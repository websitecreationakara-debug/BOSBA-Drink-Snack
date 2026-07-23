import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listMedia, uploadMedia, deleteMedia, renameMedia } from "@/data/media";
import { compressImage } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Copy, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Media } from "@/lib/types";

export const Route = createFileRoute("/admin/media")({
  component: MediaAdmin,
});

function MediaAdmin() {
  const { data: items = [] } = useQuery({
    queryKey: ["media"],
    queryFn: () => listMedia() as Promise<Media[]>,
  });
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startRename = (m: Media) => {
    setEditing(m.id);
    setDraft(m.filename);
  };

  const saveRename = async (m: Media) => {
    const filename = draft.trim();
    setEditing(null);
    if (!filename || filename === m.filename) return;
    try {
      await renameMedia({ data: { id: m.id, filename } });
      qc.invalidateQueries({ queryKey: ["media"] });
      toast.success("Renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", await compressImage(file));
        await uploadMedia({ data: fd });
      }
      toast.success(files.length > 1 ? `${files.length} images uploaded` : "Image uploaded");
      qc.invalidateQueries({ queryKey: ["media"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const del = async (m: Media) => {
    if (!confirm(`Delete ${m.filename}?`)) return;
    try {
      await deleteMedia({ data: { id: m.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["media"] });
  };

  const copy = (m: Media) => {
    navigator.clipboard.writeText(`${window.location.origin}${m.url}`);
    toast.success("Full URL copied");
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl">Media</h1>
          <p className="text-muted-foreground mt-1">{items.length} files</p>
        </div>
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full"
        >
          {uploading ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Upload className="size-4 mr-1.5" />
          )}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-16 text-center text-muted-foreground">
          No media yet. Upload your first image.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((m) => (
            <div key={m.id} className="group relative bg-card border rounded-xl overflow-hidden">
              <div className="aspect-square bg-muted">
                <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
              </div>
              <div className="p-2">
                {editing === m.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => saveRename(m)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(m);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="w-full text-xs bg-background border rounded px-1 py-0.5 outline-none focus:border-primary"
                  />
                ) : (
                  <p className="text-xs truncate" title={m.filename}>
                    {m.filename}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">{(m.size / 1024).toFixed(0)} KB</p>
                <button
                  onClick={() => copy(m)}
                  title="Click to copy full URL"
                  className="mt-1 w-full text-left font-mono text-[10px] text-muted-foreground/80 truncate hover:text-foreground"
                >
                  {m.url}
                </button>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-7"
                  onClick={() => startRename(m)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="size-7"
                  onClick={() => copy(m)}
                >
                  <Copy className="size-3.5" />
                </Button>
                <Button variant="secondary" size="icon" className="size-7" onClick={() => del(m)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
