
-- Update budget enforcement to treat FAMILY_* as unlimited
CREATE OR REPLACE FUNCTION public.enforce_budget_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_plan TEXT;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO user_plan FROM public.profiles WHERE id = NEW.user_id;
  IF user_plan IS NULL THEN user_plan := 'FREE'; END IF;

  max_allowed := CASE
    WHEN user_plan = 'FREE' THEN 0
    WHEN user_plan = 'STARTER' THEN 3
    WHEN user_plan = 'PRO' THEN 2147483647
    WHEN user_plan LIKE 'FAMILY%' THEN 2147483647
    ELSE 0
  END;

  SELECT COUNT(*) INTO current_count FROM public.budgets WHERE user_id = NEW.user_id;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Limite de orçamentos atingido para o plano %. Faça upgrade para criar mais.', user_plan
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_transaction_plan_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  max_allowed := CASE
    WHEN user_plan = 'FREE' THEN 20
    WHEN user_plan = 'STARTER' THEN 200
    WHEN user_plan = 'PRO' THEN 2147483647
    WHEN user_plan LIKE 'FAMILY%' THEN 2147483647
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
$function$;

-- RPC: invite_family_member — owner-only; finds a user by email (auth.users) or phone (profiles) and adds them to family_members.
-- Returns json: { status: 'added' | 'already_member' | 'not_found' | 'full', user_id?: uuid }
CREATE OR REPLACE FUNCTION public.invite_family_member(p_family_id uuid, p_contact text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_max integer;
  v_count integer;
  v_user uuid;
  v_contact text;
  v_digits text;
BEGIN
  SELECT owner_id, max_members INTO v_owner, v_max
    FROM public.family_groups WHERE id = p_family_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Família não encontrada';
  END IF;
  IF v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Apenas o titular pode convidar membros';
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.family_members WHERE family_id = p_family_id;
  IF v_count >= v_max THEN
    RETURN jsonb_build_object('status','full');
  END IF;

  v_contact := lower(trim(p_contact));

  -- Try email lookup
  IF position('@' IN v_contact) > 0 THEN
    SELECT id INTO v_user FROM auth.users WHERE lower(email) = v_contact LIMIT 1;
  ELSE
    -- Phone: strip non-digits and match against profiles.phone (also stripped)
    v_digits := regexp_replace(v_contact, '\D', '', 'g');
    SELECT id INTO v_user FROM public.profiles
     WHERE regexp_replace(coalesce(phone,''), '\D', '', 'g') = v_digits
     LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.family_members WHERE family_id = p_family_id AND user_id = v_user) THEN
    RETURN jsonb_build_object('status','already_member','user_id',v_user);
  END IF;

  INSERT INTO public.family_members(family_id, user_id, role)
    VALUES (p_family_id, v_user, 'member');

  RETURN jsonb_build_object('status','added','user_id',v_user);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.invite_family_member(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_family_member(uuid, text) TO authenticated;

-- Helper: get member profile info (name, phone) visible to the owner
CREATE OR REPLACE FUNCTION public.get_family_members(p_family_id uuid)
RETURNS TABLE(user_id uuid, full_name text, phone text, role text, joined_at timestamptz, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.family_groups
     WHERE id = p_family_id
       AND (owner_id = auth.uid()
            OR id IN (SELECT family_id FROM public.family_members WHERE user_id = auth.uid()))
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT fm.user_id, p.full_name, p.phone, fm.role, fm.joined_at, u.email::text
    FROM public.family_members fm
    LEFT JOIN public.profiles p ON p.id = fm.user_id
    LEFT JOIN auth.users u ON u.id = fm.user_id
   WHERE fm.family_id = p_family_id
   ORDER BY fm.joined_at;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_family_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_family_members(uuid) TO authenticated;
