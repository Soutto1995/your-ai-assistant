import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useSpendingComparison } from "@/hooks/useSpendingComparison";
import UpgradeModal from "@/components/UpgradeModal";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Plus, Trash2, Sparkles, Crown, Lock, FolderOpen, ChevronDown, Check, Users, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Legend, Area, AreaChart, ComposedChart, Line,
} from "recharts";

type PeriodFilter = "today" | "week" | "month" | "year";

const EXPENSE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#8b5cf6",
  "#06b6d4", "#ec4899", "#14b8a6", "#f43f5e",
];

const INCOME_COLOR = "#22c55e";
const EXPENSE_COLOR = "#ef4444";

// O período precisa de início E fim. Sem o fim, "Mês" incluía tudo do dia 1º
// em diante — inclusive parcelas futuras lançadas para os próximos meses, que
// entravam no total de gastos do mês atual e inflavam o número.
function getPeriodRange(period: PeriodFilter): { start: Date; end: Date } {
  const now = new Date();
  switch (period) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      return { start, end };
    }
    case "week": {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    case "month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      };
    case "year":
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: new Date(now.getFullYear() + 1, 0, 1),
      };
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
  const [folders, setFolders] = useState<Array<{ id: string; name: string; emoji: string }>>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderEmoji, setNewFolderEmoji] = useState("");
  const [newFolderName, setNewFolderName] = useState("");

  const fetchFolders = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("folders")
      .select("id, name, emoji")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    setFolders(data || []);
  };

  const createFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    const { data, error } = await supabase.from("folders").insert({
      user_id: user.id,
      name: newFolderName.trim(),
      emoji: newFolderEmoji.trim() || "📁",
    }).select("id, name, emoji").single();
    if (error) {
      toast.error("Erro ao criar pasta");
      return;
    }
    toast.success("Pasta criada!");
    setNewFolderEmoji("");
    setNewFolderName("");
    setNewFolderOpen(false);
    await fetchFolders();
    if (data) setSelectedFolder(data.id);
  };

  const comparison = useSpendingComparison(transactions);

  // Fluxo de caixa: realizado (já lançado) + projetado (parcelas futuras e contas fixas)
  const [cashFlow, setCashFlow] = useState<Array<{
    month: string;
    realized_income: number;
    realized_expense: number;
    projected_income: number;
    projected_expense: number;
  }>>([]);

  const fetchCashFlow = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc("cash_flow", {
      p_user_id: user.id,
      p_months_back: 2,
      p_months_ahead: 6,
    });
    if (error) {
      console.error(error);
      return;
    }
    setCashFlow((data as any[]) || []);
  };

  // Contas fixas (recurring_transactions) — alimentam a coluna "Previsto" do fluxo de caixa
  type RecurringTx = {
    id: string;
    description: string;
    amount: number;
    type: string;
    category: string | null;
    frequency: string;
    day_of_month: number | null;
    day_of_week: number | null;
    month_of_year: number | null;
    active: boolean;
  };

  const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const MONTH_LABELS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const [recurring, setRecurring] = useState<RecurringTx[]>([]);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [recurringDescription, setRecurringDescription] = useState("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringType, setRecurringType] = useState("gasto");
  const [recurringCategory, setRecurringCategory] = useState("");
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [recurringDayOfMonth, setRecurringDayOfMonth] = useState("1");
  const [recurringDayOfWeek, setRecurringDayOfWeek] = useState("1");
  const [recurringMonthOfYear, setRecurringMonthOfYear] = useState("1");

  const fetchRecurring = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setRecurring((data as RecurringTx[]) || []);
  };

  const resetRecurringForm = () => {
    setEditingRecurringId(null);
    setRecurringDescription("");
    setRecurringAmount("");
    setRecurringType("gasto");
    setRecurringCategory("");
    setRecurringFrequency("monthly");
    setRecurringDayOfMonth("1");
    setRecurringDayOfWeek("1");
    setRecurringMonthOfYear("1");
  };

  const openNewRecurring = () => {
    resetRecurringForm();
    setRecurringOpen(true);
  };

  const openEditRecurring = (r: RecurringTx) => {
    setEditingRecurringId(r.id);
    setRecurringDescription(r.description);
    setRecurringAmount(String(r.amount));
    setRecurringType(r.type);
    setRecurringCategory(r.category || "");
    setRecurringFrequency(r.frequency);
    setRecurringDayOfMonth(String(r.day_of_month ?? 1));
    setRecurringDayOfWeek(String(r.day_of_week ?? 1));
    setRecurringMonthOfYear(String(r.month_of_year ?? 1));
    setRecurringOpen(true);
  };

  const saveRecurring = async () => {
    if (!recurringDescription.trim() || !recurringAmount || !user) return;

    const payload = {
      user_id: user.id,
      description: recurringDescription.trim(),
      amount: Number(recurringAmount),
      type: recurringType,
      category: recurringCategory.trim() || null,
      frequency: recurringFrequency,
      day_of_month: recurringFrequency === "weekly" ? null : Number(recurringDayOfMonth),
      day_of_week: recurringFrequency === "weekly" ? Number(recurringDayOfWeek) : null,
      month_of_year: recurringFrequency === "yearly" ? Number(recurringMonthOfYear) : null,
    };

    const { error } = editingRecurringId
      ? await supabase.from("recurring_transactions").update(payload).eq("id", editingRecurringId).eq("user_id", user.id)
      : await supabase.from("recurring_transactions").insert(payload);

    if (error) {
      toast.error("Erro ao salvar conta fixa");
      return;
    }
    toast.success(editingRecurringId ? "Conta fixa atualizada!" : "Conta fixa criada!");
    setRecurringOpen(false);
    resetRecurringForm();
  };

  const toggleRecurringActive = async (r: RecurringTx) => {
    if (!user) return;
    const { error } = await supabase
      .from("recurring_transactions")
      .update({ active: !r.active })
      .eq("id", r.id)
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao atualizar conta fixa");
      return;
    }
    toast.success(r.active ? "Conta fixa pausada." : "Conta fixa reativada!");
  };

  const deleteRecurring = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("recurring_transactions").delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao remover conta fixa");
      return;
    }
    toast.success("Conta fixa removida.");
  };

  const describeRecurring = (r: RecurringTx): string => {
    if (r.frequency === "weekly") return `toda ${WEEKDAY_LABELS[r.day_of_week ?? 0]}`;
    if (r.frequency === "yearly") return `todo dia ${r.day_of_month} de ${MONTH_LABELS[(r.month_of_year ?? 1) - 1]}`;
    return `todo dia ${r.day_of_month}`;
  };

  const fetchTransactions = async () => {
    if (!user) return;
    // O .eq('user_id') é redundante com a RLS de propósito — defesa em profundidade.
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false });
    setTransactions(data || []);
  };

  useEffect(() => {
    fetchTransactions();
    fetchFolders();
    fetchCashFlow();
    fetchRecurring();
    const channel = supabase.channel("tx-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        fetchTransactions();
        fetchCashFlow();
      })
      .subscribe();
    const recurringChannel = supabase.channel("recurring-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_transactions" }, () => {
        fetchRecurring();
        fetchCashFlow();
      })
      .subscribe();
    const folderChannel = supabase.channel("folders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "folders" }, fetchFolders)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(folderChannel);
      supabase.removeChannel(recurringChannel);
    };
  }, [user]);

  // Filter by history limit
  const historyFiltered = useMemo(() => {
    if (limits.historyMonths === Infinity) return transactions;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - limits.historyMonths);
    return transactions.filter(t => new Date(t.transaction_date) >= cutoff);
  }, [transactions, limits.historyMonths]);

  const filtered = useMemo(() => {
    const { start, end } = getPeriodRange(period);
    return historyFiltered.filter(t => {
      const d = new Date(t.transaction_date);
      const inPeriod = d >= start && d < end;
      const inFolder = selectedFolder === "all" || t.folder_id === selectedFolder;
      return inPeriod && inFolder;
    });
  }, [historyFiltered, period, selectedFolder]);

  // Quantos lançamentos existem na pasta selecionada IGNORANDO o período.
  // Sem isso, a pasta parece vazia quando o gasto está fora do período atual
  // (ex: registrado dia 31/jul e o filtro está em "Mês" de agosto) — o usuário
  // conclui que o lançamento sumiu.
  const folderTotalIgnoringPeriod = useMemo(() => {
    if (selectedFolder === "all") return 0;
    return historyFiltered.filter(t => t.folder_id === selectedFolder).length;
  }, [historyFiltered, selectedFolder]);

  const hiddenByPeriod = selectedFolder !== "all" && filtered.length === 0 && folderTotalIgnoringPeriod > 0;

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

  // Quem gastou o quê — só aparece quando há mais de uma pessoa lançando na conta.
  const spendingByPerson = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    filtered.filter(t => t.type === "gasto").forEach(t => {
      const person = (t.paid_by_name || "").trim() || "Titular";
      if (!map[person]) map[person] = { total: 0, count: 0 };
      map[person].total += Math.abs(Number(t.amount));
      map[person].count += 1;
    });
    return Object.entries(map)
      .map(([person, v]) => ({ person, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const hasSharedSpending = spendingByPerson.length > 1;

  // Entradas e saídas como grandezas próprias (barras) e o saldo como
  // resultado derivado (linha). A versão anterior plotava só o saldo, que fica
  // negativo e desenha a barra para baixo — daí a sensação de "de cabeça para
  // baixo" e a dificuldade de ler o fluxo real.
  const cashFlowData = useMemo(() => {
    const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const now = new Date();
    const currentKey = now.getFullYear() * 12 + now.getMonth();

    return cashFlow.map((r) => {
      const [year, month] = String(r.month).split("-").map(Number);
      const entradas = Number(r.realized_income) + Number(r.projected_income);
      const saidas = Number(r.realized_expense) + Number(r.projected_expense);
      const isFuture = (year * 12 + (month - 1)) > currentKey;
      return {
        name: `${MONTHS_SHORT[(month || 1) - 1]}/${String(year).slice(2)}`,
        Entradas: Math.round(entradas * 100) / 100,
        Saídas: Math.round(saidas * 100) / 100,
        Saldo: Math.round((entradas - saidas) * 100) / 100,
        isFuture,
      };
    });
  }, [cashFlow]);

  const hasCashFlow = cashFlowData.some((d) => d.Entradas !== 0 || d.Saídas !== 0);
  const hasProjection = cashFlowData.some((d) => d.isFuture && (d.Entradas !== 0 || d.Saídas !== 0));

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

        {/* Period filter + pasta */}
        <div className="flex gap-2 flex-wrap items-center">
          {(Object.keys(periodLabels) as PeriodFilter[]).map(p => (
            <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
              {periodLabels[p]}
            </Button>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={selectedFolder === "all" ? "outline" : "default"}
                size="sm"
                className="gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                {selectedFolder === "all"
                  ? "Pastas"
                  : (() => { const f = folders.find(f => f.id === selectedFolder); return f ? `${f.emoji} ${f.name}` : "Pastas"; })()
                }
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[180px]">
              <DropdownMenuItem onClick={() => setSelectedFolder("all")} className="gap-2">
                {selectedFolder === "all" && <Check className="w-3.5 h-3.5 text-primary" />}
                <span className={selectedFolder === "all" ? "ml-0" : "ml-5"}>📁 Todas as pastas</span>
              </DropdownMenuItem>
              {folders.length > 0 && <DropdownMenuSeparator />}
              {folders.map(f => (
                <DropdownMenuItem key={f.id} onClick={() => setSelectedFolder(f.id)} className="gap-2">
                  {selectedFolder === f.id && <Check className="w-3.5 h-3.5 text-primary" />}
                  <span className={selectedFolder === f.id ? "ml-0" : "ml-5"}>{f.emoji} {f.name}</span>
                </DropdownMenuItem>
              ))}
              {folders.length === 0 && (
                <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                  Nenhuma pasta criada ainda
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setNewFolderOpen(true)} className="gap-2 text-primary focus:text-primary focus:bg-primary/10">
                <Plus className="w-3.5 h-3.5" />
                <span>Nova pasta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Nova pasta dialog */}
        <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar nova pasta</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-[64px_1fr] gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Emoji</label>
                  <Input
                    value={newFolderEmoji}
                    onChange={e => setNewFolderEmoji(e.target.value.slice(0, 2))}
                    placeholder="📁"
                    maxLength={2}
                    className="text-center text-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Nome da pasta</label>
                  <Input
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="Ex: Casa, Trabalho, Viagem"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancelar</Button>
                <Button onClick={createFolder} disabled={!newFolderName.trim()}>Criar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pasta ativa */}
        {selectedFolder !== "all" && (() => { const f = folders.find(f => f.id === selectedFolder); return f ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FolderOpen className="w-3.5 h-3.5 text-primary" />
            <span>Filtrando por: <span className="text-primary font-medium">{f.emoji} {f.name}</span></span>
            <button onClick={() => setSelectedFolder("all")} className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">limpar</button>
          </div>
        ) : null; })()}

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Receita" value={`R$ ${income.toLocaleString("pt-BR")}`} positive />
          <StatCard icon={<TrendingDown className="w-5 h-5" />} label="Gastos" value={`R$ ${expenses.toLocaleString("pt-BR")}`} />
          <StatCard icon={<DollarSign className="w-5 h-5" />} label="Saldo" value={`R$ ${balance.toLocaleString("pt-BR")}`} positive={balance >= 0} />
        </div>

        {/* Fluxo de caixa: realizado vs projetado */}
        {hasCashFlow && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                Fluxo de caixa
                <span className="text-xs text-muted-foreground font-normal">
                  realizado vs. previsto
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cashFlowData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
                    {/* Textura nos meses previstos: codificação secundária, para que
                        entrada/saída não dependam só da cor (par verde/vermelho é
                        o mais hostil a daltonismo). */}
                    <defs>
                      <pattern id="futuroEntrada" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                        <rect width="6" height="6" fill={INCOME_COLOR} fillOpacity={0.25} />
                        <line x1="0" y1="0" x2="0" y2="6" stroke={INCOME_COLOR} strokeWidth="3" />
                      </pattern>
                      <pattern id="futuroSaida" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(135)">
                        <rect width="6" height="6" fill={EXPENSE_COLOR} fillOpacity={0.25} />
                        <line x1="0" y1="0" x2="0" y2="6" stroke={EXPENSE_COLOR} strokeWidth="3" />
                      </pattern>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 5% 18%)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(40 15% 60%)" }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "hsl(40 15% 60%)" }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      tickFormatter={(v) => {
                        const n = Math.abs(Number(v));
                        return `${Number(v) < 0 ? "-" : ""}${n >= 1000 ? `${(n / 1000).toFixed(0)}k` : n}`;
                      }}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(240 8% 20%)", fillOpacity: 0.35 }}
                      contentStyle={CustomTooltipStyle}
                      labelStyle={{ color: "hsl(40 20% 85%)", fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ color: "hsl(40 20% 75%)" }}
                      formatter={(v: any, name: any) => [
                        `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
                        name,
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="circle" iconSize={8} />

                    <Bar dataKey="Entradas" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {cashFlowData.map((d, i) => (
                        <Cell key={i} fill={d.isFuture ? "url(#futuroEntrada)" : INCOME_COLOR} />
                      ))}
                    </Bar>
                    <Bar dataKey="Saídas" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {cashFlowData.map((d, i) => (
                        <Cell key={i} fill={d.isFuture ? "url(#futuroSaida)" : EXPENSE_COLOR} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="Saldo"
                      stroke="hsl(40 20% 88%)"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "hsl(40 20% 88%)", strokeWidth: 0 }}
                      activeDot={{ r: 5, stroke: "hsl(240 12% 8%)", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {hasProjection && <>Barras <span className="text-foreground">listradas</span> são previsão (parcelas futuras e contas fixas). </>}
                A linha clara é o saldo do mês. Cadastre contas fixas abaixo ou pelo
                WhatsApp: <span className="text-foreground">"todo dia 10 pago 1200 de aluguel"</span>.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Contas fixas */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              Contas fixas
            </CardTitle>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openNewRecurring}>
              <Plus className="w-3.5 h-3.5" />
              Nova
            </Button>
          </CardHeader>
          <CardContent>
            {recurring.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma conta fixa cadastrada. Aluguel, salário, mensalidades — cadastre aqui
                ou pelo WhatsApp para entrarem na sua projeção de fluxo de caixa.
              </p>
            ) : (
              <div className="space-y-2">
                {recurring.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-lg border border-border ${!r.active ? "opacity-50" : ""}`}
                  >
                    <button className="min-w-0 flex-1 text-left" onClick={() => openEditRecurring(r)}>
                      <p className="text-sm font-medium truncate">{r.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {describeRecurring(r)}{r.category ? ` · ${r.category}` : ""}{!r.active ? " · pausada" : ""}
                      </p>
                    </button>
                    <span className={`text-sm font-medium shrink-0 ${r.type === "receita" ? "text-success" : "text-destructive"}`}>
                      {r.type === "receita" ? "+" : "-"}R$ {Number(r.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toggleRecurringActive(r)} title={r.active ? "Pausar" : "Reativar"}>
                        {r.active ? <Lock className="w-4 h-4" /> : <Check className="w-4 h-4 text-success" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => deleteRecurring(r.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={recurringOpen} onOpenChange={(o) => { setRecurringOpen(o); if (!o) resetRecurringForm(); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingRecurringId ? "Editar conta fixa" : "Nova conta fixa"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Descrição (ex: Aluguel, Salário)" value={recurringDescription} onChange={e => setRecurringDescription(e.target.value)} />
              <Input type="number" placeholder="Valor" value={recurringAmount} onChange={e => setRecurringAmount(e.target.value)} />
              <Input placeholder="Categoria (opcional)" value={recurringCategory} onChange={e => setRecurringCategory(e.target.value)} />

              <Select value={recurringType} onValueChange={setRecurringType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gasto">Gasto</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>

              <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Todo mês</SelectItem>
                  <SelectItem value="weekly">Toda semana</SelectItem>
                  <SelectItem value="yearly">Todo ano</SelectItem>
                </SelectContent>
              </Select>

              {recurringFrequency === "weekly" && (
                <Select value={recurringDayOfWeek} onValueChange={setRecurringDayOfWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_LABELS.map((label, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {recurringFrequency === "yearly" && (
                <Select value={recurringMonthOfYear} onValueChange={setRecurringMonthOfYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_LABELS.map((label, idx) => (
                      <SelectItem key={idx} value={String(idx + 1)}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {recurringFrequency !== "weekly" && (
                <Input
                  type="number"
                  min={1}
                  max={31}
                  placeholder="Dia do mês (1-31)"
                  value={recurringDayOfMonth}
                  onChange={e => setRecurringDayOfMonth(e.target.value)}
                />
              )}

              <Button className="w-full" onClick={saveRecurring}>
                {editingRecurringId ? "Salvar alterações" : "Criar conta fixa"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Quem gastou — conta compartilhada */}
        {hasSharedSpending && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-info" />
                Gastos por pessoa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {spendingByPerson.map((p) => {
                const pct = expenses > 0 ? (p.total / expenses) * 100 : 0;
                return (
                  <div key={p.person}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{p.person}</span>
                      <span className="text-muted-foreground">
                        R$ {p.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        <span className="ml-2 text-xs">({pct.toFixed(0)}% · {p.count})</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-info rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

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
                      {(() => {
                        const f = tx.folder_id ? folders.find(f => f.id === tx.folder_id) : null;
                        return f ? (
                          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium">
                            <span>{f.emoji}</span>{f.name}
                          </span>
                        ) : null;
                      })()}
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
                hiddenByPeriod ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-muted-foreground">
                      Nenhum lançamento nesta pasta no período <strong>{periodLabels[period]}</strong>.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Mas ela tem {folderTotalIgnoringPeriod} lançamento{folderTotalIgnoringPeriod > 1 ? "s" : ""} em outros períodos.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setPeriod("year")}>
                      Ver o ano todo
                    </Button>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada.</p>
                )
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
