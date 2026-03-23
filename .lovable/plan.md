

## Plano: Migrar ADMIN_PHONE para ADMIN_PHONES

### 1. Criar secret ADMIN_PHONES
- Valor: `554784566364,5548999844528,5547996741878`
- Substituirá o antigo `ADMIN_PHONE`

### 2. Atualizar webhook para suportar múltiplos admins
- Arquivo: `supabase/functions/whatsapp-webhook/index.ts`
- Trocar leitura de `ADMIN_PHONE` por `ADMIN_PHONES`
- Fazer split por vírgula e verificar se o remetente está na lista

```typescript
// Antes (linha ~350):
const adminPhone = Deno.env.get("ADMIN_PHONE") || "554784566364";
if (remotePhone !== adminPhone) {

// Depois:
const adminPhones = (Deno.env.get("ADMIN_PHONES") || "")
  .split(",")
  .map(p => p.trim())
  .filter(Boolean);
if (!adminPhones.includes(remotePhone)) {
```

### 3. Redeploy da função

### Detalhes técnicos
- Os 3 números terão mensagens ilimitadas (sem checagem de limite)
- Nenhuma outra alteração necessária

