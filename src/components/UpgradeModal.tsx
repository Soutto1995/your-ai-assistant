import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  currentPlan: string;
  limit: number | string;
  requiredPlan?: string;
}

export default function UpgradeModal({ open, onOpenChange, feature, currentPlan, limit, requiredPlan = "STARTER" }: UpgradeModalProps) {
  const navigate = useNavigate();

  const planLabel = currentPlan === "FREE" ? "Grátis" : currentPlan === "STARTER" ? "Starter" : "Pro";
  const targetLabel = requiredPlan === "PRO" ? "Pro" : "Starter";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Limite atingido!</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Seu plano <span className="font-semibold text-foreground">{planLabel}</span> permite{" "}
            {typeof limit === "number" && limit === 0 
              ? `nenhum ${feature}` 
              : `até ${limit} ${feature}`
            }.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">Plano {targetLabel}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {requiredPlan === "PRO"
                ? "Desbloqueie acesso ilimitado a todas as funcionalidades!"
                : "Aumente seus limites e desbloqueie novas funcionalidades!"
              }
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button className="flex-1 gap-2" onClick={() => { onOpenChange(false); navigate("/pricing"); }}>
              <Crown className="w-4 h-4" />
              Fazer Upgrade
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
