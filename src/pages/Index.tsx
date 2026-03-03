import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import {
  CheckSquare,
  DollarSign,
  TrendingUp,
  MessageCircle,
  Clock,
  AlertTriangle,
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

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            Bom dia, <span className="gold-text">Usuário</span> 👋
          </h1>
          <p className="text-muted-foreground mt-1">Aqui está o resumo do seu dia.</p>
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
          <StatCard
            icon={<MessageCircle className="w-5 h-5" />}
            label="Mensagens Hoje"
            value="28"
            change="de 30 do plano FREE"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-card rounded-xl border border-border p-6 card-glow">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Atividade Recente
            </h2>
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
          </div>

          {/* Pending Tasks */}
          <div className="bg-card rounded-xl border border-border p-6 card-glow">
            <h2 className="font-display font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Tarefas Pendentes
            </h2>
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
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
