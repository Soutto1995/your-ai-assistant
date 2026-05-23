
-- 1) Fix handle_new_user search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, plan)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), ''),
    NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', ''), ''),
    'FREE'
  );
  RETURN NEW;
END;
$function$;

-- 2) Attach protect_billing_fields trigger to profiles so users can't change billing/plan fields
DROP TRIGGER IF EXISTS protect_billing_fields_trigger ON public.profiles;
CREATE TRIGGER protect_billing_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_billing_fields();

-- 3) Attach enforce_default_plan trigger to profiles on insert
DROP TRIGGER IF EXISTS enforce_default_plan_trigger ON public.profiles;
CREATE TRIGGER enforce_default_plan_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_default_plan();

-- 4) Restrictive policies to block UPDATE/DELETE on referrals for non-service-role
CREATE POLICY "Block client updates on referrals"
ON public.referrals
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false);

CREATE POLICY "Block client deletes on referrals"
ON public.referrals
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);

-- 5) Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated so they can't be called from client
REVOKE EXECUTE ON FUNCTION public.update_user_plan(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_pending_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_default_plan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_billing_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_plan_field() FROM PUBLIC, anon, authenticated;
