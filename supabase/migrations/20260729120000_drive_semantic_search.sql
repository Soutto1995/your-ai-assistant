-- Drive inteligente: todo arquivo enviado pelo WhatsApp é salvo, indexado e
-- pesquisável por conteúdo (busca semântica), não por nome de arquivo.

-- ── pgvector ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ── Tabela de arquivos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id     uuid REFERENCES public.folders(id) ON DELETE SET NULL,

  storage_path  text NOT NULL,
  file_name     text NOT NULL,
  mime_type     text,
  media_type    text NOT NULL CHECK (media_type IN ('image', 'audio', 'document')),
  size_bytes    bigint,

  -- Conteúdo textual extraído: análise da imagem (visão), transcrição do áudio
  -- ou legenda/nome do documento. É o que alimenta o embedding.
  content_text  text,
  caption       text,
  embedding     extensions.vector(1536),

  source        text NOT NULL DEFAULT 'whatsapp',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS files_user_id_created_at_idx
  ON public.files (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS files_folder_id_idx
  ON public.files (folder_id) WHERE folder_id IS NOT NULL;

-- Índice vetorial (cosine). HNSW só indexa linhas com embedding preenchido.
CREATE INDEX IF NOT EXISTS files_embedding_idx
  ON public.files USING hnsw (embedding extensions.vector_cosine_ops);

-- Busca textual como fallback quando o embedding ainda não foi gerado
CREATE INDEX IF NOT EXISTS files_content_text_trgm_idx
  ON public.files USING gin (content_text extensions.gin_trgm_ops);

-- ── RLS: usuário só enxerga os próprios arquivos ────────────────────────────
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own files" ON public.files;
CREATE POLICY "Users can view own files"
  ON public.files FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
CREATE POLICY "Users can insert own files"
  ON public.files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own files" ON public.files;
CREATE POLICY "Users can update own files"
  ON public.files FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own files" ON public.files;
CREATE POLICY "Users can delete own files"
  ON public.files FOR DELETE
  USING (auth.uid() = user_id);

-- ── Bucket privado do drive ─────────────────────────────────────────────────
-- Caminho sempre "<user_id>/<uuid>.<ext>" — a primeira pasta é o dono.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('drive', 'drive', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 52428800;

DROP POLICY IF EXISTS "Users can read own drive objects" ON storage.objects;
CREATE POLICY "Users can read own drive objects"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'drive' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can upload own drive objects" ON storage.objects;
CREATE POLICY "Users can upload own drive objects"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'drive' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own drive objects" ON storage.objects;
CREATE POLICY "Users can delete own drive objects"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'drive' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── RPC: busca semântica ────────────────────────────────────────────────────
-- SECURITY DEFINER para poder usar o índice vetorial sem RLS no meio do plano,
-- mas com trava explícita: um usuário autenticado só busca no próprio acervo.
-- O webhook chama com service_role (auth.uid() = NULL), já tendo resolvido o
-- user_id pelo telefone.
CREATE OR REPLACE FUNCTION public.search_files(
  p_user_id         uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count     integer DEFAULT 5,
  p_threshold       double precision DEFAULT 0.15
)
RETURNS TABLE (
  id           uuid,
  file_name    text,
  media_type   text,
  mime_type    text,
  storage_path text,
  content_text text,
  caption      text,
  created_at   timestamptz,
  similarity   double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT f.id,
         f.file_name,
         f.media_type,
         f.mime_type,
         f.storage_path,
         f.content_text,
         f.caption,
         f.created_at,
         (1 - (f.embedding <=> p_query_embedding))::double precision AS similarity
    FROM public.files f
   WHERE f.user_id = p_user_id
     AND f.embedding IS NOT NULL
     AND (1 - (f.embedding <=> p_query_embedding)) >= p_threshold
   ORDER BY f.embedding <=> p_query_embedding
   LIMIT GREATEST(p_match_count, 1);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.search_files(uuid, extensions.vector, integer, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_files(uuid, extensions.vector, integer, double precision) TO authenticated, service_role;
