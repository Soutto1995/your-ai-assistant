// Busca semântica no drive do usuário.
// O embedding da consulta é gerado aqui (a chave da OpenAI nunca vai ao browser)
// e o resultado é sempre restrito ao user_id do token autenticado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateEmbedding(input: string): Promise<number[] | null> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const cleaned = input.trim().slice(0, 8000);
  if (!openaiKey || !cleaned) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: cleaned }),
  });

  if (!response.ok) {
    console.error("Embeddings API error:", response.status, await response.text());
    return null;
  }

  const payload = await response.json();
  const vector = payload?.data?.[0]?.embedding;
  return Array.isArray(vector) ? vector : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const mediaType = typeof body?.mediaType === "string" ? body.mediaType : "";

    if (!query) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let matches: any[] = [];
    const embedding = await generateEmbedding(query);

    if (embedding) {
      const { data, error } = await supabase.rpc("search_files", {
        p_user_id: user.id,
        p_query_embedding: JSON.stringify(embedding),
        p_match_count: 20,
        p_threshold: 0.15,
      });
      if (error) console.error("search_files rpc error:", error);
      else if (Array.isArray(data)) matches = data;
    }

    // Fallback textual para arquivos ainda sem embedding
    if (matches.length === 0) {
      const { data } = await supabase
        .from("files")
        .select("id, file_name, media_type, mime_type, storage_path, content_text, caption, created_at")
        .eq("user_id", user.id)
        .or(`content_text.ilike.%${query}%,caption.ilike.%${query}%,file_name.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      if (Array.isArray(data)) matches = data;
    }

    if (mediaType) {
      matches = matches.filter((m) => m.media_type === mediaType);
    }

    const results = [];
    for (const match of matches) {
      const { data: signed } = await supabase.storage
        .from("drive")
        .createSignedUrl(match.storage_path, 60 * 60);
      results.push({ ...match, signed_url: signed?.signedUrl ?? null });
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("drive-search error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
