import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-hub-signature-256, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const categoryDictionary: Record<string, string[]> = {
  "Alimentação": ["restaurante", "almoço", "jantar", "café", "lanche", "pizza", "hambúrguer", "açaí", "sushi", "padaria", "ifood"],
  "Mercado": ["supermercado", "compras", "mercado", "sacolão", "hortifruti", "carne", "pão", "leite"],
  "Transporte": ["gasolina", "combustível", "uber", "99", "táxi", "metrô", "ônibus", "passagem", "estacionamento"],
  "Moradia": ["aluguel", "condomínio", "iptu", "água", "luz", "energia", "gás", "internet", "telefone"],
  "Saúde": ["farmácia", "remédio", "medicamento", "consulta", "médico", "dentista", "terapia", "plano de saúde"],
  "Lazer": ["cinema", "show", "bar", "festa", "viagem", "hotel", "passeio", "streaming", "netflix", "spotify"],
  "Pessoal": ["roupa", "tênis", "sapato", "perfume", "cabelo", "barbeiro", "salão", "academia", "presente"],
  "Educação": ["curso", "livro", "faculdade", "escola", "material escolar"],
  "Outros": ["taxa", "imposto", "doação", "pet"],
};

const PLAN_LIMITS: Record<string, { limit: number; message: string }> = {
  FREE: {
    limit: 20,
    message:
      "Você atingiu o limite de 20 mensagens mensais do plano GRÁTIS. Para continuar, faça o upgrade para o plano STARTER por R$ 19,90 e tenha 200 mensagens/mês! 🚀\n\n👉 tuddo.pro/planos",
  },
  STARTER: {
    limit: 200,
    message:
      "Você atingiu o seu limite de 200 mensagens mensais. Para ter mais liberdade, faça o upgrade para o plano PRO com mensagens ilimitadas! 💎\n\n👉 tuddo.pro/planos",
  },
  PRO: {
    limit: Infinity,
    message: "",
  },
};

const FEATURE_LIMITS: Record<string, { transactionsPerMonth: number; budgets: number; categories: number }> = {
  FREE: { transactionsPerMonth: 20, budgets: 0, categories: 5 },
  STARTER: { transactionsPerMonth: 200, budgets: 3, categories: 10 },
  PRO: { transactionsPerMonth: Infinity, budgets: Infinity, categories: Infinity },
};

async function checkFeatureLimit(supabase: any, userId: string, plan: string, feature: "transaction" | "budget"): Promise<string | null> {
  const limits = FEATURE_LIMITS[plan] || FEATURE_LIMITS.FREE;

  if (feature === "transaction") {
    if (limits.transactionsPerMonth === Infinity) return null;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("transaction_date", monthStart.toISOString());
    if ((count ?? 0) >= limits.transactionsPerMonth) {
      return `Você atingiu o limite de ${limits.transactionsPerMonth} transações/mês do seu plano. Faça upgrade para continuar! 🚀\n\n👉 tuddo.pro/planos`;
    }
  }

  if (feature === "budget") {
    if (limits.budgets === Infinity) return null;
    if (limits.budgets === 0) {
      return "O controle de orçamento está disponível a partir do plano Starter. Faça upgrade! 🚀\n\n👉 tuddo.pro/planos";
    }
    const { count } = await supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= limits.budgets) {
      return `Você atingiu o limite de ${limits.budgets} orçamentos do seu plano. Faça upgrade para mais! 🚀\n\n👉 tuddo.pro/planos`;
    }
  }

  return null;
}

