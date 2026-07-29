-- Agenda o cobrador de tarefas (chase-tasks) de hora em hora.
--
-- PRÉ-REQUISITO (rodar UMA vez, manualmente, antes desta migration):
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--
-- O segredo fica no Vault em vez de literal no arquivo de migration — a chave
-- de service_role dá acesso total ao banco e não pode ficar versionada no git.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('chase-tasks-hourly')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'chase-tasks-hourly');

SELECT cron.schedule(
  'chase-tasks-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jwxrtnleqdvzvoywzqir.supabase.co/functions/v1/chase-tasks',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
