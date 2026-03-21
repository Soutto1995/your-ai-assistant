

## Diagnóstico Completo

### Configuração da Evolution API: CORRETA ✅
- Webhook habilitado, URL correta, MESSAGES_UPSERT ativado

### Problema encontrado: 3 secrets FALTANDO no Supabase

A Edge Function precisa de 6 variáveis de ambiente. Atualmente só existem 3 das 6 necessárias:

| Secret | Status | Valor necessário |
|--------|--------|-----------------|
| EVOLUTION_API_KEY | **FALTANDO** | `c79eeae212b4ba58eb7c3ef0286c7bc37e5e49a3b885368f30dc8713011cec65` |
| EVOLUTION_API_URL | **FALTANDO** | `http://evolution-api-production-6070.up.railway.app` |
| OPENAI_API_KEY | **FALTANDO** | (sua chave da OpenAI) |
| EVOLUTION_API_INSTANCE_TOKEN | OK | — |
| EVOLUTION_API_WEBHOOK_SECRET | OK | — |
| EVOLUTION_API_INSTANCE_NAME | OK | — |

Sem `EVOLUTION_API_KEY`, a autenticação falha → "Unauthorized request - rejecting" (exatamente o que aparece nos logs).
Sem `EVOLUTION_API_URL`, a função não consegue enviar respostas pelo WhatsApp.
Sem `OPENAI_API_KEY`, a IA não processa as mensagens.

### Perfis no banco (para referência)

- Bruno: `5547999844528`
- Bruno Soutto: `5548999844528`
- Ana Paula: `47996741878`

### Plano de execução

1. **Adicionar os 3 secrets faltantes** (`EVOLUTION_API_KEY`, `EVOLUTION_API_URL`, `OPENAI_API_KEY`) via ferramenta de secrets
2. **Re-deploy da Edge Function** para que ela capture os novos secrets
3. **Testar com curl** simulando uma mensagem real para confirmar que tudo funciona

Nenhuma alteração de código é necessária — o código está correto, só faltam as variáveis de ambiente.

