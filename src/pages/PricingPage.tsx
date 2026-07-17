import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, Zap, Crown, Coffee, TrendingUp, Loader2, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PRICE_STARTER_MONTHLY = 'price_1TZtTLPpu2ogE0DArUc286V7';
const PRICE_STARTER_YEARLY = 'price_1TZtTOPpu2ogE0DAlT08sf53';
const PRICE_PRO_MONTHLY = 'price_1TZtTQPpu2ogE0DACHSzeF2b';
const PRICE_PRO_YEARLY = 'price_1TZtTTPpu2ogE0DAojmyQdPB';

const familyPlans = [
  {
    name: "Familiar Casal",
    members: 2,
    monthlyLabel: "R$ 34,90/mês",
    annualMonthly: "R$ 29,90/mês",
    annualLabel: "R$ 358,80/ano",
    annualSavings: "Economize R$ 60/ano",
    individualSavings: "vs. 2x PRO: economize ~R$ 60/mês",
    priceId: "price_1TlbK4LKc2YbZKCT1NOAflvQ",
    yearlyPriceId: "price_1TlbKCLKc2YbZKCT2nRNLta0",
    planKey: "FAMILY_2",
    highlight: false,
  },
  {
    name: "Familiar 3",
    members: 3,
    monthlyLabel: "R$ 44,90/mês",
    annualMonthly: "R$ 37,90/mês",
    annualLabel: "R$ 454,80/ano",
    annualSavings: "Economize R$ 84/ano",
    individualSavings: "vs. 3x PRO: economize ~R$ 100/mês",
    priceId: "price_1TlbKJLKc2YbZKCTtJ1doKK2",
    yearlyPriceId: "price_1TlbKQLKc2YbZKCTiGnPVHOf",
    planKey: "FAMILY_3",
    highlight: true,
  },
  {
    name: "Familiar 4",
    members: 4,
    monthlyLabel: "R$ 54,90/mês",
    annualMonthly: "R$ 44,90/mês",
    annualLabel: "R$ 538,80/ano",
    annualSavings: "Economize R$ 120/ano",
    individualSavings: "vs. 4x PRO: economize ~R$ 144/mês",
    priceId: "price_1TlbKXLKc2YbZKCTidQuFTyz",
    yearlyPriceId: "price_1TlbKeLKc2YbZKCTANYMCONf",
    planKey: "FAMILY_4",
    highlight: false,
  },
];

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
    monthly: 19.9,
    annual: 199.9,
    monthlyLabel: "R$ 19,90/mês",
    annualLabel: "R$ 199,90/ano",
    annualMonthly: "R$ 16,65/mês",
    dailyCost: "R$ 0,66",
    limit: "200 mensagens/mês",
    features: ["200 mensagens por mês", "Tudo do plano Grátis", "Prioridade no suporte", "Relatórios semanais"],
    cta: "Quero o Plano Starter",
    highlight: false,
    priceId: PRICE_STARTER_MONTHLY,
    yearlyPriceId: PRICE_STARTER_YEARLY,
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
    features: ["Mensagens ilimitadas", "Tudo do plano Starter", "IA avançada", "Integrações premium", "Leitura de fotos e áudios"],
    cta: "Quero o Plano PRO",
    highlight: true,
    priceId: PRICE_PRO_MONTHLY,
    yearlyPriceId: PRICE_PRO_YEARLY,
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
    if (typeof (window as any).fbq === "function") {
      (window as any).fbq("track", "InitiateCheckout");
    }
    if (typeof (window as any).gtag === "function") {
      (window as any).gtag("event", "begin_checkout");
    }
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
        window.open(data.url, "_blank");
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
                      onClick={() => handleCheckout(annual && (plan as any).yearlyPriceId ? (plan as any).yearlyPriceId : plan.priceId, plan.planKey)}
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

        {/* ─── Family Plans ─── */}
        <div className="pt-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Users className="w-3.5 h-3.5" />
              PARA FAMÍLIAS
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground">
              Planos Familiares
            </h2>
            <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
              Compartilhe com quem você ama. Todos os membros acessam os mesmos dados financeiros e tarefas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {familyPlans.map((plan) => {
              const isLoading = loadingPlan === plan.planKey;
              return (
                <Card
                  key={plan.planKey}
                  className={`relative flex flex-col ${plan.highlight ? "border-primary card-glow" : "border-border"}`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold gold-gradient text-primary-foreground">
                      Mais escolhido
                    </div>
                  )}
                  <CardHeader className="text-center space-y-2 p-4 md:p-6">
                    <div className="mx-auto w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                      <Users className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-base md:text-lg">{plan.name}</CardTitle>
                    <div>
                      {annual ? (
                        <>
                          <p className="text-2xl md:text-3xl font-bold text-foreground">{plan.annualMonthly}</p>
                          <p className="text-xs text-muted-foreground">{plan.annualLabel}</p>
                          <p className="text-xs font-semibold text-primary mt-1">{plan.annualSavings}</p>
                        </>
                      ) : (
                        <p className="text-2xl md:text-3xl font-bold text-foreground">{plan.monthlyLabel}</p>
                      )}
                    </div>
                    <CardDescription>{plan.members} pessoas</CardDescription>
                    <div className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2 py-0.5">
                      {plan.individualSavings}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col p-4 md:p-6 pt-0">
                    <ul className="space-y-2 flex-1 mb-6">
                      {[
                        "Tudo do plano PRO",
                        `${plan.members} números de WhatsApp`,
                        "Dashboard compartilhado",
                        "Cada membro registra gastos pelo seu WhatsApp",
                        "Relatórios consolidados da família",
                      ].map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={plan.highlight ? "default" : "outline"}
                      disabled={isLoading}
                      onClick={() => handleCheckout(annual ? plan.yearlyPriceId : plan.priceId, plan.planKey)}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        `Quero o ${plan.name}`
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
