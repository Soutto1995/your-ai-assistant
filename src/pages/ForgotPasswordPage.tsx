import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, ArrowLeft, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      console.error("Reset error:", error.message);
      toast({
        title: "Erro",
        description: "Não foi possível enviar o e-mail. Tente novamente.",
        variant: "destructive",
      });
    } else {
      setSent(true);
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
          <p className="text-muted-foreground text-sm">Recuperação de senha</p>
        </div>

        {sent ? (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 card-glow text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">E-mail enviado!</h2>
            <p className="text-sm text-muted-foreground">
              Enviamos um link de recuperação para <strong className="text-foreground">{email}</strong>. 
              Verifique sua caixa de entrada e spam.
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full gap-2 mt-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar ao login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="bg-card border border-border rounded-xl p-6 space-y-5 card-glow">
            <p className="text-sm text-muted-foreground">
              Digite seu e-mail e enviaremos um link para redefinir sua senha.
            </p>
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

            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <Mail className="w-4 h-4" />
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
          </form>
        )}

        {!sent && (
          <p className="text-center text-sm text-muted-foreground">
            Lembrou a senha?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Voltar ao login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
