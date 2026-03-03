import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from "lucide-react";

const transactions = [
  { description: "Mercado", type: "gasto", amount: -320, category: "Alimentação", date: "Hoje" },
  { description: "Consultoria", type: "receita", amount: 5000, category: "Trabalho", date: "Hoje" },
  { description: "Uber", type: "gasto", amount: -45, category: "Transporte", date: "Ontem" },
  { description: "Academia", type: "gasto", amount: -150, category: "Saúde", date: "Ontem" },
  { description: "Freelance design", type: "receita", amount: 2500, category: "Trabalho", date: "Seg" },
  { description: "Restaurante", type: "gasto", amount: -89, category: "Alimentação", date: "Seg" },
  { description: "Internet", type: "gasto", amount: -120, category: "Moradia", date: "Dom" },
  { description: "Aluguel", type: "gasto", amount: -2800, category: "Moradia", date: "01/mar" },
];

export default function FinancesPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-primary" />
            Finanças
          </h1>
          <p className="text-muted-foreground mt-1">Controle financeiro via WhatsApp.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Receita do Mês"
            value="R$ 12.500"
            change="+15% vs anterior"
            positive
          />
          <StatCard
            icon={<TrendingDown className="w-5 h-5" />}
            label="Gastos do Mês"
            value="R$ 4.320"
            change="-8% vs anterior"
            positive
          />
          <StatCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Saldo"
            value="R$ 8.180"
            change="Positivo"
            positive
          />
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-display font-semibold text-foreground">Transações Recentes</h2>
          </div>
          <div className="divide-y divide-border">
            {transactions.map((tx, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-5 py-4 hover:bg-secondary/30 transition-colors animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    tx.type === "receita" ? "bg-success/20" : "bg-destructive/20"
                  }`}>
                    {tx.type === "receita" ? (
                      <ArrowUpRight className="w-4 h-4 text-success" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{tx.description}</p>
                    <p className="text-xs text-muted-foreground">{tx.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-medium ${
                    tx.type === "receita" ? "text-success" : "text-destructive"
                  }`}>
                    {tx.type === "receita" ? "+" : ""}R$ {Math.abs(tx.amount).toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-muted-foreground">{tx.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