async function getSpendingComparison(supabase: any, userId: string, category: string, currentAmount: number): Promise<string> {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: prevTx } = await supabase
    .from("transactions")
    .select("amount, transaction_date")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("type", "gasto")
    .gte("transaction_date", threeMonthsAgo.toISOString())
    .lt("transaction_date", currentMonthStart.toISOString());

  if (!prevTx || prevTx.length === 0) return "";

  const monthlyTotals: Record<string, number> = {};
  prevTx.forEach((t: any) => {
    const key = new Date(t.transaction_date).toISOString().slice(0, 7);
    monthlyTotals[key] = (monthlyTotals[key] || 0) + Math.abs(Number(t.amount));
  });

  const months = Object.values(monthlyTotals);
  if (months.length === 0) return "";

  const average = months.reduce((s, v) => s + v, 0) / months.length;

  const { data: currentTx } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("type", "gasto")
    .gte("transaction_date", currentMonthStart.toISOString());

  const currentTotal = (currentTx || []).reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);

  if (average === 0) return "";

  const percentChange = ((currentTotal - average) / average) * 100;
  const direction = percentChange > 0 ? "a mais" : "a menos";

  return `\n\n📊 *Análise PRO:* Você já gastou R$ ${currentTotal.toLocaleString("pt-BR")} em ${category} este mês. Isso é ${Math.abs(percentChange).toFixed(0)}% ${direction} que sua média de R$ ${average.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.`;
}

// ============================================================
// SYSTEM PROMPT — REESCRITO PARA PRECISÃO CIRÚRGICA
// ============================================================
const SYSTEM_PROMPT = `Você é o "Tuddo", um assistente de produtividade e finanças para WhatsApp. Analise a mensagem do usuário e retorne APENAS um objeto JSON válido, sem markdown, crases ou texto extra.

DATA/HORA ATUAL (America/Sao_Paulo): {{current_time}}

ESTRUTURA DE SAÍDA:
{"intent":"TIPO","data":{...},"response":"TEXTO"}

INTENTS DISPONÍVEIS:
1. create_transaction — registrar gasto ou receita
2. create_task — criar tarefa ou lembrete
3. create_meeting — agendar compromisso/reunião/evento
4. list_items — listar/consultar itens existentes
5. general_query — saudações ou perguntas gerais

REGRAS DE EXTRAÇÃO DE DADOS:

Para create_transaction:
- data.description: descrição curta (ex: "Almoço no restaurante")
- data.amount: valor numérico positivo (extrair mesmo sem "R$")
- data.type: "gasto" (gastei, paguei, comprei) ou "receita" (recebi, ganhei, vendi)
- data.category: uma das categorias [${Object.keys(categoryDictionary).join(", ")}]. Default: "Geral"

Para create_task:
- data.description: título conciso da tarefa
- data.due_date: data no formato "YYYY-MM-DDTHH:mm:ss" (horário local São Paulo, SEM sufixo Z ou offset)

Para create_meeting:
- data.description: título conciso do compromisso (NÃO repita a mensagem inteira, extraia apenas o assunto. Ex: "marcar consulta para amanhã" → "Consulta")
- data.meeting_date: data no formato "YYYY-MM-DDTHH:mm:ss" (horário local São Paulo, SEM sufixo Z ou offset). Se não houver hora, use 12:00:00

Para list_items:
- data.item_type: "transaction", "task" ou "meeting"
- data.transaction_type: APENAS para transações — "gasto" (se pediu gastos/despesas) ou "receita" (se pediu ganhos/receitas). Se pediu "transações" ou "tudo", omitir este campo
- data.date_filter: "hoje", "ontem", "amanhã", "esta semana", "este mês"

REGRAS CRÍTICAS:
1. HORÁRIOS: "14h" = 14:00:00. "9h" = 09:00:00. "3 da tarde" = 15:00:00. NUNCA converta para UTC.
2. DATAS RELATIVAS: Use a data/hora atual fornecida. "Amanhã" = dia seguinte. "Semana que vem" = próxima segunda-feira.
3. TÍTULOS: Extraia títulos CONCISOS. "marcar consulta para amanhã às 14h" → description: "Consulta". "reunião com João segunda" → description: "Reunião com João".
4. PORTUGUÊS: Toda response DEVE começar com letra maiúscula. Use concordância correta (seus compromissos, suas tarefas, seus gastos).
5. RESPONSE: Seja breve e confirme a ação. Para create_meeting: "Agendado! {título} para {data} às {hora}.". Para list_items: não precisa de response elaborada.

EXEMPLOS:
Input: "marcar consulta para amanhã as 14h"
Output: {"intent":"create_meeting","data":{"description":"Consulta","meeting_date":"2026-03-28T14:00:00"},"response":"Agendado! Consulta para amanhã às 14:00."}

Input: "gastei 50 no mercado"
Output: {"intent":"create_transaction","data":{"description":"Mercado","amount":50,"type":"gasto","category":"Mercado"},"response":"Registrado! Gasto de R$ 50,00 em Mercado."}

Input: "quanto eu gastei hoje?"
Output: {"intent":"list_items","data":{"item_type":"transaction","transaction_type":"gasto","date_filter":"hoje"},"response":"Buscando seus gastos de hoje..."}

Input: "quais meus compromissos de amanhã?"
Output: {"intent":"list_items","data":{"item_type":"meeting","date_filter":"amanhã"},"response":"Buscando seus compromissos de amanhã..."}

Input: "minhas transações deste mês"
Output: {"intent":"list_items","data":{"item_type":"transaction","date_filter":"este mês"},"response":"Buscando suas transações deste mês..."}

Input: "quanto eu ganhei este mês?"
Output: {"intent":"list_items","data":{"item_type":"transaction","transaction_type":"receita","date_filter":"este mês"},"response":"Buscando suas receitas deste mês..."}

Retorne APENAS o JSON.`;

