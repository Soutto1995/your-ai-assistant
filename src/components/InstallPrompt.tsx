import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    const dismissed = localStorage.getItem("tuddo-install-dismissed");
    if (dismissed) return;

    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      setShowBanner(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("tuddo-install-dismissed", "true");
  };

  if (isStandalone || !showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-card border-t border-border p-4 shadow-lg animate-in slide-in-from-bottom">
      <div className="max-w-lg mx-auto flex items-center gap-3">
        <div className="flex-1">
          {isIOS ? (
            <p className="text-sm text-foreground">
              Instale o <strong>Tuddo</strong>: toque em{" "}
              <Share className="inline w-4 h-4 text-primary" /> e depois em{" "}
              <em>"Adicionar à Tela de Início"</em>.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Instalar Tuddo</p>
              <p className="text-xs text-muted-foreground">Acesse rápido pela tela inicial</p>
            </>
          )}
        </div>

        {!isIOS && (
          <Button size="sm" onClick={handleInstall} className="gap-1.5">
            <Download className="w-4 h-4" />
            Instalar
          </Button>
        )}

        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
