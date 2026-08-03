-- Conserta dois problemas reais confirmados por teste na logística de Planos
-- Familiares:
--
-- 1) O app web nunca compartilhava nada entre titular e membros — só o
--    WhatsApp compartilhava (o webhook redireciona manualmente o userId pro
--    titular antes de inserir). Testado com titular+membro reais: o membro
--    não via os lançamentos do titular pelo app, e o que ele criava pelo app
--    ficava isolado, invisível pro titular. As políticas de RLS de
--    transactions/tasks/events/budgets/goals/projects/folders/files/
--    recurring_transactions eram todas "auth.uid() = user_id", sem exceção
--    pra família.
--
-- 2) Cancelar a assinatura do titular nunca desfazia o family_groups nem
--    removia os membros. Testado: depois do "cancelamento" (update_user_plan
--    pra FREE), a query que o webhook do WhatsApp usa pro membro ainda
--    resolvia pro titular com userPlan="PRO" — acesso ilimitado nunca era
--    revogado.

-- ── 1) Compartilhamento de dados via redirecionamento automático ───────────
--
-- family_effective_owner(uid): se uid é membro de uma família, devolve o
-- titular; senão devolve o próprio uid. Nunca retorna NULL — seguro pra usar
-- direto em RLS e em triggers.
CREATE OR REPLACE FUNCTION public.family_effective_owner(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT fg.owner_id
       FROM public.family_members fm
       JOIN public.family_groups fg ON fg.id = fm.family_id
      WHERE fm.user_id = p_user_id
      LIMIT 1),
    p_user_id
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.family_effective_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_effective_owner(uuid) TO authenticated, service_role;

-- Trigger BEFORE INSERT: reescreve NEW.user_id para o titular quando quem
-- está inserindo é um membro. Transparente para o front-end (que continua
-- mandando user_id = usuário logado) e inofensivo para o webhook do
-- WhatsApp (que já manda o id do titular — a função é um ponto fixo nesse
-- caso, não faz nada).
CREATE OR REPLACE FUNCTION public.redirect_to_family_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.user_id := public.family_effective_owner(NEW.user_id);
  RETURN NEW;
END;
$function$;

-- Só deve rodar via trigger, nunca chamada direta (RPC).
REVOKE EXECUTE ON FUNCTION public.redirect_to_family_owner() FROM PUBLIC, anon, authenticated;

-- Aplica o trigger + políticas de RLS "family-aware" nas tabelas de dados
-- compartilháveis. Padrão repetido por tabela:
--   SELECT/UPDATE/DELETE: user_id = family_effective_owner(auth.uid())
--   INSERT: mesma condição (avaliada DEPOIS do trigger reescrever NEW.user_id)

-- transactions
DROP TRIGGER IF EXISTS redirect_family_owner_trigger ON public.transactions;
CREATE TRIGGER redirect_family_owner_trigger
  BEFORE INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.redirect_to_family_owner();

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions" ON public.transactions
  FOR INSERT WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions" ON public.transactions
  FOR UPDATE USING (user_id = public.family_effective_owner(auth.uid()))
  WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions" ON public.transactions
  FOR DELETE USING (user_id = public.family_effective_owner(auth.uid()));

-- tasks
DROP TRIGGER IF EXISTS redirect_family_owner_trigger ON public.tasks;
CREATE TRIGGER redirect_family_owner_trigger
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.redirect_to_family_owner();

DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks" ON public.tasks
  FOR SELECT USING (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
CREATE POLICY "Users can insert own tasks" ON public.tasks
  FOR INSERT WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks" ON public.tasks
  FOR UPDATE USING (user_id = public.family_effective_owner(auth.uid()))
  WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks" ON public.tasks
  FOR DELETE USING (user_id = public.family_effective_owner(auth.uid()));

-- events
DROP TRIGGER IF EXISTS redirect_family_owner_trigger ON public.events;
CREATE TRIGGER redirect_family_owner_trigger
  BEFORE INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.redirect_to_family_owner();

DROP POLICY IF EXISTS "Users can view own events" ON public.events;
CREATE POLICY "Users can view own events" ON public.events
  FOR SELECT USING (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own events" ON public.events;
CREATE POLICY "Users can insert own events" ON public.events
  FOR INSERT WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can update own events" ON public.events;
CREATE POLICY "Users can update own events" ON public.events
  FOR UPDATE USING (user_id = public.family_effective_owner(auth.uid()))
  WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own events" ON public.events;
CREATE POLICY "Users can delete own events" ON public.events
  FOR DELETE USING (user_id = public.family_effective_owner(auth.uid()));

-- budgets
DROP TRIGGER IF EXISTS redirect_family_owner_trigger ON public.budgets;
CREATE TRIGGER redirect_family_owner_trigger
  BEFORE INSERT ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.redirect_to_family_owner();

DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
CREATE POLICY "Users can view own budgets" ON public.budgets
  FOR SELECT USING (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE USING (user_id = public.family_effective_owner(auth.uid()))
  WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;
CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE USING (user_id = public.family_effective_owner(auth.uid()));

-- goals (política única ALL)
DROP TRIGGER IF EXISTS redirect_family_owner_trigger ON public.goals;
CREATE TRIGGER redirect_family_owner_trigger
  BEFORE INSERT ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.redirect_to_family_owner();

DROP POLICY IF EXISTS "Users can manage their own goals" ON public.goals;
CREATE POLICY "Users can manage their own goals" ON public.goals
  FOR ALL USING (user_id = public.family_effective_owner(auth.uid()))
  WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

-- projects
DROP TRIGGER IF EXISTS redirect_family_owner_trigger ON public.projects;
CREATE TRIGGER redirect_family_owner_trigger
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.redirect_to_family_owner();

DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (user_id = public.family_effective_owner(auth.uid()))
  WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (user_id = public.family_effective_owner(auth.uid()));

-- folders (política única ALL — mantém a de service_role intacta)
DROP TRIGGER IF EXISTS redirect_family_owner_trigger ON public.folders;
CREATE TRIGGER redirect_family_owner_trigger
  BEFORE INSERT ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.redirect_to_family_owner();

DROP POLICY IF EXISTS "Users can manage own folders" ON public.folders;
CREATE POLICY "Users can manage own folders" ON public.folders
  FOR ALL USING (user_id = public.family_effective_owner(auth.uid()))
  WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

-- files (drive — o WhatsApp já compartilha via redirecionamento manual no
-- webhook; isso só estende a mesma visibilidade pro app)
DROP TRIGGER IF EXISTS redirect_family_owner_trigger ON public.files;
CREATE TRIGGER redirect_family_owner_trigger
  BEFORE INSERT ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.redirect_to_family_owner();

DROP POLICY IF EXISTS "Users can view own files" ON public.files;
CREATE POLICY "Users can view own files" ON public.files
  FOR SELECT USING (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
CREATE POLICY "Users can insert own files" ON public.files
  FOR INSERT WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can update own files" ON public.files;
CREATE POLICY "Users can update own files" ON public.files
  FOR UPDATE USING (user_id = public.family_effective_owner(auth.uid()))
  WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own files" ON public.files;
CREATE POLICY "Users can delete own files" ON public.files
  FOR DELETE USING (user_id = public.family_effective_owner(auth.uid()));

-- recurring_transactions
DROP TRIGGER IF EXISTS redirect_family_owner_trigger ON public.recurring_transactions;
CREATE TRIGGER redirect_family_owner_trigger
  BEFORE INSERT ON public.recurring_transactions
  FOR EACH ROW EXECUTE FUNCTION public.redirect_to_family_owner();

DROP POLICY IF EXISTS "Users can view own recurring" ON public.recurring_transactions;
CREATE POLICY "Users can view own recurring" ON public.recurring_transactions
  FOR SELECT USING (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own recurring" ON public.recurring_transactions;
CREATE POLICY "Users can insert own recurring" ON public.recurring_transactions
  FOR INSERT WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can update own recurring" ON public.recurring_transactions;
CREATE POLICY "Users can update own recurring" ON public.recurring_transactions
  FOR UPDATE USING (user_id = public.family_effective_owner(auth.uid()))
  WITH CHECK (user_id = public.family_effective_owner(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own recurring" ON public.recurring_transactions;
CREATE POLICY "Users can delete own recurring" ON public.recurring_transactions
  FOR DELETE USING (user_id = public.family_effective_owner(auth.uid()));

-- ── 2) Revoga o grupo familiar quando o titular deixa de ter plano Familiar ─
--
-- Cobre tanto cancelamento total (customer.subscription.deleted -> FREE)
-- quanto downgrade direto pra um plano individual (STARTER/PRO) via checkout
-- — em ambos os casos update_user_plan é chamado com um p_plan que não é
-- FAMILY_*, e isso agora derruba o family_groups e remove todo mundo,
-- revogando o acesso ilimitado no WhatsApp imediatamente.
CREATE OR REPLACE FUNCTION public.update_user_plan(p_user_id uuid, p_plan text, p_stripe_customer_id text DEFAULT NULL::text, p_stripe_subscription_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_family_id uuid;
BEGIN
  SET LOCAL request.jwt.claim.role = 'service_role';

  IF p_plan = 'FREE' THEN
    UPDATE profiles SET plan = 'FREE', stripe_subscription_id = NULL, status = 'canceled' WHERE id = p_user_id;
  ELSE
    UPDATE profiles SET plan = p_plan, stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id), stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id), subscription_date = NOW(), last_payment_date = NOW(), status = 'active' WHERE id = p_user_id;
  END IF;

  IF p_plan NOT LIKE 'FAMILY_%' THEN
    SELECT id INTO v_family_id FROM family_groups WHERE owner_id = p_user_id;
    IF v_family_id IS NOT NULL THEN
      DELETE FROM family_members WHERE family_id = v_family_id;
      DELETE FROM family_groups WHERE id = v_family_id;
    END IF;
  END IF;
END;
$function$;
