import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Users, Play, FileText, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

const statusStyle: Record<string, string> = {
  agendada: "bg-info/20 text-info",
  concluída: "bg-success/20 text-success",
};

export default function MeetingsPage() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [participants, setParticipants] = useState("");

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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />Reuniões
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie suas reuniões.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Nova Reunião</Button></DialogTrigger>
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

        <div className="space-y-4">
          {meetings.map((meeting, i) => (
            <div key={meeting.id} className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display font-semibold text-foreground">{meeting.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle[meeting.status] || ""}`}>{meeting.status}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {meeting.meeting_date && <span>📅 {new Date(meeting.meeting_date).toLocaleString("pt-BR")}</span>}
                    <span>👥 {meeting.participants} participantes</span>
                  </div>
                  {meeting.summary && (
                    <div className="mt-3 pl-3 border-l-2 border-primary/30">
                      <p className="text-sm text-muted-foreground">{meeting.summary}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {meeting.status === "agendada" && (
                    <Button variant="outline" size="sm" onClick={() => completeMeeting(meeting.id)}><Check className="w-4 h-4" /></Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => deleteMeeting(meeting.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
          {meetings.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhuma reunião encontrada.</p>}
        </div>
      </div>
    </AppLayout>
  );
}
