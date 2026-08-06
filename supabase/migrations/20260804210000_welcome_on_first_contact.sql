-- Orientação enviada no primeiro contato de cada cliente no WhatsApp.
--
-- Hoje a pessoa se cadastra, manda "oi" e recebe uma saudação genérica. Ela não
-- descobre o que o Tuddo faz, nem que ele NÃO é um chat de IA para conversar
-- sobre qualquer assunto. O resultado é cliente perguntando coisa fora do
-- escopo, recebendo resposta confusa e achando que o produto não funciona.
--
-- Esta coluna é a trava de "já expliquei", para a orientação não repetir a cada
-- mensagem. Mesma ideia de family_groups.instructions_sent_at, mas para todo
-- cliente, não só o titular de plano Familiar.
--
-- O envio acontece na primeira mensagem que a pessoa manda, e não no cadastro:
-- a Meta não permite mensagem proativa fora da janela de 24h sem template
-- aprovado, e muita gente se cadastra pelo site sem nunca ter falado com o bot.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz;

COMMENT ON COLUMN public.profiles.welcome_sent_at IS
  'Quando a orientação de boas-vindas foi enviada pelo WhatsApp. NULL = ainda não enviada.';

-- Quem já conversa com o Tuddo há tempos não deve receber a explicação de
-- novato como se tivesse acabado de chegar. Marca como já enviada para quem já
-- tem histórico de mensagens.
UPDATE public.profiles p
   SET welcome_sent_at = now()
 WHERE p.welcome_sent_at IS NULL
   AND EXISTS (
     SELECT 1 FROM public.inbox_messages im WHERE im.user_id = p.id
   );
