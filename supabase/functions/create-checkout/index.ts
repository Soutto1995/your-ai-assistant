import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Server-side authoritative mapping. Plan is derived from priceId, NEVER from the client body.
const PRICE_TO_PLAN: Record<string, "STARTER" | "PRO" | "FAMILY_2" | "FAMILY_3" | "FAMILY_4"> = {
  "price_1TZtTLPpu2ogE0DArUc286V7": "STARTER",
  "price_1TZtTOPpu2ogE0DAlT08sf53": "STARTER",
  "price_1TZtTQPpu2ogE0DACHSzeF2b": "PRO",
  "price_1TZtTTPpu2ogE0DAojmyQdPB": "PRO",
  "price_1TZw5mPpu2ogE0DARkfRUIGt": "STARTER",
  "price_1TZw5oPpu2ogE0DAiO4YFJdb": "PRO",
  // Family plans
  "price_1TlbK4LKc2YbZKCT1NOAflvQ": "FAMILY_2", // Family 2 Mensal
  "price_1TlbKCLKc2YbZKCT2nRNLta0": "FAMILY_2", // Family 2 Anual
  "price_1TlbKJLKc2YbZKCTtJ1doKK2": "FAMILY_3", // Family 3 Mensal
  "price_1TlbKQLKc2YbZKCTiGnPVHOf": "FAMILY_3", // Family 3 Anual
  "price_1TlbKXLKc2YbZKCTidQuFTyz": "FAMILY_4", // Family 4 Mensal
  "price_1TlbKeLKc2YbZKCTANYMCONf": "FAMILY_4", // Family 4 Anual
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

    if (!STRIPE_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Stripe não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { priceId, email } = body ?? {};
    if (!priceId || typeof priceId !== "string") {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authoritative: derive plan from priceId, never trust client.
    const resolvedPlan = PRICE_TO_PLAN[priceId];
    if (!resolvedPlan) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const existing = await stripe.customers.list({ email: email ?? user.email, limit: 1 });
      if (existing.data.length > 0) customerId = existing.data[0].id;
    }

    const origin = req.headers.get("origin") ?? "https://tuddo.lovable.app";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      customer_email: customerId ? undefined : (email ?? user.email),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: {
        userId: user.id,
        plan: resolvedPlan,
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          plan: resolvedPlan,
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout error:", err);
    return new Response(JSON.stringify({ error: "Ocorreu um erro ao processar o pagamento. Tente novamente ou entre em contato com o suporte." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
