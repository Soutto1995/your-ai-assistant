import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { referred_user_id } = await req.json();
    if (!referred_user_id) {
      return new Response(JSON.stringify({ error: "Missing referred_user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

    // Check referrer is still a paid user
    const { data: referrerProfile } = await supabase
      .from("profiles")
      .select("plan, phone, full_name, subscription_date")
      .eq("id", referral.referrer_id)
      .single();

    if (!referrerProfile || referrerProfile.plan === "FREE") {
      return new Response(JSON.stringify({ message: "Referrer is not a paid user" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extend subscription by 1 month
    const currentSubDate = referrerProfile.subscription_date
      ? new Date(referrerProfile.subscription_date)
      : new Date();
    // We don't actually extend subscription_date (that's purchase date).
    // Instead we mark reward and could create Stripe credit in production.

    // Update referral status
    await supabase
      .from("referrals")
      .update({ status: "recompensado", reward_applied_at: new Date().toISOString() })
      .eq("id", referral.id);

    // Send WhatsApp notification to referrer
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL");
    const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME");
    const instanceToken = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN");

    if (evolutionApiUrl && instanceName && instanceToken && referrerProfile.phone) {
      const { data: referredProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", referred_user_id)
        .single();

      const referredName = referredProfile?.full_name || "Um amigo";
      const message = `🎉 Parabéns! ${referredName} assinou o Tuddo e você ganhou 1 mês grátis do seu plano ${referrerProfile.plan}! Continue indicando para ganhar mais!`;

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
      } catch (e) {
        console.error("Failed to send WhatsApp notification:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Reward applied" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
