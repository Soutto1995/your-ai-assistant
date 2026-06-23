export type PlanName = "FREE" | "STARTER" | "PRO" | "FAMILY_2" | "FAMILY_3" | "FAMILY_4";

export interface PlanLimits {
  transactionsPerMonth: number;
  categories: number;
  budgets: number;
  remindersPerMonth: number;
  exportFormats: string[];
  historyMonths: number;
  hasComparison: boolean;
  familyMembers?: number;
}

const PRO_LIMITS: PlanLimits = {
  transactionsPerMonth: Infinity,
  categories: Infinity,
  budgets: Infinity,
  remindersPerMonth: Infinity,
  exportFormats: ["PDF", "Excel", "CSV"],
  historyMonths: Infinity,
  hasComparison: true,
};

export const PLAN_LIMITS: Record<PlanName, PlanLimits> = {
  FREE: {
    transactionsPerMonth: 20,
    categories: 5,
    budgets: 0,
    remindersPerMonth: 0,
    exportFormats: [],
    historyMonths: 3,
    hasComparison: false,
  },
  STARTER: {
    transactionsPerMonth: 200,
    categories: 10,
    budgets: 3,
    remindersPerMonth: 5,
    exportFormats: ["PDF"],
    historyMonths: 6,
    hasComparison: false,
  },
  PRO: PRO_LIMITS,
  FAMILY_2: { ...PRO_LIMITS, familyMembers: 2 },
  FAMILY_3: { ...PRO_LIMITS, familyMembers: 3 },
  FAMILY_4: { ...PRO_LIMITS, familyMembers: 4 },
};

export function getPlanLimits(plan: string): PlanLimits {
  const normalized = (plan || "FREE").toUpperCase() as PlanName;
  return PLAN_LIMITS[normalized] || PLAN_LIMITS.FREE;
}

export function getPlanLabel(plan: string): string {
  const labels: Record<string, string> = {
    FREE: "Grátis",
    STARTER: "Starter",
    PRO: "Pro",
    FAMILY_2: "Familiar Casal",
    FAMILY_3: "Familiar 3",
    FAMILY_4: "Familiar 4",
  };
  return labels[(plan || "FREE").toUpperCase()] || "Grátis";
}

export function isFamilyPlan(plan?: string | null): boolean {
  return !!plan && plan.toUpperCase().startsWith("FAMILY");
}
