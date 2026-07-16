import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Inbox as InboxIcon, MessageCircle, CheckCircle, Clock, RefreshCw, User as UserIcon, Phone } from "lucide-react";

const ADMIN_EMAIL = "brunosouttoo@gmail.com";

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

function formatDate(d: string) {
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function InboxPage() {
  const { user, profile } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  // ===== Minhas mensagens =====
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

  // ===== Clientes (admin) =====
  const [clientItems, setClientItems] = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const fetchClientItems = useCallback(async () => {
    if (!isAdmin) return;
    setClientLoading(true);
    setClientError(null);
    const { data, error: fetchError } = await supabase
      .from("inbox_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (fetchError) {
      setClientError(fetchError.message);
      setClientItems([]);
      setClientLoading(false);
      return;
    }
    const rows = data || [];
    const ids = [...new Set(rows.map((r: any) => r.user_id).filter(Boolean))] as string[];
    let nameMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      (profiles || []).forEach((p: any) => { nameMap[p.id] = p.full_name || "—"; });
    }
    setClientItems(rows.map((r: any) => ({ ...r, full_name: nameMap[r.user_id] ?? "—" })));
    setClientLoading(false);
  }, [isAdmin]);

  // ===== Suporte (admin) =====
  const [supportRows, setSupportRows] = useState<any[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchSupport = useCallback(async () => {
    if (!isAdmin) return;
    setSupportLoading(true);
    const supabaseAny = supabase as any;
    const { data: requests, error: reqError } = await supabaseAny
      .from("support_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (reqError || !requests) {
      setSupportRows([]);
      setSupportLoading(false);
      return;
    }
    const ids = [...new Set(requests.map((r: any) => r.user_id))] as string[];
    let nameMap: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      (profiles || []).forEach((p: any) => { nameMap[p.id] = p.full_name || "—"; });
    }
    setSupportRows(requests.map((r: any) => ({ ...r, full_name: nameMap[r.user_id] ?? "—" })));
    setSupportLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchClientItems();
      fetchSupport();
    }
  }, [isAdmin, fetchClientItems, fetchSupport]);

  const markResolved = async (id: string) => {
    setResolving(id);
    const supabaseAny = supabase as any;
    await supabaseAny
      .from("support_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    setResolving(null);
    fetchSupport();
  };

  const pendingCount = supportRows.filter(r => r.status === "pending").length;

  const renderMessageCard = (item: any, i: number, displayName?: string | null) => {
    const label = intentLabels[item.type] ?? item.type;
    return (
      <div key={item.id} className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up" style={{ animationDelay: `${i * 40}ms` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-2">
            {displayName && (
              <span className="text-xs font-medium text-muted-foreground">👤 {displayName}</span>
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
          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{formatDate(item.created_at)}</span>
        </div>
      </div>
    );
  };

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
        </div>

        <Tabs defaultValue="mine" className="w-full">
          <TabsList>
            <TabsTrigger value="mine">Minhas mensagens</TabsTrigger>
            {isAdmin && <TabsTrigger value="clients">Clientes</TabsTrigger>}
            {isAdmin && (
              <TabsTrigger value="support" className="gap-2">
                Suporte
                {pendingCount > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0">{pendingCount}</Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Minhas mensagens */}
          <TabsContent value="mine" className="space-y-3 mt-4">
            <div className="flex justify-end">
              <button onClick={fetchItems} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
              </button>
            </div>
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
                Erro ao carregar mensagens: {error}
              </div>
            )}
            {loading && items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma mensagem encontrada.</p>
                <p className="text-xs mt-1 opacity-60">As mensagens enviadas pelo WhatsApp aparecerão aqui.</p>
              </div>
            ) : (
              items.map((item, i) => renderMessageCard(item, i, profile?.full_name))
            )}
          </TabsContent>

          {/* Clientes */}
          {isAdmin && (
            <TabsContent value="clients" className="space-y-3 mt-4">
              <div className="flex justify-end">
                <button onClick={fetchClientItems} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <RefreshCw className={`w-4 h-4 ${clientLoading ? "animate-spin" : ""}`} /> Atualizar
                </button>
              </div>
              {clientError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive">
                  Erro: {clientError}
                </div>
              )}
              {clientLoading && clientItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : clientItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhuma mensagem de clientes.</div>
              ) : (
                clientItems.map((item, i) => (
                  <div key={item.id} className="bg-card rounded-xl border border-border p-5 animate-slide-up" style={{ animationDelay: `${i * 30}ms` }}>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                      <UserIcon className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">{item.full_name}</span>
                    </div>
                    {renderMessageCardInner(item)}
                  </div>
                ))
              )}
            </TabsContent>
          )}

          {/* Suporte */}
          {isAdmin && (
            <TabsContent value="support" className="space-y-3 mt-4">
              <div className="flex justify-end">
                <Button size="sm" variant="outline" className="gap-2" onClick={fetchSupport}>
                  <RefreshCw className={`w-4 h-4 ${supportLoading ? "animate-spin" : ""}`} /> Atualizar
                </Button>
              </div>
              {supportLoading && supportRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : supportRows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Nenhum chamado de suporte.</div>
              ) : (
                supportRows.map((row, i) => {
                  const isPending = row.status === "pending";
                  return (
                    <div
                      key={row.id}
                      className={`rounded-xl border p-5 animate-slide-up ${isPending ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <UserIcon className="w-4 h-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">{row.full_name}</span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />{row.phone}
                            </span>
                            {isPending ? (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/50 text-orange-400">
                                <Clock className="w-2.5 h-2.5 mr-1 inline" />Pendente
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-400">
                                <CheckCircle className="w-2.5 h-2.5 mr-1 inline" />Resolvido
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-start gap-2">
                            <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                            <p className="text-sm text-foreground">{row.original_message}</p>
                          </div>
                          {isPending && (
                            <Button
                              size="sm"
                              className="gap-2 mt-2"
                              disabled={resolving === row.id}
                              onClick={() => markResolved(row.id)}
                            >
                              <CheckCircle className="w-4 h-4" />
                              {resolving === row.id ? "Resolvendo..." : "Marcar resolvido"}
                            </Button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{formatDate(row.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

function renderMessageCardInner(item: any) {
  const label = intentLabels[item.type] ?? item.type;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-2">
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
      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">{formatDate(item.created_at)}</span>
    </div>
  );
}
