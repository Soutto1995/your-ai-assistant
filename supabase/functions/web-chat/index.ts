import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const categoryDictionary: Record<string, string[]> = {
  "Alimentação": ["restaurante", "almoço", "jantar", "café", "lanche", "pizza", "hambúrguer", "açaí", "sushi", "padaria", "ifood", "rappi", "mcdonald", "burger", "subway", "starbucks", "comida", "marmita", "delivery", "churrasco"],
  "Mercado": ["supermercado", "compras", "mercado", "sacolão", "hortifruti", "carne", "pão", "leite", "bistek", "angeloni", "big", "atacadão", "assai", "assaí", "frutas", "verduras", "feira", "açougue"],
  "Transporte": ["gasolina", "combustível", "uber", "99", "táxi", "metrô", "ônibus", "passagem", "estacionamento", "diesel", "etanol", "álcool", "shell", "ipiranga", "br", "posto", "pedágio", "pneu"],
  "Moradia": ["aluguel", "condomínio", "iptu", "água", "luz", "energia", "gás", "internet", "telefone", "celesc", "casan", "conta"],
  "Saúde": ["farmácia", "remédio", "medicamento", "consulta", "médico", "dentista", "terapia", "plano de saúde", "unimed", "drogasil", "hospital", "exame", "vacina"],
  "Lazer": ["cinema", "show", "bar", "festa", "viagem", "hotel", "passeio", "streaming", "netflix", "spotify", "disney", "hbo", "amazon prime", "game", "ingresso", "parque", "cerveja"],
  "Pessoal": ["roupa", "tênis", "sapato", "perfume", "cabelo", "barbeiro", "salão", "academia", "presente", "cosmético", "maquiagem", "smartfit", "shein", "renner"],
  "Educação": ["curso", "livro", "faculdade", "escola", "material escolar", "mensalidade", "apostila", "udemy", "alura"],
  "Contas": ["boleto", "fatura", "cartão", "crédito", "parcela", "financiamento", "empréstimo", "juros", "multa", "itau", "itaú", "bradesco", "nubank", "inter", "santander"],
  "Outros": ["taxa", "imposto", "doação", "pet", "veterinario", "veterinário", "ração"],
};

