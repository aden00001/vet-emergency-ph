-- Clinic reviews (community feedback distinct from real-time pulse verifications)

CREATE TYPE public.review_status AS ENUM ('published', 'pending', 'hidden');

CREATE TABLE public.clinic_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL CHECK (char_length(body) >= 20 AND char_length(body) <= 2000),
  reviewer_name TEXT NOT NULL DEFAULT 'Pet owner'
    CHECK (char_length(trim(reviewer_name)) >= 1 AND char_length(reviewer_name) <= 40),
  experience_tags TEXT[] NOT NULL DEFAULT '{}',
  status public.review_status NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX clinic_reviews_clinic_published_idx
  ON public.clinic_reviews (clinic_id, created_at DESC)
  WHERE status = 'published';

CREATE UNIQUE INDEX clinic_reviews_user_clinic_unique
  ON public.clinic_reviews (user_id, clinic_id)
  WHERE user_id IS NOT NULL;

CREATE TRIGGER clinic_reviews_updated_at
  BEFORE UPDATE ON public.clinic_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One review per authenticated user per clinic
CREATE OR REPLACE FUNCTION public.check_review_user_unique()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clinic_reviews
    WHERE clinic_id = NEW.clinic_id
      AND user_id = NEW.user_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'You have already reviewed this clinic';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clinic_reviews_user_unique
  BEFORE INSERT ON public.clinic_reviews
  FOR EACH ROW EXECUTE FUNCTION public.check_review_user_unique();

ALTER TABLE public.clinic_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published reviews are publicly readable"
  ON public.clinic_reviews FOR SELECT
  USING (status = 'published');

CREATE POLICY "Authenticated users can submit reviews"
  ON public.clinic_reviews FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND status = 'published'
  );

CREATE POLICY "Clinic owners can view all reviews for their clinics"
  ON public.clinic_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics
      WHERE id = clinic_id AND claimed_by = auth.uid()
    )
  );

-- Extend nearby search with review aggregates
DROP FUNCTION IF EXISTS public.nearby_emergency_clinics(
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  DOUBLE PRECISION,
  TEXT,
  BOOLEAN
);

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
  rank_score DOUBLE PRECISION,
  review_count BIGINT,
  average_rating NUMERIC
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
      - CASE WHEN COALESCE(rev.review_count, 0) >= 3 THEN 1.5 ELSE 0 END
      - CASE WHEN COALESCE(rev.average_rating, 0) >= 4 THEN 1 ELSE 0 END
    ) AS rank_score,
    COALESCE(rev.review_count, 0) AS review_count,
    rev.average_rating
  FROM public.clinics c
  LEFT JOIN public.clinic_status cs ON cs.clinic_id = c.id
  LEFT JOIN (
    SELECT
      clinic_id,
      COUNT(*)::BIGINT AS review_count,
      ROUND(AVG(rating)::numeric, 1) AS average_rating
    FROM public.clinic_reviews
    WHERE status = 'published'
    GROUP BY clinic_id
  ) rev ON rev.clinic_id = c.id
  WHERE extensions.ST_DWithin(c.location, v_origin, p_radius_km * 1000)
    AND (NOT p_emergency_only OR c.emergency_capable = TRUE)
  ORDER BY rank_score ASC, distance_meters ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.nearby_emergency_clinics TO anon, authenticated;
