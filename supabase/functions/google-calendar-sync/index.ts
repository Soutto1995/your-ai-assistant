import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = () => Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = () => Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

// Renovar access token se expirado
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID(),
      client_secret: GOOGLE_CLIENT_SECRET(),
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  return data.access_token || null;
}

// Obter token válido para um usuário
async function getValidToken(supabase: any, userId: string): Promise<{ token: string; tokenRow: any } | null> {
  const { data: tokenRow } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("sync_enabled", true)
    .maybeSingle();

  if (!tokenRow) return null;

  // Verificar se o token expirou
  const now = new Date();
  const expiry = tokenRow.token_expiry ? new Date(tokenRow.token_expiry) : null;
  
  if (expiry && now >= expiry && tokenRow.refresh_token) {
    // Renovar token
    const newToken = await refreshAccessToken(tokenRow.refresh_token);
    if (newToken) {
      const newExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
      await supabase
        .from("google_calendar_tokens")
        .update({ access_token: newToken, token_expiry: newExpiry, updated_at: now.toISOString() })
        .eq("user_id", userId);
      return { token: newToken, tokenRow };
    }
    return null;
  }

  return { token: tokenRow.access_token, tokenRow };
}

// Criar evento no Google Calendar
async function createGoogleEvent(accessToken: string, calendarId: string, event: any): Promise<string | null> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );
  const data = await response.json();
  if (data.id) {
    console.log(`Created Google Calendar event: ${data.id}`);
    return data.id;
  }
  console.error("Failed to create event:", data);
  return null;
}

// Deletar evento no Google Calendar
async function deleteGoogleEvent(accessToken: string, calendarId: string, googleEventId: string): Promise<void> {
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verificar auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();
  const { action, userId, eventData, googleEventId } = body;

  // action: "create" | "delete" | "get_auth_url" | "disconnect"

  if (action === "get_auth_url") {
    // Gerar URL de autorização OAuth
    const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;
    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID());
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", encodeURIComponent(userId));

    return new Response(JSON.stringify({ auth_url: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "disconnect") {
    await supabase
      .from("google_calendar_tokens")
      .update({ sync_enabled: false })
      .eq("user_id", userId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "check_status") {
    const { data: tokenRow } = await supabase
      .from("google_calendar_tokens")
      .select("sync_enabled, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    return new Response(JSON.stringify({ 
      connected: !!tokenRow,
      sync_enabled: tokenRow?.sync_enabled || false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "create" && eventData) {
    const tokenData = await getValidToken(supabase, userId);
    if (!tokenData) {
      return new Response(JSON.stringify({ error: "Google Calendar not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calendarId = tokenData.tokenRow.calendar_id || "primary";

    // Formatar evento para o Google Calendar
    const googleEvent: any = {
      summary: eventData.title,
      description: eventData.description || `Criado pelo Tuddo`,
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "email", minutes: 60 },
        ],
      },
    };

    // Definir horário do evento
    if (eventData.event_time) {
      const dateStr = eventData.event_date; // "2024-01-15"
      const timeStr = eventData.event_time; // "14:00"
      const startDateTime = `${dateStr}T${timeStr}:00-03:00`; // BRT
      const endDateTime = `${dateStr}T${String(parseInt(timeStr.split(":")[0]) + 1).padStart(2, "0")}:${timeStr.split(":")[1]}:00-03:00`;
      googleEvent.start = { dateTime: startDateTime, timeZone: "America/Sao_Paulo" };
      googleEvent.end = { dateTime: endDateTime, timeZone: "America/Sao_Paulo" };
    } else {
      // Evento de dia inteiro
      googleEvent.start = { date: eventData.event_date };
      googleEvent.end = { date: eventData.event_date };
    }

    const createdEventId = await createGoogleEvent(tokenData.token, calendarId, googleEvent);

    return new Response(JSON.stringify({ 
      success: !!createdEventId, 
      google_event_id: createdEventId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "delete" && googleEventId) {
    const tokenData = await getValidToken(supabase, userId);
    if (!tokenData) {
      return new Response(JSON.stringify({ error: "Google Calendar not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const calendarId = tokenData.tokenRow.calendar_id || "primary";
    await deleteGoogleEvent(tokenData.token, calendarId, googleEventId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Invalid action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
