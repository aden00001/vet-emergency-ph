-- Cache invalidation webhook trigger
CREATE OR REPLACE FUNCTION public.notify_cache_invalidation()
RETURNS TRIGGER AS $$
DECLARE
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
  v_url TEXT;
  v_secret TEXT;
BEGIN
  SELECT latitude, longitude INTO v_lat, v_lng
  FROM public.clinics WHERE id = COALESCE(NEW.clinic_id, OLD.clinic_id);

  IF v_lat IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_url := current_setting('app.settings.app_url', true);
  v_secret := current_setting('app.settings.webhook_secret', true);

  IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_url || '/api/cache/invalidate',
      body := jsonb_build_object('lat', v_lat, 'lng', v_lng, 'secret', v_secret),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create triggers if pg_net is available (production Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    CREATE TRIGGER verifications_cache_invalidate
      AFTER INSERT ON public.verifications
      FOR EACH ROW EXECUTE FUNCTION public.notify_cache_invalidation();

    CREATE TRIGGER clinic_status_cache_invalidate
      AFTER INSERT OR UPDATE ON public.clinic_status
      FOR EACH ROW EXECUTE FUNCTION public.notify_cache_invalidation();
  END IF;
END $$;
