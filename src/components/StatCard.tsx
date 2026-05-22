import { ReactNode } from "react";

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  onClick?: () => void;
}

export default function StatCard({ icon, label, value, change, positive, onClick }: StatCardProps) {
  const isClickable = !!onClick;
  const Comp: any = isClickable ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      type={isClickable ? "button" : undefined}
      className={`text-left w-full bg-card rounded-xl p-5 border border-border card-glow animate-fade-in ${
        isClickable ? "cursor-pointer hover:scale-105 transition-transform hover:border-primary/40" : ""
      }`}
    >
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
    </Comp>
  );
}
