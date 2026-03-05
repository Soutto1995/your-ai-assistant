import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, Plus, Filter, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type PeriodFilter = "all" | "today" | "week" | "month";

function getPeriodStart(period: PeriodFilter): Date | null {
  if (period === "all") return null;
  const now = new Date();
  switch (period) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; }
    case "month": return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

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
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("baixa");
  const [project, setProject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  const fetchTasks = async () => {
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterPriority !== "all") query = query.eq("priority", filterPriority);
    const { data } = await query;
    setTasks(data || []);
  };

  useEffect(() => {
    fetchTasks();
    const channel = supabase.channel("tasks-realtime").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchTasks).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, filterStatus, filterPriority]);

  const filteredTasks = useMemo(() => {
    const start = getPeriodStart(periodFilter);
    if (!start) return tasks;
    return tasks.filter(t => new Date(t.created_at) >= start);
  }, [tasks, periodFilter]);

  const periodLabels: Record<PeriodFilter, string> = { all: "Todos", today: "Hoje", week: "Esta Semana", month: "Este Mês" };

  const addTask = async () => {
    if (!title.trim() || !user) return;
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), priority, project: project || null,
      due_date: dueDate || null, user_id: user.id,
    });
    if (error) { toast.error("Erro ao criar tarefa"); return; }
    toast.success("Tarefa criada!");
    setTitle(""); setPriority("baixa"); setProject(""); setDueDate(""); setOpen(false);
  };

  const completeTask = async (id: string) => {
    await supabase.from("tasks").update({ status: "concluída" }).eq("id", id);
    toast.success("Tarefa concluída!");
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id);
    toast.success("Tarefa deletada!");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <CheckSquare className="w-8 h-8 text-primary" />Tarefas
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie suas tarefas.</p>
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em andamento">Em andamento</SelectItem>
                <SelectItem value="concluída">Concluída</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="média">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="w-4 h-4" />Nova Tarefa</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Tarefa</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="média">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Projeto (opcional)" value={project} onChange={e => setProject(e.target.value)} />
                  <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  <Button onClick={addTask} className="w-full">Criar Tarefa</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Period filter */}
        <div className="flex gap-2">
          {(Object.keys(periodLabels) as PeriodFilter[]).map(p => (
            <Button key={p} variant={periodFilter === p ? "default" : "outline"} size="sm" onClick={() => setPeriodFilter(p)}>
              {periodLabels[p]}
            </Button>
          ))}
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
                <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, i) => (
                <tr key={task.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <td className="px-5 py-4"><span className="text-sm text-foreground">{task.title}</span></td>
                  <td className="px-5 py-4"><span className="text-xs text-muted-foreground">{task.project || "—"}</span></td>
                  <td className="px-5 py-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge[task.priority] || ""}`}>{task.priority}</span></td>
                  <td className="px-5 py-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[task.status] || ""}`}>{task.status}</span></td>
                  <td className="px-5 py-4"><span className="text-xs text-muted-foreground">{task.due_date ? new Date(task.due_date).toLocaleDateString("pt-BR") : "—"}</span></td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1">
                      {task.status !== "concluída" && (
                        <Button variant="ghost" size="sm" onClick={() => completeTask(task.id)}><Check className="w-4 h-4 text-success" /></Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteTask(task.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma tarefa encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
