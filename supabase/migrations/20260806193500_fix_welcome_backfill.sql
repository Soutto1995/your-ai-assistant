-- Corrige o preenchimento retroativo da migração 20260804210000.
--
-- Aquela migração marcou como "já orientado" TODO perfil que tivesse qualquer
-- mensagem no histórico. O critério era grosseiro demais: um cliente que se
-- cadastrou hoje, mandou um único "Oi Tuddo!" e nunca soube o que o produto
-- faz foi tratado igual a quem já usa há meses. Ele nunca receberia a
-- orientação — exatamente quem mais precisa dela.
--
-- Caso real: Gabriel se cadastrou às 17:51, mandou uma mensagem às 17:52, e a
-- migração o marcou como orientado às 19:14. Lucilene, convidada do plano
-- Familiar, na mesma situação.
--
-- Critério corrigido: só continua marcado quem já usa de verdade (5 mensagens
-- ou mais). Abaixo disso a pessoa mal experimentou o produto e vai receber a
-- orientação no próximo contato.
--
-- A janela de horário identifica exatamente as linhas escritas pelo
-- preenchimento retroativo — quem receber a orientação de verdade daqui pra
-- frente terá outro horário e não é afetado por esta correção.

UPDATE public.profiles p
   SET welcome_sent_at = NULL
 WHERE p.welcome_sent_at BETWEEN '2026-08-06 19:14:00+00' AND '2026-08-06 19:16:00+00'
   AND (
     SELECT count(*) FROM public.inbox_messages im WHERE im.user_id = p.id
   ) < 5;