type JsonRecord = Record<string, unknown>;

type AiResult = {
  intent: "create_task" | "create_transaction" | "create_meeting" | "list_items" | "general_query";
  data: JsonRecord;
  response: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function normalizeToken(value: string): string {
  return value.trim().replace(/^Bearer\s+/i, "");
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }

  return diff === 0;
}

function tokenMatches(candidate: string, acceptedTokens: string[]): boolean {
  const normalizedCandidate = normalizeToken(candidate);
  const lowerCandidate = normalizedCandidate.toLowerCase();

  return acceptedTokens.some((token) => {
    const normalizedToken = normalizeToken(token);
    const lowerToken = normalizedToken.toLowerCase();

    return (
      timingSafeEqual(normalizedCandidate, normalizedToken) ||
      timingSafeEqual(lowerCandidate, lowerToken)
    );
  });
}

async function verifyHmacSignature(rawBody: string, signatureHeader: string): Promise<boolean> {
  const secret = Deno.env.get("EVOLUTION_API_WEBHOOK_SECRET");
  if (!secret) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const expected = `sha256=${hashHex}`;

  const normalizedHeader = signatureHeader.trim();
  return (
    timingSafeEqual(normalizedHeader, expected) ||
    timingSafeEqual(normalizedHeader.toLowerCase(), expected.toLowerCase())
  );
}

