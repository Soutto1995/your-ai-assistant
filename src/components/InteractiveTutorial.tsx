import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Send, BarChart3, PartyPopper, ChevronRight, ChevronLeft, X } from "lucide-react";

interface TutorialStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  targetId?: string;
  example?: string;
}

const STEPS: TutorialStep[] = [
  {
    icon: <MessageCircle className="w-6 h-6" />,
    title: "Conecte seu WhatsApp",
    description: "Clique no botão abaixo para conectar seu WhatsApp ao Tuddo. Basta enviar uma mensagem!",
    targetId: "whatsapp-connect-btn",
  },
  {
    icon: <Send className="w-6 h-6" />,
    title: "Envie sua primeira transação",
    description: "Envie uma mensagem pelo WhatsApp como:",
    example: '"gastei 50 no mercado"',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Veja seus resultados",
    description: "Suas transações, tarefas e compromissos aparecem automaticamente aqui no dashboard, organizados pela IA.",
    targetId: "dashboard-stats",
  },
  {
    icon: <PartyPopper className="w-6 h-6" />,
    title: "Parabéns! Você está pronto! 🎉",
    description: "Agora é só continuar enviando mensagens pelo WhatsApp. O Tuddo cuida de tudo pra você!",
  },
];

interface InteractiveTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function InteractiveTutorial({ onComplete, onSkip }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  const updateTarget = useCallback(() => {
    if (step.targetId) {
      const el = document.getElementById(step.targetId);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    setTargetRect(null);
  }, [step.targetId]);

  useEffect(() => {
    updateTarget();
    window.addEventListener("resize", updateTarget);
    return () => window.removeEventListener("resize", updateTarget);
  }, [updateTarget]);

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const prev = () => setCurrentStep((s) => Math.max(0, s - 1));

  const pad = 12;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Dark overlay with cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - pad}
                y={targetRect.top - pad}
                width={targetRect.width + pad * 2}
                height={targetRect.height + pad * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#tutorial-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Highlight border */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-xl animate-pulse pointer-events-none"
          style={{
            left: targetRect.left - pad,
            top: targetRect.top - pad,
            width: targetRect.width + pad * 2,
            height: targetRect.height + pad * 2,
          }}
        />
      )}

      {/* Tutorial card */}
      <div
        className="absolute z-10 w-[90vw] max-w-md bg-card border border-border rounded-xl p-6 shadow-2xl animate-fade-in"
        style={{
          left: "50%",
          transform: "translateX(-50%)",
          ...(targetRect
            ? { top: Math.min(targetRect.bottom + pad + 16, window.innerHeight - 280) }
            : { top: "50%", transform: "translate(-50%, -50%)" }),
        }}
      >
        {/* Skip button */}
        <button
          onClick={onSkip}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-6 bg-primary"
                  : i < currentStep
                  ? "w-3 bg-primary/50"
                  : "w-3 bg-secondary"
              }`}
            />
          ))}
          <span className="ml-auto text-xs text-muted-foreground">
            {currentStep + 1}/{STEPS.length}
          </span>
        </div>

        {/* Content */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            {step.icon}
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
            {step.example && (
              <div className="mt-2 px-3 py-2 bg-secondary rounded-lg border border-border">
                <code className="text-sm text-primary">{step.example}</code>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-2">
          {currentStep > 0 && (
            <Button variant="ghost" size="sm" onClick={prev} className="gap-1">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </Button>
          )}
          <div className="flex-1" />
          <Button size="sm" onClick={next} className="gap-1">
            {isLast ? "Começar a usar o Tuddo" : "Próximo"}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
