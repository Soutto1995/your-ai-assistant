import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, AlertTriangle, Clock, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PLAN_PRICES: Record<string, number> = {
  STARTER: 12.9,
  PRO: 24.9,
};

export default function RefundPage() {
  const { session, profile, loading } = useAuth();
  const { toast } = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [subscriptionDate, setSubscriptionDate] = useState<Date | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profiles")
      .select("subscription_date")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data?.subscription_date) {
          setSubscriptionDate(new Date(data.subscription_date));
        }
        setLoadingData(false);
      });
  }, [session?.user?.id]);

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

  const plan = profile?.plan?.toUpperCase() || "FREE";
  if (plan === "FREE") return <Navigate to="/dashboard" replace />;

  const daysSincePurchase = subscriptionDate
    ? Math.floor((Date.now() - subscriptionDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const isEligible = daysSincePurchase !== null && daysSincePurchase <= 7;
  const refundAmount = PLAN_PRICES[plan] || 0;

  const handleRefund = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-refund", {
        body: { user_id: session.user.id },
      });
      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao processar reembolso");
      }
      toast({
        title: "Reembolso processado!",
        description: `R$ ${refundAmount.toFixed(2)} será devolvido em até 10 dias úteis.`,
      });
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Não foi possível processar o reembolso.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setShowConfirm(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitar Reembolso</h1>
          <p className="text-muted-foreground mt-1">
            Conforme o CDC Art. 49, você tem direito ao arrependimento em até 7 dias.
          </p>
        </div>

        {/* Info Card */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plano atual</p>
              <Badge variant="secondary" className="mt-0.5">{plan}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-secondary">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Clock className="w-4 h-4" />
                Data de compra
              </div>
              <p className="text-foreground font-medium">
                {subscriptionDate
                  ? subscriptionDate.toLocaleDateString("pt-BR")
                  : "Não disponível"}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-secondary">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Clock className="w-4 h-4" />
                Dias desde a compra
              </div>
              <p className="text-foreground font-medium">
                {daysSincePurchase !== null ? `${daysSincePurchase} dias` : "—"}
              </p>
            </div>
          </div>
        </Card>

        {/* Refund Status */}
        {isEligible ? (
          <Card className="p-6 border-primary/30 bg-primary/5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  Você está dentro do prazo de 7 dias
                </h3>
                <p className="text-sm text-muted-foreground">
                  Conforme o Código de Defesa do Consumidor (Art. 49), você tem direito a 
                  reembolso total de <strong className="text-foreground">R$ {refundAmount.toFixed(2)}</strong>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Restam {7 - daysSincePurchase!} dias para solicitar.
                </p>
              </div>
            </div>
            <Button
              className="w-full mt-4"
              variant="destructive"
              onClick={() => setShowConfirm(true)}
              disabled={processing}
            >
              Confirmar e Solicitar Reembolso
            </Button>
          </Card>
        ) : (
          <Card className="p-6 border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="font-semibold text-foreground">
                  Prazo de reembolso expirado
                </h3>
                <p className="text-sm text-muted-foreground">
                  {subscriptionDate
                    ? "Você já passou do período de 7 dias para solicitar reembolso. Conforme a Lei do Consumidor Brasileiro, reembolsos só são permitidos nos primeiros 7 dias."
                    : "Não encontramos a data da sua assinatura. Entre em contato com suporte@tuddo.pro para assistência."}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Legal info */}
        <Card className="p-6 bg-secondary/50">
          <h3 className="font-semibold text-foreground mb-2">Política de Reembolso</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              De acordo com o Código de Defesa do Consumidor (CDC), Art. 49, o consumidor tem 
              o direito de desistir da compra realizada pela internet no prazo de <strong className="text-foreground">7 (sete) dias corridos</strong> a 
              contar da data da assinatura.
            </p>
            <p>
              O reembolso é de 100% do valor pago e será processado automaticamente via Stripe. 
              O valor será devolvido ao método de pagamento original em até 10 dias úteis.
            </p>
            <p>
              Após o período de 7 dias, nenhum reembolso será concedido, conforme previsto em lei.
            </p>
            <p className="text-xs">
              Dúvidas? Entre em contato: <a href="mailto:suporte@tuddo.pro" className="text-primary hover:underline">suporte@tuddo.pro</a>
            </p>
          </div>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reembolso</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza? Sua assinatura será cancelada e você perderá acesso aos 
              recursos pagos. Esta ação é irreversível.
              <br /><br />
              Valor do reembolso: <strong>R$ {refundAmount.toFixed(2)}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefund}
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? "Processando..." : "Sim, quero o reembolso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
