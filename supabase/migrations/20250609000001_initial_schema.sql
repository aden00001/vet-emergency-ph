-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Enums
CREATE TYPE public.clinic_status_type AS ENUM (
  'accepting',
  'limited',
  'not_accepting',
  'closed'
);

CREATE TYPE public.verification_type AS ENUM (
  'confirmed_open',
  'confirmed_closed',
  'accepting_emergencies',
  'phone_not_working'
);

CREATE TYPE public.verification_source AS ENUM (
  'community',
  'owner',
  'system'
);

CREATE TYPE public.user_role AS ENUM (
  'pet_owner',
  'clinic_admin',
  'admin'
);

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'pet_owner',
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Clinics
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  location extensions.geography(POINT, 4326) NOT NULL,
  latitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
  longitude DOUBLE PRECISION GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,
  emergency_capable BOOLEAN NOT NULL DEFAULT FALSE,
  owner_verified BOOLEAN NOT NULL DEFAULT FALSE,
  services TEXT[] NOT NULL DEFAULT '{}',
  hours TEXT,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  confidence_score SMALLINT NOT NULL DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX clinics_location_gix ON public.clinics USING GIST (location);
CREATE INDEX clinics_emergency_capable_idx ON public.clinics (emergency_capable) WHERE emergency_capable = TRUE;
CREATE INDEX clinics_claimed_by_idx ON public.clinics (claimed_by);

-- Clinic status (one row per clinic)
CREATE TABLE public.clinic_status (
  clinic_id UUID PRIMARY KEY REFERENCES public.clinics(id) ON DELETE CASCADE,
  current_status public.clinic_status_type NOT NULL DEFAULT 'accepting',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Verifications
CREATE TABLE public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_type public.verification_type NOT NULL,
  source public.verification_source NOT NULL DEFAULT 'community',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX verifications_clinic_id_created_at_idx ON public.verifications (clinic_id, created_at DESC);
CREATE INDEX verifications_user_clinic_created_idx ON public.verifications (user_id, clinic_id, created_at DESC);

-- Claim requests (manual review for MVP)
CREATE TABLE public.claim_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinic_id, user_id)
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clinics_updated_at
  BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'pet_owner')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Confidence score calculation
CREATE OR REPLACE FUNCTION public.calculate_confidence_score(p_clinic_id UUID)
RETURNS SMALLINT AS $$
DECLARE
  v_score SMALLINT := 50;
  v_owner_verified BOOLEAN;
  v_last_verification TIMESTAMPTZ;
  v_last_status_update TIMESTAMPTZ;
  v_has_owner_verification BOOLEAN;
  v_has_verifications BOOLEAN;
  v_conflicting BOOLEAN;
