import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useProducts, useCategories, useAllVariations, usePromotions } from "@/hooks/use-products";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  reorderProducts,
  getVariations,
  saveVariations,
  getProductImages,
  saveProductImages,
} from "@/data/products";
import { listMedia, uploadMedia } from "@/data/media";
import { compressImage } from "@/lib/image";
import { groupVariations } from "@/lib/variants";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  ImageIcon,
  Loader2,
  X,
  Copy,
  Search,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product, Media } from "@/lib/types";

export const Route = createFileRoute("/admin/products")({
  component: ProductsAdmin,
});

const empty = {
  id: "",
  title: "",
  description: "",
  price: "0",
  sale_price: "",
  category_id: "",
  stock: "",
  status: "published",
  image_url: "",
  badge: "",
  rating: "4.5",
  weight: "",
  pcs: "",
  type: "simple",
  promotion_id: "",
};

type VarRow = {
  id?: string;
  weight: string;
  price: string;
  sale_price: string;
  stock: string;
  pcs: string;
};
const blankVar = (): VarRow => ({ weight: "", price: "0", sale_price: "", stock: "", pcs: "" });

function ProductsAdmin() {
  const { data: products = [] } = useProducts({ all: true });
  const { data: categories = [] } = useCategories();
  const { data: promos = [] } = usePromotions({ all: true });
  const { data: allVariations = [] } = useAllVariations();
  const { data: mediaItems = [] } = useQuery({
    queryKey: ["media"],
    queryFn: () => listMedia() as Promise<Media[]>,
  });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [vars, setVars] = useState<VarRow[]>([]);
  const editing = !!form.id;
  const isVariable = form.type === "variable";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [picker, setPicker] = useState(false);
  // Extra gallery photos (beyond the cover image), edited as an ordered URL list.
  const galleryRef = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState<string[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryPicker, setGalleryPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const variationsByProduct = groupVariations(allVariations);

  const filtersActive =
    query.trim() !== "" || catFilter !== "all" || statusFilter !== "all" || typeFilter !== "all";
  const filtered = products.filter((p) => {
    if (query && !p.title.toLowerCase().includes(query.toLowerCase())) return false;
    if (catFilter !== "all" && p.category_id !== catFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (typeFilter !== "all" && p.type !== typeFilter) return false;
    return true;
  });

  // Clamp the page so it stays valid after filters shrink the list.
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);
  // Any filter change should send the admin back to the first page.
  const onFilterChange =
    <T,>(setter: (v: T) => void) =>
    (v: T) => {
      setter(v);
      setPage(1);
    };
  const resetFilters = () => {
    setQuery("");
    setCatFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
    setPage(1);
  };

  // Drag-reorder only makes sense against the full, unfiltered list — that's the
  // global order the storefront reads. With filters on, positions are ambiguous.
  const canReorder = !filtersActive;
  const reorder = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = products.map((p) => p.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const byId = new Map(products.map((p) => [p.id, p]));
    const next = ids.map((id) => byId.get(id)!);
    qc.setQueryData(["products", "all"], next);
    try {
      await reorderProducts({ data: { ids } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder");
    }
    qc.invalidateQueries({ queryKey: ["products"] });
  };

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

  const onGalleryUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setGalleryUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", await compressImage(file));
        const { url } = await uploadMedia({ data: fd });
        setGallery((g) => [...g, url]);
      }
      qc.invalidateQueries({ queryKey: ["media"] });
      toast.success(files.length > 1 ? "Images uploaded" : "Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setGalleryUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const openNew = () => {
    setForm(empty);
    setVars([]);
    setGallery([]);
    setPicker(false);
    setGalleryPicker(false);
    setOpen(true);
  };
  const openEdit = async (p: Product) => {
    setPicker(false);
    setGalleryPicker(false);
    setGallery([]);
    getProductImages({ data: { productId: p.id } }).then((rows) =>
      setGallery(rows.map((r) => r.url)),
    );
    setForm({
      id: p.id,
      title: p.title,
      description: p.description ?? "",
      price: String(p.price),
      sale_price: p.sale_price != null ? String(p.sale_price) : "",
      category_id: p.category_id ?? "",
      stock: p.stock != null ? String(p.stock) : "",
      status: p.status,
      image_url: p.image_url ?? "",
      badge: p.badge ?? "",
      rating: p.rating != null ? String(p.rating) : "",
      weight: p.weight ?? "",
      pcs: p.pcs != null ? String(p.pcs) : "",
      type: p.type,
      promotion_id: p.promotion_id ?? "",
    });
    setOpen(true);
    if (p.type === "variable") {
      const rows = await getVariations({ data: { productId: p.id, raw: true } });
      setVars(
        rows.map((v) => ({
          id: v.id,
          weight: v.weight,
          price: String(v.price),
          sale_price: v.sale_price != null ? String(v.sale_price) : "",
          stock: v.stock != null ? String(v.stock) : "",
          pcs: v.pcs != null ? String(v.pcs) : "",
        })),
      );
    } else {
      setVars([]);
    }
  };

  const variationPayload = () =>
    vars
      .filter((v) => v.weight.trim() !== "")
      .map((v, i) => ({
        id: v.id,
        weight: v.weight.trim(),
        price: Number(v.price) || 0,
        sale_price: v.sale_price.trim() === "" ? null : Number(v.sale_price),
        stock: v.stock.trim() === "" ? null : Number(v.stock),
        pcs: v.pcs.trim() === "" ? null : Number(v.pcs),
        sort_order: i,
      }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const variable = form.type === "variable";
    const payload = {
      title: form.title,
      description: form.description || null,
      // Variable products carry price/stock/weight on their variations, not here.
      price: variable ? 0 : Number(form.price),
      sale_price: variable || !form.sale_price ? null : Number(form.sale_price),
      category_id: form.category_id || null,
      stock: variable || form.stock.trim() === "" ? null : Number(form.stock),
      status: form.status,
      image_url: form.image_url || null,
      badge: form.badge || null,
      rating: form.rating.trim() === "" ? null : Number(form.rating),
      weight: variable || form.weight.trim() === "" ? null : form.weight.trim(),
      pcs: variable || form.pcs.trim() === "" ? null : Number(form.pcs),
      type: form.type,
      promotion_id: form.promotion_id || null,
    };
    try {
      let productId = form.id;
      if (editing) await updateProduct({ data: { id: form.id, ...payload } });
      else productId = (await createProduct({ data: payload })).id;
      if (variable) await saveVariations({ data: { productId, variations: variationPayload() } });
      await saveProductImages({ data: { productId, urls: gallery } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save product");
      return;
    }
    toast.success(editing ? "Product updated" : "Product created");
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["variations"] });
    qc.invalidateQueries({ queryKey: ["product_images"] });
    setOpen(false);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct({ data: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["variations"] });
  };

  const duplicate = async (p: Product) => {
    try {
      const { id } = await createProduct({
        data: {
          title: `${p.title} (Copy)`,
          description: p.description,
          price: p.price,
          sale_price: p.sale_price,
          category_id: p.category_id,
          stock: p.stock,
          status: "draft",
          image_url: p.image_url,
          badge: p.badge,
          rating: p.rating,
          weight: p.weight,
          pcs: p.pcs,
          type: p.type,
          promotion_id: p.promotion_id,
        },
      });
      if (p.type === "variable") {
        const rows = await getVariations({ data: { productId: p.id, raw: true } });
        await saveVariations({
          data: {
            productId: id,
            variations: rows.map((v, i) => ({
              weight: v.weight,
              price: v.price,
              sale_price: v.sale_price,
              stock: v.stock,
              pcs: v.pcs,
              sort_order: i,
            })),
          },
        });
      }
      const images = await getProductImages({ data: { productId: p.id } });
      if (images.length) {
        await saveProductImages({ data: { productId: id, urls: images.map((im) => im.url) } });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate");
      return;
    }
    toast.success("Product duplicated as draft");
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["variations"] });
  };

  // Price/stock/weight columns reflect variations for variable products.
  const priceLabel = (p: Product) => {
    if (p.type !== "variable") return `$${(p.sale_price ?? p.price).toFixed(2)}`;
    const vs = variationsByProduct.get(p.id) ?? [];
    if (!vs.length) return "—";
    const prices = vs.map((v) => v.sale_price ?? v.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)}–$${max.toFixed(2)}`;
  };
  const weightLabel = (p: Product) => {
    if (p.type !== "variable") {
      const parts = [];
      if (p.weight) parts.push(p.weight);
      if (p.pcs != null) parts.push(`${p.pcs} pcs`);
      return parts.length ? parts.join(" · ") : "—";
    }
    const n = (variationsByProduct.get(p.id) ?? []).length;
    return `${n} variation${n === 1 ? "" : "s"}`;
  };
  const stockLabel = (p: Product) => {
    if (p.type !== "variable") return p.stock == null ? "∞" : p.stock;
    const vs = variationsByProduct.get(p.id) ?? [];
    if (!vs.length) return "—";
    const tracked = vs.filter((v) => v.stock != null);
    if (tracked.length === 0) return "∞";
    return tracked.reduce((a, v) => a + (v.stock ?? 0), 0);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl">Products</h1>
          <p className="text-muted-foreground mt-1">
            {filtersActive
              ? `${filtered.length} of ${products.length}`
              : `${products.length} total`}
          </p>
        </div>
        <Button onClick={openNew} className="rounded-full">
          <Plus className="size-4 mr-1.5" /> New Product
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onFilterChange(setQuery)(e.target.value)}
            placeholder="Search by title..."
            className="pl-9"
          />
        </div>
        <Select value={catFilter} onValueChange={onFilterChange(setCatFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={onFilterChange(setStatusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={onFilterChange(setTypeFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="simple">Simple</SelectItem>
            <SelectItem value="variable">Variable</SelectItem>
          </SelectContent>
        </Select>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-brand">
            <X className="size-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {canReorder
          ? "Drag the ⠿ handle to reorder — this sets the order shown in the store."
          : "Clear filters and search to drag-reorder products."}
      </p>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-3"></th>
              <th className="text-left px-6 py-3">Product</th>
              <th className="text-left px-6 py-3">Price</th>
              <th className="text-left px-6 py-3">Weight</th>
              <th className="text-left px-6 py-3">Stock</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                  No products match your filters.
                </td>
              </tr>
            )}
            {paged.map((p) => (
              <tr
                key={p.id}
                draggable={canReorder}
                onDragStart={() => canReorder && setDragId(p.id)}
                onDragOver={(e) => {
                  if (!canReorder || !dragId) return;
                  e.preventDefault();
                  setOverId(p.id);
                }}
                onDrop={() => {
                  if (canReorder && dragId) reorder(dragId, p.id);
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                className={cn(
                  "border-t",
                  dragId === p.id && "opacity-40",
                  overId === p.id && dragId !== p.id && "border-t-2 border-t-brand",
                )}
              >
                <td className="px-2 py-3 text-center">
                  {canReorder ? (
                    <GripVertical className="size-4 text-muted-foreground/60 cursor-grab inline-block" />
                  ) : (
                    <GripVertical className="size-4 text-muted-foreground/20 inline-block" />
                  )}
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-muted overflow-hidden shrink-0">
                      {p.image_url && (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <span className="font-medium">{p.title}</span>
                    {p.type === "variable" && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand border border-brand/40 rounded px-1.5 py-0.5">
                        Variable
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-3 font-bold">{priceLabel(p)}</td>
                <td className="px-6 py-3 text-muted-foreground">{weightLabel(p)}</td>
                <td className="px-6 py-3">{stockLabel(p)}</td>
                <td className="px-6 py-3">
                  <span className="px-2 py-0.5 bg-muted rounded text-xs font-bold uppercase">
                    {p.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(p)}
                      aria-label="Edit"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => duplicate(p)}
                      aria-label="Duplicate"
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => del(p.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>per page</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            {rangeStart}–{rangeEnd} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Product" : "New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <Label>Product type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple product</SelectItem>
                  <SelectItem value="variable">Variable product (weights)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {!isVariable && (
                <>
                  <div>
                    <Label>Price</Label>
                    <Input
                      required
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Sale Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.sale_price}
                      onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Stock (blank = unlimited · 0 = out of stock)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="Unlimited"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Weight</Label>
                    <Input
                      placeholder="e.g. 250g, 1kg"
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Pcs per box</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="e.g. 24"
                      value={form.pcs}
                      onChange={(e) => setForm({ ...form, pcs: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div>
                <Label>Category</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Offer / Promotion</Label>
                <Select
                  value={form.promotion_id || "none"}
                  onValueChange={(v) => setForm({ ...form, promotion_id: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No offer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No offer</SelectItem>
                    {promos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Badge</Label>
                <Select
                  value={form.badge || "none"}
                  onValueChange={(v) => setForm({ ...form, badge: v === "none" ? "" : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="NEW">NEW</SelectItem>
                    <SelectItem value="HOT">HOT</SelectItem>
                    <SelectItem value="SALE">SALE</SelectItem>
                    <SelectItem value="ORGANIC">ORGANIC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rating (0–5)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  placeholder="4.5"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: e.target.value })}
                />
              </div>
            </div>

            {isVariable && (
              <div className="space-y-3 border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold">Variations (weights)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVars((v) => [...v, blankVar()])}
                  >
                    <Plus className="size-4 mr-1.5" /> Add variation
                  </Button>
                </div>
                {vars.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Add at least one weight, each with its own price and stock.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      <span>Weight</span>
                      <span>Price</span>
                      <span>Sale</span>
                      <span>Stock</span>
                      <span>Pcs/box</span>
                      <span></span>
                    </div>
                    {vars.map((v, i) => (
                      <div key={i} className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr_auto] gap-2">
                        <Input
                          placeholder="250g"
                          value={v.weight}
                          onChange={(e) =>
                            setVars((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, weight: e.target.value } : r)),
                            )
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={v.price}
                          onChange={(e) =>
                            setVars((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)),
                            )
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="—"
                          value={v.sale_price}
                          onChange={(e) =>
                            setVars((rows) =>
                              rows.map((r, j) =>
                                j === i ? { ...r, sale_price: e.target.value } : r,
                              ),
                            )
                          }
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="∞"
                          value={v.stock}
                          onChange={(e) =>
                            setVars((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, stock: e.target.value } : r)),
                            )
                          }
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="—"
                          value={v.pcs}
                          onChange={(e) =>
                            setVars((rows) =>
                              rows.map((r, j) => (j === i ? { ...r, pcs: e.target.value } : r)),
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setVars((rows) => rows.filter((_, j) => j !== i))}
                          aria-label="Remove variation"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Product image</Label>
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
                          <img
                            src={m.url}
                            alt={m.filename}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Gallery images</Label>
              <p className="text-xs text-muted-foreground">
                Extra photos shown under the main image on the product page (3–4 recommended).
              </p>
              <div className="flex flex-wrap gap-2">
                {gallery.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="size-20 rounded-lg border bg-muted overflow-hidden shrink-0 relative"
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setGallery((g) => g.filter((_, j) => j !== i))}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5"
                      aria-label="Remove gallery image"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={galleryUploading}
                    onClick={() => galleryRef.current?.click()}
                  >
                    {galleryUploading ? (
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
                    onClick={() => setGalleryPicker((v) => !v)}
                  >
                    <ImageIcon className="size-4 mr-1.5" /> Media library
                  </Button>
                </div>
              </div>
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => onGalleryUpload(e.target.files)}
              />
              {galleryPicker && (
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
                          onClick={() => setGallery((g) => [...g, m.url])}
                          className="aspect-square rounded-md overflow-hidden border hover:ring-2 ring-brand"
                        >
                          <img
                            src={m.url}
                            alt={m.filename}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button type="submit" className="w-full">
              {editing ? "Save changes" : "Create product"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
