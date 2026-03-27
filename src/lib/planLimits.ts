export type PlanName = "FREE" | "STARTER" | "PRO";

export interface PlanLimits {
  transactionsPerMonth: number;
  categories: number;
  budgets: number;
  remindersPerMonth: number;
  exportFormats: string[];
  historyMonths: number;
  hasComparison: boolean;
}

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
  PRO: {
    transactionsPerMonth: Infinity,
    categories: Infinity,
    budgets: Infinity,
    remindersPerMonth: Infinity,
    exportFormats: ["PDF", "Excel", "CSV"],
    historyMonths: Infinity,
    hasComparison: true,
  },
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
  };
  return labels[(plan || "FREE").toUpperCase()] || "Grátis";
}
