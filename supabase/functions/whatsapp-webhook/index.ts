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
      "Você atingiu o limite de 20 mensagens mensais do plano GRÁTIS. Para continuar, faça o upgrade para o plano STARTER por R$ 19,90 e tenha 200 mensagens/mês! 🚀\n\n👉 tudd0.vercel.app/planos",
  },
  STARTER: {
    limit: 200,
    message:
      "Você atingiu o seu limite de 200 mensagens mensais. Para ter mais liberdade, faça o upgrade para o plano PRO com mensagens ilimitadas! 💎\n\n👉 tudd0.vercel.app/planos",
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
      return `Você atingiu o limite de ${limits.transactionsPerMonth} transações/mês do seu plano. Faça upgrade para continuar! 🚀\n\n👉 tudd0.vercel.app/planos`;
    }
  }

  if (feature === "budget") {
    if (limits.budgets === Infinity) return null;
    if (limits.budgets === 0) {
      return "O controle de orçamento está disponível a partir do plano Starter. Faça upgrade! 🚀\n\n👉 tudd0.vercel.app/planos";
    }
    const { count } = await supabase
      .from("budgets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= limits.budgets) {
      return `Você atingiu o limite de ${limits.budgets} orçamentos do seu plano. Faça upgrade para mais! 🚀\n\n👉 tudd0.vercel.app/planos`;
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
const SYSTEM_PROMPT = `Você é o "Tuddo", um assistente pessoal inteligente de produtividade e finanças via WhatsApp. Sua função é interpretar com precisão cirúrgica o que o usuário deseja e retornar APENAS um objeto JSON válido, sem markdown, crases ou texto extra.

DATA/HORA ATUAL (America/Sao_Paulo): {{current_time}}

ESTRUTURA DE SAÍDA:
{"intent":"TIPO","data":{...},"response":"TEXTO"}

INTENTS DISPONÍVEIS:
1. create_transaction — registrar gasto ou receita (inclui compras, pagamentos, boletos, pix, salário)
2. create_task — criar tarefa, lembrete ou to-do
3. create_meeting — agendar compromisso, reunião, consulta ou evento
4. list_items — listar/consultar itens existentes (gastos, receitas, tarefas, compromissos)
5. general_query — saudações, perguntas gerais ou qualquer coisa que não se encaixe acima

REGRAS DE EXTRAÇÃO DE DADOS:

Para create_transaction:
- data.description: descrição curta e clara (ex: "Almoço no restaurante", "Supermercado Bistek")
- data.amount: valor numérico positivo (extrair mesmo sem "R$". "50 reais" = 50. "12,90" = 12.90)
- data.type: "gasto" (gastei, paguei, comprei, boleto, conta) ou "receita" (recebi, ganhei, vendi, salário, freelance)
- data.category: uma das categorias [${Object.keys(categoryDictionary).join(", ")}]. Default: "Geral"

Para create_task:
- data.description: título conciso e claro da tarefa (ex: "Fazer INSS da Luciana", "Comprar leite")
- data.due_date: data no formato "YYYY-MM-DDTHH:mm:ss" (horário local São Paulo, SEM sufixo Z ou offset). Se não houver data específica, usar null.

Para create_meeting:
- data.description: título conciso do compromisso (NUNCA repita a mensagem inteira. Ex: "consulta com Luciana 20h quinta" → "Consulta com Luciana")
- data.meeting_date: data no formato "YYYY-MM-DDTHH:mm:ss" (horário local São Paulo, SEM sufixo Z ou offset). Se não houver hora explícita, use 12:00:00.

Para list_items:
- data.item_type: "transaction", "task" ou "meeting"
- data.transaction_type: APENAS para transações — "gasto" (gastos/despesas) ou "receita" (ganhos/receitas). Se pediu "transações" ou "tudo", OMITIR este campo.
- data.date_filter: "hoje", "ontem", "amanhã", "esta semana", "este mês", "próximo mês", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"

REGRAS CRÍTICAS DE INTERPRETAÇÃO:
1. HORÁRIOS: "14h" = 14:00:00. "9h" = 09:00:00. "3 da tarde" = 15:00:00. "20h" = 20:00:00. "meio-dia" = 12:00:00. NUNCA converta para UTC.
2. DATAS RELATIVAS: Use a data/hora atual fornecida. "Amanhã" = dia seguinte. "Quinta" = próxima quinta-feira. "Semana que vem" = próxima segunda.
3. TÍTULOS CONCISOS: Extraia APENAS o assunto. "marcar consulta Luciana 20h quinta" → "Consulta com Luciana". "fazer INSS da Luciana" → "Fazer INSS da Luciana". "reuniao com João segunda" → "Reunião com João".
4. MENSAGENS CURTAS: Se o usuário mandar apenas palavras-chave como "INSS da Luciana fazer" ou "Protocolos pacientes", interprete como TAREFA (create_task).
5. FOTOS ANALISADAS: Quando a mensagem começar com "[Foto enviada - análise: ...]", significa que o usuário enviou uma foto e a IA já extraiu os dados. Use essas informações para criar a transação automaticamente.
6. GRAMÁTICA E ORTOGRAFIA: Toda response DEVE começar com letra maiúscula. Use acentuação correta. Use concordância verbal e nominal perfeita.
7. RESPONSE: Seja breve, direto e confirme a ação realizada. Use emojis com moderação (✅, 💰, 📅, 📌).
8. DIFERENÇA GASTOS vs RECEITAS vs TRANSAÇÕES: "Quanto gastei" = só gastos. "Quanto ganhei" = só receitas. "Minhas transações" = ambos.

EXEMPLOS:
Input: "Consulta Luciana 20h quinta feira"
Output: {"intent":"create_meeting","data":{"description":"Consulta com Luciana","meeting_date":"2026-05-22T20:00:00"},"response":"Agendado! Consulta com Luciana para quinta-feira às 20:00. 📅"}

Input: "INSS da luciana fazer"
Output: {"intent":"create_task","data":{"description":"Fazer INSS da Luciana","due_date":null},"response":"Anotado! Tarefa criada: Fazer INSS da Luciana. ✅"}

Input: "gastei 50 no mercado"
Output: {"intent":"create_transaction","data":{"description":"Mercado","amount":50,"type":"gasto","category":"Mercado"},"response":"Registrado! Gasto de R$ 50,00 em Mercado. 💸"}

Input: "recebi 3500 de salario"
Output: {"intent":"create_transaction","data":{"description":"Salário","amount":3500,"type":"receita","category":"Outros"},"response":"Registrado! Receita de R$ 3.500,00 (Salário). 💰"}

Input: "[Foto enviada - análise: Compra no Supermercado Bistek: R$ 127,45 - carnes, frutas, laticínios]"
Output: {"intent":"create_transaction","data":{"description":"Supermercado Bistek","amount":127.45,"type":"gasto","category":"Mercado"},"response":"Registrado pela foto! Gasto de R$ 127,45 no Supermercado Bistek. 📸✅"}

Input: "[Foto enviada - análise: Boleto Celesc Energia: R$ 189,30 - vence 25/05/2026]"
Output: {"intent":"create_transaction","data":{"description":"Conta de energia Celesc","amount":189.30,"type":"gasto","category":"Moradia"},"response":"Registrado pela foto! Conta de energia Celesc: R$ 189,30 (vence 25/05). ⚡✅"}

Input: "quanto eu gastei hoje?"
Output: {"intent":"list_items","data":{"item_type":"transaction","transaction_type":"gasto","date_filter":"hoje"},"response":"Buscando seus gastos de hoje..."}

Input: "quais meus compromissos de amanhã?"
Output: {"intent":"list_items","data":{"item_type":"meeting","date_filter":"amanhã"},"response":"Buscando seus compromissos de amanhã..."}

Input: "compromissos para junho"
Output: {"intent":"list_items","data":{"item_type":"meeting","date_filter":"junho"},"response":"Buscando seus compromissos de junho..."}

Input: "minhas tarefas"
Output: {"intent":"list_items","data":{"item_type":"task","date_filter":"hoje"},"response":"Buscando suas tarefas pendentes..."}

Input: "quanto eu ganhei este mês?"
Output: {"intent":"list_items","data":{"item_type":"transaction","transaction_type":"receita","date_filter":"este mês"},"response":"Buscando suas receitas deste mês..."}

Input: "oi"
Output: {"intent":"general_query","data":{},"response":"Olá! Sou o Tuddo, seu assistente pessoal. Posso te ajudar com tarefas, compromissos e finanças. O que precisa? 😊"}

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
    Deno.env.get("EVOLUTION_API_KEY") || "voce-a!!!!19951506",
    Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") || "BD8F003B34FE-44F4-BBF7-B72255FCDE25",
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
  const remoteJidAlt = typeof key.remoteJidAlt === "string" ? key.remoteJidAlt : "";

  // Prefer remoteJidAlt (contains real phone when LID addressing is used)
  // Then participant, then remoteJid
  let base = "";

  // Check if remoteJidAlt has a valid phone number format
  if (remoteJidAlt && remoteJidAlt.includes("@s.whatsapp.net")) {
    base = remoteJidAlt;
  } else if (participant && !participant.endsWith("@lid")) {
    base = participant;
  } else if (remoteJid && !remoteJid.endsWith("@lid")) {
    base = remoteJid;
  } else if (remoteJidAlt) {
    base = remoteJidAlt;
  } else if (participant) {
    base = participant;
  } else {
    base = remoteJid;
  }

  if (!base) return "";

  return base
    .replace(/:\d+/g, "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@g\.us$/i, "")
    .replace(/@lid$/i, "")
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
    const openaiKey = Deno.env.get("OPENAI_API_KEY") || "sk-kFUNco9574LrFN3B4GSoKK";
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
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "sk-kFUNco9574LrFN3B4GSoKK";
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

async function sendWhatsAppMessage(phone: string, text: string): Promise<string> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "https://evolution-api-production-6070.up.railway.app";
  const evolutionKey = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") || "BD8F003B34FE-44F4-BBF7-B72255FCDE25";
  const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") || "Tuddo";

  if (!evolutionUrl || !evolutionKey) {
    console.error("Evolution API not configured");
    return "error:not_configured";
  }

  try {
    const url = `${evolutionUrl}/message/sendText/${instanceName}`;
    console.log("Sending to:", url, "phone:", phone);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionKey,
      },
      body: JSON.stringify({ number: phone, text }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Evolution send error:", response.status, responseText);
      return `error:${response.status}:${responseText.substring(0, 100)}`;
    }

    console.log("Evolution send success:", response.status);
    return `ok:${response.status}`;
  } catch (error) {
    console.error("Evolution send error:", error);
    return `error:fetch:${String(error).substring(0, 100)}`;
  }
}

// ============================================================
// MEDIA PROCESSING — IMAGEM (OCR/Vision) E ÁUDIO (Whisper)
// ============================================================

async function getMediaBase64(messageKey: JsonRecord, message: JsonRecord): Promise<string | null> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") || "https://evolution-api-production-6070.up.railway.app";
  const evolutionKey = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") || "BD8F003B34FE-44F4-BBF7-B72255FCDE25";
  const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") || "Tuddo";

  try {
    const url = `${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": evolutionKey,
      },
      body: JSON.stringify({ message: { key: messageKey, message } }),
    });

    if (!response.ok) {
      console.error("getBase64 error:", response.status, await response.text());
      return null;
    }

    const result = await response.json();
    // Evolution API v2 returns { base64: "..." }
    if (typeof result === "string") return result;
    if (isRecord(result) && typeof result.base64 === "string") return result.base64;
    return null;
  } catch (error) {
    console.error("getMediaBase64 error:", error);
    return null;
  }
}

