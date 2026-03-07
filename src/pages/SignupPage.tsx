import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, UserPlus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function cleanPhone(formatted: string): string {
  const digits = formatted.replace(/\D/g, "");
  if (digits.length === 11) return `55${digits}`;
  return digits;
}

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11) {
      toast({
        title: "Telefone inválido",
        description: "Informe um telefone com DDD válido, ex: (11) 99999-9999.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const cleanedPhone = cleanPhone(phone);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone: cleanedPhone },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);

    if (error) {
      console.error("Signup error:", error.message);
      toast({
        title: "Erro ao criar conta",
        description: "Não foi possível criar a conta. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Conta criada!", description: "Você já pode usar o Tuddo." });
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-xl gold-gradient flex items-center justify-center mx-auto">
            <MessageCircle className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold gold-text">Tuddo</h1>
          <p className="text-muted-foreground text-sm">Crie sua conta gratuitamente</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="bg-card border border-border rounded-xl p-6 space-y-5 card-glow">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone com DDD</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            <UserPlus className="w-4 h-4" />
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  );
}