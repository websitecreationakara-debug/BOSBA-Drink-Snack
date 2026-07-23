import { createFileRoute } from "@tanstack/react-router";
import { useCategories } from "@/hooks/use-products";
import { createCategory, updateCategory, deleteCategory } from "@/data/categories";
import { listMedia, uploadMedia } from "@/data/media";
import { compressImage } from "@/lib/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Fragment, useRef, useState } from "react";
import { Trash2, Upload, ImageIcon, Loader2, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import type { Category, Media } from "@/lib/types";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const Route = createFileRoute("/admin/categories")({ component: CategoriesAdmin });

function CategoriesAdmin() {
  const { data: categories = [] } = useCategories();
  const { data: mediaItems = [] } = useQuery({
    queryKey: ["media"],
    queryFn: () => listMedia() as Promise<Media[]>,
  });
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");

  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Top-level categories are valid parents (keeps the tree cycle-free).
  const topLevel = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string | null) =>
    id === null
      ? categories.filter((c) => !c.parent_id || !categories.some((p) => p.id === c.parent_id))
      : categories.filter((c) => c.parent_id === id);

  const [editing, setEditing] = useState<Category | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [picker, setPicker] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCategory({
        data: { name, slug: slugify(name), parent_id: parentId || null },
      });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to add category");
    }
    setName("");
    setParentId("");
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const reparent = async (c: Category, parent_id: string | null) => {
    if (parent_id === (c.parent_id ?? null)) return;
    try {
      await updateCategory({ data: { id: c.id, parent_id } });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to move category");
    }
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const startRename = (c: Category) => {
    setRenaming(c.id);
    setRenameValue(c.name);
  };

  const saveRename = async (c: Category) => {
    const next = renameValue.trim();
    if (!next || next === c.name) return setRenaming(null);
    try {
      await updateCategory({ data: { id: c.id, name: next, slug: slugify(next) } });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to rename");
    }
    setRenaming(null);
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const del = async (id: string) => {
    try {
      await deleteCategory({ data: { id } });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const openImage = (c: Category) => {
    setEditing(c);
    setImageUrl(c.image_url ?? "");
    setPicker(false);
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", await compressImage(file));
      const { url } = await uploadMedia({ data: fd });
      setImageUrl(url);
      qc.invalidateQueries({ queryKey: ["media"] });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveImage = async () => {
    if (!editing) return;
    try {
      await updateCategory({ data: { id: editing.id, image_url: imageUrl || null } });
    } catch (err) {
      return toast.error(err instanceof Error ? err.message : "Failed to save image");
    }
    toast.success("Category image updated");
    qc.invalidateQueries({ queryKey: ["categories"] });
    setEditing(null);
  };

  const renderRow = (c: Category, depth: number) => (
    <div
      className="flex items-center justify-between gap-3 px-5 py-3"
      style={{ paddingLeft: 20 + depth * 28 }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {depth > 0 && <span className="text-muted-foreground shrink-0">↳</span>}
        <button
          type="button"
          onClick={() => openImage(c)}
          className="size-12 rounded-lg border bg-muted overflow-hidden shrink-0 grid place-items-center text-muted-foreground hover:ring-2 ring-brand"
          aria-label="Set category image"
        >
          {c.image_url ? (
            <img src={c.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="size-5" />
          )}
        </button>
        {renaming === c.id ? (
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename(c);
              if (e.key === "Escape") setRenaming(null);
            }}
            className="h-9 w-48"
          />
        ) : (
          <div className="min-w-0">
            <p className="font-medium truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground truncate">{c.slug}</p>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Select
          value={c.parent_id ?? "none"}
          onValueChange={(v) => reparent(c, v === "none" ? null : v)}
        >
          <SelectTrigger className="h-9 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Top level</SelectItem>
            {categories
              .filter((p) => p.id !== c.id && !p.parent_id)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        {renaming === c.id ? (
          <Button variant="outline" size="sm" onClick={() => saveRename(c)}>
            <Check className="size-4 mr-1.5" /> Save
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => startRename(c)}
            aria-label="Rename category"
          >
            <Pencil className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => openImage(c)} aria-label="Image">
          <ImageIcon className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => del(c.id)}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  );

  const renderTree = (parentId: string | null, depth: number): React.ReactNode =>
    childrenOf(parentId).map((c) => (
      <Fragment key={c.id}>
        {renderRow(c, depth)}
        {renderTree(c.id, depth + 1)}
      </Fragment>
    ));

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="font-display font-bold text-3xl">Categories</h1>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <Input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
          className="flex-1 min-w-[200px]"
        />
        <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Top level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Top level (no parent)</SelectItem>
            {topLevel.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button>Add</Button>
      </form>
      <div className="bg-card border rounded-2xl divide-y">{renderTree(null, 0)}</div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.name} image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-20 rounded-lg border bg-muted overflow-hidden shrink-0 relative">
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"
                      aria-label="Remove image"
                    >
                      <X className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full grid place-items-center text-muted-foreground">
                    <ImageIcon className="size-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="size-4 mr-1.5" />
                    )}
                    Upload
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPicker((v) => !v)}
                  >
                    <ImageIcon className="size-4 mr-1.5" /> Media library
                  </Button>
                </div>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="or paste a URL https://..."
                />
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onUpload(e.target.files?.[0])}
            />
            {picker && (
              <div className="border rounded-lg p-2 max-h-44 overflow-y-auto">
                {mediaItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">
                    No media yet — upload an image first.
                  </p>
                ) : (
                  <div className="grid grid-cols-5 gap-2">
                    {mediaItems.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setImageUrl(m.url);
                          setPicker(false);
                        }}
                        className="aspect-square rounded-md overflow-hidden border hover:ring-2 ring-brand"
                      >
                        <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button onClick={saveImage} className="w-full">
              Save image
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
