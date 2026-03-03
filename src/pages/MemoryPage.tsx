import AppLayout from "@/components/AppLayout";
import { Brain, Clock, DollarSign, Tag, Shield, Target, MessageCircle } from "lucide-react";

const memoryItems = [
  {
    icon: <Clock className="w-5 h-5" />,
    title: "Horários Preferenciais",
    description: "Reuniões: 9h-12h / Foco: 14h-17h",
    editable: true,
  },
  {
    icon: <DollarSign className="w-5 h-5" />,
    title: "Limites Financeiros",
    description: "Alerta acima de R$ 500 por transação",
    editable: true,
  },
  {
    icon: <Tag className="w-5 h-5" />,
    title: "Categorias Personalizadas",
    description: "Alimentação, Transporte, Moradia, Saúde, Lazer, Trabalho",
    editable: true,
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: "Regras do Assistente",
    description: "Não agendar após 19h / Priorizar tarefas do projeto Startup",
    editable: true,
  },
  {
    icon: <Target className="w-5 h-5" />,
    title: "Objetivos",
    description: "Economizar R$ 3.000/mês / Concluir 80% das tarefas semanais",
    editable: true,
  },
  {
    icon: <MessageCircle className="w-5 h-5" />,
    title: "Estilo de Resposta",
    description: "Direto, sem rodeios. Usar emojis. Respostas curtas.",
    editable: true,
  },
];

export default function MemoryPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            Central de Memória
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure como a IA deve se comportar e responder.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {memoryItems.map((item, i) => (
            <div
              key={i}
              className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up hover:border-primary/30 transition-colors cursor-pointer group"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gold-muted flex items-center justify-center text-primary flex-shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  Editar
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
