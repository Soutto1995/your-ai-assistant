import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sendWhatsAppMessage(evolutionUrl: string, instanceName: string, apiKey: string, phone: string, message: string): Promise<void> {
  const url = `${evolutionUrl}/message/sendText/${instanceName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({ number: phone, text: message }),
  });
  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to send WhatsApp message to ${phone}:`, error);
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
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Calcular semana passada (segunda a domingo)
  const now = new Date();
  const brtNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dayOfWeek = brtNow.getDay(); // 0=domingo, 1=segunda
  
  // Semana passada: segunda-feira até domingo
  const lastMonday = new Date(brtNow);
  lastMonday.setDate(brtNow.getDate() - dayOfWeek - 6);
  const lastSunday = new Date(brtNow);
  lastSunday.setDate(brtNow.getDate() - dayOfWeek);

  const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const startDate = formatDate(lastMonday);
  const endDate = formatDate(lastSunday);

  // Calcular semana atual (para compromissos)
  const thisMonday = new Date(brtNow);
  thisMonday.setDate(brtNow.getDate() - dayOfWeek + 1);
  const thisSunday = new Date(thisMonday);
  thisSunday.setDate(thisMonday.getDate() + 6);
  const weekStart = formatDate(thisMonday);
  const weekEnd = formatDate(thisSunday);

  // Buscar todos os usuários STARTER e PRO com telefone
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, phone, plan")
    .in("plan", ["STARTER", "PRO", "FAMILY_2", "FAMILY_3", "FAMILY_4"])
    .not("phone", "is", null);

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;

  for (const profile of profiles) {
    if (!profile.phone) continue;

    try {
      // Gastos da semana passada por categoria
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount, type, category, description")
        .eq("user_id", profile.id)
        .eq("type", "expense")
        .gte("date", startDate)
        .lte("date", endDate);

      // Receitas da semana passada
      const { data: incomes } = await supabase
        .from("transactions")
        .select("amount")
        .eq("user_id", profile.id)
        .eq("type", "income")
        .gte("date", startDate)
        .lte("date", endDate);

      // Compromissos desta semana
      const { data: events } = await supabase
        .from("events")
        .select("title, event_date, event_time")
        .eq("user_id", profile.id)
        .eq("status", "agendada")
        .gte("event_date", weekStart)
        .lte("event_date", weekEnd)
        .order("event_date", { ascending: true })
        .limit(5);

      // Tarefas pendentes
      const { data: tasks } = await supabase
        .from("tasks")
        .select("title, due_date")
        .eq("user_id", profile.id)
        .eq("status", "pending")
        .limit(3);

      // Calcular totais
      const totalExpense = (transactions || []).reduce((sum, t) => sum + Number(t.amount), 0);
      const totalIncome = (incomes || []).reduce((sum, t) => sum + Number(t.amount), 0);

      // Top 3 categorias de gastos
      const categoryTotals: Record<string, number> = {};
      for (const t of transactions || []) {
        const cat = t.category || "Outros";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
      }
      const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      const firstName = profile.full_name?.split(" ")[0] || "você";

      // Montar mensagem
      let message = `📊 *Resumo da semana, ${firstName}!*\n\n`;

      if (totalExpense > 0 || totalIncome > 0) {
        message += `💰 *Semana passada:*\n`;
        if (totalExpense > 0) {
          message += `• Gastos: *R$ ${totalExpense.toFixed(2).replace(".", ",")}*\n`;
        }
        if (totalIncome > 0) {
          message += `• Receitas: *R$ ${totalIncome.toFixed(2).replace(".", ",")}*\n`;
        }
        if (totalExpense > 0 && totalIncome > 0) {
          const balance = totalIncome - totalExpense;
          const balanceStr = balance >= 0 ? `+R$ ${balance.toFixed(2).replace(".", ",")}` : `-R$ ${Math.abs(balance).toFixed(2).replace(".", ",")}`;
          message += `• Saldo: *${balanceStr}*\n`;
        }

        if (topCategories.length > 0) {
          message += `\n📌 *Maiores gastos:*\n`;
          for (const [cat, val] of topCategories) {
            message += `• ${cat}: R$ ${val.toFixed(2).replace(".", ",")}\n`;
          }
        }
        message += "\n";
      } else {
        message += `Você não registrou nenhuma movimentação na semana passada. Lembre-se de me contar seus gastos! 😊\n\n`;
      }

      if (events && events.length > 0) {
        message += `📅 *Compromissos desta semana:*\n`;
        for (const event of events) {
          const dateObj = new Date(event.event_date + "T12:00:00");
          const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
          const dayName = dayNames[dateObj.getDay()];
          const timeStr = event.event_time ? ` às ${event.event_time.substring(0, 5)}` : "";
          message += `• ${dayName}: ${event.title}${timeStr}\n`;
        }
        message += "\n";
      }

      if (tasks && tasks.length > 0) {
        message += `✅ *Tarefas pendentes:*\n`;
        for (const task of tasks) {
          message += `• ${task.title}\n`;
        }
        message += "\n";
      }

      message += `Tenha uma ótima semana! 🚀`;

      await sendWhatsAppMessage(EVOLUTION_URL, EVOLUTION_INSTANCE, EVOLUTION_KEY, profile.phone, message);
      sent++;
      console.log(`Weekly summary sent to ${profile.phone}`);
    } catch (err) {
      console.error(`Error sending weekly summary to ${profile.phone}:`, err);
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