function extractTokensFromBody(body: JsonRecord): string[] {
  const data = isRecord(body.data) ? body.data : {};
  const instance = isRecord(body.instance) ? body.instance : {};
  const auth = isRecord(body.auth) ? body.auth : {};

  return [
    body.apikey,
    body.apiKey,
    body.token,
    body.instanceToken,
    body.key,
    data.apikey,
    data.apiKey,
    data.token,
    instance.token,
    instance.apikey,
    instance.apiKey,
    auth.token,
    auth.apikey,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

async function verifyRequest(req: Request, rawBody: string, body: JsonRecord): Promise<boolean> {
  const acceptedTokens = [
    Deno.env.get("EVOLUTION_API_KEY"),
    Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN"),
  ].filter((value): value is string => Boolean(value));

  if (acceptedTokens.length === 0) {
    console.error("Webhook auth misconfigured: no accepted tokens configured");
    return false;
  }

  const signatureHeader = req.headers.get("x-hub-signature-256");
  if (signatureHeader) {
    const hmacIsValid = await verifyHmacSignature(rawBody, signatureHeader);
    if (hmacIsValid) return true;
  }

  const headerCandidates = [
    req.headers.get("apikey"),
    req.headers.get("x-api-key"),
    req.headers.get("authorization"),
    req.headers.get("x-token"),
    req.headers.get("x-webhook-token"),
  ].filter((value): value is string => Boolean(value));

  if (headerCandidates.some((candidate) => tokenMatches(candidate, acceptedTokens))) {
    return true;
  }

  const url = new URL(req.url);
  const queryCandidates = [
    url.searchParams.get("apikey"),
    url.searchParams.get("token"),
    url.searchParams.get("key"),
  ].filter((value): value is string => Boolean(value));

  if (queryCandidates.some((candidate) => tokenMatches(candidate, acceptedTokens))) {
    return true;
  }

  const payloadCandidates = extractTokensFromBody(body);
  if (payloadCandidates.some((candidate) => tokenMatches(candidate, acceptedTokens))) {
    return true;
  }

  return false;
}

function buildPhoneVariants(rawPhone: string): string[] {
  const clean = rawPhone.replace(/\D/g, "");
  const variants = new Set<string>();

  if (!clean) return [];

  variants.add(clean);
  variants.add(`+${clean}`);

  if (clean.startsWith("55") && clean.length > 2) {
    const local = clean.slice(2);
    variants.add(local);
    variants.add(`+${local}`);
  }

  if (clean.length === 12 && clean.startsWith("55")) {
    const withNine = clean.slice(0, 4) + "9" + clean.slice(4);
    variants.add(withNine);
    variants.add(`+${withNine}`);
  }

  if (clean.length === 13 && clean.startsWith("55")) {
    const withoutNine = clean.slice(0, 4) + clean.slice(5);
    variants.add(withoutNine);
    variants.add(`+${withoutNine}`);
  }

  return [...variants];
}

function extractPhoneFromKey(key: JsonRecord): string {
  const participant = typeof key.participant === "string" ? key.participant : "";
  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : "";

  const base = participant || remoteJid;
  if (!base) return "";

  return base
    .replace(/:\d+/g, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@g\.us$/i, "")
    .trim();
}

function isGroupMessage(key: JsonRecord): boolean {
  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : "";
  return remoteJid.includes("@g.us");
}

function extractTextMessage(message: JsonRecord): string {
  const conversation = typeof message.conversation === "string" ? message.conversation : "";
  const extendedText = isRecord(message.extendedTextMessage) && typeof message.extendedTextMessage.text === "string"
    ? message.extendedTextMessage.text
    : "";

  if (conversation) return conversation;
  if (extendedText) return extendedText;
  return "";
}

function extractAiJson(content: string): AiResult | null {
  try {
    const parsed = JSON.parse(content);
    if (!isRecord(parsed)) return null;
    const intent = typeof parsed.intent === "string" ? parsed.intent : "general_query";
    const response = typeof parsed.response === "string" ? parsed.response : "";
    const data = isRecord(parsed.data) ? parsed.data : {};

    return {
      intent: ["create_task", "create_transaction", "create_meeting", "list_items", "general_query"].includes(intent)
        ? (intent as AiResult["intent"])
        : "general_query",
      data,
      response,
    };
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return extractAiJson(match[0]);
    } catch {
      return null;
    }
  }
}

async function checkMessageLimit(supabase: any, userId: string, plan: string): Promise<boolean> {
  const planConfig = PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
  if (planConfig.limit === Infinity) return false;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const sinceDate = monthStart.toISOString();

  const { count, error } = await supabase
    .from("inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceDate);

  if (error) {
    console.error("Count error:", error);
    return false;
  }

  return (count ?? 0) >= planConfig.limit;
}

async function categorizeExpense(description: string): Promise<string> {
  const lowerDescription = description.toLowerCase();

  for (const [category, keywords] of Object.entries(categoryDictionary)) {
    if (keywords.some((kw) => lowerDescription.includes(kw))) {
      return category;
    }
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return "Geral";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-nano",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `Categorize a despesa em UMA categoria: ${Object.keys(categoryDictionary).join(", ")}. Responda APENAS o nome da categoria.`,
          },
          { role: "user", content: `Despesa: "${description}"` },
        ],
      }),
    });

    if (!response.ok) return "Geral";

    const payload = await response.json();
    const category = payload?.choices?.[0]?.message?.content?.trim();

    if (category && Object.keys(categoryDictionary).includes(category)) {
      return category;
    }
    return "Geral";
  } catch {
    return "Geral";
  }
}

