import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface CategoryComparison {
  category: string;
  currentMonth: number;
  average: number;
  percentChange: number;
}

export function useSpendingComparison(transactions: any[]): CategoryComparison[] {
  const { isPro } = usePlanLimits();
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!isPro) return;
    const fetchAll = async () => {
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const { data } = await supabase
        .from("transactions")
        .select("amount, category, type, transaction_date")
        .eq("type", "gasto")
        .gte("transaction_date", threeMonthsAgo.toISOString());
      setAllTransactions(data || []);
    };
    fetchAll();
  }, [isPro]);

  return useMemo(() => {
    if (!isPro || allTransactions.length === 0) return [];

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Group by category
    const catMap: Record<string, { current: number; previous: number[] }> = {};

    allTransactions.forEach(t => {
      const cat = t.category || "Sem categoria";
      if (!catMap[cat]) catMap[cat] = { current: 0, previous: [0, 0, 0] };

      const txDate = new Date(t.transaction_date);
      const amount = Math.abs(Number(t.amount));

      if (txDate >= currentMonthStart) {
        catMap[cat].current += amount;
      } else {
        // Which of the 3 previous months?
        for (let i = 1; i <= 3; i++) {
          const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          if (txDate >= mStart && txDate < mEnd) {
            catMap[cat].previous[i - 1] += amount;
            break;
          }
        }
      }
    });

    const results: CategoryComparison[] = Object.entries(catMap)
      .map(([category, data]) => {
        const prevMonths = data.previous.filter(v => v > 0);
        const average = prevMonths.length > 0 ? prevMonths.reduce((s, v) => s + v, 0) / prevMonths.length : 0;
        const percentChange = average > 0 ? ((data.current - average) / average) * 100 : 0;
        return { category, currentMonth: data.current, average, percentChange };
      })
      .filter(c => c.currentMonth > 0 || c.average > 0)
      .sort((a, b) => b.currentMonth - a.currentMonth)
      .slice(0, 5);

    return results;
  }, [isPro, allTransactions]);
}
