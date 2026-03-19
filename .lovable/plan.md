

## Plano: Abrir webhook para todos os clientes + atualizar número do Tuddo

### O que muda

1. **Edge Function `whatsapp-webhook/index.ts`**
   - Remover o bloco de self-chat (linhas 125-129) que restringe mensagens apenas ao próprio número
   - Adicionar filtro para ignorar mensagens de grupos (`@g.us`)
   - Extrair o número do remetente a partir de `key.participant` (para grupos, caso passe) ou `key.remoteJid`
   - Manter HMAC, limites de plano e bypass de admin intactos

2. **Secrets do Supabase** (atualizar via ferramenta)
   - `WHATSAPP_SELF_JID` → `554784566364@s.whatsapp.net`
   - `ADMIN_PHONE` → `554784566364`

3. **`src/pages/Index.tsx`**
   - Trocar `WHATSAPP_NUMBER` de `"5511999999999"` para `"554784566364"`

4. **Deploy** da edge function após as alterações

### Detalhes técnicos

No webhook, o bloco atual:
```typescript
const MY_OWN_WHATSAPP_NUMBER = Deno.env.get("WHATSAPP_SELF_JID") || "";
if (key?.fromMe !== true || key?.remoteJid !== MY_OWN_WHATSAPP_NUMBER) {
  return new Response(...);
}
```
Será substituído por:
```typescript
// Ignorar mensagens de grupos
if (key?.remoteJid?.includes("@g.us")) {
  return new Response(JSON.stringify({ status: "ignored_group_message" }), { headers: corsHeaders });
}
```

O resto do fluxo (lookup por telefone na tabela `profiles`, verificação de limites, processamento com IA) permanece igual — já funciona para qualquer número cadastrado.

### Checklist
- A função aceita mensagens de qualquer cliente cadastrado na tabela `profiles`
- Verificação HMAC continua obrigatória
- Bypass de limites para admin funciona com o novo número
- Link `wa.me` no dashboard aponta para `554784566364`
- Secrets atualizados no Supabase