// ============================================================
// INTERPRET MESSAGE — CORRIGIDO
// ============================================================
async function interpretMessage(message: string, now: Date = new Date()): Promise<AiResult> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    console.error("OPENAI_API_KEY not configured");
    return {
      intent: "general_query",
      data: {},
      response: "Estou com dificuldade para processar agora. Tente novamente! 🙏",
    };
  }

  try {
    const saoPauloTime = now.toLocaleString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "America/Sao_Paulo",
      hour12: false,
    });

    const systemPromptWithTime = SYSTEM_PROMPT.replace("{{current_time}}", saoPauloTime);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0,
        messages: [
          { role: "system", content: systemPromptWithTime },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      console.error("OpenAI error:", response.status, await response.text());
      return {
        intent: "general_query",
        data: {},
        response: "Recebi sua mensagem, mas estou com dificuldade para processar agora. Tente novamente! 🙏",
      };
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
      return {
        intent: "general_query",
        data: {},
        response: "Recebi sua mensagem! Pode me dar mais detalhes?",
      };
    }

    const aiJson = extractAiJson(content);
    if (!aiJson) {
      return {
        intent: "general_query",
        data: {},
        response: "Entendi! Mas não consegui interpretar com precisão. Pode reformular?",
      };
    }

    return {
      intent: aiJson.intent,
      data: aiJson.data,
      response: aiJson.response || "Perfeito! Anotado ✅",
    };
  } catch (error) {
    console.error("AI parse error:", error);
    return {
      intent: "general_query",
      data: {},
      response: "Desculpe, não entendi bem. Pode reformular? 🤔",
    };
  }
}

async function sendWhatsAppMessage(phone: string, text: string): Promise<void> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") || "Tuddo";

  if (!evolutionUrl || !evolutionKey) {
    console.error("Evolution API not configured");
    return;
  }

  try {
    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({ number: phone, text }),
    });

    if (!response.ok) {
      console.error("Evolution send error:", response.status, await response.text());
      return;
    }

    console.log("Evolution send status:", response.status);
  } catch (error) {
    console.error("Evolution send error:", error);
  }
}

