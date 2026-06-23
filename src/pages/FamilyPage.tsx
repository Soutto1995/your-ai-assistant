import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserPlus, Trash2, Crown, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isFamilyPlan, getPlanLabel } from "@/lib/planLimits";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Member {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  joined_at: string;
}

interface FamilyGroup {
  id: string;
  owner_id: string;
  plan: string;
  max_members: number;
}

export default function FamilyPage() {
  const { user, profile } = useAuth();
  const [family, setFamily] = useState<FamilyGroup | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState("");
  const [inviting, setInviting] = useState(false);

  const isOwner = !!user && !!family && family.owner_id === user.id;
  const hasFamilyPlan = isFamilyPlan(profile?.plan);

  const loadFamily = async () => {
    if (!user) return;
    setLoading(true);
    let { data: owned } = await supabase
      .from("family_groups")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    let group: FamilyGroup | null = owned as any;

    if (!group) {
      const { data: membership } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (membership?.family_id) {
        const { data: g } = await supabase
          .from("family_groups")
          .select("*")
          .eq("id", membership.family_id)
          .maybeSingle();
        group = g as any;
      }
    }

    // Auto-create group for the owner of a family plan
    if (!group && hasFamilyPlan) {
      const maxByPlan: Record<string, number> = { FAMILY_2: 2, FAMILY_3: 3, FAMILY_4: 4 };
      const plan = (profile!.plan || "FAMILY_2").toUpperCase();
      const { data: created } = await supabase
        .from("family_groups")
        .insert({ owner_id: user.id, plan, max_members: maxByPlan[plan] ?? 2 })
        .select("*")
        .single();
      group = created as any;
      if (group) {
        await supabase
          .from("family_members")
          .insert({ family_id: group.id, user_id: user.id, role: "owner" });
      }
    }

    setFamily(group);

    if (group) {
      const { data: m, error } = await supabase.rpc("get_family_members", { p_family_id: group.id });
      if (!error) setMembers((m as any[]) ?? []);
    } else {
      setMembers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadFamily();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.plan]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!family || !contact.trim()) return;
    setInviting(true);
    const { data, error } = await supabase.rpc("invite_family_member", {
      p_family_id: family.id,
      p_contact: contact.trim(),
    });
    setInviting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as any;
    if (result?.status === "added") {
      toast.success("Membro adicionado à família!");
      setContact("");
      loadFamily();
    } else if (result?.status === "already_member") {
      toast.info("Este usuário já é membro da sua família.");
    } else if (result?.status === "full") {
      toast.error("Sua família atingiu o limite de membros do plano.");
    } else if (result?.status === "not_found") {
      toast.error("Usuário não encontrado. Peça para ele se cadastrar primeiro em tuddo.pro");
    }
  };

  const handleRemove = async (memberUserId: string) => {
    if (!family) return;
    if (memberUserId === family.owner_id) {
      toast.error("Não é possível remover o titular.");
      return;
    }
    if (!confirm("Remover este membro da família?")) return;
    const { error } = await supabase
      .from("family_members")
      .delete()
      .eq("family_id", family.id)
      .eq("user_id", memberUserId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Membro removido.");
      loadFamily();
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!family) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto text-center space-y-4 py-12">
          <Users className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-display font-bold">Você ainda não tem um plano Familiar</h1>
          <p className="text-muted-foreground">
            Os planos familiares permitem compartilhar finanças e tarefas com até 4 pessoas.
          </p>
          <Link to="/pricing">
            <Button>Ver planos familiares</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const spotsLeft = family.max_members - members.length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" />
              Minha Família
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Plano <span className="text-primary font-semibold">{getPlanLabel(family.plan)}</span> · {members.length}/{family.max_members} membros · {spotsLeft} {spotsLeft === 1 ? "vaga" : "vagas"} restante{spotsLeft === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary" />
                Convidar membro
              </CardTitle>
              <CardDescription>
                Digite o e-mail ou telefone (com DDD) de alguém já cadastrado em tuddo.pro.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="contact" className="sr-only">E-mail ou telefone</Label>
                  <Input
                    id="contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="email@exemplo.com ou (47) 99999-9999"
                    disabled={inviting || spotsLeft <= 0}
                  />
                </div>
                <Button type="submit" disabled={inviting || !contact.trim() || spotsLeft <= 0}>
                  {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Convidar"}
                </Button>
              </form>
              {spotsLeft <= 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Limite de membros atingido. Faça upgrade do plano para adicionar mais pessoas.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Membros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    {m.role === "owner" ? <Crown className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {m.full_name || m.email || "Sem nome"}
                      {m.role === "owner" && <span className="ml-2 text-xs text-primary font-semibold">(Titular)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.phone || m.email || "—"} · entrou em {new Date(m.joined_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                {isOwner && m.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemove(m.user_id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum membro ainda. Convide alguém acima!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
