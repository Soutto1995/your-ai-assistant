import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isFamilyPlan } from "@/lib/planLimits";
import {
  LayoutDashboard,
  Inbox,
  CheckSquare,
  DollarSign,
  CalendarDays,
  FolderOpen,
  Target,
  PieChart,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Search,
  LogOut,
  Gift,
  Users,
  MessagesSquare,
  HeadphonesIcon,
} from "lucide-react";

const ADMIN_EMAIL = "brunosouttoo@gmail.com";

const baseNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Inbox, label: "Inbox", path: "/inbox" },
  { icon: CheckSquare, label: "Tarefas", path: "/tarefas" },
  { icon: DollarSign, label: "Finanças", path: "/financas" },
  { icon: CalendarDays, label: "Calendário", path: "/calendario" },
  { icon: FolderOpen, label: "Projetos", path: "/projetos" },
  { icon: PieChart, label: "Orçamento", path: "/orcamento" },
  { icon: Target, label: "Metas", path: "/metas" },
  { icon: CreditCard, label: "Planos", path: "/planos" },
  { icon: Gift, label: "Indicações", path: "/indicacoes" },
];

export default function AppSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const [collapsed, setCollapsed] = useState(false);
  const [pendingSupport, setPendingSupport] = useState(0);
  const location = useLocation();
  const { profile, signOut, user } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isAdmin) return;
    const fetchPending = async () => {
      const { count } = await (supabase as any)
        .from("support_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      setPendingSupport(count ?? 0);
    };
    fetchPending();
    const timer = setInterval(fetchPending, 60_000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  const navItems = isFamilyPlan(profile?.plan)
    ? [...baseNavItems, { icon: Users, label: "Família", path: "/family" }]
    : baseNavItems;

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-display font-bold text-lg gold-text">Tuddo</span>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-3 py-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-muted-foreground text-sm">
            <Search className="w-4 h-4" />
            <span>Buscar...</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-gold-muted text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-primary" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Admin section */}
        {isAdmin && (
          <>
            {!collapsed && (
              <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Admin
              </p>
            )}
            {[
              { icon: MessagesSquare, label: "Conversas", path: "/admin/conversas", badge: 0 },
              { icon: HeadphonesIcon, label: "Suporte", path: "/admin/suporte", badge: pendingSupport },
            ].map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-gold-muted text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <div className="relative flex-shrink-0">
                    <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <span className="flex-1 flex items-center gap-2">
                      {item.label}
                      {item.badge > 0 && (
                        <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center">
                          {item.badge}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-sidebar-border px-2 py-3 space-y-2">
        {!collapsed && profile && (
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile.full_name || "Usuário"}
            </p>
            <p className="text-xs text-muted-foreground">{profile.plan}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors"
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>

      {/* Collapse */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-2 mb-4 p-2 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
