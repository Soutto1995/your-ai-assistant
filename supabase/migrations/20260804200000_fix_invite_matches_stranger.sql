-- Falha de privacidade no convite do plano Familiar.
--
-- Encontrada em varredura: convidar com um texto sem dígitos ("asdfgh", um
-- nome, um typo, ou o campo vazio) adicionava um DESCONHECIDO à família.
--
-- Por quê: sem '@', o texto vai para o ramo do telefone. regexp_replace tira
-- tudo que não é dígito e sobra ''. A busca então comparava
--
--   regexp_replace(coalesce(phone,''), '\D','','g') = ''
--
-- e casava com o primeiro perfil SEM TELEFONE cadastrado. Reproduzido: o
-- convite retornou "added" com o id de uma conta que nada tinha a ver.
--
-- O estrago seria: o estranho passaria a enxergar todas as finanças, tarefas e
-- compromissos do titular; tudo que ele lançasse cairia na conta do titular; e
-- uma vaga paga do plano seria consumida. Silenciosamente — a tela mostra
-- "Membro adicionado à família!".
--
-- Nenhuma família em produção foi afetada (só existia um grupo, com o próprio
-- titular). Correções:
--   1. telefone só é buscado com no mínimo 10 dígitos, e nunca contra perfil
--      de telefone vazio;
--   2. e-mail precisa ter cara de e-mail;
--   3. a ordem das checagens passa a ser encontrar -> já é membro -> lotado,
--      para o titular não receber "lotado" ao reconvidar quem já está dentro;
--   4. convidar a si mesmo tem resposta própria.

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

  v_contact := lower(trim(coalesce(p_contact, '')));

  IF v_contact = '' THEN
    RETURN jsonb_build_object('status','invalid');
  END IF;

  IF position('@' IN v_contact) > 0 THEN
    -- Exige algo@algo.algo. Sem isso, "a@b" viraria uma busca inútil.
    IF v_contact !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' THEN
      RETURN jsonb_build_object('status','invalid');
    END IF;
    SELECT id INTO v_user
      FROM auth.users
     WHERE lower(trim(email)) = v_contact
     LIMIT 1;
  ELSE
    v_digits := regexp_replace(v_contact, '\D', '', 'g');

    -- Um telefone brasileiro tem no mínimo DDD + 8 dígitos. Abaixo disso não é
    -- telefone: é texto digitado por engano, e buscar com isso era o que
    -- casava com perfis sem telefone.
    IF length(v_digits) < 10 THEN
      RETURN jsonb_build_object('status','invalid');
    END IF;

    -- Mesma normalização do cadastro e do webhook: sem DDI, assume Brasil.
    IF length(v_digits) IN (10, 11) THEN
      v_digits := '55' || v_digits;
    END IF;

    -- Celular antigo sem o nono dígito (55 + DDD + 8) -> acrescenta o 9.
    IF length(v_digits) = 12 AND left(v_digits, 2) = '55' THEN
      v_digits := left(v_digits, 4) || '9' || substring(v_digits from 5);
    END IF;

    SELECT id INTO v_user
      FROM public.profiles
     WHERE coalesce(btrim(phone), '') <> ''            -- trava do bug
       AND regexp_replace(phone, '\D', '', 'g') = v_digits
     LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status','not_found');
  END IF;

  IF v_user = v_owner THEN
    RETURN jsonb_build_object('status','self');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.family_members
     WHERE family_id = p_family_id AND user_id = v_user
  ) THEN
    RETURN jsonb_build_object('status','already_member','user_id',v_user);
  END IF;

  -- Só agora: quem já está dentro não deve receber "lotado".
  SELECT COUNT(*) INTO v_count FROM public.family_members WHERE family_id = p_family_id;
  IF v_count >= v_max THEN
    RETURN jsonb_build_object('status','full');
  END IF;

  INSERT INTO public.family_members(family_id, user_id, role)
    VALUES (p_family_id, v_user, 'member');

  RETURN jsonb_build_object('status','added','user_id',v_user);
END;
$function$;
