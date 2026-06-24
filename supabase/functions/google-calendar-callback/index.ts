import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-callback`;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // userId encoded
  const error = url.searchParams.get("error");

  if (error) {
    return new Response(null, {
      status: 302,
      headers: { Location: "https://www.tuddo.pro/settings?google_calendar=error" },
    });
  }

  if (!code || !state) {
    return new Response(JSON.stringify({ error: "Missing code or state" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Trocar code por tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenResponse.json();

  if (!tokens.access_token) {
    console.error("Failed to get tokens:", tokens);
    return new Response(null, {
      status: 302,
      headers: { Location: "https://www.tuddo.pro/settings?google_calendar=error" },
    });
  }

  const userId = decodeURIComponent(state);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Salvar tokens no banco
  const tokenExpiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const { error: dbError } = await supabase
    .from("google_calendar_tokens")
    .upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expiry: tokenExpiry,
      sync_enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

  if (dbError) {
    console.error("DB error saving tokens:", dbError);
    return new Response(null, {
      status: 302,
      headers: { Location: "https://www.tuddo.pro/settings?google_calendar=error" },
    });
  }

  console.log(`Google Calendar connected for user ${userId}`);

  // Redirecionar de volta para o app com sucesso
  return new Response(null, {
    status: 302,
    headers: { Location: "https://www.tuddo.pro/settings?google_calendar=success" },
  });
});
