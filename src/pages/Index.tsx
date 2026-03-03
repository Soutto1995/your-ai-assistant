import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import {
  CheckSquare,
  DollarSign,
  TrendingUp,
  MessageCircle,
  Clock,
  AlertTriangle,
  Link as LinkIcon,
  ArrowRight,
  Crown,
} from "lucide-react";

const recentActivity = [
  { emoji: "✅", text: "Tarefa 'Pagar academia' criada via WhatsApp", time: "2 min atrás" },
  { emoji: "💰", text: "Gasto de R$ 320 registrado — Mercado", time: "15 min atrás" },
  { emoji: "📅", text: "Reunião com cliente agendada para terça", time: "1h atrás" },
  { emoji: "📊", text: "Relatório semanal enviado", time: "3h atrás" },
  { emoji: "🎯", text: "Projeto 'App Mobile' atualizado", time: "5h atrás" },
];

const pendingTasks = [
  { title: "Enviar proposta comercial", priority: "alta", due: "Hoje" },
  { title: "Revisar contrato", priority: "média", due: "Amanhã" },
  { title: "Pagar academia", priority: "baixa", due: "Sexta" },
  { title: "Reunião de alinhamento", priority: "alta", due: "Terça" },
];

const priorityColor: Record<string, string> = {
  alta: "text-destructive",
  média: "text-warning",
  baixa: "text-success",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function Dashboard() {
  const userName = "Bruno";
  const planName = "FREE";
  const whatsappConnected = false;

  const messagesToday = 28;
  const messagesLimit = 30;

  const usagePct = clamp(Math.round((messagesToday / messagesLimit) * 100), 0, 100);
  const showUpgradeHint = planName === "FREE" && usagePct >= 80;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Bom dia, <span className="gold-text">{userName}</span> 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              {whatsappConnected
                ? "Aqui está o resumo do seu dia."
                : "Conecte seu WhatsApp para o Você Aí organizar tudo automaticamente."}
            </p>
          </div>

          {!whatsappConnected ? (
            <Button className="gap-2">
              <LinkIcon className="w-4 h-4" />
              Conectar WhatsApp
            </Button>
          ) : (
            <Button variant="outline" className="gap-2">
              Enviar comando teste <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Activation Steps */}
        <div className="bg-card rounded-xl border border-border p-6 card-glow">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display font-semibold text-lg text-foreground">
                Comece em 30 segundos
              </h2>
              <p className="text-sm text-muted-foreground">
                O Você Aí funciona melhor quando você usa o WhatsApp como inbox universal.
              </p>
            </div>
            {showUpgradeHint && (
              <Button variant="outline" size="sm" className="gap-1.5">
                <Crown className="w-4 h-4" />
                Fazer upgrade
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <p className="font-display font-semibold text-foreground">1) Conecte o WhatsApp</p>
              <p className="text-sm text-muted-foreground">
                Para receber e confirmar tudo automaticamente.
              </p>
              {!whatsappConnected && (
                <Button size="sm" className="gap-1.5 mt-1">
                  <LinkIcon className="w-3.5 h-3.5" />
                  Conectar
                </Button>
              )}
            </div>

            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <p className="font-display font-semibold text-foreground">2) Envie uma mensagem</p>
              <p className="text-sm text-muted-foreground">
                Ex: "Lembrar de pagar academia sexta".
              </p>
              <p className="text-xs text-muted-foreground">
                O sistema cria a tarefa e te confirma.
              </p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <p className="font-display font-semibold text-foreground">3) Veja tudo organizado</p>
              <p className="text-sm text-muted-foreground">
                Inbox, tarefas, finanças e resumos — tudo no lugar.
              </p>
              <p className="text-xs text-muted-foreground">
                Depois você ativa relatórios semanais.
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<CheckSquare className="w-5 h-5" />}
            label="Tarefas Ativas"
            value="12"
            change="+3 esta semana"
            positive
          />
          <StatCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Gastos do Mês"
            value="R$ 4.320"
            change="-8% vs mês anterior"
            positive
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Receita do Mês"
            value="R$ 12.500"
            change="+15% vs mês anterior"
            positive
          />

          {/* Messages card with progress bar */}
          <div className="bg-card rounded-xl p-5 border border-border card-glow animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <span className="text-muted-foreground text-sm flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" />
                Mensagens Hoje
              </span>
              <span className="text-xs font-medium text-primary">{planName}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-display font-bold text-foreground">
                  {messagesToday}
                </span>
                <span className="text-xs text-muted-foreground">
                  de {messagesLimit} no plano {planName}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${usagePct}%` }}
                />
              </div>

              {showUpgradeHint && (
                <div className="flex items-center justify-between gap-2 mt-1">
                  <p className="text-xs text-warning">
                    Você está perto do limite do FREE.
                  </p>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
                    <Crown className="w-3 h-3" />
                    Upgrade
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-card rounded-xl border border-border p-6 card-glow">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Atividade Recente
            </h2>

            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nada por aqui ainda. Envie algo no WhatsApp para começar.
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2 border-b border-border last:border-0 animate-slide-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <span className="text-lg">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{item.text}</p>
                      <p className="text-xs text-muted-foreground">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending Tasks */}
          <div className="bg-card rounded-xl border border-border p-6 card-glow">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Tarefas Pendentes
            </h2>

            {pendingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Sem tarefas pendentes. Quer criar uma pelo WhatsApp?
              </p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0 animate-slide-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-sm text-foreground">{task.title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${priorityColor[task.priority]}`}>
                        {task.priority}
                      </span>
                      <span className="text-xs text-muted-foreground">{task.due}</span>
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