// ============================================================
// EXECUTE INTENT ACTION — TOTALMENTE REESCRITO
// ============================================================
async function executeIntentAction(supabase: any, userId: string, userPlan: string, aiResult: AiResult, fallbackText: string): Promise<string> {
  const { intent, data, response: aiResponse } = aiResult;

  switch (intent) {
    // -------------------------------------------------------
    // CRIAR TAREFA
    // -------------------------------------------------------
    case "create_task": {
      const title = typeof data.description === "string" && data.description.trim().length > 0
        ? data.description
        : (typeof data.title === "string" && data.title.trim().length > 0 ? data.title : fallbackText);

      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        title,
        priority: "baixa",
        status: "pendente",
        due_date: typeof data.due_date === "string" ? data.due_date : null,
      });

      if (error) {
        console.error("Task insert error:", error);
        return "Ops, não consegui criar a tarefa. Tente novamente! 😅";
      }

      return aiResponse || `Anotado! Tarefa "${title}" criada com sucesso ✅`;
    }

    // -------------------------------------------------------
    // CRIAR TRANSAÇÃO
    // -------------------------------------------------------
    case "create_transaction": {
      const txLimitMsg = await checkFeatureLimit(supabase, userId, userPlan, "transaction");
      if (txLimitMsg) return txLimitMsg;

      const description =
        typeof data.description === "string" && data.description.trim().length > 0
          ? data.description
          : fallbackText;
      const category = await categorizeExpense(description);
      const transactionType = typeof data.type === "string" && data.type.trim().length > 0 ? data.type : "gasto";
      const amount = Math.abs(Number(data.amount) || 0);

      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        description,
        amount,
        type: transactionType,
        category,
      });

      if (error) {
        console.error("Transaction insert error:", error);
        return "Ops, não consegui registrar essa transação. Tente novamente! 😅";
      }

      let reply = aiResponse || `Registrado! ${transactionType === "receita" ? "Receita" : "Gasto"} de R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em ${category} ✅`;

      // Verificar alerta de orçamento
      try {
        if (transactionType === "gasto") {
          const { data: budgetData } = await supabase
            .from("budgets")
            .select("limit")
            .eq("user_id", userId)
            .eq("category", category)
            .single();

          if (budgetData) {
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);

            const { data: monthTx } = await supabase
              .from("transactions")
              .select("amount")
              .eq("user_id", userId)
              .eq("category", category)
              .eq("type", "gasto")
              .gte("transaction_date", monthStart.toISOString());

            const totalSpent = (monthTx || []).reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
            const budgetLimit = Number(budgetData.limit);
            const progress = (totalSpent / budgetLimit) * 100;

            if (progress >= 100) {
              reply += `\n\n🚨 *Alerta de orçamento!* Você ultrapassou o limite de R$ ${budgetLimit.toLocaleString("pt-BR")} para ${category}. Total gasto: R$ ${totalSpent.toLocaleString("pt-BR")}.`;
            } else if (progress >= 80) {
              reply += `\n\n⚠️ *Atenção!* Você já usou ${progress.toFixed(0)}% do orçamento de ${category} (R$ ${totalSpent.toLocaleString("pt-BR")} / R$ ${budgetLimit.toLocaleString("pt-BR")}).`;
            }
          }

          // Comparação PRO
          if (userPlan === "PRO") {
            try {
              const comparison = await getSpendingComparison(supabase, userId, category, amount);
              if (comparison) reply += comparison;
            } catch (compError) {
              console.error("Comparison error:", compError);
            }
          }
        }
      } catch (budgetError) {
        console.error("Budget check error:", budgetError);
      }

      return reply;
    }

    // -------------------------------------------------------
    // CRIAR COMPROMISSO / REUNIÃO
    // -------------------------------------------------------
    case "create_meeting": {
      const meetingDateRaw = typeof data.meeting_date === "string" ? data.meeting_date : null;

      let eventDate: string | null = null;
      let eventTime: string | null = null;

      if (meetingDateRaw) {
        const parts = meetingDateRaw.split("T");
        if (parts.length >= 2) {
          eventDate = parts[0];
          eventTime = parts[1].slice(0, 5);
        } else {
          try {
            const d = new Date(meetingDateRaw);
            if (!isNaN(d.getTime())) {
              const spDate = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
              eventDate = `${spDate.getFullYear()}-${String(spDate.getMonth() + 1).padStart(2, "0")}-${String(spDate.getDate()).padStart(2, "0")}`;
              eventTime = `${String(spDate.getHours()).padStart(2, "0")}:${String(spDate.getMinutes()).padStart(2, "0")}`;
            }
          } catch {
            console.error("Failed to parse meeting date:", meetingDateRaw);
          }
        }
      }

      const title = typeof data.description === "string" && data.description.trim().length > 0
        ? data.description
        : (typeof data.title === "string" && data.title.trim().length > 0 ? data.title : fallbackText);

      const { error } = await supabase.from("events").insert({
        user_id: userId,
        title,
        event_date: eventDate,
        event_time: eventTime,
        status: "agendada",
      });

      if (error) {
        console.error("Event insert error:", error);
        return "Ops, não consegui agendar esse compromisso. Tente novamente! 😅";
      }

      const timeStr = eventTime ? ` às ${eventTime}` : "";
      return aiResponse || `Agendado! "${title}"${timeStr} ✅`;
    }

    // -------------------------------------------------------
    // LISTAR ITENS
    // -------------------------------------------------------
    case "list_items": {
      const itemType = typeof data.item_type === "string" ? data.item_type : "transaction";
      const dateFilter = typeof data.date_filter === "string" ? data.date_filter : "hoje";
      const transactionType = typeof data.transaction_type === "string" ? data.transaction_type : null;

      const now = new Date();
      const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      let startDate: string;
      let endDate: string;

      switch (dateFilter) {
        case "amanhã": {
          const tomorrow = new Date(spNow);
          tomorrow.setDate(tomorrow.getDate() + 1);
          startDate = formatDate(tomorrow);
          endDate = startDate;
          break;
        }
        case "ontem": {
          const yesterday = new Date(spNow);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = formatDate(yesterday);
          endDate = startDate;
          break;
        }
        case "esta semana": {
          const dayOfWeek = spNow.getDay();
          const startOfWeek = new Date(spNow);
          startOfWeek.setDate(spNow.getDate() - dayOfWeek);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          startDate = formatDate(startOfWeek);
          endDate = formatDate(endOfWeek);
          break;
        }
        case "este mês": {
          startDate = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, "0")}-01`;
          const lastDay = new Date(spNow.getFullYear(), spNow.getMonth() + 1, 0);
          endDate = formatDate(lastDay);
          break;
        }
        default: {
          startDate = formatDate(spNow);
          endDate = startDate;
          break;
        }
      }

      let items: string[] = [];
      let total = 0;

      if (itemType === "transaction") {
        let query = supabase
          .from("transactions")
          .select("description, amount, type, category")
          .eq("user_id", userId)
          .gte("transaction_date", `${startDate}T00:00:00`)
          .lte("transaction_date", `${endDate}T23:59:59`)
          .order("transaction_date", { ascending: false });

        if (transactionType) {
          query = query.eq("type", transactionType);
        }

        const { data: txs } = await query;
        if (txs && txs.length > 0) {
          items = txs.map((t: any) => {
            const emoji = t.type === "receita" ? "💰" : "💸";
            return `${emoji} ${t.description}: R$ ${Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
          });
          total = txs.reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
        }
      } else if (itemType === "task") {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("title, status, due_date")
          .eq("user_id", userId)
          .eq("status", "pendente")
          .order("created_at", { ascending: false });

        if (tasks && tasks.length > 0) {
          items = tasks.map((t: any) => {
            const dueStr = t.due_date ? ` (até ${new Date(t.due_date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})` : "";
            return `📌 ${t.title}${dueStr}`;
          });
        }
      } else if (itemType === "meeting") {
        const { data: events } = await supabase
          .from("events")
          .select("title, event_time, event_date")
          .eq("user_id", userId)
          .gte("event_date", startDate)
          .lte("event_date", endDate)
          .order("event_time", { ascending: true });

        if (events && events.length > 0) {
          items = events.map((e: any) => {
            const time = e.event_time ? ` às ${String(e.event_time).slice(0, 5)}` : "";
            return `📅 ${e.title}${time}`;
          });
        }
      }

      if (items.length === 0) {
        const itemLabel = itemType === "transaction"
          ? (transactionType === "gasto" ? "gastos" : transactionType === "receita" ? "receitas" : "transações")
          : itemType === "task" ? "tarefas pendentes" : "compromissos";
        return `Não encontrei nenhum registro de ${itemLabel} para ${dateFilter}. 📭`;
      }

      let header: string;
      if (itemType === "transaction") {
        if (transactionType === "gasto") {
          header = `Seus gastos de ${dateFilter}`;
        } else if (transactionType === "receita") {
          header = `Suas receitas de ${dateFilter}`;
        } else {
          header = `Suas transações de ${dateFilter}`;
        }
      } else if (itemType === "task") {
        header = `Suas tarefas pendentes`;
      } else {
        header = `Seus compromissos de ${dateFilter}`;
      }

      let reply = `📋 *${header}:*\n\n${items.join("\n")}`;

      if (itemType === "transaction" && total > 0) {
        reply += `\n\n💵 *Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*`;
      }

      return reply;
    }

    // -------------------------------------------------------
    // QUERY GERAL
    // -------------------------------------------------------
    case "general_query":
    default:
      return aiResponse || "Entendi! Como posso te ajudar? 😊";
  }
}

