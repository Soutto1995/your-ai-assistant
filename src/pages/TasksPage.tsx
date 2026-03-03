import AppLayout from "@/components/AppLayout";
import { CheckSquare, Plus, Filter } from "lucide-react";

const tasks = [
  { title: "Enviar proposta comercial", priority: "alta", status: "pendente", due: "Hoje", project: "Freelance" },
  { title: "Revisar contrato", priority: "média", status: "em andamento", due: "Amanhã", project: "Jurídico" },
  { title: "Pagar academia", priority: "baixa", status: "pendente", due: "Sexta", project: "Pessoal" },
  { title: "Reunião de alinhamento", priority: "alta", status: "pendente", due: "Terça", project: "Startup" },
  { title: "Preparar apresentação", priority: "média", status: "concluída", due: "Ontem", project: "Startup" },
  { title: "Enviar nota fiscal", priority: "alta", status: "pendente", due: "Quarta", project: "Freelance" },
  { title: "Comprar presente aniversário", priority: "baixa", status: "pendente", due: "Sábado", project: "Pessoal" },
];

const priorityBadge: Record<string, string> = {
  alta: "bg-destructive/20 text-destructive",
  média: "bg-warning/20 text-warning",
  baixa: "bg-success/20 text-success",
};

const statusBadge: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  "em andamento": "bg-info/20 text-info",
  concluída: "bg-success/20 text-success",
};

export default function TasksPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <CheckSquare className="w-8 h-8 text-primary" />
              Tarefas
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie suas tarefas criadas via WhatsApp.</p>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm hover:bg-secondary/80 transition-colors">
              <Filter className="w-4 h-4" /> Filtrar
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg gold-gradient text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
              <Plus className="w-4 h-4" /> Nova Tarefa
            </button>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Tarefa</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Projeto</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Prioridade</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, i) => (
                <tr
                  key={i}
                  className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors animate-slide-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <td className="px-5 py-4">
                    <span className="text-sm text-foreground">{task.title}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">{task.project}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge[task.priority]}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[task.status]}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-muted-foreground">{task.due}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
