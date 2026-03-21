
Objetivo
- Corrigir definitivamente o 401 e validar o fluxo completo do WhatsApp: receber → interpretar com IA → gravar no Supabase → responder no WhatsApp.

Diagnóstico atual (já confirmado)
- O `whatsapp-webhook` continua lendo `EVOLUTION_API_KEY` antigo (64 chars, prefixo `c79ee`).
- Teste com payload contendo `voce-a!!!!19951506` ainda retorna `{"error":"unauthorized"}`.
- Portanto, o secret novo não foi aplicado de fato no runtime da função.

Plano de execução
1) Reaplicar secret no Supabase (forçando overwrite)
- Ir em Supabase → Settings → Edge Functions → Secrets.
- Editar `EVOLUTION_API_KEY` com valor exato: `voce-a!!!!19951506` (sem aspas, sem espaços antes/depois).
- Salvar e confirmar overwrite.

2) Redeploy da função
- Fazer redeploy de `whatsapp-webhook` imediatamente após salvar o secret.

3) Teste técnico de autenticação (smoke test)
- Chamar a função com body mínimo contendo `apikey: "voce-a!!!!19951506"` e `data: {}`.
- Resultado esperado: NÃO retornar 401 (deve retornar status de fluxo, ex. `ignored_non_text`).

4) Teste ponta a ponta real
- Enviar uma mensagem de WhatsApp de um número cadastrado em `profiles`.
- Validar na ordem:
  - função recebe webhook sem `unauthorized`;
  - IA classifica intent;
  - registro em `inbox_messages` e tabela de destino (`tasks`/`transactions`/`meetings` quando aplicável);
  - resposta enviada via Evolution API.

5) Limpeza pós-correção (importante)
- Remover logs de debug sensíveis (`EVOLUTION_API_KEY length/first chars`, payload token preview) do arquivo `supabase/functions/whatsapp-webhook/index.ts`.
- Redeploy final para produção limpa e segura.

6) Contingência se ainda houver 401
- Verificar se o painel da Evolution usa outra credencial para webhook/requests (ex.: `instance token`) e alinhar também `EVOLUTION_API_INSTANCE_TOKEN`.
- Confirmar se o header aceito na Evolution está como `apikey` para envio de mensagem.
- Repetir smoke test.

Critérios de aceite
- Nenhum `Unauthorized request - rejecting` em chamadas válidas.
- Mensagem de teste gera resposta automática no WhatsApp.
- Inserções aparecem no Supabase conforme intent.
- Logs sem exposição de dados sensíveis.

Detalhes técnicos
- O bloqueio atual acontece na `verifyRequest()` antes do processamento de IA.
- A função compara tokens recebidos com `EVOLUTION_API_KEY` e `EVOLUTION_API_INSTANCE_TOKEN`.
- Como o runtime ainda mostra prefixo `c79ee`, a correção depende de sincronizar secret + redeploy efetivo.
