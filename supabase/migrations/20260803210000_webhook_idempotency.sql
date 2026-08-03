-- Deduplicação de mensagens do WhatsApp (idempotência do webhook).
--
-- Problema real observado: 10 chamados de suporte duplicados para o mesmo
-- cliente, alguns criados com 2 segundos de diferença. O webhook não tinha
-- nenhuma proteção contra reprocessamento — quando a Meta/Evolution não recebe
-- o 200 a tempo, ela reenvia a mesma mensagem, e o webhook executava tudo de
-- novo do zero.
--
-- Isso não afetava só o suporte: um retry podia duplicar transações, tarefas e
-- compromissos também. Esta tabela fecha esse buraco de forma genérica.

CREATE TABLE IF NOT EXISTS public.processed_messages (
  message_id  text PRIMARY KEY,
  user_id     uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS processed_messages_created_at_idx
  ON public.processed_messages (created_at);

-- Só o service_role (o webhook) escreve aqui. Nenhum usuário precisa ler.
ALTER TABLE public.processed_messages ENABLE ROW LEVEL SECURITY;

-- Limpeza: mantém a tabela enxuta descartando registros com mais de 7 dias.
-- Uma janela de 7 dias é muito maior que qualquer retry plausível.
CREATE OR REPLACE FUNCTION public.purge_processed_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM public.processed_messages WHERE created_at < now() - interval '7 days';
$function$;

REVOKE EXECUTE ON FUNCTION public.purge_processed_messages() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('purge-processed-messages')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-processed-messages');

SELECT cron.schedule(
  'purge-processed-messages',
  '30 4 * * *',
  $$ SELECT public.purge_processed_messages(); $$
);
