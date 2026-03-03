import AppLayout from "@/components/AppLayout";
import { Inbox as InboxIcon, MessageCircle, CheckCircle, Clock } from "lucide-react";

const inboxItems = [
  { type: "tarefa", message: "Lembrar de pagar academia sexta", status: "processado", time: "2 min atrás", response: "✅ Tarefa criada: Pagar academia — Prazo: Sexta" },
  { type: "finanças", message: "Gastei 320 no mercado", status: "processado", time: "15 min atrás", response: "💰 Gasto registrado: R$ 320 — Categoria: Alimentação" },
  { type: "consulta", message: "Quanto eu gastei esse mês?", status: "processado", time: "1h atrás", response: "📊 Total de gastos no mês: R$ 4.320 em 23 transações" },
  { type: "reunião", message: "Resumo da reunião com o João", status: "pendente", time: "2h atrás", response: null },
  { type: "tarefa", message: "Cancelar tarefa academia", status: "processado", time: "3h atrás", response: "✅ Tarefa 'Academia' cancelada com sucesso" },
  { type: "finanças", message: "Recebi 5.000 da consultoria", status: "processado", time: "5h atrás", response: "💰 Receita registrada: R$ 5.000 — Categoria: Consultoria" },
];

const typeColors: Record<string, string> = {
  tarefa: "bg-info/20 text-info",
  finanças: "bg-success/20 text-success",
  consulta: "bg-primary/20 text-primary",
  reunião: "bg-warning/20 text-warning",
};

export default function InboxPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <InboxIcon className="w-8 h-8 text-primary" />
            Inbox
          </h1>
          <p className="text-muted-foreground mt-1">Todas as mensagens recebidas via WhatsApp.</p>
        </div>

        <div className="space-y-3">
          {inboxItems.map((item, i) => (
            <div
              key={i}
              className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[item.type]}`}>
                      {item.type}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {item.status === "processado" ? (
                        <CheckCircle className="w-3 h-3 text-success" />
                      ) : (
                        <Clock className="w-3 h-3 text-warning" />
                      )}
                      {item.status}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <p className="text-sm text-foreground">{item.message}</p>
                  </div>
                  {item.response && (
                    <div className="ml-6 pl-3 border-l-2 border-primary/30">
                      <p className="text-sm text-muted-foreground">{item.response}</p>
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
