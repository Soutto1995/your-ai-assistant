
-- Server-side enforcement of plan limits (budgets and monthly transactions)

CREATE OR REPLACE FUNCTION public.enforce_budget_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan TEXT;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Skip enforcement for service_role (webhooks, edge functions)
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO user_plan FROM public.profiles WHERE id = NEW.user_id;
  IF user_plan IS NULL THEN user_plan := 'FREE'; END IF;

  max_allowed := CASE user_plan
    WHEN 'FREE' THEN 0
    WHEN 'STARTER' THEN 3
    WHEN 'PRO' THEN 2147483647
    ELSE 0
  END;

  SELECT COUNT(*) INTO current_count FROM public.budgets WHERE user_id = NEW.user_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de orçamentos atingido para o plano %. Faça upgrade para criar mais.', user_plan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_transaction_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan TEXT;
  current_count INTEGER;
  max_allowed INTEGER;
  month_start TIMESTAMPTZ;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO user_plan FROM public.profiles WHERE id = NEW.user_id;
  IF user_plan IS NULL THEN user_plan := 'FREE'; END IF;

  max_allowed := CASE user_plan
    WHEN 'FREE' THEN 20
    WHEN 'STARTER' THEN 200
    WHEN 'PRO' THEN 2147483647
    ELSE 20
  END;

  month_start := date_trunc('month', now());

  SELECT COUNT(*) INTO current_count
    FROM public.transactions
   WHERE user_id = NEW.user_id
     AND created_at >= month_start;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite mensal de transações atingido para o plano %. Faça upgrade para registrar mais.', user_plan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_budget_plan_limit_trigger ON public.budgets;
CREATE TRIGGER enforce_budget_plan_limit_trigger
BEFORE INSERT ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.enforce_budget_plan_limit();

DROP TRIGGER IF EXISTS enforce_transaction_plan_limit_trigger ON public.transactions;
CREATE TRIGGER enforce_transaction_plan_limit_trigger
BEFORE INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_transaction_plan_limit();

-- Make sure these are not directly callable
REVOKE EXECUTE ON FUNCTION public.enforce_budget_plan_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_transaction_plan_limit() FROM PUBLIC, anon, authenticated;
