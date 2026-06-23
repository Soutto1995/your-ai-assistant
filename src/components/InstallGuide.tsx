import { Apple, Smartphone, Share, MoreVertical, PlusSquare, Check } from "lucide-react";

const iosSteps = [
  { icon: Smartphone, text: "Abra o site tuddo.pro no Safari" },
  { icon: Share, text: "Toque no botão de compartilhar (ícone de quadrado com seta para cima)" },
  { icon: PlusSquare, text: 'Role para baixo e toque em "Adicionar à Tela de Início"' },
  { icon: Check, text: 'Confirme tocando em "Adicionar"' },
];

const androidSteps = [
  { icon: Smartphone, text: "Abra o site tuddo.pro no Chrome" },
  { icon: MoreVertical, text: "Toque nos 3 pontinhos (menu) no canto superior direito" },
  { icon: PlusSquare, text: 'Toque em "Adicionar à tela inicial"' },
  { icon: Check, text: 'Confirme tocando em "Adicionar"' },
];

function StepList({ title, icon: Icon, steps }: { title: string; icon: any; steps: typeof iosSteps }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-display font-semibold text-base">{title}</h3>
      </div>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 flex items-start gap-2">
              <s.icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-sm text-foreground leading-relaxed">{s.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function InstallGuide() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <StepList title="No iPhone (iOS)" icon={Apple} steps={iosSteps} />
      <StepList title="No Android" icon={Smartphone} steps={androidSteps} />
    </div>
  );
}
