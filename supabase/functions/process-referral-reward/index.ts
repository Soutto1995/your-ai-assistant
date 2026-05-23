import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REFERRAL_COUPON_ID = "oGI9rKbZ"; // Cupom "Indicação Tuddo - 1 Mês Grátis" (100% off, once) - Conta CNPJ

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- AUTENTICAÇÃO: Apenas chamadas com service_role key são permitidas ---
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    console.error("Unauthorized call to process-referral-reward");
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { referred_user_id } = await req.json();
    if (!referred_user_id) {
      return new Response(JSON.stringify({ error: "Missing referred_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find referral for this referred user with status "pago"
    const { data: referral, error: refErr } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_id", referred_user_id)
      .eq("status", "pago")
      .single();

    if (refErr || !referral) {
      return new Response(JSON.stringify({ message: "No referral to reward" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get referrer profile
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("plan, phone, full_name, stripe_subscription_id, stripe_customer_id")
      .eq("id", referral.referrer_id)
      .single();

    if (!referrerProfile || referrerProfile.plan === "FREE") {
      return new Response(JSON.stringify({ message: "Referrer is not a paid user" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply coupon to referrer's subscription in Stripe
    let couponApplied = false;
    if (STRIPE_SECRET_KEY && referrerProfile.stripe_subscription_id) {
      try {
        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

        // Apply the coupon to the subscription (100% off next invoice)
        await stripe.subscriptions.update(referrerProfile.stripe_subscription_id, {
          coupon: REFERRAL_COUPON_ID,
        });

        couponApplied = true;
        console.log(`Coupon ${REFERRAL_COUPON_ID} applied to subscription ${referrerProfile.stripe_subscription_id}`);
      } catch (stripeErr) {
        console.error("Failed to apply Stripe coupon:", stripeErr);
      }
    } else if (STRIPE_SECRET_KEY && referrerProfile.stripe_customer_id) {
      try {
        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

        const subscriptions = await stripe.subscriptions.list({
          customer: referrerProfile.stripe_customer_id,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          await stripe.subscriptions.update(subscriptions.data[0].id, {
            coupon: REFERRAL_COUPON_ID,
          });
          couponApplied = true;
          console.log(`Coupon applied via customer lookup to subscription ${subscriptions.data[0].id}`);
        }
      } catch (stripeErr) {
        console.error("Failed to apply Stripe coupon via customer:", stripeErr);
      }
    }

    // Update referral status to "recompensado"
    await supabase
      .from("referrals")
      .update({
        status: "recompensado",
        reward_applied_at: new Date().toISOString(),
      })
      .eq("id", referral.id);

    // Send WhatsApp notification to referrer
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME");
    const instanceToken = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN");

    if (referrerProfile.phone && evolutionApiUrl && instanceToken && instanceName) {
      const { data: referredProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", referred_user_id)
        .single();

      const referredName = referredProfile?.full_name || "Um amigo";
      const couponMsg = couponApplied
        ? "O desconto de 100% já foi aplicado na sua próxima fatura!"
        : "Sua recompensa será aplicada em breve.";

      const message = `🎉 Parabéns! ${referredName} assinou o Tuddo e você ganhou 1 mês grátis do seu plano ${referrerProfile.plan}! ${couponMsg}\n\nContinue indicando para ganhar mais meses! 🚀`;

      try {
        await fetch(`${evolutionApiUrl}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instanceToken,
          },
          body: JSON.stringify({
            number: referrerProfile.phone,
            text: message,
          }),
        });
        console.log(`WhatsApp notification sent to ${referrerProfile.phone}`);
      } catch (e) {
        console.error("Failed to send WhatsApp notification:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reward applied",
        coupon_applied: couponApplied,
        referrer_id: referral.referrer_id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
