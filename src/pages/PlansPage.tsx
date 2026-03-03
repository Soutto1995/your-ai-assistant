import AppLayout from "@/components/AppLayout";
import { CreditCard, Check, Zap } from "lucide-react";

const plans = [
  {
    name: "FREE",
    price: "R$ 0",
    period: "/mês",
    current: true,
    features: [
      "30 mensagens/mês",
      "10 tarefas ativas",
      "1 reunião/mês",
      "Dashboard básico",
    ],
    limitations: [
      "Sem relatórios automáticos",
      "Sem controle financeiro avançado",
    ],
  },
  {
    name: "PRO",
    price: "R$ 29,90",
    period: "/mês",
    current: false,
    popular: true,
    features: [
      "Mensagens ilimitadas",
      "Tarefas ilimitadas",
      "Reuniões ilimitadas",
      "Relatório semanal",
      "Controle financeiro completo",
      "Central de Memória",
    ],
    limitations: [],
  },
  {
    name: "PRO+",
    price: "R$ 59,90",
    period: "/mês",
    current: false,
    features: [
      "Tudo do PRO",
      "Multi-workspace",
      "Equipe (até 10 membros)",
      "Automações avançadas",
      "Relatório mensal detalhado",
      "Exportações (PDF, CSV)",
      "Suporte prioritário",
    ],
    limitations: [],
  },
];

export default function PlansPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center justify-center gap-3">
            <CreditCard className="w-8 h-8 text-primary" />
            Planos e Assinatura
          </h1>
          <p className="text-muted-foreground mt-2">
            Escolha o plano ideal para suas necessidades.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`bg-card rounded-xl border p-6 animate-slide-up relative ${
                plan.popular
                  ? "border-primary card-glow"
                  : "border-border"
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="gold-gradient text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" /> POPULAR
                  </span>
                </div>
              )}
              <div className="text-center mb-6">
                <h3 className="font-display font-bold text-lg text-foreground">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-display font-bold gold-text">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
              </div>
              <div className="space-y-3 mb-6">
                {plan.features.map((feature, j) => (
                  <div key={j} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground">{feature}</span>
                  </div>
                ))}
                {plan.limitations.map((limitation, j) => (
                  <div key={j} className="flex items-center gap-2 text-sm">
                    <span className="w-4 h-4 text-muted-foreground flex-shrink-0 text-center">✕</span>
                    <span className="text-muted-foreground">{limitation}</span>
                  </div>
                ))}
              </div>
              <button
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                  plan.current
                    ? "bg-secondary text-secondary-foreground cursor-default"
                    : plan.popular
                    ? "gold-gradient text-primary-foreground hover:opacity-90"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {plan.current ? "Plano Atual" : "Fazer Upgrade"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
