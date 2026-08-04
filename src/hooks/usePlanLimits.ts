import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanLimits, PlanLimits, PlanName } from "@/lib/planLimits";

export function usePlanLimits() {
  // effectivePlan, e não profile.plan: quem foi convidado para um plano
  // Familiar tem o próprio perfil como FREE, mas está usando uma conta paga.
  const { effectivePlan } = useAuth();

  const plan = useMemo(() => {
    return ((effectivePlan || "FREE").toUpperCase()) as PlanName;
  }, [effectivePlan]);

  const limits = useMemo(() => getPlanLimits(plan), [plan]);

  // Os planos Familiares liberam tudo que o PRO libera. Comparar com "PRO" na
  // mão escondia a comparação de gastos de quem assina o Familiar: ele via o
  // convite para "assinar o PRO" pagando mais caro que o PRO.
  const isPro = plan === "PRO" || plan.startsWith("FAMILY");
  const isFree = plan === "FREE";
  const isStarter = plan === "STARTER";

  return { plan, limits, isPro, isFree, isStarter };
}
