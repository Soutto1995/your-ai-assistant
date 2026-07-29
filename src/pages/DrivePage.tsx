// src/pages/DrivePage.tsx
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Trash2, FileText, Image as ImageIcon, Mic, Loader2, HardDrive, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type DriveFile = {
  id: string;
  file_name: string;
  media_type: "image" | "audio" | "document";
  mime_type: string | null;
  storage_path: string;
  content_text: string | null;
  caption: string | null;
  created_at: string;
  similarity?: number;
  signed_url?: string | null;
};

const MEDIA_FILTERS = [
  { value: "", label: "Tudo" },
  { value: "image", label: "Fotos" },
  { value: "document", label: "Documentos" },
  { value: "audio", label: "Áudios" },
] as const;

function MediaIcon({ type }: { type: DriveFile["media_type"] }) {
  if (type === "image") return <ImageIcon className="h-5 w-5 text-blue-500" />;
  if (type === "audio") return <Mic className="h-5 w-5 text-purple-500" />;
  return <FileText className="h-5 w-5 text-orange-500" />;
}

function formatBrDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function DrivePage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [query, setQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState<string>("");
  const [searching, setSearching] = useState(false);
  const [isSearchResult, setIsSearchResult] = useState(false);

  // Listagem padrão: arquivos mais recentes. O .eq('user_id') é redundante com
  // a RLS de propósito — defesa em profundidade.
  const fetchRecent = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("files")
      .select("id, file_name, media_type, mime_type, storage_path, content_text, caption, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error(error);
      return;
    }
    setFiles(((data as DriveFile[]) || []));
    setIsSearchResult(false);
  };

  useEffect(() => {
    fetchRecent();
    const ch = supabase
      .channel("files-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "files" }, fetchRecent)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const runSearch = async () => {
    if (!query.trim()) {
      fetchRecent();
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("drive-search", {
        body: { query: query.trim(), mediaType: mediaFilter || undefined },
      });
      if (error) throw error;
      setFiles((data?.results as DriveFile[]) || []);
      setIsSearchResult(true);
    } catch (err) {
      console.error(err);
      toast.error("Não consegui buscar agora. Tenta de novo?");
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery("");
    fetchRecent();
  };

  const openFile = async (file: DriveFile) => {
    if (file.signed_url) {
      window.open(file.signed_url, "_blank", "noopener,noreferrer");
      return;
    }
    const { data, error } = await supabase.storage
      .from("drive")
      .createSignedUrl(file.storage_path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast.error("Não consegui abrir esse arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const deleteFile = async (file: DriveFile) => {
    if (!user) return;
    const { error: storageErr } = await supabase.storage.from("drive").remove([file.storage_path]);
    if (storageErr) console.error(storageErr);

    const { error } = await supabase
      .from("files")
      .delete()
      .eq("id", file.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Não consegui apagar o arquivo.");
      return;
    }
    toast.success("Arquivo apagado.");
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
  };

  const visibleFiles = isSearchResult || !mediaFilter
    ? files
    : files.filter((f) => f.media_type === mediaFilter);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="h-6 w-6" />
            Drive
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tudo que você manda pro Tuddo no WhatsApp fica guardado aqui. Procure pelo
            conteúdo, não pelo nome do arquivo — ex: "comprovante do mecânico".
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="O que você está procurando?"
              className="pl-9 pr-9"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={runSearch} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {MEDIA_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={mediaFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setMediaFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {isSearchResult && (
          <p className="text-sm text-muted-foreground">
            {visibleFiles.length === 0
              ? `Nada encontrado para "${query}".`
              : `${visibleFiles.length} resultado(s) para "${query}".`}
          </p>
        )}

        {visibleFiles.length === 0 && !isSearchResult ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <HardDrive className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Seu drive está vazio</p>
              <p className="text-sm mt-1">
                Mande uma foto, um áudio ou um documento pro Tuddo no WhatsApp que ele
                guarda aqui automaticamente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleFiles.map((file) => {
              const summary = (file.caption || file.content_text || file.file_name || "").trim();
              return (
                <Card key={file.id} className="group">
                  <CardContent className="p-4 flex gap-3">
                    <div className="shrink-0 mt-0.5">
                      <MediaIcon type={file.media_type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        onClick={() => openFile(file)}
                        className="text-left w-full"
                      >
                        <p className="text-sm font-medium line-clamp-3 hover:underline">
                          {summary || file.file_name}
                        </p>
                      </button>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {formatBrDate(file.created_at)}
                        {typeof file.similarity === "number" && (
                          <> · {Math.round(file.similarity * 100)}% de relevância</>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteFile(file)}
                      className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Apagar ${file.file_name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
