
-- 1) Protect sensitive profile fields from user updates (extend existing protect_plan_field)
CREATE OR REPLACE FUNCTION public.protect_billing_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    NEW.plan := OLD.plan;
    NEW.status := OLD.status;
    NEW.stripe_customer_id := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.subscription_date := OLD.subscription_date;
    NEW.last_payment_date := OLD.last_payment_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_billing_fields_trigger ON public.profiles;
CREATE TRIGGER protect_billing_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_fields();

-- 2) Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.protect_plan_field() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_default_plan() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.protect_billing_fields() FROM anon, authenticated, public;

-- 3) Realtime authorization — users may only subscribe to topics scoped to their own user id
DROP POLICY IF EXISTS "Users can only subscribe to their own topic" ON realtime.messages;
CREATE POLICY "Users can only subscribe to their own topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (SELECT realtime.topic()) = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can only broadcast to their own topic" ON realtime.messages;
CREATE POLICY "Users can only broadcast to their own topic"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT realtime.topic()) = auth.uid()::text
);
