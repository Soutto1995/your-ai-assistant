import { ReactNode, useState } from "react";
import AppSidebar from "./AppSidebar";
import { Menu, X } from "lucide-react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-4">
        <button onClick={() => setMobileOpen(true)} className="text-sidebar-foreground">
          <Menu className="w-6 h-6" />
        </button>
        <span className="ml-3 font-display font-bold text-lg gold-text">Tuddo</span>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 w-60 h-full">
            <AppSidebar onNavigate={() => setMobileOpen(false)} />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-[-40px] text-foreground bg-card rounded-full p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      <main className="pt-14 md:pt-0 md:ml-60 min-h-screen p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
