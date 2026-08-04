-- Corrige 42702 em get_family_members: "column reference user_id is ambiguous".
--
-- A função declara RETURNS TABLE(user_id uuid, ...), e no PL/pgSQL cada coluna
-- de saída vira uma variável de mesmo nome. A checagem de acesso usava
-- "WHERE user_id = auth.uid()" sem qualificar, então o Postgres não sabia se
-- era a variável de saída ou a coluna de family_members — e abortava.
--
-- Efeito prático: a chamada SEMPRE falhava. A tela Família nunca listava
-- ninguém ("Nenhum membro ainda") e a contagem de vagas ficava errada, mesmo
-- com o grupo montado corretamente no banco.
--
-- Aqui a checagem passa a usar my_family_ids() (SECURITY DEFINER, criada na
-- migration anterior) e todas as referências ficam qualificadas por alias.

CREATE OR REPLACE FUNCTION public.get_family_members(p_family_id uuid)
RETURNS TABLE(
  user_id   uuid,
  full_name text,
  phone     text,
  role      text,
  joined_at timestamptz,
  email     text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.family_groups fg
     WHERE fg.id = p_family_id
       AND (fg.owner_id = auth.uid() OR fg.id = ANY (public.my_family_ids()))
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT fm.user_id,
         p.full_name,
         p.phone,
         fm.role,
         fm.joined_at,
         u.email::text
    FROM public.family_members fm
    LEFT JOIN public.profiles p ON p.id = fm.user_id
    LEFT JOIN auth.users     u ON u.id = fm.user_id
   WHERE fm.family_id = p_family_id
   ORDER BY fm.joined_at;
END;
$function$;
