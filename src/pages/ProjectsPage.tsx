import AppLayout from "@/components/AppLayout";
import { FolderOpen, Plus } from "lucide-react";

const projects = [
  { name: "Startup App", tasks: 8, completed: 3, color: "bg-info" },
  { name: "Freelance Design", tasks: 5, completed: 4, color: "bg-success" },
  { name: "Pessoal", tasks: 12, completed: 7, color: "bg-warning" },
  { name: "Jurídico", tasks: 3, completed: 1, color: "bg-destructive" },
];

export default function ProjectsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-primary" />
              Projetos
            </h1>
            <p className="text-muted-foreground mt-1">Organize suas tarefas por projeto.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg gold-gradient text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus className="w-4 h-4" /> Novo Projeto
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {projects.map((project, i) => {
            const progress = Math.round((project.completed / project.tasks) * 100);
            return (
              <div
                key={i}
                className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up hover:border-primary/30 transition-colors cursor-pointer"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-3 h-3 rounded-full ${project.color}`} />
                  <h3 className="font-display font-semibold text-foreground">{project.name}</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{project.completed}/{project.tasks} tarefas</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full gold-gradient transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