BEGIN
  SELECT owner_verified INTO v_owner_verified FROM public.clinics WHERE id = p_clinic_id;

  SELECT MAX(created_at) INTO v_last_verification
  FROM public.verifications WHERE clinic_id = p_clinic_id;

  SELECT updated_at INTO v_last_status_update
  FROM public.clinic_status WHERE clinic_id = p_clinic_id;

  SELECT EXISTS (
    SELECT 1 FROM public.verifications
    WHERE clinic_id = p_clinic_id AND source = 'owner'
  ) INTO v_has_owner_verification;

  SELECT EXISTS (
    SELECT 1 FROM public.verifications WHERE clinic_id = p_clinic_id
  ) INTO v_has_verifications;

  IF v_owner_verified THEN
    v_score := v_score + 30;
  END IF;

  IF v_last_verification IS NOT NULL AND v_last_verification > NOW() - INTERVAL '24 hours' THEN
    v_score := v_score + 25;
  END IF;

  IF v_last_status_update IS NOT NULL AND v_last_status_update > NOW() - INTERVAL '24 hours' THEN
    v_score := v_score + 20;
  END IF;

  IF v_has_owner_verification THEN
    v_score := v_score + 15;
  END IF;

  IF v_last_verification IS NULL OR v_last_verification < NOW() - INTERVAL '7 days' THEN
    v_score := v_score - 20;
  END IF;

  IF v_last_verification IS NULL OR v_last_verification < NOW() - INTERVAL '30 days' THEN
    v_score := v_score - 40;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.verifications v1
    JOIN public.verifications v2 ON v1.clinic_id = v2.clinic_id AND v1.id <> v2.id
    WHERE v1.clinic_id = p_clinic_id
      AND v1.created_at > NOW() - INTERVAL '48 hours'
      AND v2.created_at > NOW() - INTERVAL '48 hours'
      AND (
        (v1.verification_type = 'confirmed_open' AND v2.verification_type = 'confirmed_closed')
        OR (v1.verification_type = 'confirmed_closed' AND v2.verification_type = 'confirmed_open')
      )
  ) INTO v_conflicting;

  IF v_conflicting THEN
    v_score := v_score - 25;
  END IF;

  IF NOT v_owner_verified AND NOT v_has_verifications THEN
    v_score := v_score - 10;
  END IF;

  RETURN GREATEST(0, LEAST(100, v_score));
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.refresh_clinic_confidence_score(p_clinic_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.clinics
  SET confidence_score = public.calculate_confidence_score(p_clinic_id)
  WHERE id = p_clinic_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_all_confidence_scores()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_clinic_id UUID;
BEGIN
  FOR v_clinic_id IN SELECT id FROM public.clinics LOOP
    PERFORM public.refresh_clinic_confidence_score(v_clinic_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Refresh confidence after verification
CREATE OR REPLACE FUNCTION public.on_verification_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.refresh_clinic_confidence_score(NEW.clinic_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verifications_refresh_score
  AFTER INSERT ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.on_verification_insert();

-- Rate limit: 1 verification per user per clinic per hour
CREATE OR REPLACE FUNCTION public.check_verification_rate_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.source = 'system' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.verifications
    WHERE clinic_id = NEW.clinic_id
      AND user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '1 hour'
  ) THEN
    RAISE EXCEPTION 'Rate limit: one verification per clinic per hour';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verifications_rate_limit
  BEFORE INSERT ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.check_verification_rate_limit();

-- Nearby emergency clinics RPC
CREATE OR REPLACE FUNCTION public.nearby_emergency_clinics(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 25,
  p_triage_category TEXT DEFAULT NULL,
  p_emergency_only BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  phone TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  emergency_capable BOOLEAN,
  owner_verified BOOLEAN,
  services TEXT[],
  hours TEXT,
  confidence_score SMALLINT,
  distance_meters DOUBLE PRECISION,
  current_status public.clinic_status_type,
  status_updated_at TIMESTAMPTZ,
  rank_score DOUBLE PRECISION
) AS $$
DECLARE
  v_origin extensions.geography;
BEGIN
  v_origin := extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)::extensions.geography;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.address,
    c.phone,
    c.latitude,
    c.longitude,
    c.emergency_capable,
    c.owner_verified,
    c.services,
    c.hours,
    c.confidence_score,
    extensions.ST_Distance(c.location, v_origin) AS distance_meters,
    COALESCE(cs.current_status, 'accepting'::public.clinic_status_type) AS current_status,
    cs.updated_at AS status_updated_at,
    (
      -- Lower is better for ranking (distance-weighted)
      extensions.ST_Distance(c.location, v_origin) / 1000.0
      - (c.confidence_score * 0.05)
      - CASE COALESCE(cs.current_status, 'accepting')
          WHEN 'accepting' THEN 5
          WHEN 'limited' THEN 2
          WHEN 'not_accepting' THEN -3
          WHEN 'closed' THEN -10
        END
      - CASE WHEN p_triage_category IS NOT NULL AND p_triage_category = ANY(c.services) THEN 8 ELSE 0 END
      - CASE WHEN c.owner_verified THEN 3 ELSE 0 END
    ) AS rank_score
  FROM public.clinics c
  LEFT JOIN public.clinic_status cs ON cs.clinic_id = c.id
  WHERE extensions.ST_DWithin(c.location, v_origin, p_radius_km * 1000)
    AND (NOT p_emergency_only OR c.emergency_capable = TRUE)
  ORDER BY rank_score ASC, distance_meters ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_requests ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by owner"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Profiles are updatable by owner"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Clinics policies
CREATE POLICY "Clinics are publicly readable"
  ON public.clinics FOR SELECT
  USING (TRUE);

CREATE POLICY "Claimed clinics updatable by owner"
  ON public.clinics FOR UPDATE
  USING (claimed_by = auth.uid())
  WITH CHECK (claimed_by = auth.uid());

-- Clinic status policies
CREATE POLICY "Clinic status publicly readable"
  ON public.clinic_status FOR SELECT
  USING (TRUE);

CREATE POLICY "Clinic status updatable by owner"
  ON public.clinic_status FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE id = clinic_id AND claimed_by = auth.uid()
    )
  );

CREATE POLICY "Clinic status update by owner"
  ON public.clinic_status FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE id = clinic_id AND claimed_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE id = clinic_id AND claimed_by = auth.uid()
    )
  );

-- Verifications policies
CREATE POLICY "Verifications publicly readable"
  ON public.verifications FOR SELECT
  USING (TRUE);

-- Allow service role inserts (community pulse via API uses user_id null)
-- Community policy for authenticated users
CREATE POLICY "Authenticated users can submit community verifications"
  ON public.verifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND source = 'community'
  );

-- Service role bypasses RLS; anonymous community pulse goes through API route

CREATE POLICY "Owners can submit owner verifications"
  ON public.verifications FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND source = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.clinics
      WHERE id = clinic_id AND claimed_by = auth.uid()
    )
  );

-- Claim requests policies
CREATE POLICY "Users can view own claim requests"
  ON public.claim_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create claim requests"
  ON public.claim_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.nearby_emergency_clinics TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_confidence_scores TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_clinic_confidence_score TO service_role;
