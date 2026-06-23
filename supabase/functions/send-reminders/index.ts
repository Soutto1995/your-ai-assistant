import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsAppMessage(phone: string, text: string): Promise<void> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN");
  const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API not configured - missing env vars");
    return;
  }

  try {
    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({ number: phone, text }),
    });

    if (!response.ok) {
      console.error("Evolution send error:", response.status, await response.text());
      return;
    }
    console.log("Reminder sent to:", phone);
  } catch (error) {
    console.error("Evolution send error:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- AUTENTICAÇÃO: Aceita service_role key OU anon key (cron interno do Supabase) ---
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = authHeader?.replace("Bearer ", "");

  const isAuthorized = token && (token === serviceRoleKey || token === anonKey);
  if (!isAuthorized) {
    console.error("Unauthorized call to send-reminders");
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const today = new Date().toISOString().split("T")[0];
    // Início e fim do dia para filtrar tasks por due_date
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, phone, full_name");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return new Response(JSON.stringify({ error: "fetch_users_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ status: "no_users" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;

    for (const user of users) {
      if (!user.phone) continue;

      // Buscar events do dia E tasks com due_date de hoje
      const [eventsRes, tasksWithDateRes, tasksNoDateRes] = await Promise.all([
        supabase
          .from("events")
          .select("id, title, event_time")
          .eq("user_id", user.id)
          .eq("event_date", today),
        supabase
          .from("tasks")
          .select("id, title, due_date")
          .eq("user_id", user.id)
          .eq("status", "pendente")
          .gte("due_date", todayStart)
          .lte("due_date", todayEnd),
        supabase
          .from("tasks")
          .select("id, title")
          .eq("user_id", user.id)
          .eq("status", "pendente")
          .is("due_date", null),
      ]);

      const events = eventsRes.data || [];
      const tasksToday = tasksWithDateRes.data || [];
      const tasksNoDate = tasksNoDateRes.data || [];

      // Só envia se tiver algo relevante para o dia
      if (events.length === 0 && tasksToday.length === 0 && tasksNoDate.length === 0) continue;

      const firstName = user.full_name ? user.full_name.split(" ")[0] : "";
      let message = `*Bom dia${firstName ? `, ${firstName}` : ""}! Resumo do seu dia:* ☀️\n`;

      if (events.length > 0) {
        message += "\n📅 *Compromissos de hoje:*\n";
        events.forEach((e: any) => {
          const time = e.event_time ? ` às ${e.event_time.slice(0, 5)}` : "";
          message += `  • ${e.title}${time}\n`;
        });
      }

      if (tasksToday.length > 0) {
        message += "\n📌 *Lembretes para hoje:*\n";
        tasksToday.forEach((t: any) => {
          message += `  • ${t.title}\n`;
        });
      }

      if (tasksNoDate.length > 0) {
        message += "\n✅ *Tarefas pendentes:*\n";
        tasksNoDate.forEach((t: any) => {
          message += `  • ${t.title}\n`;
        });
      }

      message += "\n_Responda aqui para registrar algo novo!_";

      await sendWhatsAppMessage(user.phone, message);
      sent++;

      // Marcar events como reminder_sent = true
      if (events.length > 0) {
        const eventIds = events.map((e: any) => e.id);
        await supabase
          .from("events")
          .update({ reminder_sent: true })
          .in("id", eventIds);
      }
    }

    return new Response(JSON.stringify({ status: "ok", reminders_sent: sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Reminder error:", error);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
