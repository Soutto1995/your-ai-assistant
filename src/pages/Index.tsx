import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import OnboardingGuide from "@/components/OnboardingGuide";
import OnboardingModal from "@/components/OnboardingModal";
import InteractiveTutorial from "@/components/InteractiveTutorial";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckSquare, DollarSign, TrendingUp, MessageCircle,
  Clock, AlertTriangle, Crown, LogOut,
} from "lucide-react";

const WHATSAPP_NUMBER = "554784566364";
const WHATSAPP_TEXT = encodeURIComponent("Oi Tuddo!");
const WHATSAPP_WEB_LINK = `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${WHATSAPP_TEXT}`;
const WHATSAPP_MOBILE_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`;

function getWhatsAppLink() {
  if (typeof navigator === "undefined") return WHATSAPP_WEB_LINK;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return isMobile ? WHATSAPP_MOBILE_LINK : WHATSAPP_WEB_LINK;
}

const PLAN_DAILY_LIMITS: Record<string, number> = {
  FREE: 5,
  STARTER: 50,
  PRO: 99999,
};

const priorityColor: Record<string, string> = {
  alta: "text-destructive",
  média: "text-warning",
  baixa: "text-success",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const SAMPLE_TRANSACTIONS = [
  { description: "Mercado Pão de Açúcar", amount: -89.50, type: "gasto", category: "Alimentação" },
  { description: "Uber para o trabalho", amount: -22.00, type: "gasto", category: "Transporte" },
  { description: "Cinema com amigos", amount: -35.00, type: "gasto", category: "Lazer" },
  { description: "Almoço restaurante", amount: -42.00, type: "gasto", category: "Alimentação" },
  { description: "Gasolina", amount: -150.00, type: "gasto", category: "Transporte" },
];

export default function Dashboard() {
  const { profile, signOut, user } = useAuth();
  const userName = profile?.full_name || "Usuário";
  const planName = (profile?.plan || "FREE").toUpperCase();
  const whatsappConnected = !!profile?.phone;
  const whatsappLink = getWhatsAppLink();

  const messagesLimit = PLAN_DAILY_LIMITS[planName] || PLAN_DAILY_LIMITS.FREE;
  const isPro = planName === "PRO";

  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [isNewUser, setIsNewUser] = useState(false);

  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const usagePct = isPro ? 0 : clamp(Math.round((messagesCount / messagesLimit) * 100), 0, 100);
  const showUpgradeHint = planName === "FREE" && usagePct >= 80;

  // Check onboarding status
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data && !data.onboarding_completed) {
          setShowOnboardingModal(true);
        }
        setOnboardingChecked(true);
      });
  }, [user]);

  const completeOnboarding = async () => {
    setShowOnboardingModal(false);
    setShowTutorial(false);
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true } as any)
        .eq("id", user.id);
    }
  };

  const seedSampleData = async () => {
    if (!user) return;
    // Check if user already has transactions
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true });
    
    if ((count || 0) === 0) {
      const now = new Date();
      const samples = SAMPLE_TRANSACTIONS.map((t, i) => ({
        ...t,
        user_id: user.id,
        amount: Math.abs(t.amount),
        transaction_date: new Date(now.getTime() - i * 86400000).toISOString(),
      }));
      await supabase.from("transactions").insert(samples);
    }
  };

  const handleStartTutorial = async () => {
    setShowOnboardingModal(false);
    await seedSampleData();
    await fetchData();
    setShowTutorial(true);
  };

  const handleSkipOnboarding = () => {
    completeOnboarding();
  };

  const handleTutorialComplete = () => {
    completeOnboarding();
  };

  const fetchData = async () => {
    if (!user) return;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [tasksRes, txRes, inboxRes, recentInboxRes, pendingTasksRes] = await Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("transactions").select("amount, type").gte("transaction_date", startOfMonth.toISOString()),
      supabase.from("inbox_messages").select("id", { count: "exact", head: true }).gte("created_at", twentyFourHoursAgo),
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

    const totalActivity = (tasksRes.count || 0) + (txRes.data?.length || 0) + (recentInboxRes.data?.length || 0);
    setIsNewUser(totalActivity === 0);
  };

  useEffect(() => {
    fetchData();

    const channels = ["tasks", "transactions", "inbox_messages"].map(table =>
      supabase.channel(`dashboard-${table}`).on("postgres_changes", { event: "*", schema: "public", table }, fetchData).subscribe()
    );

    return () => {
      channels.forEach(c => supabase.removeChannel(c));
    };
  }, [user]);

  const typeEmoji: Record<string, string> = {
    tarefa: "✅", finanças: "💰", consulta: "📊", reunião: "📅",
  };

  return (
    <AppLayout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground">
              Bom dia, <span className="gold-text">{userName}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {whatsappConnected
                ? "Aqui está o resumo do seu dia."
                : "Para começar, clique no botão abaixo para enviar sua primeira mensagem no WhatsApp!"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!whatsappConnected && (
              <Button asChild size="sm" className="gap-2" id="whatsapp-connect-btn">
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-4 h-4" />Conectar WhatsApp
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={signOut}>
              <LogOut className="w-4 h-4" />Sair
            </Button>
          </div>
        </div>

        {!whatsappConnected && onboardingChecked && (
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 md:p-6 card-glow animate-fade-in text-center space-y-3">
            <h2 className="font-display font-semibold text-base md:text-lg text-foreground">
              Passo final: Conecte seu WhatsApp!
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Clique no botão abaixo para enviar sua primeira mensagem para o Tuddo e ativar seu assessor pessoal.
            </p>
            <Button asChild size="sm" className="gap-2 gold-gradient text-primary-foreground">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4" />
                Conectar WhatsApp Agora
              </a>
            </Button>
          </div>
        )}

        {isNewUser && !showTutorial && <OnboardingGuide whatsappLink={whatsappLink} />}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4" id="dashboard-stats">
          <StatCard icon={<CheckSquare className="w-5 h-5" />} label="Tarefas Pendentes" value={String(pendingTasksCount)} />
          <StatCard icon={<DollarSign className="w-5 h-5" />} label="Gastos do Mês" value={`R$ ${monthExpenses.toLocaleString("pt-BR")}`} />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Receita do Mês" value={`R$ ${monthIncome.toLocaleString("pt-BR")}`} />

          <div className="bg-card rounded-xl p-4 md:p-5 border border-border card-glow animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-xs sm:text-sm flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" />Mensagens (24h)
              </span>
              <span className="text-xs font-medium text-primary">{planName}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-xl md:text-2xl font-display font-bold text-foreground">{messagesCount}</span>
                {!isPro && <span className="text-xs text-muted-foreground">/ {messagesLimit}</span>}
                {isPro && <span className="text-xs text-muted-foreground">ilimitadas</span>}
              </div>
              {!isPro && (
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePct}%` }} />
                </div>
              )}
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

      {/* Onboarding Modal */}
      {onboardingChecked && (
        <OnboardingModal
          open={showOnboardingModal}
          onStartTutorial={handleStartTutorial}
          onSkip={handleSkipOnboarding}
        />
      )}

      {/* Interactive Tutorial */}
      {showTutorial && (
        <InteractiveTutorial
          onComplete={handleTutorialComplete}
          onSkip={handleSkipOnboarding}
        />
      )}
    </AppLayout>
  );
}
