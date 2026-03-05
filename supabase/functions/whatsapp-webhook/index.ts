import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    // Evolution API sends messages.upsert event
    const data = body.data;
    if (!data) {
      return new Response(JSON.stringify({ status: "no data" }), { headers: corsHeaders });
    }

    const key = data.key;
    const message = data.message;

    // ONLY process messages sent by ME (fromMe === true)
    if (key?.fromMe !== true) {
      return new Response(JSON.stringify({ status: "ignored_not_from_me" }), { headers: corsHeaders });
    }

    // Only process text messages
    let text = message?.conversation || message?.extendedTextMessage?.text;
    if (!text) {
      return new Response(JSON.stringify({ status: "ignored_non_text" }), { headers: corsHeaders });
    }

    // Extract phone numbers
    const remoteJid = key?.remoteJid?.replace("@s.whatsapp.net", "") || "";
    // Get the instance owner phone from pushName or use remoteJid for self-chat
    const isSelfChat = true; // Messages to myself: remoteJid is my own number
    const hasAiPrefix = text.trim().toLowerCase().startsWith("/ai ");

    // Only process: self-chat messages OR messages with /ai prefix
    if (!isSelfChat && !hasAiPrefix) {
      return new Response(JSON.stringify({ status: "ignored_no_prefix" }), { headers: corsHeaders });
    }

    // Strip /ai prefix if present
    if (hasAiPrefix) {
      text = text.trim().substring(4).trim();
    }

    const rawPhone = remoteJid;
    console.log("Processing self-message from:", rawPhone, "Text:", text);

    // Init Supabase with service role (bypass RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by phone
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .or(`phone.eq.${rawPhone},phone.eq.+${rawPhone}`)
      .limit(1);

    if (!profiles || profiles.length === 0) {
      await sendWhatsAppMessage(rawPhone, "Desculpe, não encontrei seu cadastro. Por favor, registre-se na plataforma primeiro! 📱");
      return new Response(JSON.stringify({ status: "user_not_found" }), { headers: corsHeaders });
    }

    const userId = profiles[0].id;
    const userName = profiles[0].full_name || "amigo(a)";

    // Interpret with OpenAI
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const aiResult = await interpretMessage(openaiKey, text, userName);
    console.log("AI result:", JSON.stringify(aiResult));

    let reply = aiResult.reply || "Entendi! Mas não consegui processar sua mensagem. Tente novamente. 🤔";
    const intent = aiResult.intent || "general_query";
    const entities = aiResult.entities || {};

    // Execute action based on intent
    try {
      switch (intent) {
        case "create_task": {
          const { error } = await supabase.from("tasks").insert({
            user_id: userId,
            title: entities.title || text,
            priority: entities.priority || "média",
            due_date: entities.due_date || null,
            project: entities.project || null,
          });
          if (error) { console.error("Task insert error:", error); reply = "Ops, não consegui criar a tarefa. Tente novamente! 😅"; }
          break;
        }
        case "create_transaction": {
          const { error } = await supabase.from("transactions").insert({
            user_id: userId,
            description: entities.description || text,
            amount: Number(entities.amount) || 0,
            type: entities.type || "gasto",
            category: entities.category || "outros",
          });
          if (error) { console.error("Transaction insert error:", error); reply = "Ops, não consegui registrar. Tente novamente! 😅"; }
          break;
        }
        case "create_meeting": {
          const { error } = await supabase.from("meetings").insert({
            user_id: userId,
            title: entities.title || text,
            meeting_date: entities.meeting_date || null,
            participants: Number(entities.participants) || 1,
          });
          if (error) { console.error("Meeting insert error:", error); reply = "Ops, não consegui agendar a reunião. Tente novamente! 😅"; }
          break;
        }
        case "list_tasks": {
          const { data: tasks } = await supabase
            .from("tasks")
            .select("title, priority, due_date")
            .eq("user_id", userId)
            .eq("status", "pendente")
            .order("created_at", { ascending: false })
            .limit(10);
          if (tasks && tasks.length > 0) {
            const list = tasks.map((t, i) => `${i + 1}. ${t.title} (${t.priority})`).join("\n");
            reply = `📋 Suas tarefas pendentes:\n\n${list}`;
          } else {
            reply = "Você não tem tarefas pendentes! Tudo limpo ✨";
          }
          break;
        }
        case "list_finances": {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const { data: transactions } = await supabase
            .from("transactions")
            .select("amount, type")
            .eq("user_id", userId)
            .gte("transaction_date", firstDay);
          if (transactions && transactions.length > 0) {
            const receitas = transactions.filter(t => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
            const gastos = transactions.filter(t => t.type === "gasto").reduce((s, t) => s + Number(t.amount), 0);
            reply = `💰 Resumo financeiro do mês:\n\n📈 Receitas: R$ ${receitas.toFixed(2)}\n📉 Gastos: R$ ${gastos.toFixed(2)}\n💵 Saldo: R$ ${(receitas - gastos).toFixed(2)}`;
          } else {
            reply = "Nenhuma movimentação financeira este mês! 📊";
          }
          break;
        }
        // general_query: just use AI reply
      }
    } catch (actionError) {
      console.error("Action error:", actionError);
    }

    // Save to inbox_messages
    await supabase.from("inbox_messages").insert({
      user_id: userId,
      message: text,
      type: intent,
      source: "whatsapp",
      status: "processado",
      response: reply,
    });

    // Send reply via Evolution API
    await sendWhatsAppMessage(rawPhone, reply);

    return new Response(JSON.stringify({ status: "ok", intent }), { headers: corsHeaders });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

async function interpretMessage(apiKey: string, message: string, userName: string) {
  const systemPrompt = `Você é um assistente pessoal inteligente chamado "Você Aí". O usuário se chama ${userName}. Analise a mensagem e extraia a intenção e entidades. Responda APENAS com JSON válido, sem markdown, sem backticks.

As intenções possíveis são:
- create_task: criar tarefa (entidades: title, priority [baixa/média/alta], due_date [ISO string ou null])
- create_transaction: registrar gasto ou receita (entidades: description, amount [número], type ["gasto" ou "receita"], category)
- create_meeting: agendar reunião (entidades: title, meeting_date [ISO string ou null], participants [número])
- list_tasks: listar tarefas pendentes
- list_finances: ver resumo financeiro
- general_query: pergunta geral ou conversa

Sempre inclua um campo "reply" com uma resposta amigável e casual em português, usando emojis. A data de hoje é ${new Date().toISOString().split("T")[0]}.

Exemplo: "gastei 50 reais no almoço" → {"intent":"create_transaction","entities":{"description":"almoço","amount":50,"type":"gasto","category":"alimentação"},"reply":"Anotado! Gasto de R$ 50,00 em alimentação (almoço) registrado 🍽️"}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.error("OpenAI error:", res.status, await res.text());
      return { intent: "general_query", entities: {}, reply: `Oi ${userName}! Recebi sua mensagem, mas estou com dificuldade para processar agora. Tente novamente em instantes! 🙏` };
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content || "";
    return JSON.parse(content);
  } catch (e) {
    console.error("AI parse error:", e);
    return { intent: "general_query", entities: {}, reply: "Desculpe, não entendi bem. Pode reformular? 🤔" };
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
