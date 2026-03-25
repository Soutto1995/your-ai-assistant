import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  Users,
  Award,
  ArrowRight,
  Coins,
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
    text: '"Eu perdia horas para manter meu DRE informado", conta Carlos, empreendedor. "Com o Tuddo, economizo no mínimo 5 horas por semana. É como ter um assistente financeiro no bolso."',
    metric: "Resultado: 80% menos tempo gasto com gestão financeira.",
    name: "Carlos M.",
    role: "Empreendedor",
  },
  {
    text: '"Eu não sabia para onde meu dinheiro ia", confessa Ana, freelancer. "Com o Tuddo, descobri que estava gastando R$ 800/mês desnecessariamente. Agora economizo e invisto."',
    metric: "Resultado: R$ 9.600 economizados em um ano.",
    name: "Ana P.",
    role: "Freelancer",
  },
  {
    text: '"Como estudante, meu dinheiro é apertado", diz Juliana. "O Tuddo me ajudou a entender meus gastos e cortar desperdícios. Agora tenho dinheiro de sobra no final do mês."',
    metric: "Resultado: Controle total com menos estresse.",
    name: "Juliana S.",
    role: "Estudante",
  },
  {
    text: '"Eu trabalhava 12 horas por dia e no final do mês não sobrava nada. Com o Tuddo, descobri que estava gastando R$ 800 por mês em coisas que nem percebia. No primeiro ano economizei R$ 4.800. Mudou minha vida."',
    metric: "Resultado: R$ 4.800 economizados no primeiro ano.",
    name: "Roberto L.",
    role: "Motorista de aplicativo",
  },
  {
    text: '"Com 3 filhos, controlar as finanças da família era impossível. O Tuddo me mostrou exatamente onde ia cada centavo. Finalmente sei onde vai o dinheiro da família e consigo planejar as férias das crianças."',
    metric: "Resultado: Planejamento financeiro familiar completo.",
    name: "Mariana C.",
    role: "Mãe e dona de casa",
  },
  {
    text: '"Eu misturava as contas pessoais com as da empresa. O Tuddo separou tudo automaticamente e reduzi 60% do tempo que gastava com gestão financeira. Agora foco no que importa: crescer meu negócio."',
    metric: "Resultado: 60% menos tempo em gestão financeira.",
    name: "Pedro H.",
    role: "Pequeno empresário",
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
  {
    q: "Por que eu pagaria por isso se posso usar uma planilha?",
    a: "Uma planilha leva horas por mês e ainda assim fica desorganizada. O Tuddo faz tudo em segundos, com 100% de precisão. Você economiza 5+ horas por semana, o que vale muito mais que R$ 12,90/mês.",
  },
  {
    q: "Como vocês protegem meus dados?",
    a: "Usamos criptografia de ponta a ponta, autenticação de dois fatores e conformidade com LGPD. Seus dados nunca são vendidos ou compartilhados.",
  },
  {
    q: "Posso integrar com meu banco?",
    a: "Sim! O Tuddo se integra com os principais bancos brasileiros. Você pode sincronizar suas contas e transações automaticamente.",
  },
];

/* ── Pain point icons ── */
const painPoints = [
  {
    icon: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663357834422/BUokifsxwuIrJSJa.png",
    iconAlt: "Ícone de planilhas e caos financeiro",
    title: "Planilhas Complicadas",
    desc: "Você abre sua planilha de gastos e sente um calafrio? Horas perdidas para um controle que nunca fica em dia.",
  },
  {
    icon: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663357834422/OBYYiBqXNJNOeorl.png",
    iconAlt: "Ícone de tempo e dinheiro perdidos",
    title: "Falta de Visibilidade",
    desc: 'O salário cai, as contas chegam, e no fim do mês você se pergunta: "para onde foi meu dinheiro?"',
  },
  {
    icon: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663357834422/RsinrKUQwRRhLCui.png",
    iconAlt: "Ícone de privacidade e segurança",
    title: "Segurança Questionável",
    desc: "Cansado de aplicativos que pedem a senha do seu banco? A segurança dos seus dados não deveria ser uma preocupação.",
  },
];

