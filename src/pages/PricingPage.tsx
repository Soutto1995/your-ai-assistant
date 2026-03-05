import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, Zap, Crown } from "lucide-react";

const plans = [
  {
    name: "GRÁTIS",
    icon: <Check className="w-6 h-6" />,
    monthly: 0,
    annual: 0,
    monthlyLabel: "R$ 0",
    annualLabel: "R$ 0",
    annualMonthly: "",
    limit: "5 mensagens/dia",
    features: ["5 mensagens por dia", "Tarefas básicas", "Registro de gastos", "Agenda de reuniões"],
    cta: "Começar agora",
    highlight: false,
  },
  {
    name: "STARTER",
    icon: <Zap className="w-6 h-6" />,
    monthly: 12.9,
    annual: 123.9,
    monthlyLabel: "R$ 12,90/mês",
    annualLabel: "R$ 123,90/ano",
    annualMonthly: "R$ 10,33/mês",
    limit: "30 mensagens/dia",
    features: ["30 mensagens por dia", "Tudo do plano Grátis", "Prioridade no suporte", "Relatórios semanais"],
    cta: "Assinar Starter",
    highlight: true,
  },
  {
    name: "PRO",
    icon: <Crown className="w-6 h-6" />,
    monthly: 24.9,
    annual: 239.9,
    monthlyLabel: "R$ 24,90/mês",
    annualLabel: "R$ 239,90/ano",
    annualMonthly: "R$ 19,99/mês",
    limit: "50 mensagens/dia",
    features: ["50 mensagens por dia", "Tudo do plano Starter", "IA avançada", "Integrações premium"],
    cta: "Assinar PRO",
    highlight: false,
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <AppLayout>
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-display font-bold text-foreground">
            Escolha o plano ideal para você
          </h1>
          <p className="text-muted-foreground">
            Comece grátis e evolua conforme sua necessidade.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Mensal</span>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
              Anual <span className="text-xs text-primary">(20% de desconto)</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${plan.highlight ? "border-primary card-glow" : "border-border"}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold gold-gradient text-primary-foreground">
                  Popular
                </div>
              )}
              <CardHeader className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  {plan.icon}
                </div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div>
                  {plan.monthly === 0 ? (
                    <p className="text-3xl font-bold text-foreground">Grátis</p>
                  ) : annual ? (
                    <>
                      <p className="text-3xl font-bold text-foreground">{plan.annualMonthly}</p>
                      <p className="text-xs text-muted-foreground">{plan.annualLabel}</p>
                    </>
                  ) : (
                    <p className="text-3xl font-bold text-foreground">{plan.monthlyLabel}</p>
                  )}
                </div>
                <CardDescription>{plan.limit}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant={plan.highlight ? "default" : "outline"}>
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
