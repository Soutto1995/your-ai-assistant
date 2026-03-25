import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Crown, Zap } from "lucide-react";

export default function SuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const plan = searchParams.get("plan") || "starter";

  const planLabel = plan.toUpperCase() === "PRO" ? "PRO" : "Starter";
  const PlanIcon = plan.toUpperCase() === "PRO" ? Crown : Zap;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full text-center border-primary/20">
        <CardContent className="pt-10 pb-8 space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold text-foreground">
              Parabéns! 🎉
            </h1>
            <p className="text-muted-foreground">
              Sua assinatura foi ativada com sucesso!
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 bg-primary/5 rounded-xl py-3 px-4">
            <PlanIcon className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">
              Plano {planLabel}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Agora você tem acesso a todos os recursos do plano {planLabel}.
            Aproveite sua jornada para a paz financeira!
          </p>

          <Button className="w-full" onClick={() => navigate("/dashboard")}>
            Ir para o Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
