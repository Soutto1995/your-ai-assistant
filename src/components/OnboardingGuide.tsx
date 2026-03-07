import { MessageCircle, Brain, LayoutDashboard, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: <MessageCircle className="w-7 h-7" />,
    title: "Envie uma mensagem",
    description: 'Mande mensagens como "gastei 50 no mercado" ou "lembrete: ligar pro dentista amanhã".',
  },
  {
    icon: <Brain className="w-7 h-7" />,
    title: "A IA organiza",
    description: "O Tuddo entende e classifica tudo automaticamente: tarefas, finanças, reuniões.",
  },
  {
    icon: <LayoutDashboard className="w-7 h-7" />,
    title: "Veja tudo no painel",
    description: "Acompanhe tudo organizado aqui no dashboard, em tempo real.",
  },
];

export default function OnboardingGuide({ whatsappLink }: { whatsappLink: string }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-card border border-primary/30 rounded-xl p-4 md:p-6 card-glow animate-fade-in relative">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <h2 className="font-display font-semibold text-base md:text-lg text-foreground mb-4">
        🚀 Como começar com o Tuddo
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex flex-col items-center text-center gap-2 p-3 rounded-lg bg-secondary/50 animate-slide-up"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              {step.icon}
            </div>
            <span className="text-xs text-muted-foreground">Passo {i + 1}</span>
            <h3 className="font-semibold text-sm text-foreground">{step.title}</h3>
            <p className="text-xs text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
      <div className="text-center">
        <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
          <Button size="sm" className="gap-2">
            <MessageCircle className="w-4 h-4" />
            Enviar primeira mensagem no WhatsApp
          </Button>
        </a>
      </div>
    </div>
  );
}