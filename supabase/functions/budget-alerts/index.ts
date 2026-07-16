import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let _cachedMetaPhoneId: string | null = null;

async function getMetaPhoneId(supabase: ReturnType<typeof createClient>): Promise<string> {
  if (_cachedMetaPhoneId) return _cachedMetaPhoneId;
  const fromEnv = Deno.env.get("META_PHONE_NUMBER_ID") ?? "";
  if (fromEnv) { _cachedMetaPhoneId = fromEnv; return fromEnv; }
  try {
    const { data } = await supabase.from("system_config").select("value").eq("key", "meta_phone_number_id").single();
    if (data?.value) { _cachedMetaPhoneId = data.value; return data.value; }
  } catch { /* ignore */ }
  return "";
}

async function sendMessage(phone: string, message: string, supabase: ReturnType<typeof createClient>): Promise<void> {
  const metaToken = Deno.env.get("META_ACCESS_TOKEN") ?? "";
  const metaPhoneId = await getMetaPhoneId(supabase);

  if (metaToken && metaPhoneId) {
    const res = await fetch(`https://graph.facebook.com/v23.0/${metaPhoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${metaToken}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }),
    });
    if (!res.ok) console.error(`Meta send error to ${phone}:`, res.status, await res.text());
    return;
  }

  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") ?? "https://evolution-api-production-6070.up.railway.app";
  const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") ?? "Tuddo";
  const evolutionKey = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") ?? "";
  const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": evolutionKey },
    body: JSON.stringify({ number: phone, text: message }),
  });
  if (!res.ok) console.error(`Evolution send error to ${phone}:`, res.status, await res.text());
}

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // Auth
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Mês atual
  const now = new Date();
  const brtNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const year = brtNow.getFullYear();
  const month = brtNow.getMonth() + 1;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  // Buscar todos os usuários com orçamentos configurados
  const { data: budgets } = await supabase
    .from("budgets")
    .select("user_id, category, limit");

  if (!budgets || budgets.length === 0) {
    return new Response(JSON.stringify({ checked: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Agrupar por usuário
  const userBudgets: Record<string, { category: string; limit: number }[]> = {};
  for (const b of budgets) {
    if (!userBudgets[b.user_id]) userBudgets[b.user_id] = [];
    userBudgets[b.user_id].push({ category: b.category, limit: Number(b.limit) });
  }

  let alertsSent = 0;

  for (const [userId, userBudgetList] of Object.entries(userBudgets)) {
    // Buscar perfil
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone, plan")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.phone) continue;

    // Buscar gastos do mês por categoria
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount, category")
      .eq("user_id", userId)
      .eq("type", "gasto")
      .gte("date", startDate)
      .lte("date", endDate);

    const categorySpent: Record<string, number> = {};
    for (const t of transactions || []) {
      const cat = t.category || "Outros";
      categorySpent[cat] = (categorySpent[cat] || 0) + Number(t.amount);
    }

    const firstName = profile.full_name?.split(" ")[0] || "você";

    for (const budget of userBudgetList) {
      const spent = categorySpent[budget.category] || 0;
      const percentage = budget.limit > 0 ? (spent / budget.limit) * 100 : 0;

      // Alertar em 80% e 100%
      if (percentage >= 100) {
        const message = `🚨 *Alerta de orçamento, ${firstName}!*\n\nVocê *ultrapassou* o limite de *${budget.category}* este mês!\n\n• Limite: R$ ${budget.limit.toFixed(2).replace(".", ",")}\n• Gasto: R$ ${spent.toFixed(2).replace(".", ",")}\n• Excesso: R$ ${(spent - budget.limit).toFixed(2).replace(".", ",")}\n\nAcesse o app para revisar seus gastos. 📊`;
        await sendMessage(profile.phone, message, supabase);
        alertsSent++;
      } else if (percentage >= 80 && percentage < 100) {
        const remaining = budget.limit - spent;
        const message = `⚠️ *Atenção, ${firstName}!*\n\nVocê já usou *${percentage.toFixed(0)}%* do orçamento de *${budget.category}*.\n\n• Limite: R$ ${budget.limit.toFixed(2).replace(".", ",")}\n• Gasto: R$ ${spent.toFixed(2).replace(".", ",")}\n• Restante: R$ ${remaining.toFixed(2).replace(".", ",")}\n\nFique de olho para não ultrapassar! 💡`;
        await sendMessage(profile.phone, message, supabase);
        alertsSent++;
      }
    }
  }

  return new Response(JSON.stringify({ alertsSent }), {
    headers: { "Content-Type": "application/json" },
  });
});
