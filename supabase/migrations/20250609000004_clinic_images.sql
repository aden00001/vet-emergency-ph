-- Listing photos and Google Maps metadata from CSV imports

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

COMMENT ON COLUMN public.clinics.image_url IS 'Primary listing photo URL (e.g. from Google Maps export)';
COMMENT ON COLUMN public.clinics.google_maps_url IS 'Canonical Google Maps place URL';

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
  average_rating NUMERIC,
  image_url TEXT,
  google_maps_url TEXT
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
    rev.average_rating,
    c.image_url,
    c.google_maps_url
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
