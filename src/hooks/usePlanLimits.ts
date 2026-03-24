import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getPlanLimits, PlanLimits, PlanName } from "@/lib/planLimits";

export function usePlanLimits() {
  const { profile } = useAuth();
  
  const plan = useMemo(() => {
    return ((profile?.plan || "FREE").toUpperCase()) as PlanName;
  }, [profile?.plan]);

  const limits = useMemo(() => getPlanLimits(plan), [plan]);

  const isPro = plan === "PRO";
  const isFree = plan === "FREE";
  const isStarter = plan === "STARTER";

  return { plan, limits, isPro, isFree, isStarter };
}
