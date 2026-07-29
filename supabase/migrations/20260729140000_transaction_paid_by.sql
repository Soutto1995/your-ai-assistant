-- Cartão nomeado: em conta compartilhada, saber QUEM fez cada gasto.
-- Numa família ou entre sócios, os lançamentos caem todos na conta do titular
-- (o webhook redireciona para o owner_id) — sem isso, some a informação de
-- quem gastou.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_by_name    text,
  ADD COLUMN IF NOT EXISTS paid_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS card_label      text;

CREATE INDEX IF NOT EXISTS transactions_paid_by_user_idx
  ON public.transactions (user_id, paid_by_user_id)
  WHERE paid_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_paid_by_name_idx
  ON public.transactions (user_id, paid_by_name)
  WHERE paid_by_name IS NOT NULL;

-- Resumo por pessoa no período. SECURITY DEFINER com trava explícita:
-- o chamador autenticado só enxerga a própria conta (que, para membros de
-- família, é a conta do titular).
CREATE OR REPLACE FUNCTION public.spending_by_person(
  p_user_id uuid,
  p_start   timestamptz,
  p_end     timestamptz
)
RETURNS TABLE (
  person       text,
  total        numeric,
  transactions bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT COALESCE(NULLIF(t.paid_by_name, ''), 'Titular') AS person,
         SUM(t.amount)::numeric                          AS total,
         COUNT(*)::bigint                                AS transactions
    FROM public.transactions t
   WHERE t.user_id = p_user_id
     AND t.type = 'gasto'
     AND t.created_at >= p_start
     AND t.created_at < p_end
   GROUP BY 1
   ORDER BY 2 DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.spending_by_person(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spending_by_person(uuid, timestamptz, timestamptz) TO authenticated, service_role;