const SYSTEM_PROMPT = `Você é o "Tuddo", um assistente pessoal inteligente de produtividade e finanças. Você é CONVERSACIONAL — não apenas um processador de comandos.

Sua função é interpretar o que o usuário deseja considerando TODO o histórico da conversa e retornar APENAS um objeto JSON válido, sem markdown, crases ou texto extra.

DATA/HORA ATUAL (America/Sao_Paulo): {{current_time}}

ESTRUTURA DE SAÍDA:
{"intent":"TIPO","data":{...},"response":"TEXTO"}

INTENTS DISPONÍVEIS:
1. create_transaction — registrar gasto ou receita
2. create_task — criar tarefa, lembrete ou to-do
3. create_meeting — agendar compromisso, reunião, consulta, visita ou evento
4. create_multiple_meetings — agendar VÁRIOS compromissos de uma vez (2 ou mais na mesma mensagem)
5. list_items — listar/consultar itens existentes (gastos, receitas, tarefas, compromissos)
6. create_goal — criar uma meta financeira
7. list_goals — listar metas financeiras ativas
8. create_budget — definir limite de gasto mensal por categoria
9. general_query — saudações, perguntas gerais ou qualquer coisa que não se encaixe acima

REGRAS DE EXTRAÇÃO:

Para create_transaction:
- data.description: descrição curta
- data.amount: valor numérico positivo
- data.type: "gasto" ou "receita"
- data.category: uma das categorias [${Object.keys(categoryDictionary).join(", ")}]. Default: "Geral"

Para create_task:
- data.description: título conciso da tarefa
- data.due_date: "YYYY-MM-DDTHH:mm:ss" (São Paulo). Null se não houver data.

Para create_meeting:
- data.description: título conciso do compromisso
- data.meeting_date: "YYYY-MM-DDTHH:mm:ss" (São Paulo). Se não houver hora, use 09:00:00.

Para create_multiple_meetings:
- data.events: array de objetos com {description, meeting_date}

Para create_goal:
- data.title, data.target_amount, data.current_amount (padrão 0), data.deadline (null se não informado), data.category

Para create_budget:
- data.category, data.limit (valor máximo mensal)

Para list_items:
- data.item_type: "transaction", "task" ou "meeting"
- data.transaction_type: "gasto" ou "receita" (opcional)
- data.date_filter: "hoje", "ontem", "amanhã", "esta semana", "este mês"

REGRAS CRÍTICAS:
1. DATAS RELATIVAS: "amanhã" = dia seguinte. "próxima quinta" = próxima quinta-feira.
2. MEETINGS: "visitar X", "ir a X", "comparecer em X", "audiência", "consulta", "reunião" com data → create_meeting. Se não houver hora explícita, use 09:00:00.
3. TAREFAS vs MEETINGS: Se a ação implica PRESENÇA FÍSICA em local/pessoa com data → create_meeting. Se é algo a fazer sem horário fixo → create_task.
4. PAGAMENTOS FUTUROS: "Pagar X dia Y" = create_task. "Paguei X" = create_transaction.
5. CATEGORIZAÇÃO: Infira categoria pelo contexto. "Bistek" = Mercado. "Shell" = Transporte. "Netflix" = Lazer.
6. RESPONSE: Breve, direto, confirme a ação. Use emojis com moderação (✅, 💰, 📅, 📌).
7. CONTEXTO: Leia o histórico entre [HISTÓRICO] e [/HISTÓRICO] antes de decidir.
8. NA DÚVIDA: Se a mensagem é ambígua, use general_query e PERGUNTE.

EXEMPLOS:
Input: "amanhã visitar presídio"
Output: {"intent":"create_meeting","data":{"description":"Visita ao presídio","meeting_date":"2026-07-17T09:00:00"},"response":"Agendado! Visita ao presídio amanhã às 09:00. 📅"}

Input: "Consulta Luciana 20h quinta feira"
Output: {"intent":"create_meeting","data":{"description":"Consulta com Luciana","meeting_date":"2026-05-22T20:00:00"},"response":"Agendado! Consulta com Luciana para quinta-feira às 20:00. 📅"}

Input: "INSS da luciana fazer"
Output: {"intent":"create_task","data":{"description":"Fazer INSS da Luciana","due_date":null},"response":"Anotado! Tarefa criada: Fazer INSS da Luciana. ✅"}

Input: "gastei 50 no mercado"
Output: {"intent":"create_transaction","data":{"description":"Mercado","amount":50,"type":"gasto","category":"Mercado"},"response":"Registrado! Gasto de R$ 50,00 em Mercado. 💸"}

Input: "recebi 3500 de salario"
Output: {"intent":"create_transaction","data":{"description":"Salário","amount":3500,"type":"receita","category":"Outros"},"response":"Registrado! Receita de R$ 3.500,00 (Salário). 💰"}

Input: "quanto eu gastei hoje?"
Output: {"intent":"list_items","data":{"item_type":"transaction","transaction_type":"gasto","date_filter":"hoje"},"response":"Buscando seus gastos de hoje..."}

Input: "quais meus compromissos de amanhã?"
Output: {"intent":"list_items","data":{"item_type":"meeting","date_filter":"amanhã"},"response":"Buscando seus compromissos de amanhã..."}

Input: "reunião segunda 10h com João e terça 15h com Maria"
Output: {"intent":"create_multiple_meetings","data":{"events":[{"description":"Reunião com João","meeting_date":"2026-07-21T10:00:00"},{"description":"Reunião com Maria","meeting_date":"2026-07-22T15:00:00"}]},"response":"2 compromissos agendados! ✅"}

Input: "Pagar 342 Itau dia 25"
Output: {"intent":"create_task","data":{"description":"Pagar Itaú R$ 342","due_date":"2026-07-25T09:00:00"},"response":"Lembrete criado! Pagar Itaú R$ 342,00 no dia 25. 📌"}

Input: "Quero juntar 5000 para uma viagem em dezembro"
Output: {"intent":"create_goal","data":{"title":"Viagem","target_amount":5000,"current_amount":0,"deadline":"2026-12-31","category":"viagem"},"response":"Meta criada! 🎯 Você quer juntar R$ 5.000,00 para Viagem até dezembro."}`;

