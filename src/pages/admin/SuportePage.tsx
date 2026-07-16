import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, Clock, ChevronDown, ChevronUp } from "lucide-react";

const ADMIN_EMAIL = "brunosouttoo@gmail.com";

type ContextMessage = {
  message: string;
  response: string | null;
  created_at: string;
  type: string;
};

type SupportRow = {
  id: string;
  user_id: string;
  phone: string;
  original_message: string;
  context: ContextMessage[];
  status: string;
  created_at: string;
  resolved_at: string | null;
  full_name: string | null;
};

export default function SuportePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<SupportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.email !== ADMIN_EMAIL) navigate("/dashboard");
  }, [user, navigate]);

  const fetchRows = useCallback(async () => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    setLoading(true);

    const supabaseAny = supabase as any;
    const { data: requests, error } = await supabaseAny
      .from("support_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !requests) { setLoading(false); return; }

    const userIds = [...new Set(requests.map((r: any) => r.user_id))] as string[];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p) => { nameMap[p.id] = p.full_name || "—"; });

    setRows(requests.map((r: any) => ({
      ...r,
      context: Array.isArray(r.context) ? r.context : [],
      full_name: nameMap[r.user_id] ?? "—",
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const markResolved = async (id: string) => {
    setResolving(id);
    const supabaseAny = supabase as any;
    await supabaseAny
      .from("support_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    setResolving(null);
    fetchRows();
  };

  if (!user || user.email !== ADMIN_EMAIL) return null;

  const pending = rows.filter(r => r.status === "pending");
  const resolved = rows.filter(r => r.status !== "pending");

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground flex items-center gap-2">
              Suporte
              {pending.length > 0 && (
                <Badge className="bg-destructive text-destructive-foreground text-xs px-2">
                  {pending.length}
                </Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {pending.length} pendente{pending.length !== 1 ? "s" : ""} · {resolved.length} resolvido{resolved.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={fetchRows}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {loading && rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground">Nenhum chamado de suporte ainda.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const isOpen = expanded === row.id;
              const dt = new Date(row.created_at);
              const dateStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
              const timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              const isPending = row.status === "pending";

              return (
                <div
                  key={row.id}
                  className={`rounded-lg border ${isPending ? "border-destructive/40 bg-destructive/5" : "border-border bg-card/50"} overflow-hidden`}
                >
                  {/* Header row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : row.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{row.full_name}</span>
                        <span className="text-xs text-muted-foreground">{row.phone}</span>
                        {isPending
                          ? <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/50 text-orange-400"><Clock className="w-2.5 h-2.5 mr-1 inline" />Pendente</Badge>
                          : <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-400"><CheckCircle className="w-2.5 h-2.5 mr-1 inline" />Resolvido</Badge>
                        }
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{row.original_message}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{dateStr} {timeStr}</span>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isOpen && (
                    <div className="border-t border-border/50 px-4 py-4 space-y-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Mensagem original</p>
                        <p className="text-sm text-foreground bg-secondary/40 rounded px-3 py-2">{row.original_message}</p>
                      </div>

                      {row.context.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Contexto da conversa</p>
                          <div className="space-y-2">
                            {row.context.map((msg, i) => (
                              <div key={i} className="text-xs space-y-1">
                                <div className="bg-secondary/30 rounded px-2 py-1.5">
                                  <span className="text-muted-foreground font-medium">Usuário: </span>
                                  <span className="text-foreground">{msg.message}</span>
                                </div>
                                {msg.response && (
                                  <div className="bg-primary/5 rounded px-2 py-1.5 ml-3">
                                    <span className="text-muted-foreground font-medium">Bot: </span>
                                    <span className="text-muted-foreground">{msg.response}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isPending && (
                        <Button
                          size="sm"
                          className="gap-2"
                          disabled={resolving === row.id}
                          onClick={() => markResolved(row.id)}
                        >
                          <CheckCircle className="w-4 h-4" />
                          {resolving === row.id ? "Resolvendo..." : "Marcar como resolvido"}
                        </Button>
                      )}

                      {!isPending && row.resolved_at && (
                        <p className="text-xs text-muted-foreground">
                          Resolvido em {new Date(row.resolved_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
