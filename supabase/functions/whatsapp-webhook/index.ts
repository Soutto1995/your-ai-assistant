import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PLATFORM_KNOWLEDGE, ASSISTANT_BEHAVIOR, buildWelcomeMessage } from "../_shared/platform-knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-hub-signature-256, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const categoryDictionary: Record<string, string[]> = {
  "Alimentação": ["restaurante", "almoço", "jantar", "café", "lanche", "pizza", "hambúrguer", "açaí", "sushi", "padaria", "ifood", "rappi", "mcdonald", "burger", "subway", "starbucks", "comida", "marmita", "delivery", "churrasco"],
  "Mercado": ["supermercado", "compras", "mercado", "sacolão", "hortifruti", "carne", "pão", "leite", "bistek", "angeloni", "big", "atacadão", "assai", "assaí", "frutas", "verduras", "feira", "açougue"],
  "Transporte": ["gasolina", "combustível", "uber", "99", "táxi", "metrô", "ônibus", "passagem", "estacionamento", "diesel", "etanol", "álcool", "shell", "ipiranga", "br", "posto", "pedagio", "pedágio", "seguro carro", "mecânico", "oficina", "pneu", "lav. carro", "lavagem"],
  "Moradia": ["aluguel", "condomínio", "iptu", "água", "luz", "energia", "gás", "internet", "telefone", "celesc", "casan", "sanepar", "copel", "cpfl", "vivo", "claro", "tim", "oi", "conta"],
  "Saúde": ["farmácia", "remédio", "medicamento", "consulta", "médico", "dentista", "terapia", "plano de saúde", "unimed", "drogasil", "panvel", "droga raia", "hospital", "exame", "vacina", "psicólogo"],
  "Lazer": ["cinema", "show", "bar", "festa", "viagem", "hotel", "passeio", "streaming", "netflix", "spotify", "disney", "hbo", "amazon prime", "game", "jogo", "ingresso", "parque", "praia", "cerveja", "chopp"],
  "Pessoal": ["roupa", "tênis", "sapato", "perfume", "cabelo", "barbeiro", "salão", "academia", "presente", "cosmético", "maquiagem", "smartfit", "smart fit", "shein", "renner", "riachuelo", "c&a", "zara"],
  "Educação": ["curso", "livro", "faculdade", "escola", "material escolar", "mensalidade", "apostila", "udemy", "alura"],
  "Contas": ["boleto", "fatura", "cartão", "crédito", "parcela", "financiamento", "empréstimo", "juros", "multa", "itau", "itaú", "bradesco", "nubank", "inter", "santander", "bb", "caixa", "sicoob", "sicredi"],
  "Outros": ["taxa", "imposto", "doação", "pet", "veterinario", "veterinário", "ração"],
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

// Os planos Familiares liberam exatamente o mesmo que o PRO — o que muda é
// quantas pessoas dividem a conta, não o que cada uma pode fazer. As tabelas de
// limite só conhecem FREE/STARTER/PRO, e sem esta tradução um assinante do
// Familiar caía no fallback FREE (20 lançamentos/mês).
function planTier(plan: string): string {
  const p = String(plan || "FREE").toUpperCase();
  return p.startsWith("FAMILY") ? "PRO" : p;
}

