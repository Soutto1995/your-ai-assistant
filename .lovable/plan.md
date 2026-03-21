

## Problema Identificado: AUTHENTICATION_API_KEY no Railway = `voce-a!`

Nos seus prints, ao revelar o valor de `AUTHENTICATION_API_KEY` no Railway, aparece **`voce-a!`**. Esse é o valor que a Evolution API usa para autenticar requisições.

No Supabase, o secret `EVOLUTION_API_KEY` foi configurado com `c79eeae212b4...` -- por isso o envio de mensagens falha com **401 Unauthorized**. A Evolution API espera `voce-a!`, mas recebe `c79eeae...`.

### Problema secundário

`voce-a!` parece ser uma senha placeholder muito fraca. Recomendo fortemente trocar por uma chave segura tanto no Railway quanto no Supabase.

### Plano de execução

1. **Atualizar `EVOLUTION_API_KEY` no Supabase** para o valor que está no Railway (`voce-a!`) -- ou, preferencialmente, gerar uma chave forte e atualizar nos dois lugares
2. **Re-deploy da Edge Function** para capturar o novo valor
3. **Testar envio** com curl para confirmar que a resposta chega pelo WhatsApp

### Recomendação de segurança

Se `voce-a!` realmente é sua AUTHENTICATION_API_KEY:
- Vá no Railway, edite `AUTHENTICATION_API_KEY` para uma chave forte (ex: gere um UUID ou hash)
- Atualize o mesmo valor no Supabase como `EVOLUTION_API_KEY`
- Faça redeploy no Railway para aplicar

### Decisão necessária

Você quer que eu:
- **Opção A**: Atualize o secret no Supabase para `voce-a!` (funciona imediatamente, mas chave fraca)
- **Opção B**: Você primeiro troca a chave no Railway por uma segura e me passa o novo valor

