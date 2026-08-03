-- Convite de familiar por telefone não funcionava.
--
-- O cadastro normaliza o telefone para 55DDD9XXXXXXXX (13 dígitos), mas o
-- convite comparava os dígitos crus do que o titular digitou. Como o próprio
-- campo do app sugere "(47) 99999-9999", o titular digitava 11 dígitos e a
-- comparação com os 13 armazenados nunca casava — o convite retornava
-- "usuário não encontrado" mesmo com a pessoa cadastrada.
--
-- Confirmado: '(47) 99604-7084' -> 47996047084 (11) vs 5547996047084 (13).
--
-- Agora o convite normaliza igual ao cadastro e ao webhook do WhatsApp, e
-- também aceita o e-mail com espaços/maiúsculas.

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

  IF position('@' IN v_contact) > 0 THEN
    SELECT id INTO v_user FROM auth.users WHERE lower(trim(email)) = v_contact LIMIT 1;
  ELSE
    v_digits := regexp_replace(v_contact, '\D', '', 'g');

    -- Mesma normalização do cadastro e do webhook: sem DDI, assume Brasil.
    IF length(v_digits) IN (10, 11) THEN
      v_digits := '55' || v_digits;
    END IF;

    -- Celular antigo sem o nono dígito (55 + DDD + 8) -> acrescenta o 9.
    IF length(v_digits) = 12 AND left(v_digits, 2) = '55' THEN
      v_digits := left(v_digits, 4) || '9' || substring(v_digits from 5);
    END IF;

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