async function checkFeatureLimit(supabase: any, userId: string, plan: string, feature: "transaction" | "budget"): Promise<string | null> {
  const limits = FEATURE_LIMITS[planTier(plan)] || FEATURE_LIMITS.FREE;

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
const SYSTEM_PROMPT = `${PLATFORM_KNOWLEDGE}
${ASSISTANT_BEHAVIOR}

Você é o "Tuddo", um assistente pessoal inteligente de produtividade e finanças via WhatsApp. Você é CONVERSACIONAL — não apenas um processador de comandos. Você CONVERSA com o usuário, ENTENDE o contexto da conversa, PERGUNTA quando não tem certeza, e APRENDE com cada interação.

Sua função é interpretar o que o usuário deseja considerando TODO o histórico da conversa e retornar APENAS um objeto JSON válido, sem markdown, crases ou texto extra.

DATA/HORA ATUAL (America/Sao_Paulo): {{current_time}}

ESTRUTURA DE SAÍDA:
{"intent":"TIPO","data":{...},"response":"TEXTO"}

INTENTS DISPONÍVEIS:
1. create_transaction — registrar gasto ou receita (inclui compras, pagamentos, boletos, pix, salário)
2. create_task — criar UMA tarefa, lembrete ou to-do
2b. create_multiple_tasks — criar VÁRIAS tarefas de uma vez, quando o usuário enviar uma lista com 2 ou mais itens (ex: "Tarefas:\n1 - Arrumar perfil\n2 - Gravar vídeo\n3 - Tirar mensal"). Use SEMPRE que houver 2 ou mais tarefas na mesma mensagem — em lista numerada, com travessões, com hífens ou uma por linha.
3. create_meeting — agendar UM compromisso, reunião, consulta, visita ou evento (inclui "visitar X", "ir a X", "comparecer em X", "audiência", "ida ao" com data)
4. create_multiple_meetings — agendar VÁRIOS compromissos de uma vez, quando o usuário enviar uma lista com múltiplos horários e nomes (ex: "13:00 - Paciente Aline\n14:00 - Paciente Mariana"). Use este intent sempre que houver 2 ou mais eventos na mesma mensagem.
5. list_items — listar/consultar itens existentes (gastos, receitas, tarefas, compromissos)
5. create_goal — criar uma meta financeira (ex: "quero juntar 5000 para viagem", "meta de economizar 1000 por mês")
6. list_goals — listar metas financeiras ativas
7. create_budget — definir um limite de gasto mensal por categoria (ex: "quero limite de 500 pra Alimentação", "orçamento de 300 em Lazer", "não quero gastar mais de 200 em Transporte")
8. create_folder — criar uma pasta/categoria personalizada para organizar gastos (ex: "cria pasta Casa", "quero organizar em pastas", "1-Casa 2-Granja 3-Consultório")
9. list_folders — listar pastas do usuário (ex: "minhas pastas", "ver categorias")
10. assign_folder — associar um gasto existente a uma pasta (ex: "coloca na pasta Casa", "esse vai pra Granja")
11. search_files — procurar um ARQUIVO, FOTO, ÁUDIO ou DOCUMENTO que o usuário já enviou antes (ex: "acha o comprovante do mecânico", "cadê a foto do orçamento da obra", "busca a nota fiscal da geladeira", "onde está aquele áudio que mandei sobre o projeto X", "me manda o boleto do condomínio que te enviei")
12. create_recurring — cadastrar uma conta FIXA que se repete todo mês/semana/ano (ex: "todo dia 10 pago 1200 de aluguel", "meu salário de 5000 cai dia 5", "mensalidade da academia 120 todo dia 15", "todo mês pago 89 de streaming")
13. cash_flow — mostrar o fluxo de caixa: quanto já entrou/saiu e quanto ainda está previsto (ex: "como fica meu mês?", "quanto vai sobrar?", "fluxo de caixa", "o que ainda tenho pra pagar?", "minha previsão dos próximos meses")
14. general_query — saudações, perguntas gerais ou qualquer coisa que não se encaixe acima

REGRA CRÍTICA — PLANO FAMILIAR (o Tuddo TEM plano compartilhado):
NUNCA diga que o Tuddo é individual ou que compartilhamento "está em estudo" — é FALSO. Os planos Familiares existem e estão à venda: Familiar 2 (R$ 34,90/mês), Familiar 3 (R$ 44,90/mês) e Familiar 4 (R$ 54,90/mês).

Como funciona, e é ASSIM que você deve explicar quando perguntarem sobre incluir esposa, marido, filho, sócio ou qualquer outra pessoa:
1. A outra pessoa cria a conta dela em tuddo.pro (é grátis criar).
2. O titular entra em tuddo.pro/family e convida ela pelo e-mail OU pelo telefone que ela cadastrou.
3. Pronto: os dois passam a lançar na MESMA conta. Gasto que ela registrar pelo WhatsApp dela aparece pro titular, e vice-versa.
4. Cada gasto fica identificado por quem fez, então dá pra ver quanto cada um gastou.

Se o usuário perguntar sobre incluir outra pessoa, explique esses passos de forma clara e acolhedora. Se ele ainda não tem plano Familiar, diga o preço e mande tuddo.pro/planos.

REGRA CRÍTICA — INTENÇÃO DE COMPRA:
Se o usuário demonstrar QUALQUER intenção de assinar, contratar, fazer upgrade ou pagar (ex: "quero assinar", "quero assinar meu plano", "como faço pra pagar", "quero contratar", "quero o PRO", "quanto custa", "quero fazer upgrade", "como faço pra ser premium"), use general_query e responda SEMPRE mandando o link direto, com entusiasmo e sem enrolação:

"Que ótimo! 🎉 É rapidinho: acesse *tuddo.pro/planos*, escolha seu plano e finalize o pagamento por lá. Assim que confirmar, seu acesso é liberado na hora! 🚀\n\nQualquer dúvida no meio do caminho, é só me chamar aqui."

NUNCA responda "não consigo te ajudar com isso" para intenção de compra — é o pedido mais importante que um usuário pode fazer. Nunca escale para o suporte humano nesse caso: mande o link.

REGRAS DE EXTRAÇÃO DE DADOS:

Para create_transaction:
- data.description: descrição curta e clara (ex: "Almoço no restaurante", "Supermercado Bistek")
- data.amount: valor numérico positivo (extrair mesmo sem "R$". "50 reais" = 50. "12,90" = 12.90)
- data.type: "gasto" (gastei, paguei, comprei, boleto, conta) ou "receita" (recebi, ganhei, vendi, salário, freelance)
- data.category: uma das categorias [${Object.keys(categoryDictionary).join(", ")}]. Default: "Geral"
- data.paid_by: nome da pessoa que FEZ o gasto, quando o usuário atribui a outra pessoa (ex: "a Maria gastou 80 na farmácia" → "Maria"; "200 no cartão do João" → "João"; "meu filho gastou 50" → "Filho"). OMITIR quando o gasto é do próprio usuário.
- data.card_label: apelido do cartão/conta, quando citado (ex: "no cartão da empresa" → "Cartão da empresa"; "no Itaú Black" → "Itaú Black"). OMITIR se não for citado.

Para create_task:
- data.description: título conciso e claro da tarefa (ex: "Fazer INSS da Luciana", "Comprar leite")
- data.due_date: data no formato "YYYY-MM-DDTHH:mm:ss" (horário local São Paulo, SEM sufixo Z ou offset). Se não houver data específica, usar null.
- data.assignee_name: nome da pessoa que deve EXECUTAR a tarefa, quando o usuário delega para outra pessoa (ex: "cobra o João pelo relatório" → "João"). OMITIR quando a tarefa é do próprio usuário.
- data.assignee_phone: telefone da pessoa responsável, só dígitos com DDD (ex: "5548999887766"). OMITIR se o usuário não informar o número.
- data.recurrence: "daily", "weekdays", "weekly" ou "monthly" — apenas quando a cobrança se repete (ex: "cobra ele todo dia", "toda segunda", "todo mês"). OMITIR se for cobrança única.
- REGRA: se o usuário delegar uma tarefa mas NÃO informar o telefone da pessoa, ainda assim crie a tarefa com assignee_name e PEÇA o número na sua "response" (ex: "Anotado! Me passa o WhatsApp do João que eu começo a cobrar.").

Para create_meeting:
- data.description: título conciso do compromisso (NUNCA repita a mensagem inteira. Ex: "consulta com Luciana 20h quinta" → "Consulta com Luciana")
- data.meeting_date: data no formato "YYYY-MM-DDTHH:mm:ss" (horário local São Paulo, SEM sufixo Z ou offset). Se não houver hora explícita, use 12:00:00.

Para create_multiple_meetings:
- data.events: array de objetos, um por compromisso. Cada objeto tem:
  - description: título conciso (ex: "Paciente Aline", "Reunião com João")
  - meeting_date: "YYYY-MM-DDTHH:mm:ss" (horário local São Paulo)
- REGRA CRÍTICA: cada linha da lista vira UM objeto no array. NUNCA misture o nome de uma linha com o horário de outra. Ex: "13:00 - Paciente Aline\n14:00 - Paciente Mariana" → [{description:"Paciente Aline",meeting_date:"YYYY-MM-DDTH13:00:00"},{description:"Paciente Mariana",meeting_date:"YYYY-MM-DDTH14:00:00"}]

Para create_goal:
- data.title: título da meta (ex: "Viagem para Europa", "Reserva de emergência")
- data.target_amount: valor alvo da meta (numérico)
- data.current_amount: valor já economizado (padrão 0 se não informado)
- data.deadline: prazo no formato "YYYY-MM-DD" (null se não informado)
- data.category: categoria da meta (ex: "viagem", "emergência", "casa", "carro", "educação", "outros")

Para list_goals:
- (sem campos adicionais — lista todas as metas ativas do usuário)

Para create_budget:
- data.category: categoria de gasto (ex: "Alimentação", "Lazer", "Transporte", "Moradia", "Mercado", "Saúde", "Pessoal", "Contas"). Use uma das categorias do sistema.
- data.limit: valor máximo mensal em reais (numérico positivo)

Para create_folder:
- data.folders: array de objetos com {name, emoji}. Se o usuário listar várias pastas (ex: "1-Casa 2-Granja 3-Consultório"), crie todas. Emoji é opcional — escolha um emoji adequado ao nome.
- Exemplos: "cria pasta Casa" → [{name:"Casa", emoji:"🏠"}]. "1-Casa 2-Granja 3-Consultório" → [{name:"Casa",emoji:"🏠"},{name:"Granja",emoji:"🌾"},{name:"Consultório",emoji:"🏥"}]

Para list_folders:
- (sem campos adicionais — lista todas as pastas do usuário)

Para assign_folder:
- data.folder_name: nome da pasta onde colocar o gasto
- data.transaction_description: descrição do gasto a ser associado (se mencionado)

Para create_multiple_tasks:
- data.tasks: array de objetos, um por tarefa. Cada objeto tem:
  - description: título conciso da tarefa
  - due_date: "YYYY-MM-DDTHH:mm:ss" ou null se não houver prazo
  - assignee_name / assignee_phone / recurrence: mesmas regras do create_task, quando a pessoa delegar
- REGRA CRÍTICA: cada item da lista vira UM objeto no array. Uma mensagem como "Tarefas:\n1 - X\n2 - Y\n3 - Z" gera TRÊS objetos, nunca um só. Ignore o cabeçalho ("Tarefas:", "Lista:", "Preciso fazer:") — ele não é uma tarefa.

Para create_recurring:
- data.description: nome da conta fixa (ex: "Aluguel", "Salário", "Academia", "Netflix")
- data.amount: valor numérico positivo
- data.type: "gasto" ou "receita"
- data.category: uma das categorias do sistema
- data.frequency: "monthly" (padrão), "weekly" ou "yearly"
- data.day_of_month: dia do mês (1-31) — obrigatório para monthly e yearly
- data.day_of_week: 0=domingo … 6=sábado — obrigatório apenas para weekly
- data.month_of_year: mês (1-12) — obrigatório apenas para yearly
- DIFERENÇA CRÍTICA: create_transaction é um gasto que JÁ aconteceu ("paguei o aluguel"). create_recurring é um compromisso que se REPETE ("todo dia 10 pago aluguel"). Se o usuário usar "todo", "todos os meses", "sempre", "mensalidade", "cai dia X" → create_recurring.

Para cash_flow:
- data.months_ahead: quantos meses à frente projetar (padrão 3). Se o usuário pedir "próximos 6 meses", use 6.

Para search_files:
- data.query: o que o usuário está procurando, em linguagem natural e SEM os verbos de busca. Ex: "acha o comprovante do mecânico" → "comprovante do mecânico". "cadê aquela foto da neve" → "foto da neve". "onde está o áudio sobre o projeto Alfa" → "áudio sobre o projeto Alfa".
- data.media_type: "image", "audio", "document" — APENAS se o usuário deixar explícito o tipo. Caso contrário, OMITIR.
- ATENÇÃO: só use search_files quando o usuário procura um ARQUIVO que ELE MESMO já mandou. Para consultar gastos, tarefas ou compromissos, use list_items.

Para list_items:
- data.item_type: "transaction", "task" ou "meeting"
- data.transaction_type: APENAS para transações — "gasto" (gastos/despesas) ou "receita" (ganhos/receitas). Se pediu "transações" ou "tudo", OMITIR este campo.
- data.date_filter: "hoje", "ontem", "amanhã", "esta semana", "este mês", "próximo mês", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"

REGRAS CRÍTICAS DE INTERPRETAÇÃO:
1. HORÁRIOS: "14h" = 14:00:00. "9h" = 09:00:00. "3 da tarde" = 15:00:00. "20h" = 20:00:00. "meio-dia" = 12:00:00. NUNCA converta para UTC.
2. DATAS RELATIVAS: Use a data/hora atual fornecida. "Amanhã" = dia seguinte. "Quinta" = próxima quinta-feira. "Semana que vem" = próxima segunda.
3. TÍTULOS CONCISOS: Extraia APENAS o assunto. "marcar consulta Luciana 20h quinta" → "Consulta com Luciana". "fazer INSS da Luciana" → "Fazer INSS da Luciana". "reuniao com João segunda" → "Reunião com João".
4. MENSAGENS CURTAS SEM CONTEXTO: Se o usuário mandar apenas palavras-chave como "INSS da Luciana fazer" ou "Protocolos pacientes" E NÃO HOUVER histórico de conversa indicando outro intent, interprete como TAREFA (create_task). MAS se houver histórico indicando que ele está listando pastas/categorias, interprete de acordo com o contexto.
5. FOTOS ANALISADAS: Quando a mensagem começar com "[Foto enviada - análise: ...]", significa que o usuário enviou uma foto e a IA já extraiu os dados. Use essas informações para criar a transação automaticamente.
6. GRAMÁTICA E ORTOGRAFIA: Toda response DEVE começar com letra maiúscula. Use acentuação correta. Use concordância verbal e nominal perfeita.
7. RESPONSE: Seja breve, direto e confirme a ação realizada. Use emojis com moderação (✅, 💰, 📅, 📌).
8. DIFERENÇA GASTOS vs RECEITAS vs TRANSAÇÕES: "Quanto gastei" = só gastos. "Quanto ganhei" = só receitas. "Minhas transações" = ambos.
9. METAS FINANCEIRAS: "Quero juntar X para Y", "Meta de economizar X", "Estou guardando para X", "Minha meta é X" → create_goal. "Minhas metas", "Ver metas", "Quanto falta para X" → list_goals.
20. ORÇAMENTOS: "Quero limite de X pra Y", "Orçamento de X em Y", "Limite de gastos Y de X", "Não quero gastar mais de X em Y", "Definir orçamento" → create_budget.
21. AGENDA COM MÚLTIPLOS HORÁRIOS: Quando a mensagem contiver uma lista com 2 ou mais linhas no formato "HH:MM - Nome" ou similar (agenda de pacientes, reuniões do dia, programação), use SEMPRE create_multiple_meetings — NUNCA create_meeting. Extraia cada linha como um objeto separado no array data.events. O dia/data pode estar no início da mensagem ("Sexta feira", "amanhã") e se aplica a TODOS os eventos da lista.
14. PASTAS/CATEGORIAS PERSONALIZADAS: "Quero organizar em pastas", "Criar pasta Casa", "1-Casa 2-Granja 3-Consultório", "Minhas pastas" → create_folder ou list_folders. Se o contexto já indicar claramente a pasta (ex: "gastei 50 na granja"), associe automaticamente adicionando data.folder_name. NÃO pergunte em qual pasta colocar um gasto automaticamente — isso só acontece quando o próprio usuário pedir (ex: "coloca esse gasto na pasta Casa" → assign_folder). Fora isso, apenas categorize normalmente (data.category) e siga em frente.
15. COMPORTAMENTO CONVERSACIONAL (REGRA MAIS IMPORTANTE):
- Você NÃO é um robô. Você é um assistente que CONVERSA como um humano.
- SEMPRE leia o HISTÓRICO DA CONVERSA antes de decidir o intent. O histórico é enviado entre [HISTÓRICO] e [/HISTÓRICO].
- Se o usuário está no MEIO de uma conversa sobre organizar pastas e manda "1 - Casa", isso é uma PASTA, não uma tarefa ou gasto.
- Se o usuário manda "Não é X" ou "Não, é Y", ele está CORRIGINDO algo. Entenda a correção e aja de acordo.
- Quando o usuário listar itens numerados ("1-Casa 2-Granja 3-Uber"), interprete TODOS como parte da mesma ação (criar pastas, se estavam falando de pastas).
- Se a mensagem é AMBÍGUA e pode ser várias coisas, use general_query e PERGUNTE ao usuário o que ele quis dizer.
- NUNCA crie transações ou tarefas quando o usuário está claramente tentando ORGANIZAR ou LISTAR categorias.
- Quando não tiver certeza: PERGUNTE. É melhor perguntar do que fazer errado.
- Seja empático, natural e paciente. O cliente pode não saber usar o app — guie ele com carinho.
16. CONTEXTO DE CONVERSA: Se o histórico mostrar que o usuário estava falando sobre organizar gastos em pastas/grupos/categorias, e ele mandar mensagens curtas como "1 Casa", "2 Granja", "3 Uber", "E grupo 3 Uber", "Não é grupo 2 Granja" — tudo isso faz parte da MESMA CONVERSA sobre criar pastas. Interprete como create_folder ou como correção/complemento da lista de pastas.
17. CORREÇÕES DO USUÁRIO: Se o usuário diz "Não é X" ou "Não, é Y", ele está corrigindo algo que você entendeu errado. Responda reconhecendo o erro, peça desculpas brevemente, e pergunte como ele gostaria que fosse feito.
18. PRIORIDADE DE INTERPRETAÇÃO (ORDEM):
   a) Primeiro: Leia o histórico e entenda o CONTEXTO da conversa
   b) Segundo: Se a mensagem faz sentido dentro do contexto atual, interprete nesse contexto
   c) Terceiro: Só se NÃO houver histórico ou a mensagem claramente mudar de assunto, interprete isoladamente
   d) Quarto: Na dúvida, use general_query e PERGUNTE
10. PAGAMENTOS FUTUROS vs REALIZADOS: Se o usuário diz "Pagar X dia Y" ou "Pagar X no dia Y" com uma DATA FUTURA, é um LEMBRETE (create_task com due_date). Se diz "Paguei X" ou "Gastei X" (passado), é uma transação já realizada (create_transaction). REGRA: verbo no INFINITIVO + data futura = create_task. Verbo no PASSADO = create_transaction.
11. CONTAS A VENCER: "Conta de luz dia 15", "Boleto dia 20", "Pagar aluguel dia 10" → SEMPRE create_task com due_date, pois são lembretes de pagamentos futuros.
12. PARCELAMENTOS: Se o usuário mencionar "em Xx", "parcelado", "em X vezes", "X parcelas", adicione data.installments (número de parcelas) e data.installment_amount (valor de cada parcela = valor total / parcelas). Ex: "Comprei TV 2000 em 10x" → amount: 2000, installments: 10, installment_amount: 200. O intent continua sendo create_transaction.
13. CATEGORIZAÇÃO INTELIGENTE: Sempre tente inferir a categoria pelo contexto. "Bistek" = Mercado. "Shell" = Transporte. "Farmácia" = Saúde. "Netflix" = Lazer. Se não souber, use "Geral".

EXEMPLOS:
Input: "amanhã visitar presídio"
Output: {"intent":"create_meeting","data":{"description":"Visita ao presídio","meeting_date":"2026-07-17T09:00:00"},"response":"Agendado! Visita ao presídio amanhã às 09:00. 📅"}

Input: "segunda ir ao cartório"
Output: {"intent":"create_meeting","data":{"description":"Ida ao cartório","meeting_date":"2026-07-21T09:00:00"},"response":"Agendado! Ida ao cartório na segunda às 09:00. 📅"}

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

Input: "Pagar 342 Itau dia 25"
Output: {"intent":"create_task","data":{"description":"Pagar Itaú R$ 342","due_date":"2026-05-25T09:00:00"},"response":"Lembrete criado! Pagar Itaú R$ 342,00 no dia 25. Vou te avisar na data. 📌"}

Input: "Pagar aluguel dia 10"
Output: {"intent":"create_task","data":{"description":"Pagar aluguel","due_date":"2026-06-10T09:00:00"},"response":"Lembrete criado! Pagar aluguel no dia 10. Vou te avisar na data. 📌"}

Input: "Paguei 342 no Itau"
Output: {"intent":"create_transaction","data":{"description":"Pagamento Itaú","amount":342,"type":"gasto","category":"Contas"},"response":"Registrado! Gasto de R$ 342,00 — Pagamento Itaú. 💸"}

Input: "Comprei uma TV de 2000 em 10x"
Output: {"intent":"create_transaction","data":{"description":"TV","amount":2000,"type":"gasto","category":"Pessoal","installments":10,"installment_amount":200},"response":"Registrado! Compra de TV: R$ 2.000,00 em 10x de R$ 200,00. Vou registrar as parcelas mensais automaticamente. 💳"}

Input: "gastei 600 em roupas em 3x"
Output: {"intent":"create_transaction","data":{"description":"Roupas","amount":600,"type":"gasto","category":"Pessoal","installments":3,"installment_amount":200},"response":"Registrado! Compra de Roupas: R$ 600,00 em 3x de R$ 200,00. Parcelas registradas! 💳"}

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

Input: "Quero juntar 5000 para uma viagem em dezembro"
Output: {"intent":"create_goal","data":{"title":"Viagem","target_amount":5000,"current_amount":0,"deadline":"2026-12-31","category":"viagem"},"response":"Meta criada! 🎯 Você quer juntar R$ 5.000,00 para Viagem até dezembro. Vou acompanhar seu progresso!"}

Input: "minhas metas"
Output: {"intent":"list_goals","data":{},"response":"Buscando suas metas financeiras..."}

Input: "Agenda Sexta feira\n\n13:00 - Paciente Aline\n14:00 - Paciente Mariana\n15:00 - Paciente Eliziane"
Output: {"intent":"create_multiple_meetings","data":{"events":[{"description":"Paciente Aline","meeting_date":"2026-07-17T13:00:00"},{"description":"Paciente Mariana","meeting_date":"2026-07-17T14:00:00"},{"description":"Paciente Eliziane","meeting_date":"2026-07-17T15:00:00"}]},"response":"Agenda de sexta-feira salva! 3 atendimentos registrados:\n\n📅 Paciente Aline às 13:00\n📅 Paciente Mariana às 14:00\n📅 Paciente Eliziane às 15:00"}

Input: "Reuniões amanhã: 9h João, 11h Maria, 15h Pedro"
Output: {"intent":"create_multiple_meetings","data":{"events":[{"description":"Reunião com João","meeting_date":"2026-07-17T09:00:00"},{"description":"Reunião com Maria","meeting_date":"2026-07-17T11:00:00"},{"description":"Reunião com Pedro","meeting_date":"2026-07-17T15:00:00"}]},"response":"3 reuniões agendadas para amanhã:\n\n📅 Reunião com João às 09:00\n📅 Reunião com Maria às 11:00\n📅 Reunião com Pedro às 15:00"}

Input: "quero limite de 500 pra Alimentação"
Output: {"intent":"create_budget","data":{"category":"Alimentação","limit":500},"response":"Orçamento definido! 📊 *Alimentação*: limite de R$ 500,00/mês. Vou te avisar quando se aproximar do limite!"}

Input: "orçamento de 300 reais em Lazer"
Output: {"intent":"create_budget","data":{"category":"Lazer","limit":300},"response":"Orçamento definido! 📊 *Lazer*: limite de R$ 300,00/mês."}

Input: "oi"
Output: {"intent":"general_query","data":{},"response":"Olá! Sou o Tuddo, seu assistente pessoal. Posso te ajudar com tarefas, compromissos e finanças. O que precisa? 😊"}

Input: "quero organizar meus gastos em pastas"
Output: {"intent":"general_query","data":{},"response":"Ótima ideia! Organizar seus gastos em pastas facilita muito o controle. 📁\n\nVocê pode criar pastas como: Casa, Carro, Consultório, Granja, Pessoa Física, CNPJ...\n\nMe diz: quais pastas fazem sentido pra sua vida? Pode listar assim:\n1 - Casa\n2 - Granja\n3 - Consultório\n\nOu me conta como você divide seus gastos que eu te ajudo a montar!"}

Input: "1-Casa 2-Granja 3-Consultório"
Output: {"intent":"create_folder","data":{"folders":[{"name":"Casa","emoji":"🏠"},{"name":"Granja","emoji":"🌾"},{"name":"Consultório","emoji":"🏥"}]},"response":"Pronto! Criei suas pastas:\n\n🏠 Casa\n🌾 Granja\n🏥 Consultório\n\nQuando você mencionar o nome da pasta no gasto (ex: "gastei 50 na Granja"), eu já registro direto lá. Se esquecer, é só me pedir depois: "coloca esse gasto na Casa". 💪"}

Input: "gastei 200 de ração" (usuário tem pastas: Casa, Granja, Consultório)
Output: {"intent":"create_transaction","data":{"description":"Ração","amount":200,"type":"gasto","category":"Outros","folder_name":"Granja"},"response":"Registrado! Gasto de R$ 200,00 em Ração. 💸\nColoquei na pasta 🌾 Granja. Certinho?"}

Input: "minhas pastas"
Output: {"intent":"list_folders","data":{},"response":"Buscando suas pastas..."}

Input: "Quero assinar meu plano"
Output: {"intent":"general_query","data":{},"response":"Que ótimo! 🎉 É rapidinho: acesse *tuddo.pro/planos*, escolha seu plano e finalize o pagamento por lá. Assim que confirmar, seu acesso é liberado na hora! 🚀\n\nQualquer dúvida no meio do caminho, é só me chamar aqui."}

Input: "como faço pra pagar?"
Output: {"intent":"general_query","data":{},"response":"É simples! 😊 Acesse *tuddo.pro/planos*, escolha o plano que faz sentido pra você e finalize por lá. O acesso libera na hora. 🚀"}

Input: "quanto custa o PRO?"
Output: {"intent":"general_query","data":{},"response":"O PRO sai por R$ 24,90/mês (ou R$ 239,90/ano, que dá 2 meses de desconto). Ele te dá mensagens e lançamentos ilimitados. 💎\n\nPra assinar: *tuddo.pro/planos*"}

Input: "Tarefas:\n\n1 - Arrumar perfil Facebook postagens\n2 - Vídeo sobre Facebook manychat\n3 - Tirar mensal do Tuddo"
Output: {"intent":"create_multiple_tasks","data":{"tasks":[{"description":"Arrumar perfil Facebook postagens","due_date":null},{"description":"Vídeo sobre Facebook manychat","due_date":null},{"description":"Tirar mensal do Tuddo","due_date":null}]},"response":"Anotei suas 3 tarefas! ✅\n\n1. Arrumar perfil Facebook postagens\n2. Vídeo sobre Facebook manychat\n3. Tirar mensal do Tuddo\n\nSe quiser prazo ou responsável em alguma, é só falar."}

Input: "preciso fazer: comprar leite, pagar o boleto e ligar pro dentista"
Output: {"intent":"create_multiple_tasks","data":{"tasks":[{"description":"Comprar leite","due_date":null},{"description":"Pagar o boleto","due_date":null},{"description":"Ligar pro dentista","due_date":null}]},"response":"Anotei suas 3 tarefas! ✅\n\n1. Comprar leite\n2. Pagar o boleto\n3. Ligar pro dentista"}

Input: "todo dia 10 pago 1200 de aluguel"
Output: {"intent":"create_recurring","data":{"description":"Aluguel","amount":1200,"type":"gasto","category":"Moradia","frequency":"monthly","day_of_month":10},"response":"Anotado como conta fixa! 🔁\n\n🏠 *Aluguel* — R$ 1.200,00 todo dia 10\n\nAgora ela já entra na sua projeção de fluxo de caixa."}

Input: "meu salário de 5000 cai dia 5"
Output: {"intent":"create_recurring","data":{"description":"Salário","amount":5000,"type":"receita","category":"Outros","frequency":"monthly","day_of_month":5},"response":"Registrado! 💰\n\n*Salário* — R$ 5.000,00 todo dia 5\n\nJá contei na sua projeção."}

Input: "paguei o aluguel de 1200" (JÁ aconteceu — não é conta fixa)
Output: {"intent":"create_transaction","data":{"description":"Aluguel","amount":1200,"type":"gasto","category":"Moradia"},"response":"Registrado! Gasto de R$ 1.200,00 em Moradia. 🏠"}

Input: "como fica meu mês?"
Output: {"intent":"cash_flow","data":{"months_ahead":3},"response":"Calculando seu fluxo de caixa..."}

Input: "quanto ainda tenho pra pagar esse mês?"
Output: {"intent":"cash_flow","data":{"months_ahead":1},"response":"Calculando seu fluxo de caixa..."}

Input: "a Maria gastou 80 na farmácia"
Output: {"intent":"create_transaction","data":{"description":"Farmácia","amount":80,"type":"gasto","category":"Saúde","paid_by":"Maria"},"response":"Registrado! Gasto de R$ 80,00 em Saúde. 💸\n👤 Maria"}

Input: "300 de gasolina no cartão da empresa"
Output: {"intent":"create_transaction","data":{"description":"Gasolina","amount":300,"type":"gasto","category":"Transporte","card_label":"Cartão da empresa"},"response":"Registrado! Gasto de R$ 300,00 em Transporte. ⛽\n💳 Cartão da empresa"}

Input: "meu filho gastou 45 no lanche"
Output: {"intent":"create_transaction","data":{"description":"Lanche","amount":45,"type":"gasto","category":"Alimentação","paid_by":"Filho"},"response":"Registrado! Gasto de R$ 45,00 em Alimentação. 🍔\n👤 Filho"}

Input: "cobra o João o relatório de vendas até sexta 18h, o número dele é 48 99988-7766"
Output: {"intent":"create_task","data":{"description":"Relatório de vendas","due_date":"2026-05-23T18:00:00","assignee_name":"João","assignee_phone":"5548999887766"},"response":"Combinado! Vou cobrar o João pelo relatório de vendas até sexta às 18:00. Você não precisa fazer o papel de chato. 😉"}

Input: "todo dia às 9h cobra a Maria o relatório diário, 11 98765-4321"
Output: {"intent":"create_task","data":{"description":"Relatório diário","due_date":"2026-05-22T09:00:00","assignee_name":"Maria","assignee_phone":"5511987654321","recurrence":"daily"},"response":"Feito! Vou cobrar a Maria todo dia às 09:00 pelo relatório diário. 🔁"}

Input: "manda o Pedro me entregar a planilha amanhã"
Output: {"intent":"create_task","data":{"description":"Entregar a planilha","due_date":"2026-05-22T09:00:00","assignee_name":"Pedro"},"response":"Anotado! Me passa o WhatsApp do Pedro (com DDD) que eu começo a cobrar. 📱"}

Input: "acha aquele comprovante do mecânico que te mandei"
Output: {"intent":"search_files","data":{"query":"comprovante do mecânico"},"response":"Procurando no seu drive..."}

Input: "cadê a foto do orçamento da obra?"
Output: {"intent":"search_files","data":{"query":"foto do orçamento da obra","media_type":"image"},"response":"Procurando no seu drive..."}

Input: "o que eu falei sobre o projeto Alfa?"
Output: {"intent":"search_files","data":{"query":"projeto Alfa"},"response":"Procurando no seu drive..."}

Input: "me manda a nota fiscal da geladeira"
Output: {"intent":"search_files","data":{"query":"nota fiscal da geladeira"},"response":"Procurando no seu drive..."}

Input: "quanto gastei esse mês?" (NÃO é busca de arquivo — é consulta de gastos)
Output: {"intent":"list_items","data":{"item_type":"transaction","transaction_type":"gasto","date_filter":"este mês"},"response":"Buscando seus gastos deste mês..."}

EXEMPLOS COM HISTÓRICO DE CONVERSA (FUNDAMENTAL):

Input com histórico:
[HISTÓRICO]
USUÁRIO: Preciso organizar meus gastos em três pastas
TUDDO: Ótima ideia! Me diz: quais pastas fazem sentido pra sua vida?
USUÁRIO: Pode ser em grupos
TUDDO: Sim! Pode me dizer os nomes dos grupos/pastas que você quer criar?
[/HISTÓRICO]
Mensagem atual: "1 - Casa"
Output: {"intent":"general_query","data":{},"response":"Perfeito! Então a primeira pasta é Casa. 🏠\n\nE as outras duas? Pode continuar listando:\n2 - ?\n3 - ?"}

Input com histórico:
[HISTÓRICO]
USUÁRIO: Preciso organizar meus gastos em três pastas
TUDDO: Ótima ideia! Me diz: quais pastas fazem sentido pra sua vida?
USUÁRIO: 1 - Casa
TUDDO: Perfeito! Primeira pasta: Casa. E as outras?
USUÁRIO: 2 Granja
TUDDO: Ótimo! 1-Casa, 2-Granja. E a terceira?
[/HISTÓRICO]
Mensagem atual: "3 Uber"
Output: {"intent":"create_folder","data":{"folders":[{"name":"Casa","emoji":"🏠"},{"name":"Granja","emoji":"🌾"},{"name":"Uber","emoji":"🚗"}]},"response":"Pronto! Criei suas 3 pastas:\n\n🏠 Casa\n🌾 Granja\n🚗 Uber\n\nQuando você mencionar o nome da pasta no gasto (ex: "gastei 50 na Granja"), eu já registro direto lá. Se esquecer, é só me pedir depois: "coloca esse gasto na Casa". 💪"}

Input com histórico:
[HISTÓRICO]
USUÁRIO: 2 Granja
TUDDO: Registrado! Gasto de R$ 2,00 em Granja.
[/HISTÓRICO]
Mensagem atual: "Não é grupo 2 Granja"
Output: {"intent":"general_query","data":{},"response":"Desculpa! Entendi errado. 😅 Você quis dizer que \"Granja\" é o nome da sua segunda pasta/grupo, certo? Não era um gasto.\n\nMe confirma: você quer criar as pastas:\n1 - Casa\n2 - Granja\n3 - ?\n\nQual seria a terceira?"}

Input com histórico:
[HISTÓRICO]
USUÁRIO: Não é grupo 2 Granja
TUDDO: Desculpa! Você quis dizer que Granja é o nome da segunda pasta?
[/HISTÓRICO]
Mensagem atual: "E grupo 3 Uber"
Output: {"intent":"create_folder","data":{"folders":[{"name":"Casa","emoji":"🏠"},{"name":"Granja","emoji":"🌾"},{"name":"Uber","emoji":"🚗"}]},"response":"Agora sim! Criei suas pastas:\n\n🏠 Casa\n🌾 Granja\n🚗 Uber\n\nQuando você mencionar o nome da pasta no gasto (ex: "gastei 50 na Granja"), eu já registro direto lá. Se esquecer, é só me pedir depois: "coloca esse gasto na Casa". 💪"}

Retorne APENAS o JSON.`;

type JsonRecord = Record<string, unknown>;

type AiResult = {
  intent: "create_task" | "create_transaction" | "create_meeting" | "create_multiple_meetings" | "create_multiple_tasks" | "list_items" | "create_goal" | "list_goals" | "create_budget" | "create_folder" | "list_folders" | "assign_folder" | "search_files" | "create_recurring" | "cash_flow" | "general_query";
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
  // EVOLUTION_WEBHOOK_TOKEN: token que a Evolution API envia nos headers para autenticar webhooks recebidos
  const acceptedTokens = [
    Deno.env.get("EVOLUTION_WEBHOOK_TOKEN") ?? "",
    Deno.env.get("EVOLUTION_API_KEY") ?? "",
    Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") ?? "",
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

const VALID_RECURRENCES = ["daily", "weekdays", "weekly", "monthly"];

// Normaliza o telefone do responsável para o formato 55DDD9XXXXXXXX, que é o
// que a Meta e a Evolution esperam para enviar mensagem.
function normalizeAssigneePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Sem código do país: assume Brasil
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;

  if (!digits.startsWith("55")) return digits.length >= 10 ? digits : null;

  // 55 + DDD(2) + número(8 ou 9)
  if (digits.length === 12) {
    // Celular antigo sem o nono dígito — acrescenta
    digits = `${digits.slice(0, 4)}9${digits.slice(4)}`;
  }

  return digits.length === 13 ? digits : null;
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
      intent: ["create_task", "create_transaction", "create_meeting", "create_multiple_meetings", "create_multiple_tasks", "list_items", "create_goal", "list_goals", "create_budget", "create_folder", "list_folders", "assign_folder", "search_files", "create_recurring", "cash_flow", "general_query"].includes(intent)
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
  const planConfig = PLAN_LIMITS[planTier(plan)] ?? PLAN_LIMITS.FREE;
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
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiKey) return "Geral";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1",
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
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
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

    // response_format json_object: o modelo passa a ser OBRIGADO a devolver JSON
    // válido. Sem isso ele às vezes respondia em prosa, o extractAiJson falhava
    // e o cliente recebia "não consegui interpretar com precisão" para uma
    // pergunta perfeitamente clara — aconteceu duas vezes seguidas com um
    // cliente pagante que só queria saber por que a tela da família não abria.
    const askOpenAI = async () =>
      await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPromptWithTime },
            { role: "user", content: message },
          ],
        }),
      });

    let response = await askOpenAI();

    if (!response.ok) {
      const detalhe = await response.text();
      console.error("OpenAI error:", response.status, detalhe);
      return {
        intent: "general_query",
        data: {},
        response: "Recebi sua mensagem, mas estou com dificuldade para processar agora. Tente novamente! 🙏",
      };
    }

    let payload = await response.json();
    let content = payload?.choices?.[0]?.message?.content;
    let aiJson = typeof content === "string" ? extractAiJson(content) : null;

    // Cinto e suspensório: se ainda assim vier algo inesperado, tenta uma vez
    // mais antes de admitir derrota para o cliente.
    if (!aiJson) {
      console.warn("Resposta da IA fora do formato esperado, tentando novamente");
      response = await askOpenAI();
      if (response.ok) {
        payload = await response.json();
        content = payload?.choices?.[0]?.message?.content;
        aiJson = typeof content === "string" ? extractAiJson(content) : null;
      }
    }

    if (!aiJson) {
      console.error("IA falhou duas vezes em devolver JSON válido");
      return {
        intent: "general_query",
        data: {},
        response:
          "Puxa, me embananei aqui e não consegui processar isso agora. 😅\n\n" +
          "Tenta de novo em instantes? Se continuar, me avisa que eu chamo alguém do time pra te ajudar.",
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
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") ?? "";
  const evolutionKey = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") ?? "";
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

async function sendMessageMeta(phoneNumberId: string, to: string, text: string): Promise<string> {
  const token = Deno.env.get("META_ACCESS_TOKEN") ?? "";
  if (!token) {
    console.error("META_ACCESS_TOKEN not configured");
    return "error:not_configured";
  }
  try {
    const url = `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      console.error("Meta send error:", response.status, responseText);
      return `error:${response.status}:${responseText.substring(0, 100)}`;
    }
    console.log("Meta send success:", response.status);
    return `ok:${response.status}`;
  } catch (error) {
    console.error("Meta send error:", error);
    return `error:fetch:${String(error).substring(0, 100)}`;
  }
}

// ============================================================
// MEDIA PROCESSING — IMAGEM (OCR/Vision) E ÁUDIO (Whisper)
// ============================================================

async function getMediaBase64(messageKey: JsonRecord, message: JsonRecord): Promise<string | null> {
  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") ?? "";
  const evolutionKey = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") ?? "";
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

async function getMetaMediaBase64(mediaId: string): Promise<string | null> {
  const token = Deno.env.get("META_ACCESS_TOKEN") ?? "";
  if (!token) {
    console.error("META_ACCESS_TOKEN not configured");
    return null;
  }
  try {
    const lookupResponse = await fetch(`https://graph.facebook.com/v23.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!lookupResponse.ok) {
      console.error("getMetaMediaBase64 lookup error:", lookupResponse.status, await lookupResponse.text());
      return null;
    }
    const lookup = await lookupResponse.json();
    const mediaUrl = typeof lookup?.url === "string" ? lookup.url : "";
    if (!mediaUrl) return null;

    const mediaResponse = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!mediaResponse.ok) {
      console.error("getMetaMediaBase64 download error:", mediaResponse.status);
      return null;
    }
    const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  } catch (error) {
    console.error("getMetaMediaBase64 error:", error);
    return null;
  }
}

