// src/pages/GoalsPage.tsx
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Target, Plus, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const GOAL_CATEGORIES = [
  { value: "viagem", label: "✈️ Viagem" },
  { value: "emergência", label: "🛡️ Reserva de Emergência" },
  { value: "casa", label: "🏠 Casa" },
  { value: "carro", label: "🚗 Carro" },
  { value: "educação", label: "📚 Educação" },
  { value: "outros", label: "🎯 Outros" },
];

type Goal = {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  category: string;
  status: string;
  created_at: string;
};

export default function GoalsPage() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [open, setOpen] = useState(false);
  const [addValueOpen, setAddValueOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [category, setCategory] = useState("outros");
  const [addValue, setAddValue] = useState("");

  const fetchGoals = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    setGoals((data as Goal[]) || []);
  };

  useEffect(() => {
    fetchGoals();
    const ch = supabase.channel("goals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, fetchGoals)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const addGoal = async () => {
    if (!title.trim() || !targetAmount || !user) return;
    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      title: title.trim(),
      target_amount: Number(targetAmount),
      current_amount: Number(currentAmount) || 0,
      deadline: deadline || null,
      category,
      status: "active",
    });
    if (error) { toast.error("Erro ao criar meta"); return; }
    toast.success("Meta criada!");
    setTitle(""); setTargetAmount(""); setCurrentAmount(""); setDeadline(""); setCategory("outros");
    setOpen(false);
    fetchGoals();
  };

  const addProgress = async (goalId: string, goal: Goal) => {
    const val = Number(addValue);
    if (!val || val <= 0) return;
    const newAmount = Math.min(goal.current_amount + val, goal.target_amount);
    const newStatus = newAmount >= goal.target_amount ? "completed" : "active";
    const { error } = await supabase
      .from("goals")
      .update({ current_amount: newAmount, status: newStatus })
      .eq("id", goalId);
    if (error) { toast.error("Erro ao atualizar meta"); return; }
    toast.success(newStatus === "completed" ? "🎉 Meta concluída!" : "Progresso atualizado!");
    setAddValue(""); setAddValueOpen(null);
    fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    toast.success("Meta removida");
    fetchGoals();
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (d: string | null) =>
    d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);
  const totalSaved = goals.reduce((s, g) => s + g.current_amount, 0);

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Target className="w-6 h-6 md:w-8 md:h-8 text-primary" />Metas Financeiras
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Acompanhe suas metas criadas aqui ou pelo WhatsApp.
            </p>
          </div>
          <Button size="sm" className="gap-2 self-start" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" />Nova Meta
          </Button>
        </div>

        {/* Resumo */}
        {goals.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Metas ativas</p>
                <p className="text-2xl font-bold text-primary">{goals.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Total guardado</p>
                <p className="text-lg font-bold text-green-400">{formatCurrency(totalSaved)}</p>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Progresso geral</p>
                <p className="text-lg font-bold">{totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(0) : 0}%</p>
                <Progress value={totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0} className="mt-1 h-1.5" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de metas */}
        {goals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Nenhuma meta criada ainda.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie uma meta aqui ou pelo WhatsApp: <span className="text-primary">"Quero juntar R$ 5.000 para viagem em dezembro"</span>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {goals.map(goal => {
              const pct = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
              const remaining = goal.target_amount - goal.current_amount;
              const catLabel = GOAL_CATEGORIES.find(c => c.value === goal.category)?.label || "🎯 Outros";
              return (
                <Card key={goal.id} className="relative">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{goal.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{catLabel}{goal.deadline ? ` · até ${formatDate(goal.deadline)}` : ""}</p>
                      </div>
                      <button onClick={() => deleteGoal(goal.id)} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-green-400 font-medium">{formatCurrency(goal.current_amount)}</span>
                        <span className="text-muted-foreground">{formatCurrency(goal.target_amount)}</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-primary font-medium">{pct.toFixed(0)}%</span>
                        <span className="text-xs text-muted-foreground">faltam {formatCurrency(remaining)}</span>
                      </div>
                    </div>

                    {addValueOpen === goal.id ? (
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Valor a adicionar"
                          value={addValue}
                          onChange={e => setAddValue(e.target.value)}
                          className="h-8 text-sm"
                          autoFocus
                        />
                        <Button size="sm" className="h-8" onClick={() => addProgress(goal.id, goal)}>OK</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAddValueOpen(null); setAddValue(""); }}>✕</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full gap-2 h-8" onClick={() => setAddValueOpen(goal.id)}>
                        <TrendingUp className="w-3.5 h-3.5" />Registrar progresso
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Dialog nova meta */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Meta Financeira</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título (ex: Viagem para Europa)" value={title} onChange={e => setTitle(e.target.value)} />
              <Input type="number" placeholder="Valor alvo (R$)" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} />
              <Input type="number" placeholder="Já guardei (R$) — opcional" value={currentAmount} onChange={e => setCurrentAmount(e.target.value)} />
              <Input type="date" placeholder="Prazo" value={deadline} onChange={e => setDeadline(e.target.value)} />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={addGoal}>Criar Meta</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
