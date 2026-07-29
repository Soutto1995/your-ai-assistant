-- Fluxo de caixa Realizado vs Projetado.
--
-- O "realizado" já existe (transactions com data passada) e as parcelas futuras
-- também (o webhook cria uma transaction por parcela, com data à frente).
-- Faltava a peça das contas fixas — aluguel, salário, mensalidade — que são o
-- que permite antecipar compromissos em vez de descobrir no vencimento.

CREATE TABLE IF NOT EXISTS public.recurring_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description   text NOT NULL,
  amount        numeric NOT NULL CHECK (amount > 0),
  type          text NOT NULL CHECK (type IN ('gasto', 'receita')),
  category      text,
  folder_id     uuid REFERENCES public.folders(id) ON DELETE SET NULL,

  frequency     text NOT NULL DEFAULT 'monthly'
                CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  -- monthly/yearly: dia do mês (1-31). weekly: ignorado.
  day_of_month  integer CHECK (day_of_month BETWEEN 1 AND 31),
  -- weekly: 0=domingo … 6=sábado. Demais frequências: ignorado.
  day_of_week   integer CHECK (day_of_week BETWEEN 0 AND 6),
  -- yearly: mês (1-12). Demais: ignorado.
  month_of_year integer CHECK (month_of_year BETWEEN 1 AND 12),

  start_date    date NOT NULL DEFAULT CURRENT_DATE,
  end_date      date,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_transactions_user_active_idx
  ON public.recurring_transactions (user_id, active);

ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recurring" ON public.recurring_transactions;
CREATE POLICY "Users can view own recurring"
  ON public.recurring_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own recurring" ON public.recurring_transactions;
CREATE POLICY "Users can insert own recurring"
  ON public.recurring_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own recurring" ON public.recurring_transactions;
CREATE POLICY "Users can update own recurring"
  ON public.recurring_transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own recurring" ON public.recurring_transactions;
CREATE POLICY "Users can delete own recurring"
  ON public.recurring_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- ── Ocorrências previstas de uma recorrência dentro de uma janela ───────────
