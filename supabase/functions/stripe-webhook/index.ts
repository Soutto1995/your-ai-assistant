import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Mapeamento de price IDs para planos
const PRICE_TO_PLAN: Record<string, string> = {
  // Subscription prices
  "price_1TZtTLPpu2ogE0DArUc286V7": "STARTER", // Starter Mensal
  "price_1TZtTOPpu2ogE0DAlT08sf53": "STARTER", // Starter Anual
  "price_1TZtTQPpu2ogE0DACHSzeF2b": "PRO",     // PRO Mensal
  "price_1TZtTTPpu2ogE0DAojmyQdPB": "PRO",     // PRO Anual
  // One-time prices (para Pix/Boleto futuro)
  "price_1TZw5mPpu2ogE0DARkfRUIGt": "STARTER", // Starter Anual (one-time)
  "price_1TZw5oPpu2ogE0DAiO4YFJdb": "PRO",     // PRO Anual (one-time)
  // Planos Familiares
  "price_1TlbK4LKc2YbZKCT1NOAflvQ": "FAMILY_2", // Familiar 2 Mensal
  "price_1TlbKCLKc2YbZKCT2nRNLta0": "FAMILY_2", // Familiar 2 Anual
  "price_1TlbKJLKc2YbZKCTtJ1doKK2": "FAMILY_3", // Familiar 3 Mensal
  "price_1TlbKQLKc2YbZKCTiGnPVHOf": "FAMILY_3", // Familiar 3 Anual
  "price_1TlbKXLKc2YbZKCTidQuFTyz": "FAMILY_4", // Familiar 4 Mensal
  "price_1TlbKeLKc2YbZKCTANYMCONf": "FAMILY_4", // Familiar 4 Anual
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error("Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET");
    return new Response(JSON.stringify({ error: "Stripe não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("No stripe-signature header");
    return new Response(JSON.stringify({ error: "Sem assinatura" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return new Response(JSON.stringify({ error: "Assinatura inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`Processing event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        console.log(`Checkout completed. Mode: ${session.mode}, Payment status: ${session.payment_status}`);
        console.log(`Metadata: ${JSON.stringify(session.metadata)}`);
        console.log(`Customer email: ${session.customer_details?.email}`);
        console.log(`Customer name: ${session.customer_details?.name}`);

        // Determinar userId e plan
        let userId = session.metadata?.userId;
        let plan = session.metadata?.plan;

        // Determinar o plano pelo line_items/price (sempre, como fallback)
        if (!plan) {
          try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
            if (lineItems.data.length > 0) {
              const priceId = lineItems.data[0].price?.id;
              if (priceId && PRICE_TO_PLAN[priceId]) {
                plan = PRICE_TO_PLAN[priceId];
                console.log(`Determined plan from price ${priceId}: ${plan}`);
              }
            }
          } catch (lineErr) {
            console.error("Error fetching line items:", lineErr);
          }
        }

        // Se não tem userId no metadata, buscar pelo email
        if (!userId) {
          const customerEmail = session.customer_details?.email;
          console.log(`No userId in metadata. Trying to find user by email: ${customerEmail}`);

          if (customerEmail) {
            // Buscar usuário pelo email na tabela profiles
            const { data: userByEmail } = await supabase
              .from("profiles")
              .select("id")
              .eq("email", customerEmail)
              .maybeSingle();

            if (userByEmail) {
              userId = userByEmail.id;
              console.log(`Found user by email in profiles: ${userId}`);
            } else {
              // Tentar buscar na auth.users
              const { data: { users } } = await supabase.auth.admin.listUsers();
              const authUser = users?.find(u => u.email === customerEmail);
              if (authUser) {
                userId = authUser.id;
                console.log(`Found user by email in auth.users: ${userId}`);
              }
            }
          }
        }

        const customerId = typeof session.customer === "string" ? session.customer : null;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

        console.log(`Final: userId=${userId}, plan=${plan}`);

        if (userId && plan) {
          // CASO 1: Usuário encontrado -> ativar plano imediatamente
          const { error: rpcError } = await supabase.rpc("update_user_plan", {
            p_user_id: userId,
            p_plan: plan,
            p_stripe_customer_id: customerId,
            p_stripe_subscription_id: subscriptionId,
          });

          if (rpcError) {
            console.error("RPC update_user_plan error:", rpcError);
            // Fallback: tentar update direto
            const { error: updateError } = await supabase
              .from("profiles")
              .update({
                plan,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                subscription_date: new Date().toISOString(),
                last_payment_date: new Date().toISOString(),
                status: "active",
              })
              .eq("id", userId);

            if (updateError) {
              console.error("Fallback update also failed:", updateError);
            } else {
              console.log(`Fallback update succeeded for user ${userId} -> plan ${plan}`);
            }
          } else {
            console.log(`Successfully updated user ${userId} to plan ${plan} via RPC`);
          }

          // Se é plano familiar, criar o family_group automaticamente
          if (plan && plan.startsWith("FAMILY_")) {
            const maxMembers = parseInt(plan.split("_")[1]) || 2;
            // Verificar se já existe um family_group para este owner
            const { data: existingGroup } = await supabase
              .from("family_groups")
              .select("id")
              .eq("owner_id", userId)
              .maybeSingle();

            if (!existingGroup) {
              // Criar novo grupo familiar
              const { data: newGroup, error: groupError } = await supabase
                .from("family_groups")
                .insert({
                  owner_id: userId,
                  plan: plan,
                  max_members: maxMembers,
                  stripe_subscription_id: subscriptionId,
                })
                .select("id")
                .single();

              if (newGroup) {
                // Adicionar o owner como membro com role 'owner'
                await supabase.from("family_members").insert({
                  family_id: newGroup.id,
                  user_id: userId,
                  role: "owner",
                });
                console.log(`Created family group ${newGroup.id} for user ${userId} with max ${maxMembers} members`);
              } else {
                console.error("Error creating family group:", groupError);
              }
            } else {
              // Atualizar grupo existente (pode ter feito upgrade)
              await supabase
                .from("family_groups")
                .update({ plan: plan, max_members: maxMembers, stripe_subscription_id: subscriptionId })
                .eq("id", existingGroup.id);
              console.log(`Updated existing family group ${existingGroup.id} to ${plan}`);
            }
          }

          // Verificar se este usuário foi indicado por alguém
          const { data: referral } = await supabase
            .from("referrals")
            .select("*")
            .eq("referred_id", userId)
            .eq("status", "cadastrado")
            .maybeSingle();

          if (referral) {
            await supabase
              .from("referrals")
              .update({ status: "pago" })
              .eq("id", referral.id);

            console.log(`Referral ${referral.id} updated to 'pago'.`);

            try {
              const rewardResponse = await fetch(
                `${SUPABASE_URL}/functions/v1/process-referral-reward`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  },
                  body: JSON.stringify({ referred_user_id: userId }),
                }
              );
              const rewardResult = await rewardResponse.json();
              console.log("Referral reward result:", rewardResult);
            } catch (rewardErr) {
              console.error("Failed to process referral reward:", rewardErr);
            }
          }
        } else if (plan) {
          // CASO 2: Usuário NÃO encontrado mas pagou -> salvar em pending_payments
          // Quando o cliente se cadastrar com o mesmo email, o trigger ativa o plano automaticamente
          const customerEmail = session.customer_details?.email;
          const customerName = session.customer_details?.name;

          if (customerEmail) {
            const { error: pendingError } = await supabase
              .from("pending_payments")
              .insert({
                email: customerEmail,
                customer_name: customerName,
                plan,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                stripe_session_id: session.id,
                amount_paid: session.amount_total,
              });

            if (pendingError) {
              console.error("Error saving pending payment:", pendingError);
            } else {
              console.log(`PENDING PAYMENT saved: ${customerEmail} -> ${plan}. Will activate when user signs up.`);
            }
          } else {
            console.error("No email and no userId. Cannot process this payment.");
          }
        } else {
          console.error(`Could not determine plan. Skipping. userId=${userId}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;

        console.log(`Subscription deleted. userId from metadata: ${userId}, customer: ${sub.customer}`);

        if (userId) {
          const { error } = await supabase.rpc("update_user_plan", {
            p_user_id: userId,
            p_plan: "FREE",
            p_stripe_customer_id: null,
            p_stripe_subscription_id: null,
          });
          if (error) {
            console.error("RPC error on subscription deleted:", error);
          }
        } else if (typeof sub.customer === "string") {
          // Buscar por stripe_customer_id
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", sub.customer)
            .maybeSingle();

          if (profile) {
            const { error } = await supabase.rpc("update_user_plan", {
              p_user_id: profile.id,
              p_plan: "FREE",
              p_stripe_customer_id: null,
              p_stripe_subscription_id: null,
            });
            if (error) {
              console.error("RPC error on subscription deleted (by customer):", error);
            }
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("stripe-webhook handler error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
