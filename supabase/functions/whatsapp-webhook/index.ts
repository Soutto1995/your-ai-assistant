import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLAN_LIMITS: Record<string, { limit: number; message: string }> = {
  FREE: {
    limit: 5,
    message: "Você atingiu o limite de 5 mensagens diárias do plano GRÁTIS. Para continuar, faça o upgrade para o plano STARTER por apenas R$ 12,90/mês e tenha 30 mensagens por dia! 🚀",
  },
  STARTER: {
    limit: 30,
    message: "Você atingiu o seu limite de 30 mensagens diárias. Para ter mais liberdade, faça o upgrade para o plano PRO com 50 mensagens por dia! 💎",
  },
  PRO: {
    limit: 50,
    message: "Você atingiu o seu limite de 50 mensagens diárias. ⏳",
  },
};

const SYSTEM_PROMPT = `Você é o "Você Aí", um assistente pessoal direto e eficiente. Sua única função é analisar a mensagem do usuário e retornar APENAS um objeto JSON válido, sem markdown, crases, ou qualquer texto adicional. A estrutura do JSON deve ser: {"intent": "TIPO", "data": {DADOS}, "response": "RESPOSTA CURTA"}
Os tipos de "intent" possíveis são:
1. \`create_task\`: para criar tarefas ou lembretes.
   - \`data\`: {"title": "texto da tarefa", "priority": "baixa"}
   - \`response\`: "Anotado! Tarefa criada: [título]"
2. \`create_transaction\`: para registrar gastos, despesas, compras, pagamentos ou receitas/ganhos.
   - \`data\`: {"description": "descrição", "amount": NUMERO, "type": "gasto" ou "receita", "category": "categoria"}
   - \`response\`: "Registrado! [Tipo] de R$ [valor] em [categoria]."
3. \`create_meeting\`: para agendar reuniões ou compromissos.
   - \`data\`: {"title": "título", "meeting_date": "ISO date ou null"}
   - \`response\`: "Agendado! Compromisso: [título]."
4. \`general_query\`: para qualquer outra pergunta, saudação ou conversa.
   - \`data\`: {}
   - \`response\`: Responda de forma amigável e útil.
REGRAS IMPORTANTES:
- Seja direto na resposta. Use "Anotado!", "Registrado!", "Agendado!".
- Para \`create_transaction\`, se a categoria não for óbvia, use "Geral".
- Para \`create_task\`, a prioridade é sempre "baixa" por padrão.
- O \`amount\` da transação deve ser sempre um número positivo.
- Retorne APENAS o JSON.
EXEMPLOS:
- Usuário: "gastei 50 reais no almoço de hoje"
JSON: {"intent":"create_transaction","data":{"description":"Almoço de hoje","amount":50,"type":"gasto","category":"Alimentação"},"response":"Registrado! Gasto de R$ 50,00 em Alimentação."}
- Usuário: "criar tarefa: comprar pão depois do trabalho"
JSON: {"intent":"create_task","data":{"title":"Comprar pão depois do trabalho","priority":"baixa"},"response":"Anotado! Tarefa criada: Comprar pão depois do trabalho"}
- Usuário: "reunião com a equipe amanhã às 10h"
JSON: {"intent":"create_meeting","data":{"title":"Reunião com a equipe","meeting_date":null},"response":"Agendado! Compromisso: Reunião com a equipe."}
- Usuário: "bom dia"
JSON: {"intent":"general_query","data":{},"response":"Bom dia! Como posso te ajudar hoje?"}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    const data = body.data;
    if (!data) {
      return new Response(JSON.stringify({ status: "no_data" }), { headers: corsHeaders });
    }

    const key = data.key;
    const message = data.message;

    // 1. Only process messages sent by ME
    if (key?.fromMe !== true) {
      return new Response(JSON.stringify({ status: "ignored_not_from_me" }), { headers: corsHeaders });
    }

    // 2. Only process messages sent to MYSELF (self-chat)
    const MY_OWN_WHATSAPP_NUMBER = "554899844528@s.whatsapp.net";
    if (key?.remoteJid !== MY_OWN_WHATSAPP_NUMBER) {
      return new Response(JSON.stringify({ status: "ignored_not_self_chat" }), { headers: corsHeaders });
    }

    // 2. Only process text messages
    let text = message?.conversation || message?.extendedTextMessage?.text;
    if (!text) {
      return new Response(JSON.stringify({ status: "ignored_non_text" }), { headers: corsHeaders });
    }

    // Strip /ai prefix if present
    if (text.trim().toLowerCase().startsWith("/ai ")) {
      text = text.trim().substring(4).trim();
    }

    // 3. Extract phone number
    const remoteJid = key?.remoteJid?.replace("@s.whatsapp.net", "") || "";
    console.log("Processing message from:", remoteJid, "Text:", text);

    // 4. Init Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 5. Find user by phone (flexible search: raw number or with extra 9 after DDD)
    const phoneVariants = buildPhoneVariants(remoteJid);
    console.log("Searching phone variants:", phoneVariants);

    const orFilter = phoneVariants.map((p) => `phone.eq.${p}`).join(",");
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, plan")
      .or(orFilter)
      .limit(1);

    if (!profiles || profiles.length === 0) {
      await sendWhatsAppMessage(remoteJid, "Desculpe, não encontrei seu cadastro. Por favor, registre-se na plataforma primeiro! 📱");
      return new Response(JSON.stringify({ status: "user_not_found" }), { headers: corsHeaders });
    }

    const userId = profiles[0].id;
    const userName = profiles[0].full_name || "amigo(a)";
    const userPlan = (profiles[0].plan || "FREE").toUpperCase();

    // 6. Check message limits (bypass for admin)
    const ADMIN_PHONE = "554899844528";
    if (remoteJid !== ADMIN_PHONE) {
      const limitExceeded = await checkMessageLimit(supabase, userId, userPlan);
      if (limitExceeded) {
        const limitMsg = PLAN_LIMITS[userPlan]?.message || PLAN_LIMITS.FREE.message;
        await sendWhatsAppMessage(remoteJid, limitMsg);
        return new Response(JSON.stringify({ status: "limit_exceeded", plan: userPlan }), { headers: corsHeaders });
      }
    }

    // 7. Interpret with OpenAI (gpt-4.1-nano)
    const aiResult = await interpretMessage(text);
    console.log("AI result:", JSON.stringify(aiResult));

    const intent = aiResult.intent || "general_query";
    const entities = aiResult.data || {};
    let reply = aiResult.response || "Entendi! Mas não consegui processar. Tente novamente. 🤔";

    // 8. Execute action based on intent
    try {
      switch (intent) {
        case "create_task": {
          const { error } = await supabase.from("tasks").insert({
            user_id: userId,
            title: entities.title || text,
            priority: entities.priority || "baixa",
            status: "pendente",
            due_date: entities.due_date || null,
          });
          if (error) { console.error("Task insert error:", error); reply = "Ops, não consegui criar a tarefa. Tente novamente! 😅"; }
          break;
        }
        case "create_transaction": {
          const { error } = await supabase.from("transactions").insert({
            user_id: userId,
            description: entities.description || text,
            amount: Math.abs(Number(entities.amount) || 0),
            type: entities.type || "gasto",
            category: entities.category || "Geral",
          });
          if (error) { console.error("Transaction insert error:", error); reply = "Ops, não consegui registrar. Tente novamente! 😅"; }
          break;
        }
        case "create_meeting": {
          const { error } = await supabase.from("meetings").insert({
            user_id: userId,
            title: entities.title || text,
            meeting_date: entities.meeting_date || null,
            status: "agendada",
          });
          if (error) { console.error("Meeting insert error:", error); reply = "Ops, não consegui agendar. Tente novamente! 😅"; }
          break;
        }
      }
    } catch (actionError) {
      console.error("Action error:", actionError);
    }

    // 9. Save to inbox_messages
    await supabase.from("inbox_messages").insert({
      user_id: userId,
      message: text,
      type: intent,
      source: "whatsapp",
      status: "processado",
      response: reply,
    });

    // 10. Send reply
    await sendWhatsAppMessage(remoteJid, reply);

    return new Response(JSON.stringify({ status: "ok", intent }), { headers: corsHeaders });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

function buildPhoneVariants(rawPhone: string): string[] {
  const clean = rawPhone.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(clean);
  variants.add(`+${clean}`);

  // Brazilian phone: country code (55) + DDD (2 digits) + number (8 or 9 digits)
  // If number has 12 digits (55 + DDD + 8-digit number), add variant with 9 inserted
  if (clean.length === 12 && clean.startsWith("55")) {
    const withNine = clean.slice(0, 4) + "9" + clean.slice(4);
    variants.add(withNine);
    variants.add(`+${withNine}`);
  }
  // If number has 13 digits (55 + DDD + 9-digit number), add variant without the 9
  if (clean.length === 13 && clean.startsWith("55")) {
    const withoutNine = clean.slice(0, 4) + clean.slice(5);
    variants.add(withoutNine);
    variants.add(`+${withoutNine}`);
  }

  return [...variants];
}

async function checkMessageLimit(supabase: any, userId: string, plan: string): Promise<boolean> {
  const planConfig = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", twentyFourHoursAgo);

  if (error) {
    console.error("Count error:", error);
    return false; // allow on error
  }

  return (count || 0) >= planConfig.limit;
}

async function interpretMessage(message: string) {
  const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: message },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.error("OpenAI error:", res.status, await res.text());
      return { intent: "general_query", data: {}, response: "Recebi sua mensagem, mas estou com dificuldade para processar agora. Tente novamente! 🙏" };
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || "";
    return JSON.parse(content);
  } catch (e) {
    console.error("AI parse error:", e);
    return { intent: "general_query", data: {}, response: "Desculpe, não entendi bem. Pode reformular? 🤔" };
  }
}

async function sendWhatsAppMessage(phone: string, text: string) {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");

  if (!evolutionUrl || !evolutionKey) {
    console.error("Evolution API not configured");
    return;
  }

  try {
    const res = await fetch(`${evolutionUrl}/message/sendText/voceai`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: evolutionKey },
      body: JSON.stringify({ number: phone, text }),
    });
    console.log("Evolution send status:", res.status);
  } catch (e) {
    console.error("Evolution send error:", e);
  }
}
