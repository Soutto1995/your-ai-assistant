import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("plan, subscription_date, stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.plan === "FREE") {
      return new Response(
        JSON.stringify({ error: "Você está no plano gratuito" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check 7-day window
    if (!profile.subscription_date) {
      return new Response(
        JSON.stringify({ error: "Data de assinatura não encontrada. Contate suporte@tuddo.pro" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subDate = new Date(profile.subscription_date);
    const daysSince = Math.floor((Date.now() - subDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince > 7) {
      return new Response(
        JSON.stringify({
          error: "Prazo de 7 dias expirado. Conforme o CDC Art. 49, reembolsos só são permitidos nos primeiros 7 dias.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Cancel subscription if exists
    if (profile.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch (e) {
        console.error("Error canceling subscription:", e);
      }
    }

    // Process refund if customer exists
    let refundAmount = 0;
    if (profile.stripe_customer_id) {
      try {
        const charges = await stripe.charges.list({
          customer: profile.stripe_customer_id,
          limit: 1,
        });

        if (charges.data.length > 0) {
          const latestCharge = charges.data[0];
          refundAmount = latestCharge.amount; // in cents
          await stripe.refunds.create({
            charge: latestCharge.id,
            reason: "requested_by_customer",
          });
        }
      } catch (e) {
        console.error("Error processing refund:", e);
        return new Response(
          JSON.stringify({ error: "Erro ao processar reembolso no Stripe" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update profile to FREE
    await supabaseAdmin
      .from("profiles")
      .update({
        plan: "FREE",
        subscription_date: null,
        stripe_subscription_id: null,
      })
      .eq("id", user.id);

    return new Response(
      JSON.stringify({
        success: true,
        refund_amount: refundAmount / 100,
        message: `Reembolso de R$ ${(refundAmount / 100).toFixed(2)} processado com sucesso.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
