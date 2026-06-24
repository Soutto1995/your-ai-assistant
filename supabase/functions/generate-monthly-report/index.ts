import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Gerar SVG de gráfico de pizza
function generatePieChartSVG(data: { label: string; value: number; color: string }[], total: number): string {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const r = 80;
  
  let paths = "";
  let startAngle = -Math.PI / 2;
  
  for (const item of data) {
    if (item.value === 0) continue;
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    
    paths += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${item.color}" stroke="white" stroke-width="2"/>`;
    startAngle = endAngle;
  }
  
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}

// Gerar HTML do relatório
function generateReportHTML(data: {
  userName: string;
  month: string;
  year: number;
  totalExpense: number;
  totalIncome: number;
  balance: number;
  categories: { name: string; amount: number; percentage: number; color: string }[];
  transactions: { date: string; description: string; amount: number; type: string; category: string }[];
  events: { title: string; event_date: string; event_time: string | null }[];
  tasks: { title: string; status: string; due_date: string | null }[];
  completedTasks: number;
  totalTasks: number;
}): string {
  const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];
  
  const pieData = data.categories.slice(0, 8).map((cat, i) => ({
    label: cat.name,
    value: cat.amount,
    color: COLORS[i % COLORS.length],
  }));
  
  const pieSVG = generatePieChartSVG(pieData, data.totalExpense);
  
  const formatCurrency = (val: number) => `R$ ${val.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
  const balanceColor = data.balance >= 0 ? "#22c55e" : "#ef4444";
  const balanceSign = data.balance >= 0 ? "+" : "";

  const transactionRows = data.transactions.slice(0, 30).map(t => {
    const color = t.type === "income" ? "#22c55e" : "#ef4444";
    const sign = t.type === "income" ? "+" : "-";
    const dateFormatted = t.date ? new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR") : "";
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#ccc;font-size:13px;">${dateFormatted}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#fff;font-size:13px;">${t.description}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#aaa;font-size:13px;">${t.category || "Outros"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:${color};font-size:13px;font-weight:600;text-align:right;">${sign}${formatCurrency(t.amount)}</td>
    </tr>`;
  }).join("");

  const eventRows = data.events.map(e => {
    const dateFormatted = e.event_date ? new Date(e.event_date + "T12:00:00").toLocaleDateString("pt-BR") : "";
    const timeStr = e.event_time ? ` às ${e.event_time.substring(0, 5)}` : "";
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#ccc;font-size:13px;">${dateFormatted}${timeStr}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a2a;color:#fff;font-size:13px;">${e.title}</td>
    </tr>`;
  }).join("");

  const categoryLegend = data.categories.slice(0, 8).map((cat, i) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="width:14px;height:14px;border-radius:3px;background:${COLORS[i % COLORS.length]};flex-shrink:0;"></div>
      <span style="color:#ccc;font-size:13px;flex:1;">${cat.name}</span>
      <span style="color:#fff;font-size:13px;font-weight:600;">${formatCurrency(cat.amount)}</span>
      <span style="color:#888;font-size:12px;">(${cat.percentage.toFixed(1)}%)</span>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório Mensal Tuddo - ${data.month} ${data.year}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f0f0f; color: #fff; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid #2a2a2a; }
  .logo { font-size: 28px; font-weight: 800; color: #22c55e; letter-spacing: -1px; }
  .logo span { color: #fff; }
  .header-info { text-align: right; }
  .header-info h2 { font-size: 20px; color: #fff; font-weight: 600; }
  .header-info p { color: #888; font-size: 14px; margin-top: 4px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px; }
  .summary-card { background: #1a1a1a; border-radius: 16px; padding: 24px; border: 1px solid #2a2a2a; }
  .summary-card .label { color: #888; font-size: 13px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 26px; font-weight: 700; }
  .section { margin-bottom: 40px; }
  .section-title { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #2a2a2a; display: flex; align-items: center; gap: 10px; }
  .section-title::before { content: ''; display: inline-block; width: 4px; height: 20px; background: #22c55e; border-radius: 2px; }
  .chart-section { display: grid; grid-template-columns: 200px 1fr; gap: 30px; align-items: start; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 10px 12px; text-align: left; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #2a2a2a; }
  .footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid #2a2a2a; text-align: center; color: #555; font-size: 12px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #14532d; color: #22c55e; }
  .badge-red { background: #450a0a; color: #ef4444; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">tud<span>do</span></div>
    <div class="header-info">
      <h2>Relatório Mensal</h2>
      <p>${data.month} de ${data.year} • ${data.userName}</p>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">💰 Total de Gastos</div>
      <div class="value" style="color:#ef4444;">${formatCurrency(data.totalExpense)}</div>
    </div>
    <div class="summary-card">
      <div class="label">📈 Total de Receitas</div>
      <div class="value" style="color:#22c55e;">${formatCurrency(data.totalIncome)}</div>
    </div>
    <div class="summary-card">
      <div class="label">⚖️ Saldo do Mês</div>
      <div class="value" style="color:${balanceColor};">${balanceSign}${formatCurrency(Math.abs(data.balance))}</div>
    </div>
  </div>

  ${data.categories.length > 0 ? `
  <div class="section">
    <div class="section-title">Gastos por Categoria</div>
    <div class="chart-section">
      <div>${pieSVG}</div>
      <div>${categoryLegend}</div>
    </div>
  </div>
  ` : ""}

  ${data.transactions.length > 0 ? `
  <div class="section">
    <div class="section-title">Movimentações do Mês</div>
    <table>
      <thead>
        <tr>
          <th>Data</th>
          <th>Descrição</th>
          <th>Categoria</th>
          <th style="text-align:right;">Valor</th>
        </tr>
      </thead>
      <tbody>${transactionRows}</tbody>
    </table>
    ${data.transactions.length > 30 ? `<p style="color:#888;font-size:12px;margin-top:12px;text-align:center;">Mostrando 30 de ${data.transactions.length} movimentações</p>` : ""}
  </div>
  ` : ""}

  ${data.events.length > 0 ? `
  <div class="section">
    <div class="section-title">Compromissos do Mês</div>
    <table>
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Compromisso</th>
        </tr>
      </thead>
      <tbody>${eventRows}</tbody>
    </table>
  </div>
  ` : ""}

  ${data.totalTasks > 0 ? `
  <div class="section">
    <div class="section-title">Tarefas</div>
    <div style="display:flex;gap:20px;">
      <div class="summary-card" style="flex:1;">
        <div class="label">✅ Concluídas</div>
        <div class="value" style="color:#22c55e;">${data.completedTasks}</div>
      </div>
      <div class="summary-card" style="flex:1;">
        <div class="label">📌 Pendentes</div>
        <div class="value" style="color:#f59e0b;">${data.totalTasks - data.completedTasks}</div>
      </div>
      <div class="summary-card" style="flex:1;">
        <div class="label">📊 Total</div>
        <div class="value">${data.totalTasks}</div>
      </div>
    </div>
  </div>
  ` : ""}

  <div class="footer">
    <p>Relatório gerado automaticamente pelo <strong style="color:#22c55e;">Tuddo</strong> • ${new Date().toLocaleDateString("pt-BR")}</p>
    <p style="margin-top:4px;">Seu assistente pessoal inteligente • www.tuddo.pro</p>
  </div>
</div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Auth via JWT do usuário
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userToken = authHeader.replace("Bearer ", "");
  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Parâmetros: mês e ano (padrão: mês atual)
  const url = new URL(req.url);
  const now = new Date();
  const brtNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const requestedMonth = parseInt(url.searchParams.get("month") || String(brtNow.getMonth() + 1));
  const requestedYear = parseInt(url.searchParams.get("year") || String(brtNow.getFullYear()));

  const startDate = `${requestedYear}-${String(requestedMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(requestedYear, requestedMonth, 0).getDate();
  const endDate = `${requestedYear}-${String(requestedMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  // Buscar perfil
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, plan")
    .eq("id", user.id)
    .maybeSingle();

  // Buscar transações
  const { data: transactions } = await supabase
    .from("transactions")
    .select("amount, type, category, description, date")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false });

  // Buscar eventos
  const { data: events } = await supabase
    .from("events")
    .select("title, event_date, event_time")
    .eq("user_id", user.id)
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date", { ascending: true });

  // Buscar tarefas
  const { data: tasks } = await supabase
    .from("tasks")
    .select("title, status, due_date")
    .eq("user_id", user.id)
    .or(`due_date.gte.${startDate},due_date.is.null`)
    .order("created_at", { ascending: false });

  // Calcular totais
  const expenses = (transactions || []).filter(t => t.type === "expense");
  const incomes = (transactions || []).filter(t => t.type === "income");
  const totalExpense = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalIncome = incomes.reduce((sum, t) => sum + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  // Calcular categorias
  const categoryTotals: Record<string, number> = {};
  for (const t of expenses) {
    const cat = t.category || "Outros";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
  }
  const categories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
      color: "#22c55e",
    }));

  const completedTasks = (tasks || []).filter(t => t.status === "completed").length;

  const html = generateReportHTML({
    userName: profile?.full_name || "Usuário",
    month: MONTH_NAMES[requestedMonth - 1],
    year: requestedYear,
    totalExpense,
    totalIncome,
    balance,
    categories,
    transactions: transactions || [],
    events: events || [],
    tasks: tasks || [],
    completedTasks,
    totalTasks: (tasks || []).length,
  });

  // Retornar HTML (o frontend vai abrir em nova aba ou converter para PDF via browser)
  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="relatorio-tuddo-${MONTH_NAMES[requestedMonth - 1].toLowerCase()}-${requestedYear}.html"`,
    },
  });
});
