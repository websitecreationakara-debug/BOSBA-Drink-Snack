import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useHeroSlides } from "@/hooks/use-products";
import { createHeroSlide, updateHeroSlide, deleteHeroSlide } from "@/data/banners";
import { listMedia, uploadMedia } from "@/data/media";
import { compressImage } from "@/lib/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Pencil, Trash2, Upload, ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { HeroSlide, Media } from "@/lib/types";

export const Route = createFileRoute("/admin/banners")({ component: BannersAdmin });

const empty = {
  id: "",
  eyebrow: "",
  title_top: "",
  title_accent: "",
  title_bottom: "",
  body: "",
  image_url: "",
  cta_label: "",
  cta_link: "/shop",
  sort_order: "0",
  active: "true",
};

function BannersAdmin() {
  const { data: slides = [] } = useHeroSlides({ all: true });
  const { data: mediaItems = [] } = useQuery({
    queryKey: ["media"],
    queryFn: () => listMedia() as Promise<Media[]>,
  });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const editing = !!form.id;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [picker, setPicker] = useState(false);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", await compressImage(file));
      const { url } = await uploadMedia({ data: fd });
      setForm((f) => ({ ...f, image_url: url }));
      qc.invalidateQueries({ queryKey: ["media"] });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const openNew = () => {
    setForm({ ...empty, sort_order: String(slides.length) });
    setPicker(false);
    setOpen(true);
  };
  const openEdit = (s: HeroSlide) => {
    setPicker(false);
    setForm({
      id: s.id,
      eyebrow: s.eyebrow ?? "",
      title_top: s.title_top ?? "",
      title_accent: s.title_accent ?? "",
      title_bottom: s.title_bottom ?? "",
      body: s.body ?? "",
      image_url: s.image_url ?? "",
      cta_label: s.cta_label ?? "",
      cta_link: s.cta_link ?? "/shop",
      sort_order: String(s.sort_order),
      active: s.active ? "true" : "false",
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      eyebrow: form.eyebrow || null,
      title_top: form.title_top || null,
      title_accent: form.title_accent || null,
      title_bottom: form.title_bottom || null,
      body: form.body || null,
      image_url: form.image_url || null,
      cta_label: form.cta_label || null,
      cta_link: form.cta_link || "/shop",
      sort_order: form.sort_order.trim() === "" ? 0 : Number(form.sort_order),
      active: form.active === "true",
    };
    try {
      if (editing) await updateHeroSlide({ data: { id: form.id, ...payload } });
      else await createHeroSlide({ data: payload });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save slide");
      return;
    }
    toast.success(editing ? "Slide updated" : "Slide created");
    qc.invalidateQueries({ queryKey: ["hero_slides"] });
    setOpen(false);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this slide?")) return;
    try {
      await deleteHeroSlide({ data: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["hero_slides"] });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl">Hero Banner</h1>
          <p className="text-muted-foreground mt-1">{slides.length} slide(s) on the homepage</p>
        </div>
        <Button onClick={openNew} className="rounded-full">
          <Plus className="size-4 mr-1.5" /> New Slide
        </Button>
      </div>

      <div className="bg-card border rounded-2xl divide-y">
        {slides.map((s) => (
          <div key={s.id} className="flex items-center gap-4 px-5 py-3">
            <div className="size-16 rounded-lg bg-muted overflow-hidden shrink-0">
              {s.image_url && (
                <img src={s.image_url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {[s.title_top, s.title_accent, s.title_bottom].filter(Boolean).join(" ") ||
                  "(untitled)"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{s.eyebrow}</p>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${s.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}
            >
              {s.active ? "Visible" : "Hidden"}
            </span>
            <span className="text-xs text-muted-foreground w-10 text-center">#{s.sort_order}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => del(s.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
        {slides.length === 0 && (
          <p className="px-5 py-8 text-center text-muted-foreground text-sm">
            No slides yet — add one to fill the homepage banner.
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Slide" : "New Slide"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>Eyebrow (small label above title)</Label>
              <Input
                value={form.eyebrow}
                onChange={(e) => setForm({ ...form, eyebrow: e.target.value })}
                placeholder="Sashimi Grade"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Title — top line</Label>
                <Input
                  value={form.title_top}
                  onChange={(e) => setForm({ ...form, title_top: e.target.value })}
                  placeholder="Ocean"
                />
              </div>
              <div>
                <Label>Highlighted word</Label>
                <Input
                  value={form.title_accent}
                  onChange={(e) => setForm({ ...form, title_accent: e.target.value })}
                  placeholder="Fresh"
                />
              </div>
              <div>
                <Label>Title — rest</Label>
                <Input
                  value={form.title_bottom}
                  onChange={(e) => setForm({ ...form, title_bottom: e.target.value })}
                  placeholder="Catch."
                />
              </div>
            </div>
            <div>
              <Label>Body text</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Sashimi-grade seafood flown from Japanese waters to your door."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Button label</Label>
                <Input
                  value={form.cta_label}
                  onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
                  placeholder="Shop the Catch"
                />
              </div>
              <div>
                <Label>Button link</Label>
                <Input
                  value={form.cta_link}
                  onChange={(e) => setForm({ ...form, cta_link: e.target.value })}
                  placeholder="/shop"
                />
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={form.active} onValueChange={(v) => setForm({ ...form, active: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Visible</SelectItem>
                    <SelectItem value="false">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Slide image</Label>
              <div className="flex items-start gap-3">
                <div className="size-20 rounded-lg border bg-muted overflow-hidden shrink-0 relative">
                  {form.image_url ? (
                    <>
                      <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image_url: "" })}
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
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
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
                            setForm((f) => ({ ...f, image_url: m.url }));
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
            </div>

            <Button type="submit" className="w-full">
              {editing ? "Save changes" : "Create slide"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
