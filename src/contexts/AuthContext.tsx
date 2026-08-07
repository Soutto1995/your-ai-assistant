import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  plan: string;
  onboarding_completed: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /**
   * Plano que vale para liberar funcionalidades.
   *
   * Quem é convidado para um plano Familiar continua com plan="FREE" no
   * próprio perfil — quem paga é o titular. Sem esta distinção o familiar
   * enxergava os dados da conta paga, mas com as travas do grátis: Orçamento
   * bloqueado, histórico cortado em 3 meses e aviso de "20/20 transações".
   *
   * profile.plan continua sendo o plano de COBRANÇA da pessoa, e é o que a
   * tela de Planos deve mostrar. Este aqui é só para permissões.
   */
  effectivePlan: string;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  effectivePlan: "FREE",
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [familyPlan, setFamilyPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    // Se esta consulta falha e o erro é ignorado, profile fica nulo e o app
    // trata um assinante como plano grátis: recursos bloqueados, limites do
    // FREE, menus somem. Uma falha de rede vira "sua assinatura acabou" na cara
    // do cliente. Por isso o erro é lido, registrado, e o perfil anterior é
    // PRESERVADO em vez de zerado.
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Falha ao carregar o perfil:", error);
      return;
    }
    setProfile(data);

    // Se a pessoa faz parte de uma família, o plano do grupo é que manda.
    const { data: membership, error: familyError } = await supabase
      .from("family_members")
      .select("family_groups(plan)")
      .eq("user_id", userId)
      .maybeSingle();
    if (familyError) {
      console.error("family membership lookup error:", familyError);
      setFamilyPlan(null);
      return;
    }
    const groupPlan = (membership?.family_groups as any)?.plan;
    setFamilyPlan(typeof groupPlan === "string" ? groupPlan : null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
          setFamilyPlan(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setFamilyPlan(null);
  };

  // O plano do grupo só substitui o próprio quando é melhor: um titular do
  // Familiar 4 que também tenha sido convidado para o Familiar 2 de outra
  // pessoa não pode ser rebaixado por causa disso.
  const ownPlan = (profile?.plan || "FREE").toUpperCase();
  const effectivePlan =
    familyPlan && !ownPlan.startsWith("FAMILY") ? familyPlan.toUpperCase() : ownPlan;

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, effectivePlan, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
