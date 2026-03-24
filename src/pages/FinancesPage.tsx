import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useSpendingComparison } from "@/hooks/useSpendingComparison";
import UpgradeModal from "@/components/UpgradeModal";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Plus, Trash2, Sparkles, Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Legend, Area, AreaChart,
} from "recharts";

type PeriodFilter = "today" | "week" | "month" | "year";

const EXPENSE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f43f5e",
];

const INCOME_COLOR = "#22c55e";
const EXPENSE_COLOR = "#ef4444";

function getPeriodStart(period: PeriodFilter): Date {
  const now = new Date();
  switch (period) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; }
    case "month": return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year": return new Date(now.getFullYear(), 0, 1);
  }
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

const CustomTooltipStyle = {
  background: "hsl(240 12% 8%)",
  border: "1px solid hsl(240 8% 20%)",
  borderRadius: "12px",
  padding: "10px 14px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
  backdropFilter: "blur(12px)",
};

const renderCustomPieLabel = ({ name, percent, cx, cy, midAngle, outerRadius }: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 24;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="hsl(40 20% 85%)" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11} fontWeight={500}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
};

export default function FinancesPage() {
  const { user } = useAuth();
  const { plan, limits, isPro } = usePlanLimits();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("gasto");
  const [period, setPeriod] = useState<PeriodFilter>("month");

  const comparison = useSpendingComparison(transactions);

  const fetchTransactions = async () => {
    const { data } = await supabase.from("transactions").select("*").order("transaction_date", { ascending: false });
    setTransactions(data || []);
  };

  useEffect(() => {
    fetchTransactions();
    const channel = supabase.channel("tx-realtime").on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, fetchTransactions).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Filter by history limit
  const historyFiltered = useMemo(() => {
    if (limits.historyMonths === Infinity) return transactions;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - limits.historyMonths);
    return transactions.filter(t => new Date(t.transaction_date) >= cutoff);
  }, [transactions, limits.historyMonths]);

  const filtered = useMemo(() => {
    const start = getPeriodStart(period);
    return historyFiltered.filter(t => new Date(t.transaction_date) >= start);
  }, [historyFiltered, period]);

  // Transaction count this month
  const txThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions.filter(t => new Date(t.transaction_date) >= monthStart).length;
  }, [transactions]);

  const canAddTransaction = limits.transactionsPerMonth === Infinity || txThisMonth < limits.transactionsPerMonth;

  const income = filtered.filter(t => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = filtered.filter(t => t.type === "gasto").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const balance = income - expenses;

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(t => t.type === "gasto").forEach(t => {
      const cat = t.category || "Sem categoria";
      map[cat] = (map[cat] || 0) + Math.abs(Number(t.amount));
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const topCategories = useMemo(() => [...pieData].sort((a, b) => b.value - a.value).slice(0, 3), [pieData]);

  const dailyTrendData = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const expenseMap: Record<number, number> = {};
    const incomeMap: Record<number, number> = {};
    filtered.filter(t => new Date(t.transaction_date) >= monthStart).forEach(t => {
      const day = new Date(t.transaction_date).getDate();
      if (t.type === "gasto") expenseMap[day] = (expenseMap[day] || 0) + Math.abs(Number(t.amount));
      else incomeMap[day] = (incomeMap[day] || 0) + Number(t.amount);
    });
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const result = [];
    for (let d = 1; d <= Math.min(daysInMonth, now.getDate()); d++) {
      result.push({ day: String(d), gastos: expenseMap[d] || 0, receitas: incomeMap[d] || 0 });
    }
    return result;
  }, [filtered]);

  const monthlyComparisonData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = getMonthLabel(d).charAt(0).toUpperCase() + getMonthLabel(d).slice(1);
      const gastos = historyFiltered.filter(t => t.type === "gasto" && new Date(t.transaction_date) >= d && new Date(t.transaction_date) < nextMonth).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const receitas = historyFiltered.filter(t => t.type === "receita" && new Date(t.transaction_date) >= d && new Date(t.transaction_date) < nextMonth).reduce((s, t) => s + Number(t.amount), 0);
      months.push({ month: label, gastos, receitas });
    }
    return months;
  }, [historyFiltered]);

  const handleAddClick = () => {
    if (!canAddTransaction) { setUpgradeOpen(true); return; }
    setOpen(true);
  };

  const addTransaction = async () => {
    if (!description.trim() || !amount || !user) return;
    if (!canAddTransaction) { setUpgradeOpen(true); return; }
    const { error } = await supabase.from("transactions").insert({
      description: description.trim(), amount: Number(amount),
      category: category || null, type, user_id: user.id,
    });
    if (error) { toast.error("Erro ao registrar"); return; }
    toast.success("Transação registrada!");
    setDescription(""); setAmount(""); setCategory(""); setType("gasto"); setOpen(false);
  };

  const deleteTransaction = async (id: string) => {
    await supabase.from("transactions").delete().eq("id", id);
    toast.success("Transação removida!");
  };

  const periodLabels: Record<PeriodFilter, string> = { today: "Hoje", week: "Semana", month: "Mês", year: "Ano" };

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-primary" />Dashboard Financeiro
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Visão completa das suas finanças.
              {limits.transactionsPerMonth !== Infinity && (
                <span className="ml-2 text-xs text-primary">({txThisMonth}/{limits.transactionsPerMonth} transações este mês)</span>
              )}
            </p>
          </div>
          <Button size="sm" className="gap-2 self-start" onClick={handleAddClick} disabled={!canAddTransaction}>
            {canAddTransaction ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            Nova Transação
          </Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Transação</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Descrição" value={description} onChange={e => setDescription(e.target.value)} />
              <Input type="number" placeholder="Valor" value={amount} onChange={e => setAmount(e.target.value)} />
              <Input placeholder="Categoria (opcional)" value={category} onChange={e => setCategory(e.target.value)} />
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasto">Gasto</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addTransaction} className="w-full">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Period filter */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(periodLabels) as PeriodFilter[]).map(p => (
            <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
              {periodLabels[p]}
            </Button>
          ))}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Receita" value={`R$ ${income.toLocaleString("pt-BR")}`} positive />
          <StatCard icon={<TrendingDown className="w-5 h-5" />} label="Gastos" value={`R$ ${expenses.toLocaleString("pt-BR")}`} />
          <StatCard icon={<DollarSign className="w-5 h-5" />} label="Saldo" value={`R$ ${balance.toLocaleString("pt-BR")}`} positive={balance >= 0} />
        </div>

        {/* PRO Comparison Section */}
        {isPro && comparison.length > 0 && (
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Crown className="w-4 h-4 text-primary" />
                Comparação com a Média
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">PRO</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {comparison.map((item, i) => {
                  const isUp = item.percentChange > 0;
                  const isDown = item.percentChange < 0;
                  return (
                    <div key={i} className="p-4 rounded-xl bg-card border border-border space-y-2">
                      <p className="text-sm font-semibold text-foreground">{item.category}</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-foreground">R$ {item.currentMonth.toLocaleString("pt-BR")}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isUp ? "bg-destructive/20 text-destructive" : isDown ? "bg-emerald-500/20 text-emerald-500" : "bg-muted text-muted-foreground"
                        }`}>
                          {isUp ? "↑" : isDown ? "↓" : "="} {Math.abs(item.percentChange).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Média: R$ {item.average.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </p>
                      <div className="w-full h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(item.average > 0 ? (item.currentMonth / item.average) * 100 : 0, 150)}%`,
                            maxWidth: "100%",
                            background: isUp
                              ? "linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--destructive) / 0.6))"
                              : "linear-gradient(90deg, #22c55e, #22c55e80)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PRO upsell for non-PRO users */}
        {!isPro && (
          <Card className="border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setUpgradeOpen(true)}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Comparação com a Média</p>
                <p className="text-xs text-muted-foreground">Compare seus gastos com a média dos últimos 3 meses. Exclusivo do plano Pro.</p>
              </div>
              <Lock className="w-5 h-5 text-primary flex-shrink-0" />
            </CardContent>
          </Card>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Area Chart */}
          <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />Fluxo Diário
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={dailyTrendData}>
                    <defs>
                      <linearGradient id="gradientIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradientExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={EXPENSE_COLOR} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={EXPENSE_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 8% 16%)" strokeOpacity={0.5} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(240 5% 50%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(240 5% 50%)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={CustomTooltipStyle} formatter={(v: number, name: string) => [`R$ ${v.toLocaleString("pt-BR")}`, name === "receitas" ? "Receitas" : "Gastos"]} labelStyle={{ color: "hsl(40 20% 85%)", fontWeight: 600, marginBottom: 4 }} itemStyle={{ color: "hsl(40 20% 75%)" }} />
                    <Area type="monotone" dataKey="receitas" stroke={INCOME_COLOR} strokeWidth={2} fill="url(#gradientIncome)" />
                    <Area type="monotone" dataKey="gastos" stroke={EXPENSE_COLOR} strokeWidth={2} fill="url(#gradientExpense)" />
                    <Legend formatter={(value) => value === "receitas" ? "Receitas" : "Gastos"} wrapperStyle={{ fontSize: 11, color: "hsl(240 5% 50%)" }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados para exibir.</p>
              )}
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />Comparativo Mensal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyComparisonData.some(d => d.gastos > 0 || d.receitas > 0) ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={monthlyComparisonData} barGap={4}>
                    <defs>
                      <linearGradient id="barIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={INCOME_COLOR} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={INCOME_COLOR} stopOpacity={0.5} />
                      </linearGradient>
                      <linearGradient id="barExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={EXPENSE_COLOR} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={EXPENSE_COLOR} stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 8% 16%)" strokeOpacity={0.5} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(240 5% 50%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(240 5% 50%)" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={CustomTooltipStyle} formatter={(v: number, name: string) => [`R$ ${v.toLocaleString("pt-BR")}`, name === "receitas" ? "Receitas" : "Gastos"]} labelStyle={{ color: "hsl(40 20% 85%)", fontWeight: 600 }} itemStyle={{ color: "hsl(40 20% 75%)" }} />
                    <Bar dataKey="receitas" fill="url(#barIncome)" radius={[6, 6, 0, 0]} name="receitas" />
                    <Bar dataKey="gastos" fill="url(#barExpense)" radius={[6, 6, 0, 0]} name="gastos" />
                    <Legend formatter={(value) => value === "receitas" ? "Receitas" : "Gastos"} wrapperStyle={{ fontSize: 11, color: "hsl(240 5% 50%)" }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados para exibir.</p>
              )}
            </CardContent>
          </Card>

          {/* Pie Chart - Fixed overflow */}
          <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />Gastos por Categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden">
              {pieData.length > 0 ? (
                <div className="w-full overflow-hidden">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <defs>
                        {pieData.map((_, idx) => (
                          <linearGradient key={idx} id={`pieGrad${idx}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]} stopOpacity={1} />
                            <stop offset="100%" stopColor={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]} stopOpacity={0.6} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} strokeWidth={0} label={renderCustomPieLabel} labelLine={{ stroke: "hsl(240 5% 30%)", strokeWidth: 1 }}>
                        {pieData.map((_, idx) => (
                          <Cell key={idx} fill={`url(#pieGrad${idx})`} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CustomTooltipStyle} formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} itemStyle={{ color: "hsl(40 20% 75%)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados para exibir.</p>
              )}
            </CardContent>
          </Card>

          {/* Top Categories */}
          <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />Top 3 Categorias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topCategories.length > 0 ? (
                topCategories.map((cat, i) => {
                  const pct = expenses > 0 ? ((cat.value / expenses) * 100).toFixed(1) : "0";
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                          <span className="text-sm text-foreground font-medium">{cat.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground">R$ {cat.value.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-secondary/50 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${EXPENSE_COLORS[i % EXPENSE_COLORS.length]}, ${EXPENSE_COLORS[i % EXPENSE_COLORS.length]}90)` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">{pct}% do total de gastos</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Sem dados para exibir.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transações Recentes */}
        <Card className="overflow-hidden border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Transações Recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.slice(0, 15).map((tx, i) => (
                <div key={tx.id} className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 hover:bg-secondary/30 transition-colors animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: tx.type === "receita" ? `${INCOME_COLOR}20` : `${EXPENSE_COLOR}20` }}>
                      {tx.type === "receita" ? <ArrowUpRight className="w-4 h-4" style={{ color: INCOME_COLOR }} /> : <ArrowDownRight className="w-4 h-4" style={{ color: EXPENSE_COLOR }} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.category || "Sem categoria"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-medium" style={{ color: tx.type === "receita" ? INCOME_COLOR : EXPENSE_COLOR }}>
                        {tx.type === "receita" ? "+" : "-"}R$ {Math.abs(Number(tx.amount)).toLocaleString("pt-BR")}
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.transaction_date).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteTransaction(tx.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="transações/mês"
        currentPlan={plan}
        limit={limits.transactionsPerMonth}
        requiredPlan={plan === "FREE" ? "STARTER" : "PRO"}
      />
    </AppLayout>
  );
}