// ============================================================
// SERVE — FUNÇÃO PRINCIPAL
// ============================================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();
    let body: JsonRecord;

    try {
      const parsed = JSON.parse(rawBody);
      if (!isRecord(parsed)) {
        return new Response(JSON.stringify({ error: "invalid_json" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      body = parsed;
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isAuthorized = await verifyRequest(req, rawBody, body);
    if (!isAuthorized) {
      console.warn("Unauthorized request - rejecting");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = isRecord(body.data) ? body.data : null;
    if (!data) {
      return new Response(JSON.stringify({ status: "no_data" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = isRecord(data.key) ? data.key : {};
    if (isGroupMessage(key)) {
      return new Response(JSON.stringify({ status: "ignored_group_message" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = isRecord(data.message) ? data.message : {};
    let text = extractTextMessage(message).trim();

    if (!text) {
      return new Response(JSON.stringify({ status: "ignored_non_text" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (text.toLowerCase().startsWith("/ai ")) {
      text = text.slice(4).trim();
    }

    const remotePhone = extractPhoneFromKey(key);
    if (!remotePhone) {
      return new Response(JSON.stringify({ status: "missing_phone" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const phoneVariants = buildPhoneVariants(remotePhone);
    const orFilter = phoneVariants.map((phone) => `phone.eq.${phone}`).join(",");

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, plan")
      .or(orFilter)
      .limit(1);

    if (profileError) {
      console.error("Profile query error:", profileError);
      return new Response(JSON.stringify({ error: "profile_lookup_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profiles || profiles.length === 0) {
      await sendWhatsAppMessage(
        remotePhone,
        "Desculpe, não encontrei seu cadastro. Por favor, registre-se na plataforma primeiro! 📱\n\n👉 tuddo.pro",
      );

      return new Response(JSON.stringify({ status: "user_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = profiles[0].id;
    const userPlan = String(profiles[0].plan || "FREE").toUpperCase();
    const adminPhones = (Deno.env.get("ADMIN_PHONES") || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const isAdmin = phoneVariants.some((v) => adminPhones.includes(v)) || adminPhones.includes(remotePhone);
    if (!isAdmin) {
      const limitExceeded = await checkMessageLimit(supabase, userId, userPlan);
      if (limitExceeded) {
        const limitMessage = PLAN_LIMITS[userPlan]?.message || PLAN_LIMITS.FREE.message;
        await sendWhatsAppMessage(remotePhone, limitMessage);

        return new Response(JSON.stringify({ status: "limit_exceeded", plan: userPlan }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Interpretar a mensagem com IA
    const aiResult = await interpretMessage(text, new Date());
    const intent = aiResult.intent || "general_query";

    // Executar a ação e obter a resposta REAL
    const reply = await executeIntentAction(supabase, userId, userPlan, aiResult, text);

    // Salvar no inbox
    const { error: inboxError } = await supabase.from("inbox_messages").insert({
      user_id: userId,
      message: text,
      type: intent,
      source: "whatsapp",
      status: "processado",
      response: reply,
    });

    if (inboxError) {
      console.error("Inbox insert error:", inboxError);
    }

    // Enviar resposta via WhatsApp
    await sendWhatsAppMessage(remotePhone, reply);

    return new Response(JSON.stringify({ status: "ok", intent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
