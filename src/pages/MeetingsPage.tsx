import AppLayout from "@/components/AppLayout";
import { Users, Play, FileText } from "lucide-react";

const meetings = [
  {
    title: "Alinhamento com cliente",
    date: "Terça, 10h",
    status: "agendada",
    participants: 3,
    summary: null,
  },
  {
    title: "Sprint Planning",
    date: "Hoje, 14h",
    status: "concluída",
    participants: 5,
    summary: "📌 Definidos 8 itens para o sprint. Prioridade: integração de pagamentos.",
  },
  {
    title: "1:1 com João",
    date: "Ontem, 11h",
    status: "concluída",
    participants: 2,
    summary: "🧠 Discutido promoção e metas Q2. Próximos passos: preparar apresentação.",
  },
  {
    title: "Review mensal",
    date: "Seg, 15h",
    status: "concluída",
    participants: 8,
    summary: "📊 Crescimento de 23% no trimestre. Decisão: expandir equipe de vendas.",
  },
];

const statusStyle: Record<string, string> = {
  agendada: "bg-info/20 text-info",
  concluída: "bg-success/20 text-success",
};

export default function MeetingsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Reuniões
          </h1>
          <p className="text-muted-foreground mt-1">Resumos automáticos de reuniões via IA.</p>
        </div>

        <div className="space-y-4">
          {meetings.map((meeting, i) => (
            <div
              key={i}
              className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display font-semibold text-foreground">{meeting.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[meeting.status]}`}>
                      {meeting.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>📅 {meeting.date}</span>
                    <span>👥 {meeting.participants} participantes</span>
                  </div>
                  {meeting.summary && (
                    <div className="mt-3 pl-3 border-l-2 border-primary/30">
                      <p className="text-sm text-muted-foreground">{meeting.summary}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {meeting.status === "agendada" && (
                    <button className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  {meeting.summary && (
                    <button className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                      <FileText className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
