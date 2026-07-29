-- Cobrança de terceiros: o Tuddo passa a cobrar outras pessoas pelas tarefas,
-- em vez de só lembrar o próprio dono da conta.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assignee_name    text,
  ADD COLUMN IF NOT EXISTS assignee_phone   text,
  ADD COLUMN IF NOT EXISTS recurrence       text,
  ADD COLUMN IF NOT EXISTS last_charged_at  timestamptz,
  ADD COLUMN IF NOT EXISTS charge_count     integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurrence_check'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_recurrence_check
      CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekdays', 'weekly', 'monthly'));
  END IF;
END $$;

-- O telefone é guardado só em dígitos (55DDD9XXXXXXXX) para bater com o
-- formato que o webhook já usa em buildPhoneVariants.
CREATE INDEX IF NOT EXISTS tasks_assignee_phone_idx
  ON public.tasks (assignee_phone)
  WHERE assignee_phone IS NOT NULL;

-- Índice da varredura horária do cobrador
CREATE INDEX IF NOT EXISTS tasks_chase_due_idx
  ON public.tasks (due_date)
  WHERE assignee_phone IS NOT NULL AND status = 'pendente';
