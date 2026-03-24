import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  Zap,
  Crown,
  DollarSign,
  CheckSquare,
  Calendar,
  MessageCircle,
  Send,
  Menu,
  X,
  Star,
  ChevronRight,
  Coffee,
  TrendingUp,
  Lock,
  ShieldCheck,
  Flame,
  Clock,
} from "lucide-react";

/* ── Plan data ── */
const STRIPE_LINK_STARTER_MONTHLY = 'https://buy.stripe.com/test_3cIdRagEv05v34p82HbMQ00';
const STRIPE_LINK_STARTER_YEARLY = 'https://buy.stripe.com/test_5kQ6oI3RJcSh6gB1EjbMQ01';
const STRIPE_LINK_PRO_MONTHLY = 'https://buy.stripe.com/test_14AeVe87Z2dDcEZ0AfbMQ02';
const STRIPE_LINK_PRO_YEARLY = 'https://buy.stripe.com/test_dRm8wQ0Fxg4t48t82HbMQ03';

const plans = [
  {
    name: "GRÁTIS",
    icon: <Check className="w-6 h-6" />,
    monthlyLabel: "R$ 0",
    annualLabel: "R$ 0",
    annualMonthly: "",
    limit: "5 mensagens/dia",
    features: ["5 mensagens por dia", "Tarefas básicas", "Registro de gastos", "Agenda de reuniões"],
    cta: "Começar agora",
    highlight: false,
    monthly: 0,
    stripeMonthly: "",
    stripeYearly: "",
  },
  {
    name: "STARTER",
    icon: <Zap className="w-6 h-6" />,
    monthlyLabel: "R$ 12,90/mês",
    annualLabel: "R$ 123,90/ano",
    annualMonthly: "R$ 10,33/mês",
    dailyCost: "R$ 0,43",
    limit: "50 mensagens/dia",
    features: ["50 mensagens por dia", "Tudo do plano Grátis", "Prioridade no suporte", "Relatórios semanais"],
    cta: "Quero o Plano Starter",
    highlight: true,
    monthly: 12.9,
    stripeMonthly: STRIPE_LINK_STARTER_MONTHLY,
    stripeYearly: STRIPE_LINK_STARTER_YEARLY,
  },
  {
    name: "PRO",
    icon: <Crown className="w-6 h-6" />,
    monthlyLabel: "R$ 24,90/mês",
    annualLabel: "R$ 239,90/ano",
    annualMonthly: "R$ 19,99/mês",
    dailyCost: "R$ 0,83",
    limit: "Mensagens ilimitadas",
    features: ["Mensagens ilimitadas", "Tudo do plano Starter", "IA avançada", "Integrações premium"],
    cta: "Organizar minhas finanças",
    highlight: false,
    monthly: 24.9,
    stripeMonthly: STRIPE_LINK_PRO_MONTHLY,
    stripeYearly: STRIPE_LINK_PRO_YEARLY,
  },
];

const testimonials = [
  {
    text: "Toop demais, gostei! Eu passo um trabalho imenso pra conseguir manter meu DRE sempre informado... Olhando essa tua plataforma já estourou na minha cabeça o quanto isso pode fazer eu economizar muito o meu tempo.",
    name: "Carlos M.",
    role: "Empreendedor",
  },
  { text: "Tuddo é tudo de bom, super indico!", name: "Ana P.", role: "Freelancer" },
  { text: "Tuddo muuuuito bom, está sendo perfeito para mim.", name: "Juliana S.", role: "Estudante" },
  {
    text: "Tuddo muito fácil agora, amei! Minha vida é outra agora.",
    name: "Marcos V.",
    role: "Gestor de Projetos",
  },
  {
    text: "Era Tuddo que me faltava!!! Muito prático, Tuddo muito organizado na minha vida agora.",
    name: "Fernanda L.",
    role: "Autônoma",
  },
];

const faqs = [
  {
    q: "Preciso instalar algo?",
    a: "Não! O Tuddo funciona 100% via WhatsApp e navegador. Você só precisa adicionar nosso número e começar a usar.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Usamos criptografia de ponta a ponta e seus dados são armazenados de forma segura. Nunca compartilhamos suas informações.",
  },
  {
    q: "Como funciona o plano gratuito?",
    a: "O plano gratuito te dá direito a 5 mensagens por dia, para sempre. É perfeito para você testar e se organizar no dia a dia.",
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Você pode cancelar sua assinatura a qualquer momento, sem burocracia.",
  },
];

