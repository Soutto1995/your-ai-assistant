-- Corrige DOIS bugs reais confirmados por teste em claim_pending_payment()
-- (trigger que ativa o plano quando um cliente paga sem estar logado e depois
-- se cadastra com o mesmo e-mail):
--
-- 1) PERFORM update_user_plan(NEW.id::text, ...) — a função espera p_user_id
--    uuid, e o cast explícito para text quebra a resolução do overload
--    (ERROR 42883: function update_user_plan(text, unknown, unknown, unknown)
--    does not exist). O EXCEPTION WHEN OTHERS engolia esse erro em silêncio.
--
-- 2) IF pending IS NOT NULL THEN — clássica pegadinha do Postgres: para um
--    tipo composto (RECORD), "IS NOT NULL" só é verdadeiro se TODOS os campos
--    forem não-nulos. Como claimed_by/claimed_at são sempre NULL num
--    pagamento ainda não reivindicado, essa condição NUNCA era verdadeira —
--    mesmo quando o SELECT INTO encontrava a linha certa (confirmado: um
--    teste mostrou cnt_by_email=1 mas pending_found=false). Corrigido usando
--    a variável especial FOUND do PL/pgSQL, que reflete corretamente se o
--    SELECT INTO anterior retornou alguma linha.
--
-- Resultado prático de ambos os bugs combinados: NENHUM pagamento pendente
-- jamais foi ativado automaticamente no cadastro — confirmado com usuários de
-- teste reais criados via Admin API. Há pelo menos 2 clientes reais parados
-- nesse estado desde 23/05 (ver pending_payments, claimed=false).

CREATE OR REPLACE FUNCTION public.claim_pending_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pending RECORD;
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;

  IF user_email IS NOT NULL THEN
    SELECT * INTO pending FROM pending_payments
     WHERE email = user_email AND claimed = FALSE
     ORDER BY created_at DESC LIMIT 1;

    IF FOUND THEN
      PERFORM update_user_plan(NEW.id, pending.plan, pending.stripe_customer_id, pending.stripe_subscription_id);
      UPDATE pending_payments SET claimed = TRUE, claimed_by = NEW.id, claimed_at = NOW() WHERE id = pending.id;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'claim_pending_payment falhou para user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;
