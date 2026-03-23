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

    const { data: events, error } = await supabase
      .from("events")
      .select("id, title, event_time, user_id")
      .eq("event_date", today)
      .eq("reminder_sent", false);

    if (error) {
      console.error("Error fetching events:", error);
      return new Response(JSON.stringify({ error: "fetch_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ status: "no_reminders" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    for (const event of events) {
      // Fetch user phone from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", event.user_id)
        .single();

      const userPhone = profile?.phone;
      if (userPhone) {
        const timeStr = event.event_time ? ` às ${String(event.event_time).slice(0, 5)}` : "";
        const message = `📅 Lembrete do Tuddo: Hoje você tem "${event.title}"${timeStr}. Tenha um ótimo dia! ✨`;
        await sendWhatsAppMessage(userPhone, message);
        await supabase.from("events").update({ reminder_sent: true }).eq("id", event.id);
        sent++;
      }
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
