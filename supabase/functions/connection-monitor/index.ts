import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const EVOLUTION_URL = Deno.env.get("EVOLUTION_API_URL") ?? "https://evolution-api-production-6070.up.railway.app";
const EVOLUTION_KEY = Deno.env.get("EVOLUTION_API_KEY") ?? "";
const INSTANCE = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") ?? "Tuddo";

async function checkAndReconnect(): Promise<{ was_open: boolean; action: string }> {
  const stateRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${INSTANCE}`, {
    headers: { apikey: EVOLUTION_KEY },
  });

  if (!stateRes.ok) {
    console.error("Falha ao checar estado:", stateRes.status);
    return { was_open: false, action: "check_failed" };
  }

  const { instance } = await stateRes.json();
  const state: string = instance?.state ?? "unknown";
  console.log(`Estado atual da instância ${INSTANCE}: ${state}`);

  if (state === "open") {
    return { was_open: true, action: "none" };
  }

  // Logout para limpar sessão travada
  console.log("Instância não está open. Executando logout...");
  await fetch(`${EVOLUTION_URL}/instance/logout/${INSTANCE}`, {
    method: "DELETE",
    headers: { apikey: EVOLUTION_KEY },
  });

  await new Promise((r) => setTimeout(r, 3000));

  const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${INSTANCE}`, {
    headers: { apikey: EVOLUTION_KEY },
  });

  if (!connectRes.ok) {
    console.error("Falha ao reconectar:", connectRes.status);
    return { was_open: false, action: "reconnect_failed" };
  }

  console.log(`Reconexão solicitada para ${INSTANCE}. Estado era: ${state}`);
  return { was_open: false, action: "reconnect_requested" };
}

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  try {
    const result = await checkAndReconnect();
    console.log("Monitor resultado:", JSON.stringify(result));

    return new Response(JSON.stringify({ ok: true, instance: INSTANCE, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Monitor erro:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