async function analyzeImageWithVision(base64: string, mimetype: string, caption?: string): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "sk-kFUNco9574LrFN3B4GSoKK";

  const imagePrompt = `Você é o Tuddo, assistente financeiro e de produtividade. Analise esta imagem e extraia as informações relevantes.

Se for um RECIBO, NOTA FISCAL ou COMPROVANTE DE COMPRA:
- Extraia: estabelecimento, valor total, data, itens principais
- Responda no formato: "Compra no [estabelecimento]: R$ [valor] - [itens principais]"

Se for um BOLETO ou CONTA:
- Extraia: empresa/serviço, valor, data de vencimento
- Responda no formato: "Boleto [empresa]: R$ [valor] - vence [data]"

Se for um COMPROVANTE DE PAGAMENTO/PIX:
- Extraia: destinatário, valor, data
- Responda no formato: "Pagamento para [destinatário]: R$ [valor] em [data]"

Se for QUALQUER OUTRA IMAGEM:
- Descreva brevemente o conteúdo relevante

Responda APENAS com a informação extraída de forma concisa, sem explicações adicionais.${caption ? `\n\nO usuário enviou junto a legenda: "${caption}"` : ""}`;

  try {
    const dataUrl = `data:${mimetype || "image/jpeg"};base64,${base64}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0,
        max_tokens: 500,
        messages: [
          { role: "user", content: [
            { type: "text", text: imagePrompt },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ]},
        ],
      }),
    });

    if (!response.ok) {
      console.error("Vision API error:", response.status, await response.text());
      return "";
    }

    const payload = await response.json();
    return payload?.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    console.error("analyzeImageWithVision error:", error);
    return "";
  }
}

async function transcribeAudio(base64: string, mimetype: string): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "sk-kFUNco9574LrFN3B4GSoKK";

  try {
    // Convert base64 to binary
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Determine file extension from mimetype
    let ext = "ogg";
    if (mimetype?.includes("mp4")) ext = "mp4";
    else if (mimetype?.includes("mpeg")) ext = "mp3";
    else if (mimetype?.includes("wav")) ext = "wav";
    else if (mimetype?.includes("webm")) ext = "webm";

    // Create form data with the audio file
    const formData = new FormData();
    const blob = new Blob([bytes], { type: mimetype || "audio/ogg" });
    formData.append("file", blob, `audio.${ext}`);
    formData.append("model", "gpt-4o-mini-transcribe");
    formData.append("language", "pt");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error("Whisper API error:", response.status, await response.text());
      return "";
    }

    const result = await response.json();
    return result?.text?.trim() || "";
  } catch (error) {
    console.error("transcribeAudio error:", error);
    return "";
  }
}

function detectMediaType(message: JsonRecord): "image" | "audio" | "document" | null {
  if (isRecord(message.imageMessage)) return "image";
  if (isRecord(message.audioMessage)) return "audio";
  if (isRecord(message.documentMessage)) return "document";
  return null;
}

function getMediaMimetype(message: JsonRecord): string {
  if (isRecord(message.imageMessage)) return String(message.imageMessage.mimetype || "image/jpeg");
  if (isRecord(message.audioMessage)) return String(message.audioMessage.mimetype || "audio/ogg");
  if (isRecord(message.documentMessage)) return String(message.documentMessage.mimetype || "application/pdf");
  return "";
}

function getMediaCaption(message: JsonRecord): string {
  if (isRecord(message.imageMessage) && typeof message.imageMessage.caption === "string") {
    return message.imageMessage.caption;
  }
  return "";
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
        case "próximo mês": {
          const nextMonth = new Date(spNow.getFullYear(), spNow.getMonth() + 1, 1);
          startDate = formatDate(nextMonth);
          const lastDayNext = new Date(spNow.getFullYear(), spNow.getMonth() + 2, 0);
          endDate = formatDate(lastDayNext);
          break;
        }
        default: {
          // Verificar se é um nome de mês
          const monthNames: Record<string, number> = {
            "janeiro": 0, "fevereiro": 1, "março": 2, "abril": 3,
            "maio": 4, "junho": 5, "julho": 6, "agosto": 7,
            "setembro": 8, "outubro": 9, "novembro": 10, "dezembro": 11
          };
          const monthIndex = monthNames[dateFilter.toLowerCase()];
          if (monthIndex !== undefined) {
            let year = spNow.getFullYear();
            // Se o mês já passou, assume próximo ano
            if (monthIndex < spNow.getMonth()) year++;
            startDate = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
            const lastDayMonth = new Date(year, monthIndex + 1, 0);
            endDate = formatDate(lastDayMonth);
          } else {
            startDate = formatDate(spNow);
            endDate = startDate;
          }
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
        // Buscar eventos/compromissos
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
            const dateStr = e.event_date ? ` (${new Date(e.event_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })})` : "";
            return `📅 ${e.title}${time}${dateStr}`;
          });
        }

        // Também buscar tarefas com due_date no período (são compromissos implícitos)
        const { data: tasksWithDate } = await supabase
          .from("tasks")
          .select("title, due_date")
          .eq("user_id", userId)
          .eq("status", "pendente")
          .gte("due_date", `${startDate}T00:00:00`)
          .lte("due_date", `${endDate}T23:59:59`)
          .order("due_date", { ascending: true });

        if (tasksWithDate && tasksWithDate.length > 0) {
          const taskItems = tasksWithDate.map((t: any) => {
            const d = new Date(t.due_date);
            const dateStr = ` (${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })})`;
            return `📌 ${t.title}${dateStr}`;
          });
          items = items.concat(taskItems);
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

    // Detectar mídia (imagem ou áudio)
    const mediaType = detectMediaType(message);
    let mediaProcessed = false;

    if (mediaType === "image" || mediaType === "audio") {
      // Buscar o base64 da mídia via Evolution API
      const messageKey = {
        id: typeof key.id === "string" ? key.id : "",
        remoteJid: typeof key.remoteJid === "string" ? key.remoteJid : "",
        fromMe: key.fromMe || false,
      };

      const base64 = await getMediaBase64(messageKey, message);

      if (base64) {
        const mimetype = getMediaMimetype(message);

        if (mediaType === "image") {
          const caption = getMediaCaption(message);
          const imageAnalysis = await analyzeImageWithVision(base64, mimetype, caption || text);
          if (imageAnalysis) {
            // Combinar a análise da imagem com qualquer texto/legenda
            text = caption
              ? `[Foto enviada - análise: ${imageAnalysis}] Legenda do usuário: ${caption}`
              : `[Foto enviada - análise: ${imageAnalysis}]`;
            mediaProcessed = true;
          }
        } else if (mediaType === "audio") {
          const transcription = await transcribeAudio(base64, mimetype);
          if (transcription) {
            text = transcription;
            mediaProcessed = true;
          }
        }
      }

      // Se não conseguiu processar a mídia e não tem texto
      if (!mediaProcessed && !text) {
        return new Response(JSON.stringify({ status: "media_processing_failed" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
    const sendResult = await sendWhatsAppMessage(remotePhone, reply);

    return new Response(JSON.stringify({ status: "ok", intent, sendResult, phone: remotePhone, reply: reply.substring(0, 50) }), {
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
