import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsAppMessage(phone: string, text: string): Promise<void> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") || "Tuddo";

  if (!evolutionUrl || !evolutionKey) {
    console.error("Evolution API not configured");
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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const today = new Date().toISOString().split("T")[0];

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, phone");

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

      const [eventsRes, tasksRes] = await Promise.all([
        supabase.from("events").select("title, event_time").eq("user_id", user.id).eq("event_date", today),
        supabase.from("tasks").select("title").eq("user_id", user.id).eq("status", "pendente"),
      ]);

      const events = eventsRes.data || [];
      const tasks = tasksRes.data || [];

      if (events.length === 0 && tasks.length === 0) continue;

      let message = "*Resumo do seu dia no Tuddo:* ☀️\n";

      if (events.length > 0) {
        message += "\n*Compromissos:*\n";
        events.forEach((e: any) => {
          const time = e.event_time ? ` às ${e.event_time.slice(0, 5)}` : "";
          message += `- ${e.title}${time}\n`;
        });
      }

      if (tasks.length > 0) {
        message += "\n*Tarefas Pendentes:*\n";
        tasks.forEach((t: any) => {
          message += `- ${t.title}\n`;
        });
      }

      await sendWhatsAppMessage(user.phone, message);
      sent++;
    }

    return new Response(JSON.stringify({ status: "ok", reminders_sent: sent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Reminder error:", error);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
