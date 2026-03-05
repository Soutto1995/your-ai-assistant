import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, Plus, Pencil, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function MemoryPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchItems = async () => {
    const { data } = await supabase.from("memory_settings").select("*").order("created_at", { ascending: false });
    setItems(data || []);
  };

  useEffect(() => {
    fetchItems();
    const channel = supabase.channel("memory-rt").on("postgres_changes", { event: "*", schema: "public", table: "memory_settings" }, fetchItems).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const addItem = async () => {
    if (!key.trim() || !value.trim() || !user) return;
    const { error } = await supabase.from("memory_settings").insert({ key: key.trim(), value: value.trim(), user_id: user.id });
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Preferência salva!");
    setKey(""); setValue(""); setOpen(false);
  };

  const saveEdit = async (id: string) => {
    await supabase.from("memory_settings").update({ value: editValue }).eq("id", id);
    toast.success("Atualizado!");
    setEditingId(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Brain className="w-8 h-8 text-primary" />Central de Memória
            </h1>
            <p className="text-muted-foreground mt-1">Configure como a IA deve se comportar.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" />Nova Preferência</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Preferência</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Chave (ex: Horários Preferenciais)" value={key} onChange={e => setKey(e.target.value)} />
                <Input placeholder="Valor (ex: Reuniões: 9h-12h)" value={value} onChange={e => setValue(e.target.value)} />
                <Button onClick={addItem} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item, i) => (
            <div key={item.id} className="bg-card rounded-xl border border-border p-5 card-glow animate-slide-up hover:border-primary/30 transition-colors" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-gold-muted flex items-center justify-center text-primary flex-shrink-0">
                  <Brain className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-semibold text-foreground mb-1">{item.key}</h3>
                  {editingId === item.id ? (
                    <div className="flex gap-2">
                      <Input value={editValue} onChange={e => setEditValue(e.target.value)} className="text-sm" />
                      <Button size="sm" onClick={() => saveEdit(item.id)}><Save className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{item.value}</p>
                  )}
                </div>
                {editingId !== item.id && (
                  <Button variant="ghost" size="sm" onClick={() => { setEditingId(item.id); setEditValue(item.value); }}>
                    <Pencil className="w-4 h-4 text-primary" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-center py-8 text-muted-foreground col-span-2">Nenhuma preferência configurada.</p>}
        </div>
      </div>
    </AppLayout>
  );
}