async function analyzeImageWithVision(base64: string, mimetype: string, caption?: string): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

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
        model: "gpt-4.1",
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
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

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

function base64ToBytes(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function extensionForMime(mimetype: string): string {
  const m = (mimetype || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("heic")) return "heic";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg")) return "mp3";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  if (m.includes("wordprocessingml")) return "docx";
  if (m.includes("spreadsheetml")) return "xlsx";
  if (m.includes("msword")) return "doc";
  if (m.includes("excel")) return "xls";
  return "bin";
}

// Embedding do conteúdo textual do arquivo — é isso que permite achar
// "aquele comprovante do mecânico" sem lembrar o nome do arquivo.
async function generateEmbedding(input: string): Promise<number[] | null> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const cleaned = (input || "").trim().slice(0, 8000);
  if (!openaiKey || !cleaned) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "text-embedding-3-small", input: cleaned }),
    });

    if (!response.ok) {
      console.error("Embeddings API error:", response.status, await response.text());
      return null;
    }

    const payload = await response.json();
    const vector = payload?.data?.[0]?.embedding;
    return Array.isArray(vector) ? vector : null;
  } catch (error) {
    console.error("generateEmbedding error:", error);
    return null;
  }
}

interface PendingMedia {
  base64: string;
  mimetype: string;
  mediaType: "image" | "audio" | "document";
  fileName: string;
  caption: string;
  contentText: string;
}

