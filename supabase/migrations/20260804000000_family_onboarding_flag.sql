-- Instruções automáticas do plano Familiar.
--
-- Quem assina o Familiar não recebe nenhuma orientação sobre como incluir a
-- outra pessoa — e o passo 1 (a pessoa precisa criar a conta ANTES de ser
-- convidada) não é óbvio. Um cliente real ficou perguntando isso no WhatsApp
-- e recebeu resposta errada do bot.
--
-- O envio acontece na PRIMEIRA mensagem que o titular mandar depois de
-- assinar, não no momento do pagamento: a Meta não permite mensagem proativa
-- fora da janela de 24h sem template aprovado, e o cliente pode ter assinado
-- pelo site sem nunca ter falado com o bot.
--
-- Esta coluna é a trava de "já enviei", para não repetir a cada mensagem.

ALTER TABLE public.family_groups
  ADD COLUMN IF NOT EXISTS instructions_sent_at timestamptz;

COMMENT ON COLUMN public.family_groups.instructions_sent_at IS
  'Quando as instruções de como convidar membros foram enviadas ao titular pelo WhatsApp. NULL = ainda não enviadas.';
