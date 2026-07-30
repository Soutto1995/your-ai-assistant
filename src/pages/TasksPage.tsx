import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, Plus, Trash2, Check, UserRound, Repeat } from "lucide-react";
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
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("baixa");
  const [project, setProject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [assigneePhone, setAssigneePhone] = useState("");
  const [recurrence, setRecurrence] = useState("__none__");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");

  const fetchTasks = async () => {
    if (!user) return;
    let query = supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (filterStatus !== "all") query = query.eq("status", filterStatus);
    if (filterPriority !== "all") query = query.eq("priority", filterPriority);
    const { data } = await query;
    setTasks(data || []);
  };

  // Normaliza pro formato 55DDD9XXXXXXXX, igual ao webhook do WhatsApp — assim
  // o chase-tasks reconhece e o número bate com o que o Tuddo já usa.
  const normalizePhone = (raw: string): string | null => {
    let digits = raw.replace(/\D/g, "");
    if (!digits) return null;
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    if (!digits.startsWith("55")) return digits.length >= 10 ? digits : null;
    if (digits.length === 12) digits = `${digits.slice(0, 4)}9${digits.slice(4)}`;
    return digits.length === 13 ? digits : null;
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("name");
    setProjects(data || []);
  };

  useEffect(() => {
    fetchTasks();
    fetchProjects();
    const channel = supabase.channel("tasks-realtime").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, fetchTasks).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, filterStatus, filterPriority]);

  const filteredTasks = useMemo(() => {
    const start = getPeriodStart(periodFilter);
    if (!start) return tasks;
    return tasks.filter(t => new Date(t.created_at) >= start);
  }, [tasks, periodFilter]);

  const periodLabels: Record<PeriodFilter, string> = { all: "Todos", today: "Hoje", week: "Semana", month: "Mês" };

  const addTask = async () => {
    if (!title.trim() || !user) return;

    const normalizedPhone = assigneeName.trim() ? normalizePhone(assigneePhone) : null;
    if (assigneeName.trim() && assigneePhone.trim() && !normalizedPhone) {
      toast.error("Telefone inválido. Use DDD + número (ex: 48 99988-7766).");
      return;
    }
    if (normalizedPhone && !dueDate) {
      toast.error("Defina um prazo — é o que o Tuddo usa para saber quando cobrar.");
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      title: title.trim(), priority, project: (project && project !== "__none__") ? project : null,
      due_date: dueDate || null, user_id: user.id,
      assignee_name: assigneeName.trim() || null,
      assignee_phone: normalizedPhone,
      recurrence: normalizedPhone && recurrence !== "__none__" ? recurrence : null,
    });
    if (error) { toast.error("Erro ao criar tarefa"); return; }
    toast.success(normalizedPhone ? "Tarefa criada! Vou cobrar o responsável no WhatsApp." : "Tarefa criada!");
    setTitle(""); setPriority("baixa"); setProject(""); setDueDate("");
    setAssigneeName(""); setAssigneePhone(""); setRecurrence("__none__");
    setOpen(false);
  };

  const completeTask = async (id: string) => {
    if (!user) return;
    await supabase.from("tasks").update({ status: "concluída" }).eq("id", id).eq("user_id", user.id);
    toast.success("Tarefa concluída!");
  };

  const deleteTask = async (id: string) => {
    if (!user) return;
    await supabase.from("tasks").delete().eq("id", id).eq("user_id", user.id);
    toast.success("Tarefa deletada!");
  };

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
                <CheckSquare className="w-6 h-6 md:w-8 md:h-8 text-primary" />Tarefas
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">Gerencie suas tarefas.</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 self-start"><Plus className="w-4 h-4" />Nova Tarefa</Button>
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
                  <Select value={project} onValueChange={setProject}>
                    <SelectTrigger><SelectValue placeholder="Projeto (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem projeto</SelectItem>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} />

                  <div className="pt-2 border-t border-border space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Delegar para outra pessoa (opcional) — o Tuddo cobra ela pelo WhatsApp.
                    </p>
                    <Input placeholder="Nome do responsável" value={assigneeName} onChange={e => setAssigneeName(e.target.value)} />
                    {assigneeName.trim() && (
                      <>
                        <Input placeholder="WhatsApp com DDD (ex: 48 99988-7766)" value={assigneePhone} onChange={e => setAssigneePhone(e.target.value)} />
                        <Select value={recurrence} onValueChange={setRecurrence}>
                          <SelectTrigger><SelectValue placeholder="Repetir cobrança?" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Não repetir</SelectItem>
                            <SelectItem value="daily">Todo dia</SelectItem>
                            <SelectItem value="weekdays">Dias úteis</SelectItem>
                            <SelectItem value="weekly">Toda semana</SelectItem>
                            <SelectItem value="monthly">Todo mês</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  <Button onClick={addTask} className="w-full">Criar Tarefa</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em andamento">Em andamento</SelectItem>
                <SelectItem value="concluída">Concluída</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="média">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Period filter */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(periodLabels) as PeriodFilter[]).map(p => (
            <Button key={p} variant={periodFilter === p ? "default" : "outline"} size="sm" onClick={() => setPeriodFilter(p)}>
              {periodLabels[p]}
            </Button>
          ))}
        </div>

        {/* Mobile card view */}
        <div className="md:hidden space-y-3">
          {filteredTasks.map((task, i) => (
            <div key={task.id} className="bg-card rounded-xl border border-border p-4 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.project || "Sem projeto"}</p>
                  {task.assignee_name && (
                    <p className="text-xs text-info mt-1 flex items-center gap-1">
                      <UserRound className="w-3 h-3" />
                      {task.assignee_name}
                      {task.recurrence && <Repeat className="w-3 h-3" />}
                      {task.charge_count > 0 && (
                        <span className="text-muted-foreground">· cobrado {task.charge_count}x</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {task.status !== "concluída" && (
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => completeTask(task.id)}><Check className="w-4 h-4 text-success" /></Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => deleteTask(task.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityBadge[task.priority] || ""}`}>{task.priority}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[task.status] || ""}`}>{task.status}</span>
                {task.due_date && <span className="text-xs text-muted-foreground ml-auto">{new Date(task.due_date).toLocaleDateString("pt-BR")}</span>}
              </div>
            </div>
          ))}
          {filteredTasks.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhuma tarefa encontrada.</p>}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Tarefa</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wider">Responsável</th>
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
                    <td className="px-5 py-4">
                      {task.assignee_name ? (
                        <span className="text-xs text-info flex items-center gap-1">
                          <UserRound className="w-3 h-3" />
                          {task.assignee_name}
                          {task.recurrence && <Repeat className="w-3 h-3" />}
                          {task.charge_count > 0 && (
                            <span className="text-muted-foreground">· {task.charge_count}x</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">eu</span>
                      )}
                    </td>
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
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma tarefa encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
