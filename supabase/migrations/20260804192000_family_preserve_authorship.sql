-- Preserva a autoria quando um gasto de familiar é redirecionado ao titular.
--
-- O trigger reescreve user_id para o titular, para que a família compartilhe a
-- mesma conta. Só que ele apagava a informação de QUEM lançou: em Finanças, a
-- seção "Gastos por pessoa" lê paid_by_name e trata nulo como "Titular"
-- (FinancesPage.tsx). Resultado: tudo que a esposa lançasse pelo site
-- apareceria como gasto do marido.
--
-- Pelo WhatsApp isso já funcionava — a função lá preenche paid_by_name com o
-- nome de quem mandou a mensagem. O furo era só no app.
--
-- A atribuição é preenchida APENAS quando houve redirecionamento (ou seja,
-- quem lançou não é o titular). Lançamento do próprio titular continua com
-- paid_by_name nulo, que a tela já exibe como "Titular" — comportamento atual
-- preservado de propósito.

CREATE OR REPLACE FUNCTION public.redirect_to_family_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_autor uuid := NEW.user_id;
  v_titular uuid;
  v_nome text;
BEGIN
  v_titular := public.family_effective_owner(v_autor);
  NEW.user_id := v_titular;

  IF TG_TABLE_NAME = 'transactions' AND v_titular IS DISTINCT FROM v_autor THEN
    IF NEW.paid_by_user_id IS NULL THEN
      NEW.paid_by_user_id := v_autor;
    END IF;

    IF NEW.paid_by_name IS NULL OR btrim(NEW.paid_by_name) = '' THEN
      -- Primeiro nome basta: a lista fica legível e evita repetir sobrenome.
      SELECT NULLIF(btrim(split_part(btrim(COALESCE(p.full_name, '')), ' ', 1)), '')
        INTO v_nome
        FROM public.profiles p
       WHERE p.id = v_autor;
      NEW.paid_by_name := v_nome;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
