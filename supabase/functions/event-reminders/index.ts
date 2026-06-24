import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tipos de eventos que merecem lembrete 1h antes
const IMPORTANT_EVENT_TYPES = [
  "consulta", "médico", "dentista", "reunião", "meeting", "evento",
  "entrevista", "exame", "cirurgia", "terapia", "psicólogo",
  "compromisso", "apresentação", "palestra", "conferência", "workshop",
  "aula", "curso", "treinamento", "jogo", "partida", "show", "cinema",
  "voo", "viagem", "embarque", "check-in", "aniversário", "casamento",
  "formatura", "cerimônia", "reunião de pais", "consult"
];

function isImportantEvent(title: string): boolean {
  const titleLower = title.toLowerCase();
  return IMPORTANT_EVENT_TYPES.some(keyword => titleLower.includes(keyword));
}

async function sendWhatsAppMessage(evolutionUrl: string, instanceName: string, apiKey: string, phone: string, message: string): Promise<void> {
  const url = `${evolutionUrl}/message/sendText/${instanceName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey,
    },
    body: JSON.stringify({
      number: phone,
      text: message,
    }),
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

  // Verificar auth — aceitar service_role key ou cron secret
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  
  if (token !== SUPABASE_SERVICE_ROLE_KEY && token !== (Deno.env.get("CRON_SECRET") ?? "")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Horário atual em BRT (UTC-3)
  const now = new Date();
  const brtNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  
  const currentHour = brtNow.getHours();
  const currentMinute = brtNow.getMinutes();
  const today = `${brtNow.getFullYear()}-${String(brtNow.getMonth() + 1).padStart(2, "0")}-${String(brtNow.getDate()).padStart(2, "0")}`;
  
  // Calcular o horário daqui a 1 hora (±10 min de tolerância)
  const targetHour = (currentHour + 1) % 24;
  const targetTimeMin = `${String(targetHour).padStart(2, "0")}:${String(Math.max(0, currentMinute - 10)).padStart(2, "0")}`;
  const targetTimeMax = `${String(targetHour).padStart(2, "0")}:${String(Math.min(59, currentMinute + 10)).padStart(2, "0")}`;

  console.log(`Checking events for today ${today} between ${targetTimeMin} and ${targetTimeMax} BRT`);

  // Buscar eventos de hoje com horário daqui a ~1 hora que ainda não receberam lembrete
  const { data: events, error } = await supabase
    .from("events")
    .select(`
      id,
      title,
      event_date,
      event_time,
      user_id,
      reminder_1h_sent
    `)
    .eq("event_date", today)
    .eq("status", "agendada")
    .gte("event_time", targetTimeMin)
    .lte("event_time", targetTimeMax)
    .not("reminder_1h_sent", "eq", true);

  if (error) {
    console.error("Error fetching events:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!events || events.length === 0) {
    console.log("No events to remind in the next hour");
    return new Response(JSON.stringify({ sent: 0, message: "No events to remind" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  const results: any[] = [];

  for (const event of events) {
    // Verificar se é um evento importante
    if (!isImportantEvent(event.title)) {
      console.log(`Skipping non-important event: ${event.title}`);
      continue;
    }

    // Buscar o perfil do usuário para obter o telefone
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, full_name, plan")
      .eq("id", event.user_id)
      .maybeSingle();

    if (!profile?.phone) {
      console.log(`No phone for user ${event.user_id}`);
      continue;
    }

    // Verificar se o plano permite lembretes (STARTER e PRO)
    if (profile.plan === "FREE") {
      console.log(`User ${event.user_id} is on FREE plan, skipping 1h reminder`);
      continue;
    }

    const firstName = profile.full_name?.split(" ")[0] || "você";
    const timeStr = event.event_time ? event.event_time.substring(0, 5) : "";
    
    const message = `⏰ *Lembrete!* Você tem um compromisso em *1 hora*:\n\n📅 *${event.title}*${timeStr ? `\n🕐 Às ${timeStr}` : ""}\n\nBoa sorte, ${firstName}! 💪`;

    try {
      await sendWhatsAppMessage(EVOLUTION_URL, EVOLUTION_INSTANCE, EVOLUTION_KEY, profile.phone, message);
      
      // Marcar como lembrete enviado
      await supabase
        .from("events")
        .update({ reminder_1h_sent: true })
        .eq("id", event.id);

      sent++;
      results.push({ event_id: event.id, title: event.title, phone: profile.phone });
      console.log(`1h reminder sent for event: ${event.title} to ${profile.phone}`);
    } catch (err) {
      console.error(`Failed to send reminder for event ${event.id}:`, err);
    }
  }

  return new Response(JSON.stringify({ sent, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
