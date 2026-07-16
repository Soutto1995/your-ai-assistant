import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Inbox as InboxIcon, MessageCircle, CheckCircle, Clock, RefreshCw } from "lucide-react";

const intentLabels: Record<string, string> = {
  create_task: "tarefa",
  create_transaction: "finanças",
  create_meeting: "reunião",
  create_multiple_meetings: "agenda",
  create_goal: "meta",
  create_budget: "orçamento",
  create_folder: "pasta",
  list_items: "consulta",
  list_goals: "consulta",
  list_folders: "consulta",
  assign_folder: "pasta",
  general_query: "consulta",
  tarefa: "tarefa",
  finanças: "finanças",
  consulta: "consulta",
  reunião: "reunião",
};

const typeColors: Record<string, string> = {
  tarefa: "bg-info/20 text-info",
  finanças: "bg-success/20 text-success",
  consulta: "bg-primary/20 text-primary",
  reunião: "bg-warning/20 text-warning",
  agenda: "bg-purple-500/20 text-purple-400",
  meta: "bg-yellow-500/20 text-yellow-400",
  orçamento: "bg-orange-500/20 text-orange-400",
  pasta: "bg-pink-500/20 text-pink-400",
};

export default function InboxPage() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("inbox_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (fetchError) {
      console.error("Inbox fetch error:", fetchError);
      setError(fetchError.message);
      setItems([]);
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchItems();
    if (!user) return;
    const channel = supabase
      .channel("inbox-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_messages", filter: `user_id=eq.${user.id}` }, fetchItems)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchItems]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <InboxIcon className="w-8 h-8 text-primary" />Inbox
            </h1>
            <p className="text-muted-foreground mt-1">Todas as mensagens recebidas via WhatsApp.</p>
          </div>
          <button
            onClick={fetchItems}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
            Erro ao carregar mensagens: {error}
          </div>
        )}

        <div className="space-y-3">
          {loading && items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhuma mensagem encontrada.</p>
              <p className="text-xs mt-1 opacity-60">As mensagens enviadas pelo WhatsApp aparecerão aqui.</p>
            </div>
          ) : (
            items.map((item, i) => {
              const label = intentLabels[item.type] ?? item.type;
              return (
                <div key={item.id} className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      {profile?.full_name && (
                        <span className="text-xs font-medium text-muted-foreground">👤 {profile.full_name}</span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[label] || "bg-muted text-muted-foreground"}`}>{label}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {item.status === "processado" ? <CheckCircle className="w-3 h-3 text-success" /> : <Clock className="w-3 h-3 text-warning" />}
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm text-foreground">{item.message}</p>
                      </div>
                      {item.response && (
                        <div className="ml-6 pl-3 border-l-2 border-primary/30">
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.response}</p>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {new Date(item.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
