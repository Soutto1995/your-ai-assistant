import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import UpgradeModal from "@/components/UpgradeModal";
import { Target, Plus, Trash2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const BUDGET_CATEGORIES = [
  "Alimentação", "Mercado", "Transporte", "Moradia", "Saúde",
  "Lazer", "Pessoal", "Educação", "Outros", "Geral",
];

export default function BudgetPage() {
  const { user } = useAuth();
  const { plan, limits } = usePlanLimits();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [category, setCategory] = useState(BUDGET_CATEGORIES[0]);
  const [limit, setLimit] = useState("");

  const fetchBudgets = async () => {
    const { data } = await supabase.from("budgets" as any).select("*").order("created_at", { ascending: false });
    setBudgets((data as any[]) || []);
  };

  const fetchTransactions = async () => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data } = await supabase
      .from("transactions")
      .select("amount, category, type")
      .eq("type", "gasto")
      .gte("transaction_date", monthStart);
    setTransactions(data || []);
  };

  useEffect(() => {
    fetchBudgets();
    fetchTransactions();
    const ch1 = supabase.channel("budgets-rt").on("postgres_changes", { event: "*", schema: "public", table: "budgets" }, fetchBudgets).subscribe();
    const ch2 = supabase.channel("tx-budget-rt").on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, fetchTransactions).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [user]);

  const getCategorySpent = (cat: string) => {
    return transactions
      .filter(t => t.category === cat)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
  };

  const canAddBudget = limits.budgets === Infinity || budgets.length < limits.budgets;

  const handleAddClick = () => {
    if (!canAddBudget) {
      setUpgradeOpen(true);
      return;
    }
    setOpen(true);
  };

  const addBudget = async () => {
    if (!limit || !user) return;
    if (!canAddBudget) { setUpgradeOpen(true); return; }
    const { error } = await supabase.from("budgets" as any).insert({
      category,
      limit: Number(limit),
      user_id: user.id,
    });
    if (error) {
      if (error.code === "23505") {
        toast.error("Orçamento para essa categoria já existe!");
      } else {
        toast.error("Erro ao criar orçamento");
      }
      return;
    }
    toast.success("Orçamento criado!");
    setLimit(""); setOpen(false);
  };

  const deleteBudget = async (id: string) => {
    await supabase.from("budgets" as any).delete().eq("id", id);
    toast.success("Orçamento removido!");
  };

  const totalBudget = budgets.reduce((s, b) => s + Number(b.limit), 0);
  const totalSpent = budgets.reduce((s, b) => s + getCategorySpent(b.category), 0);
  const overallProgress = totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;

  // Show blocked state for FREE plan
  if (limits.budgets === 0) {
    return (
      <AppLayout>
        <div className="space-y-4 md:space-y-6">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Target className="w-6 h-6 md:w-8 md:h-8 text-primary" />Orçamento Mensal
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Defina limites de gastos por categoria.</p>
          </div>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Funcionalidade exclusiva</h2>
              <p className="text-muted-foreground max-w-md">
                O controle de orçamento está disponível a partir do plano <span className="font-semibold text-primary">Starter</span>.
                Defina limites por categoria e receba alertas automáticos!
              </p>
              <Button onClick={() => setUpgradeOpen(true)} className="gap-2">
                <Lock className="w-4 h-4" /> Fazer Upgrade
              </Button>
            </CardContent>
          </Card>
          <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="orçamentos" currentPlan={plan} limit={0} requiredPlan="STARTER" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Target className="w-6 h-6 md:w-8 md:h-8 text-primary" />Orçamento Mensal
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Defina limites de gastos por categoria.
              {limits.budgets !== Infinity && (
                <span className="ml-2 text-xs text-primary">({budgets.length}/{limits.budgets} orçamentos)</span>
              )}
            </p>
          </div>
          <Button size="sm" className="gap-2 self-start" onClick={handleAddClick} disabled={!canAddBudget && limits.budgets !== Infinity}>
            {canAddBudget ? <Plus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            Novo Orçamento
          </Button>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Orçamento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {BUDGET_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <Input type="number" placeholder="Limite mensal (R$)" value={limit} onChange={e => setLimit(e.target.value)} />
              <Button onClick={addBudget} className="w-full">Criar Orçamento</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm md:text-base">Visão Geral do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Total gasto</span>
              <span className="font-medium text-foreground">
                R$ {totalSpent.toLocaleString("pt-BR")} / R$ {totalBudget.toLocaleString("pt-BR")}
              </span>
            </div>
            <Progress value={overallProgress} className={overallProgress >= 100 ? "[&>div]:bg-destructive" : ""} />
            <p className="text-xs text-muted-foreground mt-1">{overallProgress.toFixed(0)}% utilizado</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget, i) => {
            const spent = getCategorySpent(budget.category);
            const progress = Math.min((spent / Number(budget.limit)) * 100, 100);
            const isOver = spent > Number(budget.limit);
            const isWarning = progress >= 80 && !isOver;

            return (
              <Card
                key={budget.id}
                className={`animate-slide-up ${isOver ? "border-destructive/50" : isWarning ? "border-yellow-500/50" : ""}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">{budget.category}</CardTitle>
                    <div className="flex items-center gap-1">
                      {isOver && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">Estourado!</span>}
                      {isWarning && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 font-medium">Atenção</span>}
                      <Button variant="ghost" size="sm" onClick={() => deleteBudget(budget.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">R$ {spent.toLocaleString("pt-BR")}</span>
                    <span className="font-medium text-foreground">R$ {Number(budget.limit).toLocaleString("pt-BR")}</span>
                  </div>
                  <Progress value={progress} className={isOver ? "[&>div]:bg-destructive" : isWarning ? "[&>div]:bg-yellow-500" : ""} />
                  <p className="text-xs text-muted-foreground mt-1">{progress.toFixed(0)}% utilizado</p>
                </CardContent>
              </Card>
            );
          })}
          {budgets.length === 0 && (
            <p className="text-center py-8 text-muted-foreground col-span-full">
              Nenhum orçamento definido. Crie um para começar a controlar seus gastos!
            </p>
          )}
        </div>
      </div>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="orçamentos" currentPlan={plan} limit={limits.budgets} requiredPlan="PRO" />
    </AppLayout>
  );
}
