-- Corrige recursão infinita (42P17) nas policies do plano Familiar.
--
-- Sintoma real, cliente pagante: o titular abria tuddo.pro/family e via
-- "Você ainda não tem um plano Familiar" — mesmo com o grupo existindo no
-- banco e o plano FAMILY_2 ativo.
--
-- Causa: as duas policies se chamavam em círculo.
--   family_groups  SELECT ... id IN (SELECT family_id FROM family_members ...)
--   family_members SELECT ... family_id IN (SELECT id FROM family_groups ...)
-- Para autorizar a leitura de family_groups o Postgres precisava ler
-- family_members, que por sua vez precisava ler family_groups. Ele detecta o
-- ciclo e aborta a query inteira com 42P17. Nenhuma linha volta — nem para o
-- dono do grupo, cuja primeira condição (owner_id = auth.uid()) sozinha
-- bastaria, porque o erro acontece ao PLANEJAR a policy, não ao avaliá-la
-- linha a linha.
--
-- Solução: tirar o cruzamento de dentro da policy. Estas funções são
-- SECURITY DEFINER, então rodam sem RLS e o ciclo deixa de existir. Cada
-- policy passa a consultar apenas a própria tabela + um array pronto.

CREATE OR REPLACE FUNCTION public.my_family_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(family_id), '{}')
    FROM public.family_members
   WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_family_ids() IS
  'IDs dos grupos familiares em que o usuário atual é membro. SECURITY DEFINER para quebrar a recursão entre as policies de family_groups e family_members.';

CREATE OR REPLACE FUNCTION public.my_owned_family_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(id), '{}')
    FROM public.family_groups
   WHERE owner_id = auth.uid();
$$;

COMMENT ON FUNCTION public.my_owned_family_ids() IS
  'IDs dos grupos familiares de que o usuário atual é titular. SECURITY DEFINER, mesmo motivo de my_family_ids().';

-- family_groups: dono vê o seu; membro vê aquele em que foi incluído.
DROP POLICY IF EXISTS "Users can view their family group" ON public.family_groups;
CREATE POLICY "Users can view their family group"
  ON public.family_groups FOR SELECT
  USING (
    owner_id = auth.uid()
    OR id = ANY (public.my_family_ids())
  );

-- family_members: cada um vê a própria linha; o titular vê todas do grupo dele.
DROP POLICY IF EXISTS "Members can view their family" ON public.family_members;
CREATE POLICY "Members can view their family"
  ON public.family_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR family_id = ANY (public.my_owned_family_ids())
  );

-- Estas duas funções PRECISAM ficar executáveis por anon. As policies são
-- avaliadas com o papel de quem chama, então revogar de anon não esconde nada:
-- só troca "nenhuma linha" por erro 42501 em qualquer consulta de visitante
-- não logado (inclusive durante a renovação de sessão). Testado. Não é furo de
-- segurança: as duas filtram por auth.uid(), que para anon é NULL — o retorno
-- é um array vazio.
GRANT EXECUTE ON FUNCTION public.my_family_ids()       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_owned_family_ids() TO anon, authenticated;

-- Só o titular inclui/remove membros.
DROP POLICY IF EXISTS "Owner can manage members" ON public.family_members;
CREATE POLICY "Owner can manage members"
  ON public.family_members FOR ALL
  USING (family_id = ANY (public.my_owned_family_ids()))
  WITH CHECK (family_id = ANY (public.my_owned_family_ids()));
