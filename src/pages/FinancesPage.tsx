import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type PeriodFilter = "today" | "week" | "month" | "year";

const COLORS = [
  "hsl(43, 56%, 52%)", "hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)",
  "hsl(0, 72%, 51%)", "hsl(38, 92%, 50%)", "hsl(280, 60%, 55%)",
  "hsl(180, 60%, 45%)", "hsl(330, 60%, 55%)",
];

function getPeriodStart(period: PeriodFilter): Date {
  const now = new Date();
  switch (period) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; }
    case "month": return new Date(now.getFullYear(), now.getMonth(), 1);
    case "year": return new Date(now.getFullYear(), 0, 1);
  }
}

export default function FinancesPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("gasto");
  const [period, setPeriod] = useState<PeriodFilter>("month");

  const fetchTransactions = async () => {
    const { data } = await supabase.from("transactions").select("*").order("transaction_date", { ascending: false });
    setTransactions(data || []);
  };

  useEffect(() => {
    fetchTransactions();
    const channel = supabase.channel("tx-realtime").on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, fetchTransactions).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = useMemo(() => {
    const start = getPeriodStart(period);
    return transactions.filter(t => new Date(t.transaction_date) >= start);
  }, [transactions, period]);

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

  const addTransaction = async () => {
    if (!description.trim() || !amount || !user) return;
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <DollarSign className="w-6 h-6 md:w-8 md:h-8 text-primary" />Finanças
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Controle financeiro.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-2 self-start"><Plus className="w-4 h-4" />Nova Transação</Button></DialogTrigger>
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
        </div>

        {/* Period filter */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(periodLabels) as PeriodFilter[]).map(p => (
            <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
              {periodLabels[p]}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Receita" value={`R$ ${income.toLocaleString("pt-BR")}`} positive />
          <StatCard icon={<TrendingDown className="w-5 h-5" />} label="Gastos" value={`R$ ${expenses.toLocaleString("pt-BR")}`} />
          <StatCard icon={<DollarSign className="w-5 h-5" />} label="Saldo" value={`R$ ${balance.toLocaleString("pt-BR")}`} positive={balance >= 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Transactions table */}
          <div className="lg:col-span-2 bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 md:px-5 py-3 md:py-4 border-b border-border">
              <h2 className="font-display font-semibold text-foreground text-sm md:text-base">Transações Recentes</h2>
            </div>
            <div className="divide-y divide-border overflow-x-auto">
              {filtered.map((tx, i) => (
                <div key={tx.id} className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 hover:bg-secondary/30 transition-colors animate-slide-up min-w-[300px]" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tx.type === "receita" ? "bg-success/20" : "bg-destructive/20"}`}>
                      {tx.type === "receita" ? <ArrowUpRight className="w-4 h-4 text-success" /> : <ArrowDownRight className="w-4 h-4 text-destructive" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.category || "Sem categoria"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className={`text-sm font-medium ${tx.type === "receita" ? "text-success" : "text-destructive"}`}>
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
          </div>

          {/* Pie chart */}
          <div className="bg-card rounded-xl border border-border p-4 md:p-5">
            <h2 className="font-display font-semibold text-foreground mb-4 text-sm md:text-base">Gastos por Categoria</h2>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Sem dados para exibir.</p>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
