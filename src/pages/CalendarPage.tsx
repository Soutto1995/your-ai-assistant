import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import UpgradeModal from "@/components/UpgradeModal";
import { CalendarDays, Plus, Trash2, Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const CATEGORIES = ["compromisso", "reunião", "consulta", "pessoal", "trabalho", "outro"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { plan, limits } = usePlanLimits();
  const [events, setEvents] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [category, setCategory] = useState("compromisso");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchEvents = async () => {
    const { data } = await supabase.from("events" as any).select("*").order("created_at", { ascending: false });
    setEvents((data as any[]) || []);
  };

  useEffect(() => {
    fetchEvents();
    const channel = supabase.channel("events-rt").on("postgres_changes", { event: "*", schema: "public", table: "events" }, fetchEvents).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Filter events by history limit
  const visibleEvents = useMemo(() => {
    if (limits.historyMonths === Infinity) return events;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - limits.historyMonths);
    return events.filter(e => {
      const d = e.event_date || e.legacy_meeting_date;
      if (!d) return true;
      return new Date(d) >= cutoff;
    });
  }, [events, limits.historyMonths]);

  // Count reminders this month
  const remindersThisMonth = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return events.filter(e => new Date(e.created_at) >= monthStart).length;
  }, [events]);

  const canAddEvent = limits.remindersPerMonth === Infinity || limits.remindersPerMonth === 0 || remindersThisMonth < limits.remindersPerMonth;

  const addEvent = async () => {
    if (!title.trim() || !user) return;
    const { error } = await supabase.from("events" as any).insert({
      title: title.trim(),
      event_date: eventDate || null,
      event_time: eventTime || null,
      category,
      user_id: user.id,
    });
    if (error) { toast.error("Erro ao criar evento"); return; }
    toast.success("Evento criado!");
    setTitle(""); setEventDate(""); setEventTime(""); setCategory("compromisso"); setOpen(false);
  };

  const completeEvent = async (id: string) => {
    await supabase.from("events" as any).update({ status: "concluída" }).eq("id", id);
    toast.success("Evento concluído!");
  };

  const deleteEvent = async (id: string) => {
    await supabase.from("events" as any).delete().eq("id", id);
    toast.success("Evento removido!");
  };

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    visibleEvents.forEach(e => {
      const dateKey = e.event_date || (e.legacy_meeting_date ? new Date(e.legacy_meeting_date).toISOString().slice(0, 10) : null);
      if (dateKey) {
        const key = dateKey.slice(0, 10);
        (map[key] ||= []).push(e);
      }
    });
    return map;
  }, [visibleEvents]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);
  const today = new Date().toISOString().slice(0, 10);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <CalendarDays className="w-6 h-6 md:w-8 md:h-8 text-primary" />Calendário
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Gerencie seus eventos e compromissos.
              {limits.historyMonths !== Infinity && (
                <span className="ml-2 text-xs text-primary">(Histórico: {limits.historyMonths} meses)</span>
              )}
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 self-start">
                <Plus className="w-4 h-4" />Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Evento</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Título do evento" value={title} onChange={e => setTitle(e.target.value)} />
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                <Input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addEvent} className="w-full">Criar Evento</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 bg-card rounded-xl border border-border p-3 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-5 h-5" /></Button>
              <h2 className="font-display font-semibold text-foreground text-sm md:text-base">{MONTHS[currentMonth]} {currentYear}</h2>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-5 h-5" /></Button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1 md:py-2">{d}</div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hasEvents = !!eventsByDate[dateStr];
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                    className={`relative h-8 md:h-10 rounded-lg text-xs md:text-sm transition-colors
                      ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-accent/20 text-accent-foreground" : "hover:bg-secondary text-foreground"}
                    `}
                  >
                    {day}
                    {hasEvents && (
                      <span className="absolute bottom-0.5 md:bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-4 md:p-5 space-y-4">
            <h2 className="font-display font-semibold text-foreground text-sm md:text-base">
              {selectedDate ? new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : "Selecione uma data"}
            </h2>
            {selectedDate && selectedEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum evento nesta data.</p>
            )}
            {selectedEvents.map(event => (
              <div key={event.id} className="p-3 rounded-lg border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{event.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${event.status === "concluída" ? "bg-success/20 text-success" : "bg-info/20 text-info"}`}>
                    {event.status}
                  </span>
                </div>
                {event.event_time && (
                  <p className="text-xs text-muted-foreground">🕐 {String(event.event_time).slice(0, 5)}</p>
                )}
                {event.category && (
                  <p className="text-xs text-muted-foreground">📌 {event.category}</p>
                )}
                <div className="flex gap-1 pt-1">
                  {event.status === "agendada" && (
                    <Button variant="outline" size="sm" onClick={() => completeEvent(event.id)}><Check className="w-3 h-3" /></Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => deleteEvent(event.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {!selectedDate && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Próximos eventos:</p>
                {visibleEvents.filter(e => e.status === "agendada").slice(0, 5).map(e => (
                  <div key={e.id} className="p-3 rounded-lg border border-border">
                    <p className="text-sm font-medium text-foreground">{e.title}</p>
                    {e.event_date && <p className="text-xs text-muted-foreground">{new Date(e.event_date + "T12:00:00").toLocaleDateString("pt-BR")}</p>}
                    {e.category && <p className="text-xs text-muted-foreground">📌 {e.category}</p>}
                  </div>
                ))}
                {visibleEvents.filter(e => e.status === "agendada").length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum evento agendado.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <UpgradeModal open={upgradeOpen} onOpenChange={setUpgradeOpen} feature="lembretes/mês" currentPlan={plan} limit={limits.remindersPerMonth} requiredPlan="PRO" />
    </AppLayout>
  );
}
