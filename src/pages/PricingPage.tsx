import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, Zap, Crown, Coffee, TrendingUp, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PRICE_STARTER_MONTHLY = 'price_1TEcLALkc2YbZKCTTJ5PHokf';
const PRICE_PRO_MONTHLY = 'price_11EcLALkc2YbZKCTXMpglSRQ';

const plans = [
  {
    name: "GRÁTIS",
    icon: <Check className="w-6 h-6" />,
    monthly: 0,
    annual: 0,
    monthlyLabel: "R$ 0",
    annualLabel: "R$ 0",
    annualMonthly: "",
    dailyCost: "",
    limit: "5 mensagens/dia",
    features: ["5 mensagens por dia", "Tarefas básicas", "Registro de gastos", "Agenda de reuniões"],
    cta: "Começar agora",
    highlight: false,
    priceId: "",
    planKey: "free",
  },
  {
    name: "STARTER",
    icon: <Zap className="w-6 h-6" />,
    monthly: 12.9,
    annual: 123.9,
    monthlyLabel: "R$ 12,90/mês",
    annualLabel: "R$ 123,90/ano",
    annualMonthly: "R$ 10,33/mês",
    dailyCost: "R$ 0,43",
    limit: "50 mensagens/dia",
    features: ["50 mensagens por dia", "Tudo do plano Grátis", "Prioridade no suporte", "Relatórios semanais"],
    cta: "Quero o Plano Starter",
    highlight: true,
    priceId: PRICE_STARTER_MONTHLY,
    planKey: "STARTER",
  },
  {
    name: "PRO",
    icon: <Crown className="w-6 h-6" />,
    monthly: 24.9,
    annual: 239.9,
    monthlyLabel: "R$ 24,90/mês",
    annualLabel: "R$ 239,90/ano",
    annualMonthly: "R$ 19,99/mês",
    dailyCost: "R$ 0,83",
    limit: "Mensagens ilimitadas",
    features: ["Mensagens ilimitadas", "Tudo do plano Starter", "IA avançada", "Integrações premium"],
    cta: "Organizar minhas finanças",
    highlight: false,
    priceId: PRICE_PRO_MONTHLY,
    planKey: "PRO",
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { user, session } = useAuth();
  const navigate = useNavigate();

  const handleCheckout = async (priceId: string, planKey: string) => {
    if (!session?.access_token || !user) {
      navigate("/login");
      return;
    }

    setLoadingPlan(planKey);
    try {
      const response = await fetch(
        'https://jwxrtnleqdvzvoywzqir.supabase.co/functions/v1/create-checkout',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            priceId,
            plan: planKey,
            email: user.email,
            userId: user.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar checkout');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar checkout. Tente novamente.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto">
        <div className="text-center space-y-3">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground">
            Escolha o plano ideal para você
          </h1>
          <p className="text-muted-foreground text-sm">
            Comece grátis e evolua conforme sua necessidade.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>Mensal</span>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
              Anual <span className="text-xs text-primary">(20% off)</span>
            </span>
          </div>
        </div>

        {/* Valor Percebido */}
        <div className="bg-card border border-border rounded-xl p-5 md:p-6 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-primary">
            <TrendingUp className="w-5 h-5" />
            <span className="font-display font-semibold text-sm md:text-base">
              Economize de R$ 50 a R$ 200 por mês com nossas sugestões inteligentes.
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Coffee className="w-4 h-4" />
            <span className="text-xs md:text-sm">
              Menos que um cafezinho por dia para ter suas finanças em ordem.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {plans.map((plan) => {
            const isLoading = loadingPlan === plan.planKey;
            return (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${plan.highlight ? "border-primary card-glow" : "border-border"}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold gold-gradient text-primary-foreground">
                    Popular
                  </div>
                )}
                <CardHeader className="text-center space-y-2 p-4 md:p-6">
                  <div className="mx-auto w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                    {plan.icon}
                  </div>
                  <CardTitle className="text-base md:text-lg">{plan.name}</CardTitle>
                  <div>
                    {plan.monthly === 0 ? (
                      <p className="text-2xl md:text-3xl font-bold text-foreground">Grátis</p>
                    ) : plan.name === "PRO" ? (
                      <>
                        <p className="text-lg md:text-xl font-bold text-primary">
                          apenas {annual ? "R$ 0,67" : plan.dailyCost} por dia
                        </p>
                        {annual ? (
                          <>
                            <p className="text-sm text-muted-foreground mt-1">{plan.annualMonthly}</p>
                            <p className="text-xs text-muted-foreground">{plan.annualLabel}</p>
                            <p className="text-xs font-semibold text-primary mt-1">Economize R$ 59 por ano!</p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">{plan.monthlyLabel}</p>
                        )}
                      </>
                    ) : annual ? (
                      <>
                        <p className="text-2xl md:text-3xl font-bold text-foreground">{plan.annualMonthly}</p>
                        <p className="text-xs text-muted-foreground">{plan.annualLabel}</p>
                        <p className="text-xs font-semibold text-primary mt-1">Economize R$ 30 por ano!</p>
                      </>
                    ) : (
                      <p className="text-2xl md:text-3xl font-bold text-foreground">{plan.monthlyLabel}</p>
                    )}
                  </div>
                  <CardDescription>{plan.limit}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-4 md:p-6 pt-0">
                  <ul className="space-y-2 flex-1 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.monthly === 0 ? (
                    <Button className="w-full" variant="outline" onClick={() => navigate("/signup")}>
                      {plan.cta}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.highlight ? "default" : "outline"}
                      disabled={isLoading}
                      onClick={() => handleCheckout(plan.priceId, plan.planKey)}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        plan.cta
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
