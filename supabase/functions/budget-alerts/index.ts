import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sendWhatsAppMessage(evolutionUrl: string, instanceName: string, apiKey: string, phone: string, message: string): Promise<void> {
  const url = `${evolutionUrl}/message/sendText/${instanceName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apiKey },
    body: JSON.stringify({ number: phone, text: message }),
  });
  if (!response.ok) {
    console.error(`Failed to send WhatsApp to ${phone}:`, await response.text());
  }
}

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const EVOLUTION_URL = Deno.env.get("EVOLUTION_API_URL") ?? "https://evolution-api-production-6070.up.railway.app";
  const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") ?? "Tuddo";
  const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") ?? "";

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
      .eq("type", "expense")
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
        await sendWhatsAppMessage(EVOLUTION_URL, EVOLUTION_INSTANCE, EVOLUTION_KEY, profile.phone, message);
        alertsSent++;
      } else if (percentage >= 80 && percentage < 100) {
        const remaining = budget.limit - spent;
        const message = `⚠️ *Atenção, ${firstName}!*\n\nVocê já usou *${percentage.toFixed(0)}%* do orçamento de *${budget.category}*.\n\n• Limite: R$ ${budget.limit.toFixed(2).replace(".", ",")}\n• Gasto: R$ ${spent.toFixed(2).replace(".", ",")}\n• Restante: R$ ${remaining.toFixed(2).replace(".", ",")}\n\nFique de olho para não ultrapassar! 💡`;
        await sendWhatsAppMessage(EVOLUTION_URL, EVOLUTION_INSTANCE, EVOLUTION_KEY, profile.phone, message);
        alertsSent++;
      }
    }
  }

  return new Response(JSON.stringify({ alertsSent }), {
    headers: { "Content-Type": "application/json" },
  });
});
