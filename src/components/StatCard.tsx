import { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
}

export default function StatCard({ icon, label, value, change, positive }: StatCardProps) {
  return (
    <div className="bg-card rounded-xl p-5 border border-border card-glow animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-muted-foreground text-sm">{label}</span>
        <div className="w-9 h-9 rounded-lg bg-gold-muted flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-display font-bold text-foreground">{value}</p>
      {change && (
        <p className={`text-xs mt-1 ${positive ? "text-success" : "text-destructive"}`}>
          {change}
        </p>
      )}
    </div>
  );
}
