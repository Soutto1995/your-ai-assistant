import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";

const ADMIN_EMAIL = "brunosouttoo@gmail.com";
const PAGE_SIZE = 30;

const INTENT_COLORS: Record<string, string> = {
  create_transaction: "bg-green-900/50 text-green-300 border-green-700",
  create_task: "bg-blue-900/50 text-blue-300 border-blue-700",
  create_meeting: "bg-purple-900/50 text-purple-300 border-purple-700",
  create_multiple_meetings: "bg-violet-900/50 text-violet-300 border-violet-700",
  list_items: "bg-slate-700/50 text-slate-300 border-slate-600",
  create_goal: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  list_goals: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  create_budget: "bg-orange-900/50 text-orange-300 border-orange-700",
  create_folder: "bg-pink-900/50 text-pink-300 border-pink-700",
  list_folders: "bg-pink-900/50 text-pink-300 border-pink-700",
  assign_folder: "bg-pink-900/50 text-pink-300 border-pink-700",
  general_query: "bg-slate-800/50 text-slate-400 border-slate-700",
};

type Row = {
  id: string;
  user_id: string;
  message: string;
  type: string;
  response: string | null;
  source: string;
  created_at: string;
  full_name: string | null;
};

export default function ConversasPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (user && user.email !== ADMIN_EMAIL) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const fetch = useCallback(async () => {
    if (!user || user.email !== ADMIN_EMAIL) return;
    setLoading(true);

    // Fetch inbox_messages with profile join via separate query
    let query = supabase
      .from("inbox_messages")
      .select("id, user_id, message, type, response, source, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (filterDate) {
      query = query
        .gte("created_at", `${filterDate}T00:00:00`)
        .lte("created_at", `${filterDate}T23:59:59`);
    }

    const { data: msgs, count, error } = await query;
    if (error) { setLoading(false); return; }

    setTotal(count ?? 0);

    if (!msgs || msgs.length === 0) { setRows([]); setLoading(false); return; }

    // Fetch profile names for these user_ids
    const userIds = [...new Set(msgs.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);

    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p) => { nameMap[p.id] = p.full_name || "—"; });

    let combined: Row[] = msgs.map((m) => ({ ...m, full_name: nameMap[m.user_id] ?? "—" }));

    // Filter by user name client-side (simple)
    if (filterUser.trim()) {
      const q = filterUser.trim().toLowerCase();
      combined = combined.filter((r) =>
        (r.full_name ?? "").toLowerCase().includes(q) || r.user_id.includes(q)
      );
    }

    setRows(combined);
    setLoading(false);
  }, [user, page, filterDate, filterUser]);

  useEffect(() => { fetch(); }, [fetch]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [filterUser, filterDate]);

  if (!user || user.email !== ADMIN_EMAIL) return null;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">
              Conversas
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {total.toLocaleString("pt-BR")} mensagens no total
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-2 self-start" onClick={fetch}>
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Filtrar por usuário..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="sm:max-w-xs"
          />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="sm:max-w-[180px]"
          />
          {(filterUser || filterDate) && (
            <Button size="sm" variant="ghost" onClick={() => { setFilterUser(""); setFilterDate(""); }}>
              Limpar
            </Button>
          )}
        </div>

        {/* Tabela */}
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Data/hora</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Usuário</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Mensagem</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Intent</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Resposta</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhuma conversa encontrada.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isExpanded = expanded === row.id;
                  const dt = new Date(row.created_at);
                  const dateStr = dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
                  const timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                  const intentColor = INTENT_COLORS[row.type] ?? "bg-slate-700/50 text-slate-300 border-slate-600";
                  const truncate = (s: string | null, n: number) =>
                    s && s.length > n ? s.slice(0, n) + "…" : s ?? "—";

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setExpanded(isExpanded ? null : row.id)}
                      className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                        {dateStr}<br />{timeStr}
                      </td>
                      <td className="px-3 py-2.5 max-w-[120px]">
                        <span className="text-xs font-medium text-foreground">
                          {truncate(row.full_name, 20)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 max-w-[240px]">
                        <span className={`text-xs ${isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
                          {isExpanded ? row.message : truncate(row.message, 120)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${intentColor}`}>
                          {row.type.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 max-w-[280px]">
                        <span className={`text-xs text-muted-foreground ${isExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}`}>
                          {isExpanded ? (row.response ?? "—") : truncate(row.response, 120)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