/* ── Main Page ── */
export default function HomePage() {
  const [mobileNav, setMobileNav] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [remainingSpots, setRemainingSpots] = useState<number | null>(null);

  useEffect(() => {
    const fetchSpots = async () => {
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .neq("plan", "FREE");
      setRemainingSpots(Math.max(0, 500 - (count ?? 0)));
    };
    fetchSpots();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── HEADER ─── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 h-16">
          <Link to="/" className="font-display font-bold text-[28px] text-primary">
            Tuddo
          </Link>
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
          <button className="md:hidden text-foreground" onClick={() => setMobileNav(!mobileNav)}>
            {mobileNav ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {mobileNav && (
          <div className="md:hidden border-t border-border bg-background px-4 py-4 space-y-3">
            <a href="#funcionalidades" onClick={() => setMobileNav(false)} className="block text-sm text-muted-foreground">Funcionalidades</a>
            <a href="#precos" onClick={() => setMobileNav(false)} className="block text-sm text-muted-foreground">Preços</a>
            <a href="#faq" onClick={() => setMobileNav(false)} className="block text-sm text-muted-foreground">FAQ</a>
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
          {/* Hero images */}
          <div className="relative flex flex-col items-start">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663357834422/pbyrLhYwLqUCWCPi.png"
              alt="iPhone com WhatsApp mostrando conversa com Tuddo"
              className="w-[260px] md:w-[320px] h-auto relative z-[2] object-contain"
              style={{ filter: "drop-shadow(0 24px 48px rgba(245, 166, 35, 0.2))" }}
              loading="lazy"
            />
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663357834422/qwvOhMoXEhLhyofM.png"
              alt="Dashboard do Tuddo com gráficos financeiros"
              className="hidden md:block w-[300px] md:w-[380px] h-auto relative z-[1] -mt-[60px] ml-[40px] rounded-2xl object-contain"
              style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ─── PROVA SOCIAL COM NÚMEROS ─── */}
      <section className="py-16 md:py-24 bg-card/50 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center max-w-3xl mx-auto">
            Mais de 5.000 brasileiros já confiam no Tuddo para organizar suas{" "}
            <span className="gold-text">finanças.</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "+5.000", icon: <Users className="w-6 h-6" />, label: "Vidas Organizadas" },
              { value: "98%", icon: <Star className="w-6 h-6" />, label: "de Satisfação" },
              { value: "R$ 250", icon: <Coins className="w-6 h-6" />, label: "Economizados/mês em média" },
              { value: "Destaque", icon: <Award className="w-6 h-6" />, label: "em Mídia Especializada" },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-card border border-border rounded-xl p-5 text-center space-y-3 hover:border-primary/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  {card.icon}
                </div>
                <p className="text-2xl md:text-3xl font-display font-bold text-foreground">{card.value}</p>
                <p className="text-xs md:text-sm text-muted-foreground">{card.label}</p>
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

      {/* ─── TRANSFORMAÇÃO VISUAL ─── */}
      <section className="py-16 md:py-24 bg-card/50 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
            De caos a controle. <span className="gold-text">Em um instante.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
            {/* ANTES */}
            <div className="bg-card border border-destructive/20 rounded-xl overflow-hidden">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663357834422/YoVTATftbXlXNpFJ.jpg"
                alt="Antes: planilhas e caos financeiro"
                className="w-full h-48 md:h-56 object-cover"
                loading="lazy"
              />
              <div className="p-5 text-center space-y-2">
                <span className="inline-block bg-destructive/10 text-destructive text-xs font-semibold px-3 py-1 rounded-full">
                  ANTES
                </span>
                <p className="text-sm text-muted-foreground">Caos, desorganização, estresse</p>
              </div>
            </div>

            {/* Seta */}
            <div className="flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <ArrowRight className="w-6 h-6 text-primary" />
              </div>
            </div>

            {/* DEPOIS */}
            <div className="bg-card border border-primary/20 rounded-xl overflow-hidden">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663357834422/XnBwLDCcNjyHsyyA.jpg"
                alt="Depois: dashboard Tuddo organizado"
                className="w-full h-48 md:h-56 object-cover"
                loading="lazy"
              />
              <div className="p-5 text-center space-y-2">
                <span className="inline-block bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
                  DEPOIS
                </span>
                <p className="text-sm text-muted-foreground">Clareza, controle, paz</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AGITAÇÃO DA DOR ─── */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
            Você se identifica com <span className="gold-text">isso?</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {painPoints.map((pain) => (
              <div
                key={pain.title}
                className="bg-card border border-border rounded-xl p-6 space-y-4 hover:border-destructive/30 transition-colors text-center"
              >
                <img
                  src={pain.icon}
                  alt={pain.iconAlt}
                  className="w-[72px] h-[72px] mx-auto object-contain mb-4"
                  style={{ background: "transparent" }}
                  loading="lazy"
                />
                <h3 className="font-display font-semibold text-lg text-foreground">{pain.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{pain.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="funcionalidades" className="py-16 md:py-24 bg-card/50 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
            Ferramentas para sua <span className="gold-text">tranquilidade financeira.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <DollarSign className="w-8 h-8" />,
                title: "Saiba exatamente para onde vai seu dinheiro",
                desc: "Registre despesas e receitas sem sair do WhatsApp. Veja gráficos simples que mostram claramente seus hábitos de gastos.",
              },
              {
                icon: <CheckSquare className="w-8 h-8" />,
                title: "Nunca mais esqueça um pagamento ou compromisso",
                desc: "Crie lembretes automáticos para contas, boletos e compromissos importantes. Tudo sincronizado com seu WhatsApp.",
              },
              {
                icon: <Calendar className="w-8 h-8" />,
                title: "Sua vida pessoal e profissional, sincronizada",
                desc: "Agende reuniões, consultas e eventos diretamente do WhatsApp. Tudo integrado com sua agenda pessoal.",
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

      {/* ─── DEPOIMENTOS ─── */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-6xl mx-auto space-y-10">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
            Não acredite em nós. Acredite <span className="gold-text">neles.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-5 space-y-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.text}</p>
                <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
                  <p className="text-xs font-semibold text-primary">{t.metric}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="precos" className="py-16 md:py-24 bg-card/50 px-4">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Banner de Oferta de Aniversário */}
          {remainingSpots !== null && remainingSpots > 0 && (
            <div className="relative bg-card border border-primary/30 rounded-xl overflow-hidden animate-fade-in">
              <img
                src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663357834422/DKCzlEUkkRyoKxFx.jpg"
                alt="Oferta de aniversário Tuddo"
                className="w-full h-32 md:h-40 object-cover opacity-30"
                loading="lazy"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-2">
                <span className="font-display font-bold text-sm md:text-base text-foreground max-w-2xl">
                  OFERTA DE ANIVERSÁRIO TUDDO: Os próximos 500 usuários PRO ganham acesso à feature "Análise Preditiva" que será lançada em breve!
                </span>
                <span className="text-xs md:text-sm font-semibold text-muted-foreground">
                  Restam apenas <span className="text-primary font-bold">{remainingSpots}</span> vagas nesta oferta!
                </span>
              </div>
            </div>
          )}

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

          <div className="bg-card border border-border rounded-xl p-5 md:p-6 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <TrendingUp className="w-5 h-5" />
              <span className="font-display font-semibold text-sm md:text-base">
                Economize até 10x o valor da assinatura todo mês
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

      {/* ─── GARANTIA ─── */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-bold">
            Seu risco é <span className="gold-text">zero.</span>
          </h2>
          <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Teste o Tuddo PRO por 7 dias. Se você não sentir que sua vida financeira está mais organizada e sob controle, nós devolvemos 100% do seu dinheiro. Sem perguntas, sem burocracia. Basta um único e-mail.
          </p>
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-5 py-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">Garantia de 7 Dias</span>
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
            Sua jornada para a paz financeira começa com uma{" "}
            <span className="gold-text">mensagem.</span>
          </h2>
          <div className="space-y-3">
            <Link to="/signup">
              <Button size="lg" className="text-base px-10 gap-2">
                Quero ter controle total das minhas finanças <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground">
              Crie sua conta grátis. Leva 30 segundos.
            </p>
          </div>
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
