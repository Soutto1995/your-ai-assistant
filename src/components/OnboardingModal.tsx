import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Play, X } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onStartTutorial: () => void;
  onSkip: () => void;
}

const VIDEO_URL = "https://www.youtube.com/embed/dQw4w9WgXcQ"; // placeholder

export default function OnboardingModal({ open, onStartTutorial, onSkip }: OnboardingModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onSkip()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden gap-0">
        <div className="relative w-full aspect-video bg-secondary">
          <iframe
            src={VIDEO_URL}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Como usar o Tuddo"
          />
        </div>
        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">
              Bem-vindo ao <span className="gold-text">Tuddo</span>! 🎉
            </DialogTitle>
            <DialogDescription>
              Organize finanças, tarefas e compromissos apenas conversando pelo WhatsApp.
              Vamos te guiar nos primeiros passos!
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button onClick={onStartTutorial} className="flex-1 gap-2">
              <Play className="w-4 h-4" /> Começar Tutorial
            </Button>
            <Button variant="ghost" onClick={onSkip} className="text-muted-foreground">
              Pular
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