interface AiResult {
  intent: string;
  data: Record<string, any>;
  response: string;
}

async function interpretMessage(message: string): Promise<AiResult> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const now = new Date();
  const saoPauloTime = now.toLocaleString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo", hour12: false,
  });
  const systemPromptWithTime = SYSTEM_PROMPT.replace("{{current_time}}", saoPauloTime);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1",
      temperature: 0,
      messages: [
        { role: "system", content: systemPromptWithTime },
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) {
    return { intent: "general_query", data: {}, response: "Recebi sua mensagem, mas estou com dificuldade agora. Tente novamente! 🙏" };
  }

  const aiData = await response.json();
  const rawText = aiData.choices?.[0]?.message?.content?.trim() ?? "";

  try {
    // Strip markdown fences if present
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { intent: "general_query", data: {}, response: rawText || "Entendi! Como posso ajudar?" };
  }
}

async function executeIntent(supabase: any, userId: string, aiResult: AiResult, fallbackText: string): Promise<string> {
  const { intent, data, response: aiResponse } = aiResult;

  switch (intent) {
    case "create_task": {
      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        title: data.description || fallbackText,
        due_date: data.due_date || null,
        status: "pendente",
        priority: "média",
      });
      if (error) return "Ops, não consegui criar a tarefa. Tente novamente! 😅";
      return aiResponse || `✅ Tarefa criada: "${data.description || fallbackText}"`;
    }

    case "create_meeting": {
      const meetingDateRaw = typeof data.meeting_date === "string" ? data.meeting_date : null;
      let eventDate: string | null = null;
      let eventTime: string | null = null;
      if (meetingDateRaw) {
        const parts = meetingDateRaw.split("T");
        eventDate = parts[0] || null;
        eventTime = parts[1]?.slice(0, 5) || null;
      }
      const title = typeof data.description === "string" ? data.description : fallbackText;
      const { error } = await supabase.from("events").insert({
        user_id: userId,
        title,
        event_date: eventDate,
        event_time: eventTime,
        status: "agendada",
      });
      if (error) return "Ops, não consegui agendar esse compromisso. Tente novamente! 😅";

      // Google Calendar sync (non-fatal)
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          },
          body: JSON.stringify({ action: "create", userId, eventData: { title, event_date: eventDate, event_time: eventTime, description: "Criado pelo Tuddo via web" } }),
        });
      } catch { /* non-fatal */ }

      return aiResponse || `📅 Agendado! "${title}"${eventTime ? ` às ${eventTime}` : ""}`;
    }

    case "create_multiple_meetings": {
      const events = Array.isArray(data.events) ? data.events : [];
      if (events.length === 0) return "Não identifiquei os compromissos. Pode repetir?";
      const inserts = events.map((e: any) => {
        const parts = (e.meeting_date || "").split("T");
        return { user_id: userId, title: e.description || "Compromisso", event_date: parts[0] || null, event_time: parts[1]?.slice(0, 5) || null, status: "agendada" };
      });
      const { error } = await supabase.from("events").insert(inserts);
      if (error) return "Ops, não consegui agendar os compromissos. Tente novamente! 😅";
      return aiResponse || `📅 ${inserts.length} compromisso(s) agendado(s)! ✅`;
    }

    case "create_transaction": {
      const amount = typeof data.amount === "number" ? data.amount : parseFloat(String(data.amount || 0));
      if (!amount || isNaN(amount)) return "Não consegui identificar o valor. Pode repetir com o valor? 🙏";
      const type = data.type === "receita" ? "receita" : "gasto";

      // Detect category
      let category = data.category || "Geral";
      const descLower = (data.description || fallbackText).toLowerCase();
      if (!data.category || data.category === "Geral") {
        for (const [cat, keywords] of Object.entries(categoryDictionary)) {
          if (keywords.some(k => descLower.includes(k))) { category = cat; break; }
        }
      }

      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        description: data.description || fallbackText,
        amount: type === "gasto" ? -Math.abs(amount) : Math.abs(amount),
        type,
        category,
        transaction_date: new Date().toISOString(),
      });
      if (error) return "Ops, não consegui registrar. Tente novamente! 😅";
      const fmt = amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return aiResponse || `${type === "gasto" ? "💸" : "💰"} Registrado! ${type === "gasto" ? "Gasto" : "Receita"} de ${fmt} — ${data.description || fallbackText}.`;
    }

    case "create_goal": {
      const { error } = await supabase.from("goals").insert({
        user_id: userId,
        title: data.title || "Meta",
        target_amount: data.target_amount || 0,
        current_amount: data.current_amount || 0,
        deadline: data.deadline || null,
        category: data.category || "outros",
        status: "active",
      });
      if (error) return "Ops, não consegui criar a meta. Tente novamente! 😅";
      return aiResponse || `🎯 Meta criada: "${data.title}"!`;
    }

    case "create_budget": {
      const { error } = await (supabase as any).from("budgets").upsert({
        user_id: userId,
        category: data.category,
        limit_amount: data.limit || 0,
        month: new Date().toISOString().slice(0, 7),
      }, { onConflict: "user_id,category,month" });
      if (error) return "Ops, não consegui definir o orçamento. Tente novamente! 😅";
      return aiResponse || `✅ Orçamento de R$ ${(data.limit || 0).toFixed(2)} para ${data.category} definido!`;
    }

    case "list_items": {
      const itemType = data.item_type || "transaction";
      const dateFilter = data.date_filter || "este mês";
      const now = new Date();
      const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

      let startDate = fmt(spNow);
      let endDate = fmt(spNow);

      if (dateFilter === "ontem") {
        const y = new Date(spNow); y.setDate(y.getDate()-1); startDate = endDate = fmt(y);
      } else if (dateFilter === "amanhã") {
        const t = new Date(spNow); t.setDate(t.getDate()+1); startDate = endDate = fmt(t);
      } else if (dateFilter === "esta semana") {
        const d = spNow.getDay();
        const mon = new Date(spNow); mon.setDate(spNow.getDate() - (d === 0 ? 6 : d-1));
        const sun = new Date(mon); sun.setDate(mon.getDate()+6);
        startDate = fmt(mon); endDate = fmt(sun);
      } else if (dateFilter === "este mês") {
        startDate = `${spNow.getFullYear()}-${pad(spNow.getMonth()+1)}-01`;
        const last = new Date(spNow.getFullYear(), spNow.getMonth()+1, 0);
        endDate = fmt(last);
      }

      if (itemType === "transaction") {
        let q = supabase.from("transactions").select("description,amount,type,category,transaction_date")
          .eq("user_id", userId).gte("transaction_date", `${startDate}T00:00:00`).lte("transaction_date", `${endDate}T23:59:59`).order("transaction_date", { ascending: false }).limit(20);
        if (data.transaction_type) q = q.eq("type", data.transaction_type);
        const { data: rows } = await q;
        if (!rows || rows.length === 0) return `Nenhum${data.transaction_type === "gasto" ? " gasto" : data.transaction_type === "receita" ? "a receita" : "a transação"} encontrado(a) para ${dateFilter}. 📊`;
        const total = rows.reduce((s: number, r: any) => s + Math.abs(Number(r.amount)), 0);
        const lines = rows.slice(0, 10).map((r: any) => `• ${r.description}: R$ ${Math.abs(Number(r.amount)).toFixed(2)}`).join("\n");
        return `📊 *${data.transaction_type === "gasto" ? "Gastos" : data.transaction_type === "receita" ? "Receitas" : "Transações"} de ${dateFilter}:*\n${lines}\n\n*Total: R$ ${total.toFixed(2)}*`;
      }

      if (itemType === "task") {
        const { data: rows } = await supabase.from("tasks").select("title,status,due_date,priority").eq("user_id", userId).eq("status", "pendente").order("created_at", { ascending: false }).limit(10);
        if (!rows || rows.length === 0) return "Nenhuma tarefa pendente. 🎉";
        const lines = rows.map((r: any) => `• ${r.title}${r.due_date ? ` (${new Date(r.due_date).toLocaleDateString("pt-BR")})` : ""}`).join("\n");
        return `📋 *Suas tarefas pendentes:*\n${lines}`;
      }

      if (itemType === "meeting") {
        const { data: rows } = await supabase.from("events").select("title,event_date,event_time").eq("user_id", userId).gte("event_date", startDate).lte("event_date", endDate).order("event_date").order("event_time").limit(10);
        if (!rows || rows.length === 0) return `Nenhum compromisso encontrado para ${dateFilter}. 📅`;
        const lines = rows.map((r: any) => `• ${r.title}${r.event_time ? ` às ${r.event_time}` : ""}${r.event_date ? ` — ${new Date(r.event_date + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}`).join("\n");
        return `📅 *Seus compromissos (${dateFilter}):*\n${lines}`;
      }

      return aiResponse || "Consulta realizada. 📊";
    }

    case "list_goals": {
      const { data: rows } = await supabase.from("goals").select("title,target_amount,current_amount,deadline").eq("user_id", userId).eq("status", "active").order("created_at", { ascending: false });
      if (!rows || rows.length === 0) return "Você ainda não tem metas cadastradas. 🎯";
      const lines = rows.map((r: any) => {
        const pct = r.target_amount > 0 ? Math.round((r.current_amount / r.target_amount) * 100) : 0;
        return `• ${r.title}: R$ ${Number(r.current_amount).toFixed(2)} / R$ ${Number(r.target_amount).toFixed(2)} (${pct}%)`;
      }).join("\n");
      return `🎯 *Suas metas:*\n${lines}`;
    }

    default:
      return aiResponse || "Entendi! Como posso ajudar? 😊";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { message } = await req.json();
    if (!message?.trim()) return new Response(JSON.stringify({ error: "Empty message" }), { status: 400, headers: corsHeaders });

    // Get recent conversation history
    const { data: history } = await supabase.from("inbox_messages")
      .select("message, response, type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8);

    const historyText = (history || []).reverse()
      .filter((m: any) => m.message && m.response)
      .map((m: any) => `Usuário: ${m.message}\nTuddo: ${m.response}`)
      .join("\n\n");

    const messageWithContext = historyText
      ? `[HISTÓRICO]\n${historyText}\n[/HISTÓRICO]\n\nMensagem atual: "${message}"`
      : message;

    // Interpret with AI
    const aiResult = await interpretMessage(messageWithContext);
    const reply = await executeIntent(supabase, user.id, aiResult, message);

    // Save to inbox_messages
    await supabase.from("inbox_messages").insert({
      user_id: user.id,
      message: message.trim(),
      type: aiResult.intent || "general_query",
      source: "web",
      status: "processado",
      response: reply,
    });

    return new Response(JSON.stringify({ response: reply, intent: aiResult.intent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("web-chat error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
