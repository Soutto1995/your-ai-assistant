-- Correção de auth nos cron jobs + padronização via Vault.
--
-- Achado: quando o projeto migrou para o novo formato de API key (sb_secret_...),
-- alguns cron jobs continuaram com o JWT legado hardcoded no comando. O
-- 'budget-alerts-daily' ficava silenciosamente recebendo 401 todo dia ao meio-dia,
-- porque a edge function compara contra o valor atual de SUPABASE_SERVICE_ROLE_KEY
-- (a chave nova), não o JWT antigo.
--
-- 'monitor-whatsapp-connection' (hourly) não mandava nenhum header de autorização
-- válido — só um x-cron-secret que a função nem verifica — e é redundante com
-- 'whatsapp-connection-monitor', que já roda a cada 10 min e funciona.
--
-- PRÉ-REQUISITO: supõe que o secret 'service_role_key' já existe no Vault
-- (criado durante a implementação do chase-tasks-hourly).

-- Remove o job duplicado e quebrado.
SELECT cron.unschedule('monitor-whatsapp-connection')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitor-whatsapp-connection');

-- Recria os jobs restantes usando o Vault em vez de literal — padroniza com
-- chase-tasks-hourly e evita que uma futura rotação de chave quebre tudo de novo.
SELECT cron.unschedule('daily-reminders-6am')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-reminders-6am');
SELECT cron.schedule(
  'daily-reminders-6am',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jwxrtnleqdvzvoywzqir.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.unschedule('event-reminders-hourly')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'event-reminders-hourly');
SELECT cron.schedule(
  'event-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jwxrtnleqdvzvoywzqir.supabase.co/functions/v1/event-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.unschedule('weekly-summary-monday')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-summary-monday');
SELECT cron.schedule(
  'weekly-summary-monday',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://jwxrtnleqdvzvoywzqir.supabase.co/functions/v1/weekly-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Este era o quebrado: agora usa a chave atual via Vault em vez do JWT legado.
SELECT cron.unschedule('budget-alerts-daily')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'budget-alerts-daily');
SELECT cron.schedule(
  'budget-alerts-daily',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jwxrtnleqdvzvoywzqir.supabase.co/functions/v1/budget-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
