import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const colorOptions = [
  { value: "bg-info", label: "Azul" },
  { value: "bg-success", label: "Verde" },
  { value: "bg-warning", label: "Amarelo" },
  { value: "bg-destructive", label: "Vermelho" },
  { value: "bg-primary", label: "Dourado" },
];

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [taskCounts, setTaskCounts] = useState<Record<string, { total: number; completed: number }>>({});
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("bg-info");

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects(data || []);

    // Fetch task counts per project name
    const { data: tasks } = await supabase.from("tasks").select("project, status");
    const counts: Record<string, { total: number; completed: number }> = {};
    (tasks || []).forEach(t => {
      if (!t.project) return;
      if (!counts[t.project]) counts[t.project] = { total: 0, completed: 0 };
      counts[t.project].total++;
      if (t.status === "concluída") counts[t.project].completed++;
    });
    setTaskCounts(counts);
  };

  useEffect(() => {
    fetchProjects();
    const channel = supabase.channel("projects-rt").on("postgres_changes", { event: "*", schema: "public", table: "projects" }, fetchProjects).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const addProject = async () => {
    if (!name.trim() || !user) return;
    const { error } = await supabase.from("projects").insert({ name: name.trim(), color, user_id: user.id });
    if (error) { toast.error("Erro ao criar projeto"); return; }
    toast.success("Projeto criado!");
    setName(""); setColor("bg-info"); setOpen(false);
  };

  const deleteProject = async (id: string) => {
    await supabase.from("projects").delete().eq("id", id);
    toast.success("Projeto removido!");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-primary" />Projetos
            </h1>
            <p className="text-muted-foreground mt-1">Organize suas tarefas por projeto.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Novo Projeto</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Nome do projeto" value={name} onChange={e => setName(e.target.value)} />
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {colorOptions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={addProject} className="w-full">Criar Projeto</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((project, i) => {
            const counts = taskCounts[project.name] || { total: 0, completed: 0 };
            const progress = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;
            return (
              <div key={project.id} className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up hover:border-primary/30 transition-colors" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${project.color}`} />
                    <h3 className="font-display font-semibold text-foreground">{project.name}</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteProject(project.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{counts.completed}/{counts.total} tarefas</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary">
                    <div className="h-full rounded-full gold-gradient transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
          {projects.length === 0 && <p className="text-center py-8 text-muted-foreground col-span-2">Nenhum projeto encontrado.</p>}
        </div>
      </div>
    </AppLayout>
  );
}
