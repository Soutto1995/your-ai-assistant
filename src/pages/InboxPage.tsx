import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Inbox as InboxIcon, MessageCircle, CheckCircle, Clock } from "lucide-react";

const typeColors: Record<string, string> = {
  tarefa: "bg-info/20 text-info",
  finanças: "bg-success/20 text-success",
  consulta: "bg-primary/20 text-primary",
  reunião: "bg-warning/20 text-warning",
};

export default function InboxPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const fetchItems = async () => {
    const { data } = await supabase.from("inbox_messages").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  };

  useEffect(() => {
    fetchItems();
    const channel = supabase.channel("inbox-rt").on("postgres_changes", { event: "*", schema: "public", table: "inbox_messages" }, fetchItems).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <InboxIcon className="w-8 h-8 text-primary" />Inbox
          </h1>
          <p className="text-muted-foreground mt-1">Todas as mensagens recebidas via WhatsApp.</p>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.id} className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[item.type] || "bg-muted text-muted-foreground"}`}>{item.type}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {item.status === "processado" ? <CheckCircle className="w-3 h-3 text-success" /> : <Clock className="w-3 h-3 text-warning" />}
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
                <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(item.created_at).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhuma mensagem encontrada.</p>}
        </div>
      </div>
    </AppLayout>
  );
}