-- Encapsula a aritmética de calendário (dia 31 em mês de 30, etc.) para que o
-- RPC de fluxo fique legível.
CREATE OR REPLACE FUNCTION public.recurring_occurrences(
  p_user_id uuid,
  p_from    date,
  p_to      date
)
RETURNS TABLE (
  occurs_on   date,
  description text,
  amount      numeric,
  type        text,
  category    text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH bounded AS (
    SELECT r.*,
           GREATEST(p_from, r.start_date)                       AS win_from,
           LEAST(p_to, COALESCE(r.end_date, p_to))              AS win_to
      FROM public.recurring_transactions r
     WHERE r.user_id = p_user_id
       AND r.active
       AND (auth.uid() IS NULL OR auth.uid() = p_user_id)
  ),
  monthly AS (
    SELECT (date_trunc('month', gs)::date
             + (LEAST(b.day_of_month, EXTRACT(DAY FROM (date_trunc('month', gs) + interval '1 month - 1 day'))::int) - 1)) AS occurs_on,
           b.description, b.amount, b.type, b.category
      FROM bounded b
      CROSS JOIN LATERAL generate_series(
             date_trunc('month', b.win_from),
             date_trunc('month', b.win_to),
             interval '1 month') AS gs
     WHERE b.frequency = 'monthly'
       AND b.day_of_month IS NOT NULL
  ),
  weekly AS (
    SELECT gs::date AS occurs_on, b.description, b.amount, b.type, b.category
      FROM bounded b
      CROSS JOIN LATERAL generate_series(b.win_from, b.win_to, interval '1 day') AS gs
     WHERE b.frequency = 'weekly'
       AND b.day_of_week IS NOT NULL
       AND EXTRACT(DOW FROM gs)::int = b.day_of_week
  ),
  yearly AS (
    SELECT (make_date(EXTRACT(YEAR FROM gs)::int, b.month_of_year, 1)
             + (LEAST(b.day_of_month,
                      EXTRACT(DAY FROM (make_date(EXTRACT(YEAR FROM gs)::int, b.month_of_year, 1)
                                        + interval '1 month - 1 day'))::int) - 1)) AS occurs_on,
           b.description, b.amount, b.type, b.category
      FROM bounded b
      CROSS JOIN LATERAL generate_series(
             date_trunc('year', b.win_from),
             date_trunc('year', b.win_to),
             interval '1 year') AS gs
     WHERE b.frequency = 'yearly'
       AND b.month_of_year IS NOT NULL
       AND b.day_of_month IS NOT NULL
  ),
  all_occ AS (
    SELECT * FROM monthly
    UNION ALL SELECT * FROM weekly
    UNION ALL SELECT * FROM yearly
  )
  SELECT o.occurs_on, o.description, o.amount, o.type, o.category
    FROM all_occ o
   WHERE o.occurs_on BETWEEN p_from AND p_to
   ORDER BY o.occurs_on;
$function$;

REVOKE EXECUTE ON FUNCTION public.recurring_occurrences(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recurring_occurrences(uuid, date, date) TO authenticated, service_role;

-- ── Fluxo de caixa por mês: realizado até hoje, projetado daqui pra frente ──
CREATE OR REPLACE FUNCTION public.cash_flow(
  p_user_id       uuid,
  p_months_back   integer DEFAULT 3,
  p_months_ahead  integer DEFAULT 6
)
RETURNS TABLE (
  month              date,
  realized_income    numeric,
  realized_expense   numeric,
  projected_income   numeric,
  projected_expense  numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from  date;
  v_to    date;
  v_today date := CURRENT_DATE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_from := (date_trunc('month', v_today) - make_interval(months => GREATEST(p_months_back, 0)))::date;
  v_to   := (date_trunc('month', v_today) + make_interval(months => GREATEST(p_months_ahead, 0) + 1) - interval '1 day')::date;

  RETURN QUERY
  WITH months AS (
    SELECT gs::date AS month
      FROM generate_series(v_from, v_to, interval '1 month') AS gs
  ),
  -- Transações já lançadas. As de data futura (parcelas) contam como projeção.
  tx AS (
    SELECT date_trunc('month', t.transaction_date)::date AS month,
           t.type,
           t.amount,
           (t.transaction_date::date <= v_today) AS is_realized
      FROM public.transactions t
     WHERE t.user_id = p_user_id
       AND t.transaction_date::date BETWEEN v_from AND v_to
  ),
  -- Contas fixas: só projetam do dia seguinte em diante, para não duplicar o
  -- que já foi efetivamente lançado no passado.
  rec AS (
    SELECT date_trunc('month', o.occurs_on)::date AS month, o.type, o.amount
      FROM public.recurring_occurrences(p_user_id, GREATEST(v_today + 1, v_from), v_to) o
  )
  SELECT m.month,
         COALESCE(SUM(t.amount) FILTER (WHERE t.is_realized AND t.type = 'receita'), 0)::numeric,
         COALESCE(SUM(ABS(t.amount)) FILTER (WHERE t.is_realized AND t.type = 'gasto'), 0)::numeric,
         (COALESCE(SUM(t.amount) FILTER (WHERE NOT t.is_realized AND t.type = 'receita'), 0)
          + COALESCE((SELECT SUM(r.amount) FROM rec r WHERE r.month = m.month AND r.type = 'receita'), 0))::numeric,
         (COALESCE(SUM(ABS(t.amount)) FILTER (WHERE NOT t.is_realized AND t.type = 'gasto'), 0)
          + COALESCE((SELECT SUM(r.amount) FROM rec r WHERE r.month = m.month AND r.type = 'gasto'), 0))::numeric
    FROM months m
    LEFT JOIN tx t ON t.month = m.month
   GROUP BY m.month
   ORDER BY m.month;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cash_flow(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cash_flow(uuid, integer, integer) TO authenticated, service_role;
