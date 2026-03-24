import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Gift, Copy, Check, Users, Crown, ChevronRight,
  UserPlus, CreditCard, PartyPopper,
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Link criado", color: "bg-muted text-muted-foreground", icon: <UserPlus className="w-3 h-3" /> },
  cadastrado: { label: "Cadastrado", color: "bg-secondary text-secondary-foreground", icon: <Users className="w-3 h-3" /> },
  pago: { label: "Pagou", color: "bg-primary/20 text-primary", icon: <CreditCard className="w-3 h-3" /> },
  recompensado: { label: "Recompensa aplicada", color: "bg-green-500/20 text-green-400", icon: <PartyPopper className="w-3 h-3" /> },
};

function generateCode(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export default function ReferralsPage() {
  const { session, profile, loading } = useAuth();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const plan = (profile?.plan || "FREE").toUpperCase();
  const isPaid = plan === "STARTER" || plan === "PRO";

  useEffect(() => {
    if (!session?.user?.id || !isPaid) {
      setLoadingData(false);
      return;
    }

    const userId = session.user.id;
    const code = generateCode(userId);
    setReferralCode(code);

    const fetchReferrals = async () => {
      // Ensure referral code exists
      const { data: existing } = await supabase
        .from("referrals")
        .select("id")
        .eq("referrer_id", userId)
        .eq("referral_code", code)
        .eq("status", "pendente")
        .is("referred_id", null)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("referrals").insert({
          referrer_id: userId,
          referral_code: code,
          status: "pendente",
        } as any);
      }

      // Fetch all referrals for this user
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false });

      setReferrals(data || []);
      setLoadingData(false);
    };

    fetchReferrals();
  }, [session?.user?.id, isPaid]);

  if (loading || loadingData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 rounded-lg gold-gradient animate-pulse" />
        </div>
      </AppLayout>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Free users see upgrade CTA
  if (!isPaid) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto text-center space-y-6 py-16">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Programa de Indicações
          </h1>
          <p className="text-muted-foreground">
            Indique amigos e ganhe meses grátis! Para participar, você precisa ser assinante de um plano pago.
          </p>
          <Button asChild className="gap-2">
            <Link to="/planos">
              <Crown className="w-4 h-4" /> Fazer Upgrade <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const referralLink = `tuddo.lovable.app/signup?ref=${referralCode}`;
  const rewardedCount = referrals.filter((r) => r.status === "recompensado").length;
  const referredReferrals = referrals.filter((r) => r.referred_id);

  const handleCopy = () => {
    navigator.clipboard.writeText(`https://${referralLink}`);
    setCopied(true);
    toast({ title: "Link copiado!", description: "Compartilhe com seus amigos." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Gift className="w-6 h-6 text-primary" /> Indicações
          </h1>
          <p className="text-muted-foreground mt-1">
            Indique amigos e ganhe meses grátis do seu plano!
          </p>
        </div>

        {/* Referral link card */}
        <Card className="p-6 border-primary/30 bg-primary/5 space-y-4">
          <h3 className="font-semibold text-foreground">Seu link de indicação</h3>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-2.5 bg-secondary rounded-lg text-sm text-foreground font-mono truncate">
              {referralLink}
            </div>
            <Button onClick={handleCopy} size="sm" className="gap-1.5 flex-shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Compartilhe este link. Quando seu amigo assinar um plano pago, você ganha 1 mês grátis!
          </p>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center">
            <p className="text-2xl font-display font-bold text-foreground">{referredReferrals.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Indicados</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-display font-bold text-primary">{rewardedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Meses ganhos</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-display font-bold text-foreground">
              R$ {(rewardedCount * (plan === "PRO" ? 24.9 : 12.9)).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Economia total</p>
          </Card>
        </div>

        {/* Referral list */}
        <Card className="p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Seus indicados
          </h3>
          {referredReferrals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum indicado ainda. Compartilhe seu link para começar!
            </p>
          ) : (
            <div className="space-y-3">
              {referredReferrals.map((ref) => {
                const st = STATUS_MAP[ref.status] || STATUS_MAP.pendente;
                return (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-foreground">
                          {ref.referred_id ? "Amigo indicado" : "Aguardando"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ref.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${st.color} gap-1`}>
                      {st.icon} {st.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Rules */}
        <Card className="p-6 bg-secondary/50">
          <h3 className="font-semibold text-foreground mb-3">Como funciona</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
              <p>Compartilhe seu link de indicação com amigos.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
              <p>Seu amigo se cadastra usando o seu link.</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
              <p>Quando seu amigo fizer o primeiro pagamento de um plano pago, você ganha <strong className="text-foreground">1 mês grátis</strong> do seu plano atual!</p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-card border border-border text-xs text-muted-foreground">
            <strong className="text-foreground">Regras:</strong> Apenas assinantes pagos podem participar.
            A recompensa é aplicada automaticamente ao seu plano após o pagamento do indicado.
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
