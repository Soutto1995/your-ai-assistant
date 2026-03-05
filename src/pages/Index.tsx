import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckSquare, DollarSign, TrendingUp, MessageCircle,
  Clock, AlertTriangle, Link as LinkIcon, ArrowRight, Crown, LogOut,
} from "lucide-react";

const priorityColor: Record<string, string> = {
  alta: "text-destructive",
  média: "text-warning",
  baixa: "text-success",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Dashboard() {
  const { profile, signOut, user } = useAuth();
  const userName = profile?.full_name || "Usuário";
  const planName = profile?.plan || "FREE";
  const whatsappConnected = false;

  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);

  const messagesLimit = 30;
  const usagePct = clamp(Math.round((messagesCount / messagesLimit) * 100), 0, 100);
  const showUpgradeHint = planName === "FREE" && usagePct >= 80;

  const fetchData = async () => {
    if (!user) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [tasksRes, txRes, inboxRes, recentInboxRes, pendingTasksRes] = await Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("transactions").select("amount, type").gte("transaction_date", startOfMonth.toISOString()),
      supabase.from("inbox_messages").select("id", { count: "exact", head: true }).eq("status", "processado"),
      supabase.from("inbox_messages").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("tasks").select("*").eq("status", "pendente").order("created_at", { ascending: false }).limit(5),
    ]);

    setPendingTasksCount(tasksRes.count || 0);
    setMessagesCount(inboxRes.count || 0);

    const income = (txRes.data || []).filter(t => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
    const expenses = (txRes.data || []).filter(t => t.type === "gasto").reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    setMonthIncome(income);
    setMonthExpenses(expenses);

    setRecentActivity(recentInboxRes.data || []);
    setPendingTasks(pendingTasksRes.data || []);
  };

  useEffect(() => {
    fetchData();

    const channels = ["tasks", "transactions", "inbox_messages"].map(table =>
      supabase.channel(`dashboard-${table}`).on("postgres_changes", { event: "*", schema: "public", table }, fetchData).subscribe()
    );

    return () => { channels.forEach(c => supabase.removeChannel(c)); };
  }, [user]);

  const typeEmoji: Record<string, string> = {
    tarefa: "✅", finanças: "💰", consulta: "📊", reunião: "📅",
  };

  return (
    <AppLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground">
              Bom dia, <span className="gold-text">{userName}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {whatsappConnected
                ? "Aqui está o resumo do seu dia."
                : "Conecte seu WhatsApp para o Você Aí organizar tudo automaticamente."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!whatsappConnected ? (
              <Button size="sm" className="gap-2"><LinkIcon className="w-4 h-4" />Conectar WhatsApp</Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-2">Comando teste <ArrowRight className="w-4 h-4" /></Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={signOut}><LogOut className="w-4 h-4" />Sair</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard icon={<CheckSquare className="w-5 h-5" />} label="Tarefas Pendentes" value={String(pendingTasksCount)} />
          <StatCard icon={<DollarSign className="w-5 h-5" />} label="Gastos do Mês" value={`R$ ${monthExpenses.toLocaleString("pt-BR")}`} />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Receita do Mês" value={`R$ ${monthIncome.toLocaleString("pt-BR")}`} />

          <div className="bg-card rounded-xl p-4 md:p-5 border border-border card-glow animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" />Mensagens
              </span>
              <span className="text-xs font-medium text-primary">{planName}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-xl md:text-2xl font-display font-bold text-foreground">{messagesCount}</span>
                <span className="text-xs text-muted-foreground">/ {messagesLimit}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePct}%` }} />
              </div>
              {showUpgradeHint && (
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs text-warning">Perto do limite.</p>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1"><Crown className="w-3 h-3" />Upgrade</Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Recent Activity */}
          <div className="bg-card rounded-xl border border-border p-4 md:p-6 card-glow">
            <h2 className="font-display font-semibold text-base md:text-lg text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />Atividade Recente
            </h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nada por aqui ainda.</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item, i) => (
                  <div key={item.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0 animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                    <span className="text-lg">{typeEmoji[item.type] || "📩"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{item.message}</p>
                      <p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Tasks */}
          <div className="bg-card rounded-xl border border-border p-4 md:p-6 card-glow">
            <h2 className="font-display font-semibold text-base md:text-lg text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />Tarefas Pendentes
            </h2>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem tarefas pendentes.</p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task, i) => (
                  <div key={task.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-sm text-foreground truncate">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium ${priorityColor[task.priority] || ""}`}>{task.priority}</span>
                      {task.due_date && <span className="text-xs text-muted-foreground hidden sm:inline">{new Date(task.due_date).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