/* ── Mockup Components ── */
function PhoneMockup() {
  return (
    <div className="w-[260px] sm:w-[280px] h-[420px] sm:h-[480px] bg-card rounded-[2rem] border-2 border-border p-3 flex flex-col shadow-2xl shadow-primary/10">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 text-[10px] text-muted-foreground">
        <span>9:41</span>
        <div className="flex gap-1">
          <div className="w-3 h-2 rounded-sm bg-muted-foreground/40" />
          <div className="w-3 h-2 rounded-sm bg-muted-foreground/40" />
        </div>
      </div>
      {/* Chat header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">Tuddo</p>
          <p className="text-[10px] text-success">online</p>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-hidden py-3 px-2 space-y-2">
        <div className="flex justify-end">
          <div className="bg-primary/20 text-foreground text-[11px] px-3 py-1.5 rounded-xl rounded-br-sm max-w-[85%]">
            gastei 50 reais no almoço
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-secondary text-foreground text-[11px] px-3 py-1.5 rounded-xl rounded-bl-sm max-w-[85%]">
            ✅ Registrado! Gasto de R$ 50 em Alimentação.
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-primary/20 text-foreground text-[11px] px-3 py-1.5 rounded-xl rounded-br-sm max-w-[85%]">
            lembrete: reunião às 15h
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-secondary text-foreground text-[11px] px-3 py-1.5 rounded-xl rounded-bl-sm max-w-[85%]">
            📅 Agendado! Compromisso: Reunião às 15h.
          </div>
        </div>
      </div>
      {/* Input */}
      <div className="flex items-center gap-2 px-2 py-2 border-t border-border">
        <div className="flex-1 bg-secondary rounded-full px-3 py-1.5 text-[10px] text-muted-foreground">
          Mensagem...
        </div>
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <Send className="w-3 h-3 text-primary-foreground" />
        </div>
      </div>
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="w-[320px] sm:w-[380px] h-[260px] sm:h-[300px] bg-card rounded-xl border border-border p-4 shadow-2xl shadow-primary/10 hidden md:block">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
          <span className="text-[10px] font-bold text-primary-foreground">T</span>
        </div>
        <span className="text-xs font-display font-bold text-primary">Tuddo</span>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "Tarefas", value: "12", color: "text-primary" },
          { label: "Gastos", value: "R$ 850", color: "text-destructive" },
          { label: "Reuniões", value: "3", color: "text-info" },
        ].map((s) => (
          <div key={s.label} className="bg-secondary rounded-lg p-2 text-center">
            <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      {/* Chart mock */}
      <div className="bg-secondary rounded-lg p-3 h-24 flex items-end gap-1">
        {[40, 65, 35, 80, 55, 70, 45].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-primary/60 rounded-t-sm transition-all"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function HomePage() {
  const [mobileNav, setMobileNav] = useState(false);
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── HEADER ─── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-16">
          <Link to="/" className="font-display font-bold text-xl text-primary">
            Tuddo
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#funcionalidades" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Funcionalidades
            </a>
            <a href="#precos" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </a>
            <Link to="/login">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Começar de Graça</Button>
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button className="md:hidden text-foreground" onClick={() => setMobileNav(!mobileNav)}>
            {mobileNav ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileNav && (
          <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-3">
            <a href="#funcionalidades" onClick={() => setMobileNav(false)} className="block text-sm text-muted-foreground">
              Funcionalidades
            </a>
            <a href="#precos" onClick={() => setMobileNav(false)} className="block text-sm text-muted-foreground">
              Preços
            </a>
            <a href="#faq" onClick={() => setMobileNav(false)} className="block text-sm text-muted-foreground">
              FAQ
            </a>
            <div className="flex gap-2 pt-2">
              <Link to="/login" className="flex-1">
                <Button variant="outline" className="w-full" size="sm">Login</Button>
              </Link>
              <Link to="/signup" className="flex-1">
                <Button className="w-full" size="sm">Começar de Graça</Button>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── HERO ─── */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-24 px-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 text-center lg:text-left space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight">
              Paz financeira{" "}
              <span className="gold-text">no seu WhatsApp.</span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
              Diga adeus à ansiedade das planilhas. Saiba para onde vai cada centavo com uma simples mensagem.
            </p>
            <div className="space-y-3">
              <Link to="/signup">
                <Button size="lg" className="text-base px-8 gap-2">
                  Quero minha paz financeira agora <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground flex items-center justify-center lg:justify-start gap-1">
                <Lock className="w-3 h-3" /> Grátis para sempre. Não precisa de cartão de crédito.
              </p>
            </div>
          </div>

          <div className="flex items-end gap-[-20px] relative">
            <PhoneMockup />
            <div className="absolute -right-4 -bottom-4 lg:relative lg:right-0 lg:bottom-0 lg:-ml-8">
              <DashboardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF ─── */}
      <section className="py-16 md:py-24 bg-card/50 px-4">
        <div className="max-w-6xl mx-auto space-y-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
            Milhares de vidas já <span className="gold-text">organizadas</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-5 space-y-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">"{t.text}"</p>
                <div>
                  <p className="text-sm font-medium text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
            Sua vida organizada em <span className="gold-text">3 passos</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: "1",
                title: "Envie uma mensagem",
                desc: "Sua vida acontece, você apenas relata. Um áudio de 10s ou uma frase. É só isso.",
              },
              {
                num: "2",
                title: "A Mágica Acontece",
                desc: "Nossa IA, treinada para o português do dia a dia, entende, categoriza e organiza tudo em segundos. Sem esforço.",
              },
              {
                num: "3",
                title: "Veja Tudo Organizado",
                desc: "Acesse seu painel e veja, pela primeira vez, clareza total sobre sua vida financeira. Tome decisões inteligentes, sem estresse.",
              },
            ].map((step) => (
              <div key={step.num} className="bg-card border border-border rounded-xl p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto">
                  {step.num}
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="funcionalidades" className="py-16 md:py-24 bg-card/50 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
            Um assistente para cada área da sua <span className="gold-text">vida</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <DollarSign className="w-8 h-8" />,
                title: "Controle Financeiro",
                desc: "Saiba para onde seu dinheiro vai. Registre despesas e receitas sem sair do WhatsApp e veja gráficos simples no seu painel.",
              },
              {
                icon: <CheckSquare className="w-8 h-8" />,
                title: "Gestor de Tarefas",
                desc: "Nunca mais esqueça uma tarefa. Crie lembretes, defina prioridades e organize seus projetos com uma simples mensagem.",
              },
              {
                icon: <Calendar className="w-8 h-8" />,
                title: "Agenda Inteligente",
                desc: "Seus compromissos, organizados. Agende reuniões e eventos diretamente do seu WhatsApp, integrado com sua agenda.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-card border border-border rounded-xl p-6 space-y-4 hover:border-primary/30 transition-colors"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  {f.icon}
                </div>
                <h3 className="font-display font-semibold text-lg text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="precos" className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              Escolha o plano perfeito para <span className="gold-text">você</span>
            </h2>
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}>
                Mensal
              </span>
              <Switch checked={annual} onCheckedChange={setAnnual} />
              <span className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}>
                Anual <span className="text-xs text-primary">(20% off)</span>
              </span>
            </div>
          </div>

          {/* Valor Percebido */}
          <div className="bg-card border border-border rounded-xl p-5 md:p-6 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <TrendingUp className="w-5 h-5" />
              <span className="font-display font-semibold text-sm md:text-base">
                Economize de R$ 50 a R$ 200 por mês com nossas sugestões inteligentes.
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Coffee className="w-4 h-4" />
              <span className="text-xs md:text-sm">
                Menos que um cafezinho por dia para ter suas finanças em ordem.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col bg-card border rounded-xl p-6 ${
                  plan.highlight ? "border-primary card-glow" : "border-border"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold gold-gradient text-primary-foreground">
                    Popular
                  </div>
                )}
                <div className="text-center space-y-3 mb-6">
                  <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                    {plan.icon}
                  </div>
                  <h3 className="font-display font-semibold text-lg">{plan.name}</h3>
                  {plan.monthly === 0 ? (
                    <p className="text-3xl font-bold text-foreground">Grátis</p>
                  ) : plan.name === "PRO" ? (
                    <>
                      <p className="text-lg md:text-xl font-bold text-primary">
                        apenas {annual ? "R$ 0,67" : (plan as any).dailyCost} por dia
                      </p>
                      {annual ? (
                        <>
                          <p className="text-sm text-muted-foreground mt-1">{plan.annualMonthly}</p>
                          <p className="text-xs text-muted-foreground">{plan.annualLabel}</p>
                          <p className="text-xs font-semibold text-primary mt-1">Economize R$ 59 por ano!</p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">{plan.monthlyLabel}</p>
                      )}
                    </>
                  ) : annual ? (
                    <>
                      <p className="text-3xl font-bold text-foreground">{plan.annualMonthly}</p>
                      <p className="text-xs text-muted-foreground">{plan.annualLabel}</p>
                      <p className="text-xs font-semibold text-primary mt-1">Economize R$ 30 por ano!</p>
                    </>
                  ) : (
                    <p className="text-3xl font-bold text-foreground">{plan.monthlyLabel}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{plan.limit}</p>
                </div>
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.monthly === 0 ? (
                  <Link to="/signup">
                    <Button className="w-full" variant="outline">
                      {plan.cta}
                    </Button>
                  </Link>
                ) : (
                  <a
                    href={annual ? plan.stripeYearly : plan.stripeMonthly}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="w-full" variant={plan.highlight ? "default" : "outline"}>
                      {plan.cta}
                    </Button>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-16 md:py-24 bg-card/50 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
            Ainda tem <span className="gold-text">dúvidas?</span>
          </h2>
          <Accordion type="single" collapsible className="space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-card border border-border rounded-xl px-4">
                <AccordionTrigger className="text-sm md:text-base font-medium text-foreground hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-2xl md:text-4xl font-display font-bold">
            Sua vida organizada em uma <span className="gold-text">conversa.</span>
          </h2>
          <Link to="/signup">
            <Button size="lg" className="text-base px-10 gap-2 mt-4">
              Começar de Graça Agora <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-display font-bold text-lg text-primary">Tuddo</span>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Termos de Serviço</a>
            <a href="#" className="hover:text-foreground transition-colors">Política de Privacidade</a>
            <Link to="/reembolso" className="hover:text-foreground transition-colors">Política de Reembolso</Link>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 Tuddo. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
