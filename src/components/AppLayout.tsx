import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-60 min-h-screen p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
