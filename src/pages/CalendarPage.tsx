import { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Plus, Trash2, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function MeetingsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [participants, setParticipants] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchMeetings = async () => {
    const { data } = await supabase.from("meetings").select("*").order("created_at", { ascending: false });
    setMeetings(data || []);
  };

  useEffect(() => {
    fetchMeetings();
    const channel = supabase.channel("meetings-rt").on("postgres_changes", { event: "*", schema: "public", table: "meetings" }, fetchMeetings).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const addMeeting = async () => {
    if (!title.trim() || !user) return;
    const { error } = await supabase.from("meetings").insert({
      title: title.trim(), meeting_date: meetingDate || null,
      participants: participants ? Number(participants) : 0, user_id: user.id,
    });
    if (error) { toast.error("Erro ao criar reunião"); return; }
    toast.success("Reunião criada!");
    setTitle(""); setMeetingDate(""); setParticipants(""); setOpen(false);
  };

  const completeMeeting = async (id: string) => {
    await supabase.from("meetings").update({ status: "concluída" }).eq("id", id);
    toast.success("Reunião concluída!");
  };

  const deleteMeeting = async (id: string) => {
    await supabase.from("meetings").delete().eq("id", id);
    toast.success("Reunião removida!");
  };

  const meetingsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    meetings.forEach(m => {
      if (m.meeting_date) {
        const key = new Date(m.meeting_date).toISOString().slice(0, 10);
        (map[key] ||= []).push(m);
      }
    });
    return map;
  }, [meetings]);

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

  const selectedMeetings = selectedDate ? meetingsByDate[selectedDate] || [] : [];

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Users className="w-6 h-6 md:w-8 md:h-8 text-primary" />Reuniões
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">Gerencie suas reuniões.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-2 self-start"><Plus className="w-4 h-4" />Nova Reunião</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Reunião</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
                <Input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
                <Input type="number" placeholder="Participantes" value={participants} onChange={e => setParticipants(e.target.value)} />
                <Button onClick={addMeeting} className="w-full">Criar Reunião</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Calendar */}
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
                const hasMeetings = !!meetingsByDate[dateStr];
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
                    {hasMeetings && (
                      <span className="absolute bottom-0.5 md:bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side panel */}
          <div className="bg-card rounded-xl border border-border p-4 md:p-5 space-y-4">
            <h2 className="font-display font-semibold text-foreground text-sm md:text-base">
              {selectedDate ? new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : "Selecione uma data"}
            </h2>
            {selectedDate && selectedMeetings.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma reunião nesta data.</p>
            )}
            {selectedMeetings.map(meeting => (
              <div key={meeting.id} className="p-3 rounded-lg border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{meeting.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meeting.status === "concluída" ? "bg-success/20 text-success" : "bg-info/20 text-info"}`}>
                    {meeting.status}
                  </span>
                </div>
                {meeting.meeting_date && (
                  <p className="text-xs text-muted-foreground">📅 {new Date(meeting.meeting_date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                )}
                <p className="text-xs text-muted-foreground">👥 {meeting.participants} participantes</p>
                <div className="flex gap-1 pt-1">
                  {meeting.status === "agendada" && (
                    <Button variant="outline" size="sm" onClick={() => completeMeeting(meeting.id)}><Check className="w-3 h-3" /></Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => deleteMeeting(meeting.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                </div>
              </div>
            ))}
            {!selectedDate && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Próximas reuniões:</p>
                {meetings.filter(m => m.status === "agendada").slice(0, 5).map(m => (
                  <div key={m.id} className="p-3 rounded-lg border border-border">
                    <p className="text-sm font-medium text-foreground">{m.title}</p>
                    {m.meeting_date && <p className="text-xs text-muted-foreground">{new Date(m.meeting_date).toLocaleDateString("pt-BR")}</p>}
                  </div>
                ))}
                {meetings.filter(m => m.status === "agendada").length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma reunião agendada.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
