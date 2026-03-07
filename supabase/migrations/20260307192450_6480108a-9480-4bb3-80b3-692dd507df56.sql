CREATE OR REPLACE FUNCTION public.enforce_default_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    NEW.plan := 'FREE';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_plan_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_default_plan();