// Salva a mídia no bucket privado e indexa o conteúdo extraído.
// Nunca lança: falha no drive não pode derrubar o registro do gasto/tarefa.
async function saveToDrive(supabase: any, userId: string, media: PendingMedia): Promise<void> {
  try {
    const bytes = base64ToBytes(media.base64);
    const ext = extensionForMime(media.mimetype);
    const objectId = crypto.randomUUID();
    const storagePath = `${userId}/${objectId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("drive")
      .upload(storagePath, bytes, {
        contentType: media.mimetype || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error("saveToDrive upload error:", uploadError);
      return;
    }

    // O texto indexado junta legenda + conteúdo extraído, para que tanto o que
    // o usuário escreveu quanto o que está dentro do arquivo sejam pesquisáveis.
    const indexText = [media.caption, media.contentText, media.fileName]
      .filter((part) => part && part.trim())
      .join(" — ");
    const embedding = await generateEmbedding(indexText);

    const { error: insertError } = await supabase.from("files").insert({
      user_id: userId,
      storage_path: storagePath,
      file_name: media.fileName || `${media.mediaType}-${objectId}.${ext}`,
      mime_type: media.mimetype || null,
      media_type: media.mediaType,
      size_bytes: bytes.length,
      content_text: media.contentText || null,
      caption: media.caption || null,
      embedding,
      source: "whatsapp",
    });

    if (insertError) {
      console.error("saveToDrive insert error:", insertError);
      return;
    }

    console.log(`Drive: arquivo ${media.mediaType} salvo para ${userId} (${bytes.length} bytes, embedding=${embedding ? "sim" : "não"})`);
  } catch (error) {
    console.error("saveToDrive error:", error);
  }
}

function formatFileDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "";
  }
}

const MEDIA_TYPE_ICONS: Record<string, string> = {
  image: "🖼️",
  audio: "🎙️",
  document: "📄",
};

async function searchDriveFiles(supabase: any, userId: string, query: string): Promise<string> {
  const cleanQuery = (query || "").trim();
  if (!cleanQuery) {
    return "Me diz o que você está procurando — ex: \"acha o comprovante do mecânico\". 🔎";
  }

  const embedding = await generateEmbedding(cleanQuery);
  let matches: any[] = [];

  if (embedding) {
    const { data, error } = await supabase.rpc("search_files", {
      p_user_id: userId,
      p_query_embedding: JSON.stringify(embedding),
      p_match_count: 5,
      p_threshold: 0.15,
    });
    if (error) {
      console.error("searchDriveFiles rpc error:", error);
    } else if (Array.isArray(data)) {
      matches = data;
    }
  }

  // Fallback textual: arquivos antigos sem embedding, ou embedding indisponível
  if (matches.length === 0) {
    const { data } = await supabase
      .from("files")
      .select("id, file_name, media_type, storage_path, content_text, caption, created_at")
      .eq("user_id", userId)
      .or(`content_text.ilike.%${cleanQuery}%,caption.ilike.%${cleanQuery}%,file_name.ilike.%${cleanQuery}%`)
      .order("created_at", { ascending: false })
      .limit(5);
    if (Array.isArray(data)) matches = data;
  }

  if (matches.length === 0) {
    return `Não achei nada sobre "${cleanQuery}" no seu drive. 🤔\n\nTudo que você me manda (foto, áudio, documento) fica guardado aqui — talvez esse arquivo ainda não tenha passado por mim.`;
  }

  const lines: string[] = [`Achei ${matches.length === 1 ? "1 arquivo" : `${matches.length} arquivos`} sobre "${cleanQuery}": 🔎\n`];

  for (const match of matches) {
    const { data: signed } = await supabase.storage
      .from("drive")
      .createSignedUrl(match.storage_path, 60 * 60 * 24);

    const icon = MEDIA_TYPE_ICONS[match.media_type] || "📎";
    const date = formatFileDate(match.created_at);
    const summary = String(match.caption || match.content_text || match.file_name || "").trim().slice(0, 120);

    lines.push(`${icon} *${summary || match.file_name}*${date ? `\n   ${date}` : ""}${signed?.signedUrl ? `\n   ${signed.signedUrl}` : ""}`);
  }

  lines.push("\n_Os links valem por 24h._");
  return lines.join("\n");
}

// ============================================================
// FLUXO DE CAIXA
// ============================================================

function clampInt(value: unknown, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i >= min && i <= max ? i : null;
}

const WEEKDAY_NAMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function describeFrequency(
  frequency: string,
  dayOfMonth: number | null,
  dayOfWeek: number | null,
  monthOfYear: number | null,
): string {
  if (frequency === "weekly" && dayOfWeek !== null) return `toda ${WEEKDAY_NAMES[dayOfWeek]}`;
  if (frequency === "yearly" && dayOfMonth !== null && monthOfYear !== null) {
    return `todo dia ${dayOfMonth} de ${MONTH_NAMES[monthOfYear - 1]}`;
  }
  if (dayOfMonth !== null) return `todo dia ${dayOfMonth}`;
  return "todo mês";
}

function brl(value: number): string {
  return `R$ ${Math.abs(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthLabel(monthIso: string): string {
  const [year, month] = monthIso.split("-").map(Number);
  return `${MONTH_NAMES[(month ?? 1) - 1]}/${String(year).slice(2)}`;
}

async function buildCashFlowReply(supabase: any, userId: string, monthsAhead: number): Promise<string> {
  const { data, error } = await supabase.rpc("cash_flow", {
    p_user_id: userId,
    p_months_back: 0,
    p_months_ahead: monthsAhead,
  });

  if (error) {
    console.error("cash_flow rpc error:", error);
    return "Não consegui montar seu fluxo de caixa agora. Tenta de novo em instantes? 😅";
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) {
    return "Ainda não tenho dados suficientes para projetar seu fluxo. 📊\n\nRegistre seus gastos e me conte suas contas fixas (ex: \"todo dia 10 pago 1200 de aluguel\") que eu monto a previsão.";
  }

  const lines: string[] = ["*Seu fluxo de caixa* 📊\n"];
  let hasProjection = false;

  for (const row of rows) {
    const realizedIncome = Number(row.realized_income) || 0;
    const realizedExpense = Number(row.realized_expense) || 0;
    const projectedIncome = Number(row.projected_income) || 0;
    const projectedExpense = Number(row.projected_expense) || 0;

    const realizedBalance = realizedIncome - realizedExpense;
    const totalBalance = realizedIncome + projectedIncome - realizedExpense - projectedExpense;
    const hasAnything = realizedIncome || realizedExpense || projectedIncome || projectedExpense;
    if (!hasAnything) continue;

    lines.push(`*${monthLabel(String(row.month))}*`);

    if (realizedIncome || realizedExpense) {
      lines.push(`  Realizado: +${brl(realizedIncome)} / -${brl(realizedExpense)} = ${realizedBalance >= 0 ? "" : "-"}${brl(realizedBalance)}`);
    }

    if (projectedIncome || projectedExpense) {
      hasProjection = true;
      lines.push(`  Previsto:  +${brl(projectedIncome)} / -${brl(projectedExpense)}`);
      lines.push(`  ${totalBalance >= 0 ? "✅" : "⚠️"} Saldo do mês: ${totalBalance >= 0 ? "" : "-"}${brl(totalBalance)}`);
    }

    lines.push("");
  }

  if (!hasProjection) {
    lines.push("_Ainda não tenho nada previsto para frente. Me conta suas contas fixas (ex: \"todo dia 10 pago 1200 de aluguel\") que eu passo a projetar._");
  }

  return lines.join("\n").trim();
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
  if (isRecord(message.documentMessage) && typeof message.documentMessage.caption === "string") {
    return message.documentMessage.caption;
  }
  return "";
}

function getMediaFileName(message: JsonRecord, mediaType: string, mimetype: string): string {
  if (isRecord(message.documentMessage) && typeof message.documentMessage.fileName === "string" && message.documentMessage.fileName.trim()) {
    return message.documentMessage.fileName.trim();
  }
  return `${mediaType}-${crypto.randomUUID().slice(0, 8)}.${extensionForMime(mimetype)}`;
}

// ============================================================
// SUPPORT ESCALATION HELPERS
// ============================================================

// ============================================================
// RESPOSTA DE TERCEIRO COBRADO
// ============================================================

const COMPLETION_WORDS = [
  "feito", "fiz", "ja fiz", "já fiz", "pronto", "concluido", "concluído", "conclui", "concluí",
  "terminei", "finalizado", "finalizei", "entreguei", "resolvido", "resolvi", "ok feito", "tá feito", "ta feito",
];

function isCompletionMessage(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/[!.?]+$/, "");
  return COMPLETION_WORDS.some((w) => t === w || t.startsWith(w + " ") || t.includes(" " + w));
}

interface AssigneeReply {
  reply: string;
  ownerPhone?: string;
  ownerNotice?: string;
}

// Terceiros cobrados não têm cadastro no Tuddo. Esta função dá a eles o mínimo
// necessário: ver o que devem e dar baixa. Nada além disso.
async function handleAssigneeReply(
  supabase: any,
  phoneVariants: string[],
  text: string,
): Promise<AssigneeReply | null> {
  if (!phoneVariants.length) return null;

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, user_id, title, due_date, assignee_name")
    .in("assignee_phone", phoneVariants)
    .eq("status", "pendente")
    .order("due_date", { ascending: true })
    .limit(10);

  if (!tasks || tasks.length === 0) return null;

  if (!isCompletionMessage(text)) {
    const list = tasks
      .map((t: any) => `  • ${t.title}${t.due_date ? ` — até ${new Date(t.due_date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}`)
      .join("\n");
    return {
      reply: `Oi! Sou o Tuddo. 👋\n\nO que está pendente com você:\n\n${list}\n\nQuando concluir, é só responder *"feito"* que eu dou baixa e aviso quem pediu. 👍`,
    };
  }

  // Se a mensagem cita o título de alguma tarefa, fecha essa. Senão, a mais antiga.
  const lower = text.toLowerCase();
  const matched = tasks.find((t: any) =>
    String(t.title).toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).some((w: string) => lower.includes(w))
  ) ?? tasks[0];

  const { error } = await supabase
    .from("tasks")
    .update({ status: "concluída" })
    .eq("id", matched.id);

  if (error) {
    console.error("Assignee task completion error:", error);
    return { reply: "Ops, não consegui dar baixa agora. Tenta de novo em instantes? 😅" };
  }

  const remaining = tasks.filter((t: any) => t.id !== matched.id);
  const remainingText = remaining.length > 0
    ? `\n\nAinda ficou pendente:\n${remaining.map((t: any) => `  • ${t.title}`).join("\n")}`
    : "";

  const { data: owner } = await supabase
    .from("profiles")
    .select("phone, full_name")
    .eq("id", matched.user_id)
    .single();

  const who = matched.assignee_name || "O responsável";

  return {
    reply: `Perfeito, dei baixa em *${matched.title}*. ✅\n\nJá avisei quem pediu. Valeu!${remainingText}`,
    ownerPhone: owner?.phone || undefined,
    ownerNotice: `✅ *${who}* concluiu: "${matched.title}".\n\nDei baixa na sua lista de tarefas.`,
  };
}

function isAffirmativeMessage(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/[!.?]+$/, "");
  const positives = ["sim", "s", "ok", "pode", "quero", "confirma", "confirmo", "avise", "chama", "por favor", "pfv", "claro", "vai", "yes", "ta", "tá", "bora", "pode sim", "claro que sim", "com certeza", "pode ser"];
  return positives.some(p => t === p || t.startsWith(p + " ") || t.endsWith(" " + p));
}

// Pedido explícito de falar com uma pessoa. Quem pede atendente tem que ser
// atendido — não adianta o assistente tentar resolver mais uma vez.
function wantsHumanSupport(text: string): boolean {
  const t = text.toLowerCase().trim();
  const pedidos = [
    "falar com humano", "falar com uma pessoa", "falar com alguem", "falar com alguém",
    "falar com atendente", "falar com o suporte", "falar com suporte",
    "quero suporte", "chamar o suporte", "chama o suporte", "aciona o suporte",
    "atendimento humano", "atendente humano", "pessoa de verdade",
    "me transfere", "transferir para",
  ];
  if (pedidos.some((p) => t.includes(p))) return true;
  // "suporte" / "atendente" sozinhos, ou quase, também contam.
  const curto = t.replace(/[!.?,]+$/, "");
  return ["suporte", "atendente", "humano", "atendimento"].includes(curto);
}

// Relato de coisa quebrada. O assistente não conserta defeito nem mexe em
// cobrança — insistir aqui só faz o cliente repetir o problema várias vezes,
// que foi exatamente o que aconteceu com quem não conseguia abrir a tela da
// família.
function reportsSomethingBroken(text: string): boolean {
  const t = text.toLowerCase();
  const sintomas = [
    "não funciona", "nao funciona", "não está funcionando", "nao esta funcionando",
    "não abre", "nao abre", "não carrega", "nao carrega", "não consigo", "nao consigo",
    "deu erro", "dá erro", "da erro", "deu problema", "está com problema", "ta com problema",
    "não aparece", "nao aparece", "sumiu", "desapareceu", "travou", "bugou", "com bug",
    "cobrado", "cobrança", "cobranca", "cobrou", "paguei e", "não recebi", "nao recebi",
    "reembolso", "estorno", "duplicado", "em dobro",
    "diz que não", "diz que nao", "consta que não", "consta que nao",
  ];
  return sintomas.some((s) => t.includes(s));
}

async function createSupportRequest(
  supabase: any,
  userId: string,
  phone: string,
  originalMessage: string,
  context: Array<{message: string; response: string | null; created_at: string; type: string}>
): Promise<string | null> {
  // Não abrir um segundo chamado se o usuário já tem um pendente — senão o
  // time recebe o mesmo caso várias vezes. Um chamado resolvido não bloqueia
  // um novo (o cliente pode ter um problema diferente depois).
  const { data: existing } = await supabase
    .from("support_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`Usuário ${userId} já tem chamado pendente ${existing.id} — não duplicando`);
    return existing.id;
  }

  const { data, error } = await supabase.from("support_requests").insert({
    user_id: userId,
    phone,
    original_message: originalMessage,
    context,
    status: "pending",
  }).select("id").single();

  if (error) {
    console.error("Support request insert error:", error);
    return null;
  }
  return data?.id ?? null;
}

async function notifySupportAdmin(
  clientName: string,
  originalMessage: string,
  _metaPhoneId: string
): Promise<void> {
  const adminPhone = Deno.env.get("SUPPORT_ADMIN_PHONE") || "5548999844528";
  const msgBody = `🆘 *Novo chamado de suporte — Tuddo*\n\nCliente: ${clientName}\nMensagem: "${originalMessage.substring(0, 200)}"\n\nAcesse tuddo.pro/admin/suporte para atender.`;

  // TODO: após aprovação do template 'suporte_tuddo' na Meta, substituir por:
  // POST /v23.0/{_metaPhoneId}/messages com type:"template", name:"suporte_tuddo",
  // language:{code:"pt_BR"}, components:[{type:"body",parameters:[{type:"text",text:clientName},{type:"text",text:originalMessage}]}]

  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") ?? "";
  const evolutionKey = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") ?? "";
  const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") || "Tuddo";

  if (evolutionUrl && evolutionKey) {
    await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": evolutionKey },
      body: JSON.stringify({ number: adminPhone, text: msgBody }),
    }).then(r => { if (!r.ok) console.error("Admin notify Evolution error:", r.status); })
      .catch(e => console.error("Admin notify Evolution error:", e));
  }
}

// ============================================================
// EXECUTE INTENT ACTION — TOTALMENTE REESCRITO
// ============================================================
// sender identifica QUEM mandou a mensagem. Em conta compartilhada isso é
// diferente do userId (que é sempre o titular) — é o que permite atribuir o
// gasto à pessoa certa.
interface MessageSender {
  userId: string | null;
  name: string | null;
}

async function executeIntentAction(
  supabase: any,
  userId: string,
  userPlan: string,
  aiResult: AiResult,
  fallbackText: string,
  sender: MessageSender = { userId: null, name: null },
): Promise<string> {
  const { intent, data, response: aiResponse } = aiResult;

  switch (intent) {
    // -------------------------------------------------------
    // CRIAR TAREFA
    // -------------------------------------------------------
    case "create_task": {
      const title = typeof data.description === "string" && data.description.trim().length > 0
        ? data.description
        : (typeof data.title === "string" && data.title.trim().length > 0 ? data.title : fallbackText);

      // Tarefa delegada: o Tuddo cobra a pessoa responsável em vez do dono.
      const assigneeName = typeof data.assignee_name === "string" && data.assignee_name.trim()
        ? data.assignee_name.trim()
        : null;
      const assigneePhone = normalizeAssigneePhone(data.assignee_phone);
      const recurrence = VALID_RECURRENCES.includes(String(data.recurrence))
        ? String(data.recurrence)
        : null;

      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        title,
        priority: "baixa",
        status: "pendente",
        due_date: typeof data.due_date === "string" ? data.due_date : null,
        assignee_name: assigneeName,
        assignee_phone: assigneePhone,
        recurrence: assigneePhone ? recurrence : null,
      });

      if (error) {
        console.error("Task insert error:", error);
        return "Ops, não consegui criar a tarefa. Tente novamente! 😅";
      }

      if (assigneeName && !assigneePhone) {
        return aiResponse || `Anotado: *${title}* — responsável ${assigneeName}. 📌\n\nMe passa o WhatsApp ${assigneeName ? `d${assigneeName.endsWith("a") ? "a" : "o"} ${assigneeName}` : "da pessoa"} (com DDD) que eu começo a cobrar. 📱`;
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
      const totalAmount = Math.abs(Number(data.amount) || 0);
      const installments = Number(data.installments) || 0;
      const installmentAmount = Number(data.installment_amount) || 0;

      // Resolver pasta (folder) se o usuário tiver pastas cadastradas
      let folderId: string | null = null;
      let folderLabel = "";
      const folderNameFromAI = typeof data.folder_name === "string" ? data.folder_name.trim() : "";

      if (folderNameFromAI) {
        // IA identificou a pasta pelo contexto
        const { data: matchedFolder } = await supabase
          .from("folders")
          .select("id, name, emoji")
          .eq("user_id", userId)
          .ilike("name", folderNameFromAI)
          .single();

        if (matchedFolder) {
          folderId = matchedFolder.id;
          folderLabel = `${matchedFolder.emoji} ${matchedFolder.name}`;
        }
      }

      // Quem gastou: o nome dito na mensagem ("cartão da Maria") tem prioridade
      // sobre quem enviou. Em conta individual ambos ficam nulos.
      const explicitPayer = typeof data.paid_by === "string" && data.paid_by.trim()
        ? data.paid_by.trim()
        : null;
      const paidByName = explicitPayer ?? sender.name;
      const paidByUserId = explicitPayer ? null : sender.userId;
      const cardLabel = typeof data.card_label === "string" && data.card_label.trim()
        ? data.card_label.trim()
        : null;

      // Se é parcelamento, criar múltiplas transações
      if (installments > 1 && installmentAmount > 0) {
        const now = new Date();
        const transactions = [];
        for (let i = 0; i < installments; i++) {
          const txDate = new Date(now.getFullYear(), now.getMonth() + i, now.getDate());
          transactions.push({
            user_id: userId,
            description: `${description} (${i + 1}/${installments})`,
            amount: installmentAmount,
            type: transactionType,
            category,
            folder_id: folderId,
            transaction_date: txDate.toISOString(),
            paid_by_name: paidByName,
            paid_by_user_id: paidByUserId,
            card_label: cardLabel,
          });
        }
        const { error: installError } = await supabase.from("transactions").insert(transactions);
        if (installError) {
          console.error("Installment insert error:", installError);
          return "Ops, não consegui registrar as parcelas. Tente novamente! 😅";
        }
        let installReply = aiResult.response || `Registrado! ${description}: R$ ${totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em ${installments}x de R$ ${installmentAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Parcelas registradas nos próximos ${installments} meses! 💳`;
        if (folderLabel) installReply += `\nPasta: ${folderLabel}`;
        return installReply;
      }

      const amount = totalAmount;
      const { error } = await supabase.from("transactions").insert({
        user_id: userId,
        description,
        amount,
        type: transactionType,
        category,
        folder_id: folderId,
        paid_by_name: paidByName,
        paid_by_user_id: paidByUserId,
        card_label: cardLabel,
      });

      if (error) {
        console.error("Transaction insert error:", error);
        return "Ops, não consegui registrar essa transação. Tente novamente! 😅";
      }

      let reply = aiResponse || `Registrado! ${transactionType === "receita" ? "Receita" : "Gasto"} de R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} em ${category} ✅`;

      // Se tem pasta associada (pelo contexto da mensagem), informar.
      // Não perguntamos mais em qual pasta colocar a cada gasto — o usuário pede quando quiser (assign_folder).
      if (folderLabel) {
        reply += `\nPasta: ${folderLabel}`;
      }

      // Em conta compartilhada, deixar claro em nome de quem o gasto entrou.
      if (paidByName) {
        reply += `\n👤 ${paidByName}${cardLabel ? ` · ${cardLabel}` : ""}`;
      }

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

          // Comparação PRO (os planos Familiares também têm direito)
          if (planTier(userPlan) === "PRO") {
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

      // Sincronizar com Google Calendar (se o usuário tiver conectado)
      try {
        const gcalResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          },
          body: JSON.stringify({
            action: "create",
            userId,
            eventData: {
              title,
              event_date: eventDate,
              event_time: eventTime,
              description: `Criado pelo Tuddo via WhatsApp`,
            },
          }),
        });
        const gcalResult = await gcalResponse.json();
        if (gcalResult.success) {
          console.log(`Event synced to Google Calendar for user ${userId}`);
        }
      } catch (gcalErr) {
        console.error("Google Calendar sync error (non-fatal):", gcalErr);
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
        let taskQuery = supabase
          .from("tasks")
          .select("title, status, due_date")
          .eq("user_id", userId)
          .eq("status", "pendente")
          .order("due_date", { ascending: true });

        if (["amanhã", "ontem", "esta semana"].includes(dateFilter)) {
          // Filtros específicos: excluir tarefas sem due_date
          taskQuery = supabase
            .from("tasks")
            .select("title, status, due_date")
            .eq("user_id", userId)
            .eq("status", "pendente")
            .gte("due_date", `${startDate}T00:00:00`)
            .lte("due_date", `${endDate}T23:59:59`)
            .order("due_date", { ascending: true });
        } else if (startDate && endDate) {
          // Filtros gerais (hoje, este mês, mês nomeado): incluir tarefas sem due_date OU dentro do range
          taskQuery = supabase
            .from("tasks")
            .select("title, status, due_date")
            .eq("user_id", userId)
            .eq("status", "pendente")
            .or(`due_date.is.null,and(due_date.gte.${startDate}T00:00:00,due_date.lte.${endDate}T23:59:59)`)
            .order("due_date", { ascending: true });
        }

        const { data: tasks } = await taskQuery;
        if (tasks && tasks.length > 0) {
          items = tasks.map((t: any) => {
            const dueStr = t.due_date
              ? ` (até ${new Date(t.due_date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})`
              : "";
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
    // CRIAR META FINANCEIRA
    // -------------------------------------------------------
    case "create_goal": {
      const goalTitle = typeof data.title === "string" && data.title.trim().length > 0
        ? data.title
        : fallbackText;
      const targetAmount = Math.abs(Number(data.target_amount) || 0);
      const currentAmount = Math.abs(Number(data.current_amount) || 0);
      const goalDeadline = typeof data.deadline === "string" && data.deadline ? data.deadline : null;
      const goalCategory = typeof data.category === "string" && data.category ? data.category : "outros";

      if (targetAmount === 0) {
        return "Para criar uma meta, preciso saber o valor alvo. Ex: \"Quero juntar R$ 5.000 para viagem\". 🎯";
      }

      const { error: goalError } = await supabase.from("goals").insert({
        user_id: userId,
        title: goalTitle,
        target_amount: targetAmount,
        current_amount: currentAmount,
        deadline: goalDeadline,
        category: goalCategory,
        status: "active",
      });

      if (goalError) {
        console.error("Goal insert error:", goalError);
        return "Ops, não consegui criar a meta. Tente novamente! 😅";
      }

      const progressPct = targetAmount > 0 ? ((currentAmount / targetAmount) * 100).toFixed(0) : "0";
      const deadlineStr = goalDeadline ? ` até ${new Date(goalDeadline + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}` : "";
      return aiResponse || `Meta criada! 🎯 *${goalTitle}*: R$ ${targetAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${deadlineStr}. Progresso atual: ${progressPct}%.`;
    }

    // -------------------------------------------------------
    // LISTAR METAS
    // -------------------------------------------------------
    case "list_goals": {
      const { data: goals } = await supabase
        .from("goals")
        .select("title, target_amount, current_amount, deadline, category, status")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (!goals || goals.length === 0) {
        return "Você ainda não tem metas financeiras. Para criar uma, diga: \"Quero juntar R$ 5.000 para viagem em dezembro\". 🎯";
      }

      const goalLines = goals.map((g: any) => {
        const progress = g.target_amount > 0 ? ((g.current_amount / g.target_amount) * 100).toFixed(0) : "0";
        const bar = Number(progress) >= 100 ? "✅" : Number(progress) >= 50 ? "🟡" : "🔴";
        const deadlineStr = g.deadline ? ` | Prazo: ${new Date(g.deadline + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}` : "";
        return `${bar} *${g.title}*\nR$ ${Number(g.current_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / R$ ${Number(g.target_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${progress}%)${deadlineStr}`;
      });

      return `🎯 *Suas metas financeiras:*\n\n${goalLines.join("\n\n")}`;
    }

    // -------------------------------------------------------
    // CRIAR / ATUALIZAR ORÇAMENTO DE CATEGORIA
    // -------------------------------------------------------
    case "create_budget": {
      const budgetLimitMsg = await checkFeatureLimit(supabase, userId, userPlan, "budget");
      if (budgetLimitMsg) return budgetLimitMsg;

      const budgetCategory = typeof data.category === "string" && data.category.trim()
        ? data.category.trim()
        : null;
      const budgetLimit = Math.abs(Number(data.limit) || 0);

      if (!budgetCategory) {
        return "Para definir um orçamento preciso saber a categoria. Ex: \"Limite de R$ 500 para Alimentação\". 📊";
      }
      if (budgetLimit === 0) {
        return "Para definir um orçamento preciso saber o valor. Ex: \"Limite de R$ 500 para Alimentação\". 📊";
      }

      const { error: budgetError } = await supabase.from("budgets").upsert({
        user_id: userId,
        category: budgetCategory,
        limit: budgetLimit,
      }, { onConflict: "user_id,category" });

      if (budgetError) {
        console.error("Budget upsert error:", budgetError);
        return "Ops, não consegui salvar o orçamento. Tente novamente! 😅";
      }

      return aiResponse || `Orçamento definido! 📊 *${budgetCategory}*: limite de R$ ${budgetLimit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês. Vou te avisar quando estiver chegando perto! 🔔`;
    }

    // -------------------------------------------------------
    // CRIAR MÚLTIPLOS COMPROMISSOS DE UMA VEZ
    // -------------------------------------------------------
    case "create_multiple_meetings": {
      const eventsRaw = Array.isArray(data.events) ? data.events : [];
      if (eventsRaw.length === 0) {
        return aiResponse || "Não consegui identificar os compromissos da lista. Tente no formato:\n13:00 - Paciente Aline\n14:00 - Paciente Mariana 📅";
      }

      const toInsert: Array<{ user_id: string; title: string; event_date: string | null; event_time: string | null; status: string }> = [];
      const lines: string[] = [];

      for (const ev of eventsRaw) {
        if (!isRecord(ev)) continue;
        const description = typeof ev.description === "string" && ev.description.trim() ? ev.description.trim() : "";
        const meetingDateRaw = typeof ev.meeting_date === "string" ? ev.meeting_date : "";
        if (!description) continue;

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
                const sp = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
                eventDate = `${sp.getFullYear()}-${String(sp.getMonth() + 1).padStart(2, "0")}-${String(sp.getDate()).padStart(2, "0")}`;
                eventTime = `${String(sp.getHours()).padStart(2, "0")}:${String(sp.getMinutes()).padStart(2, "0")}`;
              }
            } catch { /* ignore */ }
          }
        }

        toInsert.push({ user_id: userId, title: description, event_date: eventDate, event_time: eventTime, status: "agendada" });
        lines.push(`📅 ${description}${eventTime ? ` às ${eventTime}` : ""}`);
      }

      if (toInsert.length === 0) {
        return "Não consegui processar a lista de compromissos. Tente novamente! 😅";
      }

      const { error: multiError } = await supabase.from("events").insert(toInsert);
      if (multiError) {
        console.error("Multiple events insert error:", multiError);
        return "Ops, não consegui salvar os compromissos. Tente novamente! 😅";
      }

      const dateLabel = toInsert[0].event_date
        ? new Date(toInsert[0].event_date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
        : "";
      const header = dateLabel ? `Agenda de ${dateLabel} salva!` : "Agenda salva!";

      return aiResponse || `✅ ${header} ${toInsert.length} compromissos registrados:\n\n${lines.join("\n")}`;
    }

    // -------------------------------------------------------
    // CRIAR PASTA(S)
    // -------------------------------------------------------
    case "create_folder": {
      const folders = Array.isArray(data.folders) ? data.folders : [];
      if (folders.length === 0) {
        return aiResponse || "Me diz o nome da pasta que você quer criar! Pode listar várias assim: 1-Casa 2-Granja 3-Consultório 📁";
      }

      const created: string[] = [];
      const alreadyExists: string[] = [];

      for (const folder of folders) {
        const name = typeof folder === "object" && folder !== null ? String((folder as any).name || "").trim() : String(folder).trim();
        const emoji = typeof folder === "object" && folder !== null ? String((folder as any).emoji || "📁") : "📁";
        if (!name) continue;

        const { error } = await supabase.from("folders").insert({
          user_id: userId,
          name,
          emoji,
        });

        if (error) {
          if (error.code === "23505") {
            alreadyExists.push(`${emoji} ${name}`);
          } else {
            console.error("Folder insert error:", error);
          }
        } else {
          created.push(`${emoji} ${name}`);
        }
      }

      let reply = "";
      if (created.length > 0) {
        reply = `Pronto! Criei suas pastas:\n\n${created.join("\n")}\n\nQuando você mencionar o nome da pasta no gasto (ex: "gastei 50 na Granja"), eu já registro direto lá. Se esquecer, é só me pedir depois: "coloca esse gasto na Casa". 💪`;
      }
      if (alreadyExists.length > 0) {
        reply += reply ? "\n\n" : "";
        reply += `Essas pastas já existiam: ${alreadyExists.join(", ")}`;
      }
      if (!reply) {
        reply = "Não consegui criar as pastas. Tente novamente com os nomes! 😅";
      }

      return reply;
    }

    // -------------------------------------------------------
    // LISTAR PASTAS
    // -------------------------------------------------------
    case "create_multiple_tasks": {
      const rawTasks = Array.isArray(data.tasks) ? data.tasks : [];
      if (rawTasks.length === 0) {
        return "Não consegui identificar as tarefas. Pode listar assim?\n\n1 - Primeira tarefa\n2 - Segunda tarefa 😊";
      }

      const rows = rawTasks
        .filter((t: any) => isRecord(t) && typeof t.description === "string" && t.description.trim())
        .map((t: any) => {
          const phone = normalizeAssigneePhone(t.assignee_phone);
          return {
            user_id: userId,
            title: String(t.description).trim(),
            priority: "baixa",
            status: "pendente",
            due_date: typeof t.due_date === "string" ? t.due_date : null,
            assignee_name: typeof t.assignee_name === "string" && t.assignee_name.trim() ? t.assignee_name.trim() : null,
            assignee_phone: phone,
            recurrence: phone && VALID_RECURRENCES.includes(String(t.recurrence)) ? String(t.recurrence) : null,
          };
        });

      if (rows.length === 0) {
        return "Não consegui identificar as tarefas. Pode listar uma por linha? 😊";
      }

      const { error } = await supabase.from("tasks").insert(rows);
      if (error) {
        console.error("Multiple tasks insert error:", error);
        return "Ops, não consegui criar as tarefas. Tente novamente! 😅";
      }

      const lista = rows.map((r, i) => `${i + 1}. ${r.title}`).join("\n");
      return aiResponse || `Anotei suas ${rows.length} tarefas! ✅\n\n${lista}\n\nSe quiser prazo ou responsável em alguma, é só falar.`;
    }

    case "create_recurring": {
      const description = typeof data.description === "string" && data.description.trim()
        ? data.description.trim()
        : fallbackText;
      const amount = Math.abs(Number(data.amount) || 0);
      if (amount <= 0) {
        return "Não consegui identificar o valor dessa conta fixa. Me diz assim: \"todo dia 10 pago 1200 de aluguel\". 😊";
      }

      const type = data.type === "receita" ? "receita" : "gasto";
      const frequency = ["weekly", "monthly", "yearly"].includes(String(data.frequency))
        ? String(data.frequency)
        : "monthly";

      const dayOfMonth = clampInt(data.day_of_month, 1, 31);
      const dayOfWeek = clampInt(data.day_of_week, 0, 6);
      const monthOfYear = clampInt(data.month_of_year, 1, 12);

      // Cada frequência tem seu campo obrigatório — sem ele a projeção não sabe
      // em que dia lançar a ocorrência.
      if (frequency === "monthly" && dayOfMonth === null) {
        return "Em que dia do mês essa conta cai? Ex: \"todo dia 10\". 📅";
      }
      if (frequency === "weekly" && dayOfWeek === null) {
        return "Em que dia da semana essa conta cai? Ex: \"toda segunda\". 📅";
      }
      if (frequency === "yearly" && (dayOfMonth === null || monthOfYear === null)) {
        return "Em que dia e mês essa conta cai? Ex: \"todo 15 de março\". 📅";
      }

      const { error } = await supabase.from("recurring_transactions").insert({
        user_id: userId,
        description,
        amount,
        type,
        category: typeof data.category === "string" ? data.category : null,
        frequency,
        day_of_month: frequency === "weekly" ? null : dayOfMonth,
        day_of_week: frequency === "weekly" ? dayOfWeek : null,
        month_of_year: frequency === "yearly" ? monthOfYear : null,
      });

      if (error) {
        console.error("Recurring insert error:", error);
        return "Ops, não consegui salvar essa conta fixa. Tente novamente! 😅";
      }

      return aiResponse || `Anotado como conta fixa! 🔁\n\n*${description}* — R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ${describeFrequency(frequency, dayOfMonth, dayOfWeek, monthOfYear)}\n\nJá entra na sua projeção de fluxo de caixa.`;
    }

    case "cash_flow": {
      const monthsAhead = clampInt(data.months_ahead, 1, 12) ?? 3;
      return await buildCashFlowReply(supabase, userId, monthsAhead);
    }

    case "search_files": {
      const query = typeof data.query === "string" && data.query.trim()
        ? data.query.trim()
        : fallbackText;
      return await searchDriveFiles(supabase, userId, query);
    }

    case "list_folders": {
      const { data: userFolders } = await supabase
        .from("folders")
        .select("name, emoji, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (!userFolders || userFolders.length === 0) {
        return "Você ainda não tem pastas criadas. 📁\n\nQuer organizar seus gastos? Me diz quais categorias fazem sentido pra você!\nExemplo: 1-Casa 2-Carro 3-Consultório";
      }

      // Buscar total gasto por pasta
      const folderLines: string[] = [];
      for (const f of userFolders) {
        const { data: folderRecord } = await supabase
          .from("folders")
          .select("id")
          .eq("user_id", userId)
          .eq("name", f.name)
          .single();

        let totalStr = "";
        if (folderRecord) {
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          const { data: txs } = await supabase
            .from("transactions")
            .select("amount")
            .eq("user_id", userId)
            .eq("folder_id", folderRecord.id)
            .eq("type", "gasto")
            .gte("transaction_date", monthStart.toISOString());

          if (txs && txs.length > 0) {
            const total = txs.reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
            totalStr = ` — R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} este mês`;
          }
        }

        folderLines.push(`${f.emoji} *${f.name}*${totalStr}`);
      }

      return `📁 *Suas pastas:*\n\n${folderLines.join("\n")}\n\nPara ver gastos de uma pasta específica, diga: \"gastos da pasta Casa\"`;
    }

    // -------------------------------------------------------
    // ASSOCIAR GASTO A PASTA
    // -------------------------------------------------------
    case "assign_folder": {
      const folderName = typeof data.folder_name === "string" ? data.folder_name.trim() : "";
      const txDesc = typeof data.transaction_description === "string" ? data.transaction_description.trim() : "";

      if (!folderName) {
        return "Qual pasta você quer usar? Me diz o nome da pasta! 📁";
      }

      // Buscar a pasta
      const { data: folder } = await supabase
        .from("folders")
        .select("id, name, emoji")
        .eq("user_id", userId)
        .ilike("name", folderName)
        .single();

      if (!folder) {
        return `Não encontrei a pasta \"${folderName}\". Quer que eu crie? 📁`;
      }

      // Buscar a última transação (ou a que bate com a descrição)
      let txQuery = supabase
        .from("transactions")
        .select("id, description")
        .eq("user_id", userId)
        .is("folder_id", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (txDesc) {
        txQuery = supabase
          .from("transactions")
          .select("id, description")
          .eq("user_id", userId)
          .ilike("description", `%${txDesc}%`)
          .order("created_at", { ascending: false })
          .limit(1);
      }

      const { data: txRecord } = await txQuery;

      if (!txRecord || txRecord.length === 0) {
        return `Não encontrei uma transação recente para associar à pasta ${folder.emoji} ${folder.name}. Registre um gasto primeiro!`;
      }

      const { error: updateError } = await supabase
        .from("transactions")
        .update({ folder_id: folder.id })
        .eq("id", txRecord[0].id);

      if (updateError) {
        console.error("Assign folder error:", updateError);
        return "Ops, não consegui associar. Tente novamente! 😅";
      }

      return `Pronto! \"${txRecord[0].description}\" foi para a pasta ${folder.emoji} ${folder.name}. ✅`;
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

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === "tuddo_meta_verify_2026_x7k9" && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
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

    // ── Detectar formato Meta Cloud API ─────────────────────────
    const _metaExtracted = (() => {
      try {
        const entry = Array.isArray(body.entry) && isRecord(body.entry[0]) ? body.entry[0] as JsonRecord : null;
        const change = entry && Array.isArray(entry.changes) && isRecord(entry.changes[0]) ? entry.changes[0] as JsonRecord : null;
        const val = change && isRecord(change.value) ? change.value as JsonRecord : null;
        const msgs = val && Array.isArray(val.messages) ? val.messages : [];
        const msg = msgs.length > 0 && isRecord(msgs[0]) ? msgs[0] as JsonRecord : null;
        if (!msg || typeof msg.from !== "string") return null;
        const contacts = val && Array.isArray(val.contacts) ? val.contacts : [];
        const profile = contacts.length > 0 && isRecord(contacts[0]) && isRecord((contacts[0] as JsonRecord).profile) ? (contacts[0] as JsonRecord).profile as JsonRecord : null;
        const type = typeof msg.type === "string" ? msg.type : "";
        const mediaField = (type === "audio" || type === "image" || type === "document") && isRecord(msg[type])
          ? msg[type] as JsonRecord
          : null;
        return {
          from: String(msg.from).replace(/\D/g, ""),
          text: type === "text" && isRecord(msg.text) ? String((msg.text as JsonRecord).body ?? "").trim() : "",
          type,
          messageId: typeof msg.id === "string" ? msg.id : "",
          mediaId: mediaField ? String(mediaField.id ?? "") : "",
          mediaMimetype: mediaField ? String(mediaField.mime_type ?? "") : "",
          caption: mediaField && typeof mediaField.caption === "string" ? mediaField.caption : "",
          phoneNumberId: String(isRecord(val!.metadata) ? (val!.metadata as JsonRecord).phone_number_id ?? "" : ""),
          pushName: profile ? String(profile.name ?? "") : "",
        };
      } catch { return null; }
    })();
    const isMeta = Boolean(_metaExtracted);
    const metaPhoneNumberId = _metaExtracted?.phoneNumberId ?? "";
    let remotePhone = _metaExtracted?.from ?? "";
    let text = _metaExtracted?.text ?? "";
    let originalRemoteJid = "";
    let isLidAddress = false;
    let _pushName = "";
    // ID único da mensagem no WhatsApp — usado para descartar reentregas.
    // Meta preenche aqui; Evolution é lido mais abaixo (data.key.id).
    let inboundMessageId = _metaExtracted?.messageId ?? "";
    // Mídia recebida fica pendente até o userId ser resolvido pelo telefone,
    // aí vai para o drive (bucket + índice semântico).
    let pendingMedia: PendingMedia | null = null;

    // A Meta manda webhook para MUITO mais coisa do que mensagem de cliente:
    // cada resposta nossa gera aviso de "enviada", "entregue" e "lida", e ainda
    // há eventos de conta e de template. Nada disso tem messages[0].from, então
    // caía na verificação de assinatura da Evolution e levava 401.
    //
    // Isso não era só ruído: a Meta REENVIA o que falha, e desativa webhook que
    // falha de forma consistente. Chegamos a 526 rejeições em 4 horas contra 1
    // entrega bem-sucedida — e o cliente ficou sem resposta.
    //
    // Qualquer coisa com cara de Meta responde 200. Confirmar recebimento não é
    // brecha de segurança: nada é processado, só evita a tempestade de retentativa.
    const looksLikeMeta =
      body.object === "whatsapp_business_account" ||
      (Array.isArray(body.entry) &&
        body.entry.some((e) => isRecord(e) && Array.isArray((e as JsonRecord).changes)));

    if (!isMeta && looksLikeMeta) {
      console.log("Evento Meta sem mensagem de cliente (status/conta) — confirmado e ignorado");
      return new Response(JSON.stringify({ status: "ignored_meta_event" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isMeta) {
      const isAuthorized = await verifyRequest(req, rawBody, body);
      if (!isAuthorized) {
        console.warn("Unauthorized request - rejecting");
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (isMeta && !text && remotePhone && (_metaExtracted?.type === "audio" || _metaExtracted?.type === "image" || _metaExtracted?.type === "document") && _metaExtracted?.mediaId) {
      const base64 = await getMetaMediaBase64(_metaExtracted.mediaId);
      if (base64) {
        const mimetype = _metaExtracted.mediaMimetype;
        const metaType = _metaExtracted.type as "image" | "audio" | "document";
        let contentText = "";

        if (metaType === "image") {
          const imageAnalysis = await analyzeImageWithVision(base64, mimetype, _metaExtracted.caption);
          if (imageAnalysis) {
            contentText = imageAnalysis;
            text = _metaExtracted.caption
              ? `[Foto enviada - análise: ${imageAnalysis}] Legenda do usuário: ${_metaExtracted.caption}`
              : `[Foto enviada - análise: ${imageAnalysis}]`;
          }
        } else if (metaType === "audio") {
          const transcription = await transcribeAudio(base64, mimetype);
          if (transcription) {
            contentText = transcription;
            text = transcription;
          }
        } else {
          // Documento: ainda não extraímos o conteúdo, mas guardamos no drive
          // indexado pela legenda/nome para busca posterior.
          contentText = _metaExtracted.caption;
          text = _metaExtracted.caption
            ? `[Documento enviado] ${_metaExtracted.caption}`
            : "[Documento enviado — guardei no seu drive]";
        }

        // Mesmo se a visão/transcrição falhar, seguimos o fluxo para que o
        // arquivo chegue ao drive em vez de ser descartado como "non_text".
        if (!text) {
          text = _metaExtracted.caption
            ? `[Arquivo enviado] ${_metaExtracted.caption}`
            : "[Arquivo enviado — guardei no seu drive]";
        }

        pendingMedia = {
          base64,
          mimetype,
          mediaType: metaType,
          fileName: `${metaType}-${_metaExtracted.mediaId}.${extensionForMime(mimetype)}`,
          caption: _metaExtracted.caption,
          contentText,
        };
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // O cliente mandou algo que não conseguimos ler como texto: figurinha,
    // vídeo, localização, contato, resposta de botão — ou uma foto/áudio cujo
    // download falhou. Isso era descartado CALADO, e a pessoa ficava falando
    // sozinha achando que o Tuddo tinha morrido. Silêncio parece produto
    // quebrado; responder custa nada.
    if (isMeta && !text) {
      if (!remotePhone) {
        return new Response(JSON.stringify({ status: "ignored_no_phone" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Trava própria: a geral só roda mais abaixo, e a Meta reenvia o webhook.
      // Sem isto o cliente levaria o mesmo aviso três ou quatro vezes.
      if (inboundMessageId) {
        const { error: dupErr } = await supabase
          .from("processed_messages")
          .insert({ message_id: inboundMessageId });
        if (dupErr?.code === "23505") {
          return new Response(JSON.stringify({ status: "duplicate_ignored" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const tipo = _metaExtracted?.type ?? "";
      const aviso =
        tipo === "sticker"
          ? "Recebi sua figurinha! 😄 Mas eu trabalho com texto, áudio, foto e documento. Me conta em palavras o que você precisa?"
          : tipo === "video"
          ? "Recebi seu vídeo, mas ainda não consigo assistir. 😅 Se for um comprovante, me manda como *foto* que eu leio e registro!"
          : tipo === "location"
          ? "Recebi sua localização! 📍 Ainda não faço nada com ela. Se quiser registrar um gasto ou compromisso, é só me escrever."
          : "Recebi sua mensagem, mas não consegui ler esse formato. 😅\n\nEu entendo *texto*, *áudio*, *foto* e *documento*. Pode mandar de novo assim?";

      await sendMessageMeta(metaPhoneNumberId, remotePhone, aviso);
      console.log(`Tipo não suportado (${tipo}) — cliente avisado em vez de ignorado`);

      return new Response(JSON.stringify({ status: "unsupported_type", tipo }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persistir phone_number_id Meta para uso proativo (ex: budget-alerts)
    if (isMeta && metaPhoneNumberId) {
      supabase.from("system_config").upsert(
        { key: "meta_phone_number_id", value: metaPhoneNumberId, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      ).then(() => {}).catch(() => {});
    }

    if (!isMeta) {
    const data = isRecord(body.data) ? body.data : null;
    if (!data) {
      return new Response(JSON.stringify({ status: "no_data" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = isRecord(data.key) ? data.key : {};
    if (typeof key.id === "string" && key.id) inboundMessageId = key.id;
    if (isGroupMessage(key)) {
      return new Response(JSON.stringify({ status: "ignored_group_message" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignorar eco de mensagens enviadas pelo próprio bot — sem isso, toda resposta
    // do Tuddo (inclusive a oferta de escalonamento) volta pelo webhook como se
    // fosse mensagem do usuário e pode disparar um novo ciclo de escalonamento.
    if (key.fromMe === true) {
      return new Response(JSON.stringify({ status: "ignored_own_message" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = isRecord(data.message) ? data.message : {};
    text = extractTextMessage(message).trim();

    // Detectar mídia (imagem ou áudio)
    const mediaType = detectMediaType(message);
    let mediaProcessed = false;

    if (mediaType === "image" || mediaType === "audio" || mediaType === "document") {
      // Buscar o base64 da mídia via Evolution API
      const messageKey = {
        id: typeof key.id === "string" ? key.id : "",
        remoteJid: typeof key.remoteJid === "string" ? key.remoteJid : "",
        fromMe: key.fromMe || false,
      };

      const base64 = await getMediaBase64(messageKey, message);

      if (base64) {
        const mimetype = getMediaMimetype(message);
        const caption = getMediaCaption(message);
        let contentText = "";

        if (mediaType === "image") {
          const imageAnalysis = await analyzeImageWithVision(base64, mimetype, caption || text);
          if (imageAnalysis) {
            contentText = imageAnalysis;
            // Combinar a análise da imagem com qualquer texto/legenda
            text = caption
              ? `[Foto enviada - análise: ${imageAnalysis}] Legenda do usuário: ${caption}`
              : `[Foto enviada - análise: ${imageAnalysis}]`;
            mediaProcessed = true;
          }
        } else if (mediaType === "audio") {
          const transcription = await transcribeAudio(base64, mimetype);
          if (transcription) {
            contentText = transcription;
            text = transcription;
            mediaProcessed = true;
          }
        } else {
          // Documento: guardado no drive, indexado pela legenda/nome do arquivo.
          contentText = caption;
          text = caption
            ? `[Documento enviado] ${caption}`
            : "[Documento enviado — guardei no seu drive]";
          mediaProcessed = true;
        }

        // Mesmo se a visão/transcrição falhar, seguimos o fluxo para que o
        // arquivo chegue ao drive em vez de ser descartado.
        if (!text) {
          text = caption
            ? `[Arquivo enviado] ${caption}`
            : "[Arquivo enviado — guardei no seu drive]";
          mediaProcessed = true;
        }

        pendingMedia = {
          base64,
          mimetype,
          mediaType,
          fileName: getMediaFileName(message, mediaType, mimetype),
          caption,
          contentText,
        };
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

    remotePhone = extractPhoneFromKey(key);
    originalRemoteJid = typeof key.remoteJid === "string" ? key.remoteJid : "";
    isLidAddress = originalRemoteJid.endsWith("@lid");

    if (!remotePhone) {
      return new Response(JSON.stringify({ status: "missing_phone" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se o endereço é LID, tentar resolver o número real
    if (isLidAddress) {
      console.log("LID address detected:", originalRemoteJid, "extracted phone:", remotePhone);
      
      // Primeiro: verificar se temos mapeamento salvo na tabela lid_mappings
      try {
        const { data: lidMapping } = await supabase
          .from("lid_mappings")
          .select("phone")
          .eq("lid", originalRemoteJid.replace(/@lid$/i, ""))
          .limit(1)
          .single();
        
        if (lidMapping?.phone) {
          console.log("LID resolved from mapping:", lidMapping.phone);
          remotePhone = lidMapping.phone;
        }
      } catch (lidErr) {
        // Tabela pode não existir ainda, ignorar
        console.log("LID mapping lookup failed (table may not exist):", lidErr);
      }

      // Segundo: se ainda é um LID numérico (não resolveu), tentar via Evolution API
      if (remotePhone === originalRemoteJid.replace(/@lid$/i, "")) {
        try {
          const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") ?? "";
          const evolutionKey = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") ?? "";
          const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") || "Tuddo";
          
          if (evolutionUrl && evolutionKey) {
            // Buscar contato pelo LID na Evolution API
            const contactResp = await fetch(`${evolutionUrl}/chat/findContacts/${instanceName}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": evolutionKey },
              body: JSON.stringify({ where: { remoteJid: originalRemoteJid } }),
            });
            
            if (contactResp.ok) {
              const contacts = await contactResp.json();
              const contactList = Array.isArray(contacts) ? contacts : [];
              
              // Verificar se o contato também tem uma entrada @s.whatsapp.net
              if (contactList.length > 0) {
                const pushName = contactList[0]?.pushName || "";
                
                // Buscar pelo pushName para encontrar a versão @s.whatsapp.net
                if (pushName) {
                  const altResp = await fetch(`${evolutionUrl}/chat/findContacts/${instanceName}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "apikey": evolutionKey },
                    body: JSON.stringify({ where: { pushName } }),
                  });
                  
                  if (altResp.ok) {
                    const altContacts = await altResp.json();
                    const altList = Array.isArray(altContacts) ? altContacts : [];
                    const whatsappContact = altList.find((c: any) => 
                      c.remoteJid && c.remoteJid.includes("@s.whatsapp.net")
                    );
                    
                    if (whatsappContact) {
                      remotePhone = whatsappContact.remoteJid.replace(/@s\.whatsapp\.net$/i, "");
                      console.log("LID resolved via Evolution API pushName:", remotePhone);
                      
                      // Salvar mapeamento para próxima vez
                      try {
                        await supabase.from("lid_mappings").upsert({
                          lid: originalRemoteJid.replace(/@lid$/i, ""),
                          phone: remotePhone,
                          push_name: pushName,
                        }, { onConflict: "lid" });
                      } catch (saveErr) {
                        console.log("Could not save LID mapping:", saveErr);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (evolutionErr) {
          console.error("Evolution API LID resolution error:", evolutionErr);
        }
      }
    }
    _pushName = typeof data.pushName === "string" ? String(data.pushName) : "";
    } // end if (!isMeta)

    // ── Idempotência ────────────────────────────────────────────────────────
    // Meta e Evolution reenviam a mesma mensagem quando não recebem o 200 a
    // tempo. Sem esta trava, cada reentrega reexecutava tudo: já gerou 10
    // chamados de suporte duplicados para o mesmo cliente (alguns com 2s de
    // diferença) e poderia igualmente duplicar transações e tarefas.
    //
    // A PK da tabela faz o trabalho: se o insert falhar por conflito, é
    // reentrega e paramos aqui.
    if (inboundMessageId) {
      const { error: dupErr } = await supabase
        .from("processed_messages")
        .insert({ message_id: inboundMessageId });

      if (dupErr) {
        // 23505 = unique_violation → já processamos esta mensagem antes.
        if (dupErr.code === "23505") {
          console.log(`Mensagem ${inboundMessageId} já processada — ignorando reentrega`);
          return new Response(JSON.stringify({ status: "duplicate_ignored" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Qualquer outro erro não deve bloquear o atendimento do usuário.
        console.error("processed_messages insert error:", dupErr);
      }
    }

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
      // Tentar uma última vez: buscar pelo pushName no profiles
      const pushName = isMeta ? (_metaExtracted?.pushName ?? "") : _pushName;
      let foundByPushName = false;
      
      if (pushName && pushName.length > 2) {
        const { data: pushNameProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, plan, phone")
          .ilike("full_name", `%${pushName}%`)
          .limit(1);
        
        if (pushNameProfiles && pushNameProfiles.length > 0) {
          console.log("Found user by pushName:", pushName, "->", pushNameProfiles[0].full_name);
          foundByPushName = true;
          // Usar este perfil e atualizar remotePhone para enviar a resposta
          remotePhone = pushNameProfiles[0].phone?.replace(/\D/g, "") || remotePhone;
          
          // Salvar mapeamento LID
          if (isLidAddress) {
            try {
              await supabase.from("lid_mappings").upsert({
                lid: originalRemoteJid.replace(/@lid$/i, ""),
                phone: remotePhone,
                push_name: pushName,
              }, { onConflict: "lid" });
            } catch (e) { /* ignore */ }
          }
        }
      }
      
      if (!foundByPushName) {
        // Antes de recusar: pode ser um TERCEIRO que está sendo cobrado por uma
        // tarefa. Essas pessoas não têm cadastro, mas precisam conseguir dar
        // baixa respondendo "feito".
        const assigneeReply = await handleAssigneeReply(supabase, phoneVariants, text);
        if (assigneeReply) {
          isMeta
            ? await sendMessageMeta(metaPhoneNumberId, remotePhone, assigneeReply.reply)
            : await sendWhatsAppMessage(remotePhone, assigneeReply.reply);

          if (assigneeReply.ownerPhone && assigneeReply.ownerNotice) {
            isMeta
              ? await sendMessageMeta(metaPhoneNumberId, assigneeReply.ownerPhone, assigneeReply.ownerNotice)
              : await sendWhatsAppMessage(assigneeReply.ownerPhone, assigneeReply.ownerNotice);
          }

          return new Response(JSON.stringify({ status: "assignee_reply" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        isMeta
          ? await sendMessageMeta(metaPhoneNumberId, remotePhone, "Desculpe, não encontrei seu cadastro. Por favor, registre-se na plataforma primeiro! 📱\n\n👉 tuddo.pro")
          : await sendWhatsAppMessage(remotePhone, "Desculpe, não encontrei seu cadastro. Por favor, registre-se na plataforma primeiro! 📱\n\n👉 tuddo.pro");

        return new Response(JSON.stringify({ status: "user_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Determinar userId e userPlan (pode vir de profiles ou pushNameProfiles)
    let userId: string;
    let userPlan: string;
    
    if (profiles && profiles.length > 0) {
      userId = profiles[0].id;
      userPlan = String(profiles[0].plan || "FREE").toUpperCase();
    } else {
      // foundByPushName = true, buscar novamente
      const pushName = isMeta ? (_metaExtracted?.pushName ?? "") : _pushName;
      const { data: pnProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, plan")
        .ilike("full_name", `%${pushName}%`)
        .limit(1);
      
      if (pnProfiles && pnProfiles.length > 0) {
        userId = pnProfiles[0].id;
        userPlan = String(pnProfiles[0].plan || "FREE").toUpperCase();
      } else {
        return new Response(JSON.stringify({ status: "user_not_found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Quem mandou a mensagem, antes de qualquer redirecionamento para o titular.
    // É o que permite atribuir o gasto à pessoa certa numa conta compartilhada.
    const sender: MessageSender = { userId: null, name: null };

    // Verificar se o usuário é membro de um plano familiar
    // Se for, usar o owner_id da família para compartilhar dados
    try {
      const { data: familyMember } = await supabase
        .from("family_members")
        .select("family_id, role, family_groups(owner_id, plan)")
        .eq("user_id", userId)
        .limit(1)
        .single();

      if (familyMember && familyMember.family_groups) {
        // Membro familiar: dados vão para a conta do owner
        const familyOwnerId = (familyMember.family_groups as any).owner_id;
        const familyPlan = (familyMember.family_groups as any).plan || "FAMILY_2";
        // Usar o owner como userId para que os dados sejam compartilhados
        if (familyMember.role === "member") {
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", userId)
            .single();
          sender.userId = userId;
          sender.name = senderProfile?.full_name?.trim() || null;
          userId = familyOwnerId;
        }
        // Mantemos o plano REAL (FAMILY_2/3/4). Achatar para "PRO" aqui fazia
        // todo teste de startsWith("FAMILY") falhar depois — era por isso que o
        // titular nunca recebia as instruções de onboarding e a IA achava que
        // ele estava no PRO, chegando a oferecer o Familiar a quem já assinava.
        // As liberações continuam iguais às do PRO via planTier().
        userPlan = String(familyPlan).toUpperCase();
      }
    } catch (familyErr) {
      // Se não é membro de família, continua normal
      console.log("Not a family member or no family found");
    }

    // ── Primeiro contato: explicar o que o Tuddo é ──────────────────────────
    // A pessoa se cadastrava, mandava "oi", recebia uma saudação genérica e
    // seguia sem saber o que o produto faz — nem que ele não é um chat de IA
    // de assunto livre. Isso virava pergunta fora do escopo, resposta confusa e
    // a impressão de que o Tuddo não funciona.
    //
    // Vai só para quem escreveu de fato: sender.userId preenchido significa que
    // quem mandou é membro de família e o userId já é o do titular — nesse caso
    // a orientação seria gravada na conta errada.
    if (!sender.userId) {
      try {
        const { data: perfil, error: perfilErr } = await supabase
          .from("profiles")
          .select("full_name, welcome_sent_at")
          .eq("id", userId)
          .maybeSingle();

        if (perfilErr) {
          console.error("Welcome lookup error:", perfilErr);
        } else if (perfil && !perfil.welcome_sent_at) {
          const boasVindas = buildWelcomeMessage(perfil.full_name);

          const envio = isMeta
            ? await sendMessageMeta(metaPhoneNumberId, remotePhone, boasVindas)
            : await sendWhatsAppMessage(remotePhone, boasVindas);

          // Só marca como enviada se saiu mesmo. Marcar antes faria o cliente
          // perder a orientação para sempre por causa de uma falha de envio.
          if (!String(envio).startsWith("error")) {
            await supabase
              .from("profiles")
              .update({ welcome_sent_at: new Date().toISOString() })
              .eq("id", userId);
            console.log(`Orientação de boas-vindas enviada a ${userId}`);
          } else {
            console.error("Falha ao enviar boas-vindas:", envio);
          }
        }
      } catch (welcomeErr) {
        // Nunca deixar a orientação derrubar o atendimento normal.
        console.error("Welcome error:", welcomeErr);
      }
    }

    // ── Onboarding do plano Familiar ────────────────────────────────────────
    // Quem assina o Familiar não recebe orientação nenhuma sobre como incluir
    // a outra pessoa, e o passo "ela precisa criar a conta antes" não é óbvio.
    // Enviamos na primeira mensagem que o titular manda depois de assinar —
    // mensagem proativa fora da janela de 24h esbarraria nas regras da Meta.
    //
    // sender.userId só é preenchido quando quem escreveu é MEMBRO e o userId já
    // foi trocado pelo do titular. Sem essa checagem, a instrução de "como
    // convidar alguém" iria para o familiar convidado, que não convida ninguém.
    if (userPlan.startsWith("FAMILY") && !sender.userId) {
      try {
        const { data: ownedGroup } = await supabase
          .from("family_groups")
          .select("id, max_members, instructions_sent_at")
          .eq("owner_id", userId)
          .maybeSingle();

        if (ownedGroup && !ownedGroup.instructions_sent_at) {
          const vagas = (ownedGroup.max_members ?? 2) - 1;
          const boasVindas =
            `Bem-vindo ao *Plano Familiar*! 🎉\n\n` +
            `Deixa eu te explicar como incluir ${vagas > 1 ? "as outras pessoas" : "a outra pessoa"}:\n\n` +
            `*1.* Ela cria a conta dela em *tuddo.pro* (criar é grátis)\n` +
            `*2.* Você entra em *tuddo.pro/family* e convida ela pelo e-mail ou telefone que ela usou no cadastro\n` +
            `*3.* Pronto! ✅\n\n` +
            `A partir daí vocês lançam na *mesma conta*: o que ela registrar aparece pra você e vice-versa. ` +
            `E cada gasto fica identificado por quem fez, então dá pra ver quanto cada um gastou.\n\n` +
            `Seu plano permite *${ownedGroup.max_members} pessoas* (você + ${vagas}).\n\n` +
            `⚠️ Importante: ela precisa criar a conta *antes* de você convidar, senão não vai encontrar.\n\n` +
            `Qualquer dúvida é só me chamar! 😊`;

          isMeta
            ? await sendMessageMeta(metaPhoneNumberId, remotePhone, boasVindas)
            : await sendWhatsAppMessage(remotePhone, boasVindas);

          await supabase
            .from("family_groups")
            .update({ instructions_sent_at: new Date().toISOString() })
            .eq("id", ownedGroup.id);

          console.log(`Instruções do plano Familiar enviadas ao titular ${userId}`);
        }
      } catch (famErr) {
        // Nunca deixar o onboarding derrubar o atendimento normal.
        console.error("Family onboarding error:", famErr);
      }
    }

    // Drive: toda mídia recebida vira arquivo guardado e indexado.
    // Roda depois da resolução de família para que o arquivo caia na mesma
    // conta que recebe as transações.
    if (pendingMedia) {
      await saveToDrive(supabase, userId, pendingMedia);
      pendingMedia = null;
    }

    const adminPhones = (Deno.env.get("ADMIN_PHONES") || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const isAdmin = phoneVariants.some((v) => adminPhones.includes(v)) || adminPhones.includes(remotePhone);
    if (!isAdmin) {
      const limitExceeded = await checkMessageLimit(supabase, userId, userPlan);
      if (limitExceeded) {
        const limitMessage = PLAN_LIMITS[planTier(userPlan)]?.message || PLAN_LIMITS.FREE.message;
        isMeta ? await sendMessageMeta(metaPhoneNumberId, remotePhone, limitMessage) : await sendWhatsAppMessage(remotePhone, limitMessage);

        return new Response(JSON.stringify({ status: "limit_exceeded", plan: userPlan }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ============================================================
    // ONBOARDING PROATIVO — SEQUÊNCIA DE BOAS-VINDAS
    // ============================================================
    // Detecta o estágio do onboarding pelo histórico de inbox_messages.
    // Estágio 0: nenhuma mensagem anterior → enviar Mensagem 1 (boas-vindas)
    // Estágio 1: última resposta do bot foi a pergunta de diagnóstico → enviar Mensagem 3 (dica personalizada)
    // Estágio 2+: onboarding concluído → seguir fluxo normal da IA

    const ONBOARDING_DIAGNOSIS_MARKER = "[ONBOARDING_DIAGNOSIS]";

    const ONBOARDING_MSG1 = (name: string) =>
      `Oi, ${name}! 👋\n\nBem-vindo ao Tuddo — seu assistente financeiro pessoal aqui no WhatsApp.\n\nSou o Tuddo. Vou te ajudar a saber exatamente para onde vai o seu dinheiro, sem planilha, sem app novo, sem complicação. Tudo aqui mesmo, no WhatsApp que você já usa.\n\nPra começar, é simples: só me manda uma mensagem quando gastar alguma coisa. Tipo assim:\n\n💬 "Gastei R$18 no café"\n💬 "Mercado R$95"\n💬 "Uber R$22"\n\nEu registro, categorizo e organizo tudo automaticamente. Você só fala, eu cuido do resto.\n\nTesta agora — me manda o último gasto que você teve hoje. 👇`;

    const ONBOARDING_MSG2 =
      `Ótimo! Já anotei aqui. 📝\n\nAgora me conta uma coisa — assim eu consigo te ajudar de um jeito muito mais certeiro:\n\n*Qual é o seu maior desafio financeiro agora?*\n\n1️⃣ Gasto demais no cartão e não sei exatamente onde\n2️⃣ Minha conta fica no vermelho antes do fim do mês\n3️⃣ Não sei para onde vai o meu dinheiro — ele simplesmente some\n\nSó responde o número (1, 2 ou 3). 😊\n\n${ONBOARDING_DIAGNOSIS_MARKER}`;

    const ONBOARDING_MSG2_DELAYED =
      `Oi! Só passando para te lembrar que estou aqui quando você quiser. 😊\n\nEnquanto isso, me conta uma coisa rápida:\n\n*Qual é o seu maior desafio com dinheiro agora?*\n\n1️⃣ Gasto demais no cartão e não sei exatamente onde\n2️⃣ Minha conta fica no vermelho antes do fim do mês\n3️⃣ Não sei para onde vai o meu dinheiro — ele simplesmente some\n\nSó responde o número — leva 5 segundos. Assim eu já sei como te ajudar melhor. 👇\n\n${ONBOARDING_DIAGNOSIS_MARKER}`;

    const ONBOARDING_MSG3_CARTAO =
      `Entendi! Cartão é o maior vilão de quem não tem visibilidade dos gastos — porque você gasta sem sentir o dinheiro saindo.\n\nAqui está o que vou fazer por você: *toda vez que você me mandar um gasto no cartão, eu vou registrar e te mostrar o total acumulado do mês.* Assim você sabe em tempo real quanto já comprometeu — antes de chegar a fatura.\n\nTesta agora: me manda o último gasto que você fez no cartão. Pode ser de hoje ou de ontem.\n\n💡 *Dica rápida:* Você também pode me perguntar "quanto gastei no cartão esse mês?" a qualquer hora. Eu respondo em segundos. 💳`;

    const ONBOARDING_MSG3_VERMELHO =
      `Entendi! Conta no vermelho geralmente acontece por uma combinação de dois problemas: gastos invisíveis que somam mais do que parecem, e falta de visibilidade do saldo real ao longo do mês.\n\nAqui está o que vou fazer por você: *vou te ajudar a mapear onde está indo o dinheiro antes do fim do mês* — não depois, quando já é tarde.\n\nComeça assim: me manda os 3 maiores gastos fixos que você tem todo mês (aluguel, financiamento, mensalidade, seja o que for). Assim eu consigo te dar uma visão do quanto você já tem comprometido antes mesmo de gastar.\n\n💡 *Dica rápida:* Você pode me perguntar "quanto ainda posso gastar esse mês?" a qualquer hora. 📊`;

    const ONBOARDING_MSG3_SUMINDO =
      `Entendi! Esse é o mais comum — e o mais frustrante. O dinheiro vai embora em pequenos gastos que parecem insignificantes na hora, mas somam centenas de reais no fim do mês.\n\nAqui está o que vou fazer por você: *vou rastrear cada gasto e te mostrar os padrões que você ainda não viu.* Em 2 semanas, você vai saber exatamente para onde está indo cada real.\n\nComeça agora: me manda tudo que você gastou hoje — pode ser vários gastos de uma vez, um por linha.\n\n💡 *Dica rápida:* No fim de cada semana, você pode me pedir "resumo da semana" e eu te mostro tudo organizado por categoria. 🔍`;

    const ONBOARDING_MSG3_LIVRE =
      `Obrigado por me contar! Vou prestar atenção nisso enquanto trabalhamos juntos.\n\nPara começar, o mais importante é criar o hábito de me avisar quando gastar alguma coisa. Quanto mais você me conta, mais preciso fico nas análises.\n\nTesta agora: me manda o último gasto que você teve — pode ser qualquer coisa, de qualquer valor. 👇`;

    // Verificar estágio do onboarding
    try {
      const { data: allMessages, count: totalMessages } = await supabase
        .from("inbox_messages")
        .select("message, response, created_at", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      const messageCount = totalMessages ?? (allMessages?.length ?? 0);
      const lastBotResponse = allMessages && allMessages.length > 0 ? (allMessages[0].response || "") : "";
      const isAwaitingDiagnosis = lastBotResponse.includes(ONBOARDING_DIAGNOSIS_MARKER);

      if (messageCount === 0) {
        // ESTÁGIO 0: Primeiro contato — enviar Mensagem 1 de boas-vindas
        const userName = profiles && profiles.length > 0
          ? (profiles[0].full_name || "").split(" ")[0] || "amigo"
          : "amigo";
        const welcomeMsg = ONBOARDING_MSG1(userName);

        await supabase.from("inbox_messages").insert({
          user_id: userId,
          message: text,
          type: "general_query",
          source: "whatsapp",
          status: "processado",
          response: welcomeMsg,
        });

        await sendWhatsAppMessage(remotePhone, welcomeMsg);

        // Agendar Mensagem 2 com delay de 30 minutos via Edge Function (usando setTimeout não é confiável em Deno Deploy)
        // Solução: registrar um flag no banco para que o próximo contato do usuário dispare a MSG2 se ainda não respondeu
        // Por ora, a MSG2 será enviada na PRÓXIMA mensagem do usuário se ainda não tiver respondido

        return new Response(JSON.stringify({ status: "ok", intent: "onboarding_welcome", phone: remotePhone }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isAwaitingDiagnosis) {
        // ESTÁGIO 1: Usuário respondeu à pergunta de diagnóstico — enviar Mensagem 3 personalizada
        const lowerText = text.toLowerCase().trim();
        let diagnosisReply = "";

        if (lowerText.includes("1") || lowerText.includes("cartão") || lowerText.includes("cartao") || lowerText.includes("crédito") || lowerText.includes("credito")) {
          diagnosisReply = ONBOARDING_MSG3_CARTAO;
        } else if (lowerText.includes("2") || lowerText.includes("vermelho") || lowerText.includes("negativo") || lowerText.includes("devendo")) {
          diagnosisReply = ONBOARDING_MSG3_VERMELHO;
        } else if (lowerText.includes("3") || lowerText.includes("some") || lowerText.includes("sumindo") || lowerText.includes("não sei") || lowerText.includes("nao sei")) {
          diagnosisReply = ONBOARDING_MSG3_SUMINDO;
        } else {
          diagnosisReply = ONBOARDING_MSG3_LIVRE;
        }

        await supabase.from("inbox_messages").insert({
          user_id: userId,
          message: text,
          type: "general_query",
          source: "whatsapp",
          status: "processado",
          response: diagnosisReply,
        });

        await sendWhatsAppMessage(remotePhone, diagnosisReply);

        return new Response(JSON.stringify({ status: "ok", intent: "onboarding_diagnosis", phone: remotePhone }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ESTÁGIO 2: Verificar se o usuário tem apenas 1 mensagem (boas-vindas enviada, mas ainda não respondeu à MSG2)
      // Nesse caso, a próxima mensagem do usuário deve disparar a MSG2 de diagnóstico ANTES de processar normalmente
      if (messageCount === 1) {
        const firstResponse = allMessages && allMessages.length > 0 ? (allMessages[0].response || "") : "";
        const isFirstResponseWelcome = firstResponse.includes("Bem-vindo ao Tuddo");

        if (isFirstResponseWelcome) {
          // Usuário respondeu à MSG1 (registrou primeiro gasto ou mandou qualquer coisa)
          // Processar normalmente E depois enviar MSG2 de diagnóstico
          // Deixar o fluxo normal rodar — a MSG2 será enviada como mensagem adicional após a resposta da IA
          // Marcamos isso para enviar a MSG2 ao final
          // (implementado abaixo, após o processamento normal)
        }
      }
    } catch (onboardingErr) {
      console.error("Onboarding check error:", onboardingErr);
      // Em caso de erro, seguir fluxo normal
    }
    // ============================================================
    // FIM DO ONBOARDING — FLUXO NORMAL DA IA
    // ============================================================

    // Buscar histórico de conversa (últimas 8 mensagens) para dar contexto à IA
    let conversationHistory = "";
    let recentMsgsDesc: Array<{message: string; response: string | null; created_at: string; type: string}> = [];
    try {
      const { data: historyData } = await supabase
        .from("inbox_messages")
        .select("message, response, created_at, type")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(8);

      if (historyData && historyData.length > 0) {
        recentMsgsDesc = historyData;
        // Cópia invertida para ordem cronológica — só para display no histórico
        const chronological = [...historyData].reverse();
        const historyLines = chronological.map((m: any) => {
          const userMsg = `USUÁRIO: ${m.message}`;
          const botMsg = m.response ? `TUDDO: ${m.response.substring(0, 150)}` : "";
          return botMsg ? `${userMsg}\n${botMsg}` : userMsg;
        }).join("\n");
        conversationHistory = `\n\n[HISTÓRICO]\n${historyLines}\n[/HISTÓRICO]`;
      }
    } catch (historyErr) {
      console.error("History fetch error:", historyErr);
    }

    // Verificar confirmação de escalonamento para suporte humano
    const lastInboxMsg = recentMsgsDesc.length > 0 ? recentMsgsDesc[0] : null;
    const alreadyRequestedSupport = recentMsgsDesc.some(m => m.type === "support_requested");
    if (lastInboxMsg?.type === "escalation_offered" && isAffirmativeMessage(text) && !alreadyRequestedSupport) {
      const clientName = (profiles && profiles.length > 0 ? profiles[0].full_name : null)
        || (isMeta ? (_metaExtracted?.pushName ?? "") : _pushName)
        || remotePhone;
      const contextForSupport = [...recentMsgsDesc.slice(0, 5)].reverse(); // cronológico

      const requestId = await createSupportRequest(supabase, userId, remotePhone, lastInboxMsg.message, contextForSupport);

      const supportReply = requestId
        ? "✅ Pronto! Acionei o suporte. Alguém do time Tuddo vai entrar em contato por aqui em breve. 🤝"
        : "Ops, não consegui acionar o suporte agora. Tente novamente em alguns instantes! 😅";

      if (requestId) {
        notifySupportAdmin(clientName, lastInboxMsg.message, metaPhoneNumberId).catch(() => {});
      }

      await supabase.from("inbox_messages").insert({
        user_id: userId,
        message: text,
        type: "support_requested",
        source: "whatsapp",
        status: "processado",
        response: supportReply,
      }).catch((e: unknown) => console.error("Inbox insert error:", e));

      isMeta
        ? await sendMessageMeta(metaPhoneNumberId, remotePhone, supportReply)
        : await sendWhatsAppMessage(remotePhone, supportReply);

      return new Response(JSON.stringify({ status: "ok", intent: "support_requested" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar pastas do usuário para dar contexto à IA
    let userFoldersContext = "";
    try {
      const { data: userFolders } = await supabase
        .from("folders")
        .select("name, emoji")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (userFolders && userFolders.length > 0) {
        const folderNames = userFolders.map((f: any) => `${f.emoji} ${f.name}`).join(", ");
        userFoldersContext = `\n\n[PASTAS DO USUÁRIO: ${folderNames}]`;
      }
    } catch (folderCtxErr) {
      console.error("Folder context error:", folderCtxErr);
    }

    // Contexto do plano — sem isso a IA não sabe o que o cliente já tem e
    // acaba oferecendo um plano que ele acabou de assinar (aconteceu de
    // verdade: cliente no Familiar 2 recebeu "está disponível a partir de
    // R$ 34,90/mês"). Também evita empurrar upgrade para quem já é PRO.
    let planContext = "";
    try {
      const planLabels: Record<string, string> = {
        FREE: "Grátis", STARTER: "Starter", PRO: "PRO",
        FAMILY_2: "Familiar 2 (casal)", FAMILY_3: "Familiar 3", FAMILY_4: "Familiar 4",
      };
      const label = planLabels[userPlan] ?? userPlan;

      if (userPlan.startsWith("FAMILY")) {
        // Quem é membro tem o userId já trocado pelo do titular, então buscar
        // por owner_id acharia o grupo e trataria o familiar como se fosse o
        // dono da assinatura. sender.userId é o que distingue os dois.
        const ehTitular = !sender.userId;
        const { data: fg } = ehTitular
          ? await supabase
              .from("family_groups")
              .select("id, max_members")
              .eq("owner_id", userId)
              .maybeSingle()
          : { data: null };

        if (fg) {
          const { count } = await supabase
            .from("family_members")
            .select("id", { count: "exact", head: true })
            .eq("family_id", fg.id);

          const usados = count ?? 1;
          const vagas = Math.max((fg.max_members ?? 2) - usados, 0);
          planContext =
            `\n\n[PLANO ATUAL DO USUÁRIO: ${label} — ele é o TITULAR. ` +
            `${usados} de ${fg.max_members} pessoas usando, ${vagas} vaga(s) livre(s). ` +
            `NÃO ofereça vender plano familiar: ele JÁ TEM. Se perguntar sobre incluir alguém, ` +
            `explique os passos do convite.]`;
        } else {
          planContext = `\n\n[PLANO ATUAL DO USUÁRIO: ${label} — é MEMBRO de uma família, não o titular. Só o titular convida novas pessoas.]`;
        }
      } else {
        planContext = `\n\n[PLANO ATUAL DO USUÁRIO: ${label}. Só sugira upgrade se fizer sentido para o que ele pediu.]`;
      }
    } catch (planCtxErr) {
      console.error("Plan context error:", planCtxErr);
    }

    // Montar mensagem com histórico + contexto de pastas + plano + mensagem atual
    let messageWithContext = "";
    if (conversationHistory) {
      messageWithContext += conversationHistory;
    }
    if (userFoldersContext) {
      messageWithContext += userFoldersContext;
    }
    if (planContext) {
      messageWithContext += planContext;
    }
    messageWithContext += `\n\nMensagem atual: "${text}"`;

    // Interpretar a mensagem com IA (com histórico e contexto)
    const aiResult = await interpretMessage(messageWithContext, new Date());
    const intent = aiResult.intent || "general_query";

    // Executar a ação e obter a resposta REAL
    let reply = await executeIntentAction(supabase, userId, userPlan, aiResult, text, sender);
    let finalIntent: string = intent;

    // ── Quando chamar gente de verdade ──────────────────────────────────────
    // Suporte humano é o ÚLTIMO recurso, mas "último" não pode virar "nunca":
    // quem pede atendente tem que ser atendido, e defeito o assistente não
    // conserta. Ordem: pedido explícito > relato de defeito > insistência.

    // Se já ofertamos ou já abrimos chamado recentemente, não insistir.
    const alreadyEscalatedRecently = recentMsgsDesc.some(
      (m: any) => m.type === "escalation_offered" || m.type === "support_requested"
    );

    if (!alreadyEscalatedRecently) {
      if (wantsHumanSupport(text)) {
        // Pediu pessoa: não tentar resolver de novo, não empurrar link.
        reply =
          "Claro! 🤝 Quer que eu acione o time do Tuddo pra falar com você por aqui? " +
          "Responda *sim* que eu chamo agora.";
        finalIntent = "escalation_offered";
      } else if (intent === "general_query") {
        const isNewUser = recentMsgsDesc.length <= 3;
        const prevMsg = recentMsgsDesc.length > 0 ? recentMsgsDesc[0] : null;
        const prev2Msg = recentMsgsDesc.length > 1 ? recentMsgsDesc[1] : null;

        // Só conta como "não reconhecida" a mensagem que de fato caiu em
        // general_query. Antes, escalation_offered também contava — e como a
        // própria oferta vira a mensagem anterior, cada nova mensagem
        // reofertava suporte indefinidamente.
        const twoConsecutiveUnrecognized =
          prevMsg?.type === "general_query" && prev2Msg?.type === "general_query";

        // Defeito, cobrança e conta travada não se resolvem conversando. Aqui
        // basta UMA repetição — o cliente que relatou a tela da família quebrada
        // perguntou duas vezes e não foi encaminhado nenhuma vez.
        const relataProblema = reportsSomethingBroken(text);
        const jaTentouAntes = prevMsg?.type === "general_query";

        if (!isNewUser && relataProblema && jaTentouAntes) {
          reply =
            "Pelo jeito isso é algo que eu não consigo resolver sozinho por aqui. 😕\n\n" +
            "Quer que eu acione o time do Tuddo pra olhar sua conta? Responda *sim* que eu chamo.";
          finalIntent = "escalation_offered";
        } else if (!isNewUser && twoConsecutiveUnrecognized) {
          reply =
            "Não consegui te ajudar com isso ainda. Quer que eu avise o suporte humano? " +
            "Responda *sim* para confirmar. 🆘";
          finalIntent = "escalation_offered";
        }
      }
    }

    // Salvar no inbox
    const { error: inboxError } = await supabase.from("inbox_messages").insert({
      user_id: userId,
      message: text,
      type: finalIntent,
      source: "whatsapp",
      status: "processado",
      response: reply,
    });

    if (inboxError) {
      console.error("Inbox insert error:", inboxError);
    }

    // Enviar resposta via WhatsApp
    const sendResult = isMeta
      ? await sendMessageMeta(metaPhoneNumberId, remotePhone, reply)
      : await sendWhatsAppMessage(remotePhone, reply);

    // ONBOARDING: Se esta é a segunda mensagem do usuário (respondeu à MSG1 de boas-vindas),
    // enviar a MSG2 de diagnóstico logo após a resposta normal da IA
    try {
      const { data: msgCheck, count: msgCheckCount } = await supabase
        .from("inbox_messages")
        .select("response", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3);

      // Contar inclui a mensagem que acabamos de salvar, então 2 = esta é a segunda mensagem
      const totalNow = msgCheckCount ?? (msgCheck?.length ?? 0);
      const prevResponse = msgCheck && msgCheck.length > 1 ? (msgCheck[1].response || "") : "";
      const prevWasWelcome = prevResponse.includes("Bem-vindo ao Tuddo");

      if (totalNow === 2 && prevWasWelcome) {
        // Aguardar 2 segundos para não parecer instantâneo
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const diagnosisMsg = ONBOARDING_MSG2;
        const diagnosisMsgClean = diagnosisMsg.replace(ONBOARDING_DIAGNOSIS_MARKER, "").trim();

        // Salvar MSG2 no inbox COM marcador (para detecção do próximo estágio)
        await supabase.from("inbox_messages").insert({
          user_id: userId,
          message: "[ONBOARDING_AUTO]",
          type: "general_query",
          source: "whatsapp",
          status: "processado",
          response: diagnosisMsg,
        });

        // Enviar ao usuário SEM marcador
        await sendWhatsAppMessage(remotePhone, diagnosisMsgClean);
      }
    } catch (onboardingFollowErr) {
      console.error("Onboarding follow-up error:", onboardingFollowErr);
    }

    return new Response(JSON.stringify({ status: "ok", intent: finalIntent, sendResult, phone: remotePhone, reply: reply.substring(0, 50) }), {
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
