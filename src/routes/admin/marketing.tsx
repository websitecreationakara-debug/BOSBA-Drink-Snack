import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useProducts, usePromotions } from "@/hooks/use-products";
import {
  createPromotion,
  updatePromotion,
  deletePromotion,
  assignPromotion,
} from "@/data/promotions";
import {
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from "@/data/promo-codes";
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
import { Plus, Pencil, Trash2, X, Search, Tag, Percent, Ticket } from "lucide-react";
import { toast } from "sonner";
import { KIND_LABEL } from "@/lib/promotions";
import type { Promotion, PromoCode } from "@/lib/types";

export const Route = createFileRoute("/admin/marketing")({ component: MarketingAdmin });

const empty = {
  id: "",
  name: "",
  kind: "special",
  description: "",
  discount_pct: "",
  starts_at: "",
  ends_at: "",
  active: "true",
  sort_order: "0",
};

// Live/scheduled/ended state for the status pill, derived from the date window.
function promoStatus(p: Promotion) {
  if (!p.active) return { label: "Hidden", cls: "bg-muted text-muted-foreground" };
  const now = Date.now();
  if (p.starts_at && now < Date.parse(`${p.starts_at}T00:00:00`))
    return { label: "Scheduled", cls: "bg-warning/20 text-warning" };
  if (p.ends_at && now > Date.parse(`${p.ends_at}T23:59:59`))
    return { label: "Ended", cls: "bg-muted text-muted-foreground" };
  return { label: "Live", cls: "bg-success/20 text-success" };
}

const period = (p: Promotion) => {
  if (!p.starts_at && !p.ends_at) return "Always on";
  return `${p.starts_at || "…"} → ${p.ends_at || "…"}`;
};

const emptyCode = { id: "", code: "", type: "percent", value: "", active: "true" };

const codeValueLabel = (c: PromoCode) =>
  c.type === "fixed" ? `$${c.value.toFixed(2)} off` : `${c.value}% off`;

function MarketingAdmin() {
  const { data: promos = [] } = usePromotions({ all: true });
  const { data: products = [] } = useProducts({ all: true });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const editing = !!form.id;

  // Product picker dialog state.
  const [pickerFor, setPickerFor] = useState<Promotion | null>(null);
  const [pickerSel, setPickerSel] = useState<Set<string>>(new Set());
  const [pickerQuery, setPickerQuery] = useState("");

  // Promo codes.
  const { data: codes = [] } = useQuery({
    queryKey: ["promo-codes"],
    queryFn: () => listPromoCodes() as Promise<PromoCode[]>,
  });
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeForm, setCodeForm] = useState(emptyCode);
  const codeEditing = !!codeForm.id;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["promotions"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };
  const refreshCodes = () => qc.invalidateQueries({ queryKey: ["promo-codes"] });

  const openNewCode = () => {
    setCodeForm(emptyCode);
    setCodeOpen(true);
  };
  const openEditCode = (c: PromoCode) => {
    setCodeForm({
      id: c.id,
      code: c.code,
      type: c.type,
      value: String(c.value),
      active: c.active ? "true" : "false",
    });
    setCodeOpen(true);
  };
  const saveCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: codeForm.code,
      type: codeForm.type,
      value: codeForm.value.trim() === "" ? 0 : Number(codeForm.value),
      active: codeForm.active === "true",
    };
    try {
      if (codeEditing) await updatePromoCode({ data: { id: codeForm.id, ...payload } });
      else await createPromoCode({ data: payload });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save code");
      return;
    }
    toast.success(codeEditing ? "Code updated" : "Code created");
    refreshCodes();
    setCodeOpen(false);
  };
  const delCode = async (id: string) => {
    if (!confirm("Delete this promo code?")) return;
    try {
      await deletePromoCode({ data: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      return;
    }
    toast.success("Code deleted");
    refreshCodes();
  };

  const openNew = () => {
    setForm({ ...empty, sort_order: String(promos.length) });
    setOpen(true);
  };
  const openEdit = (p: Promotion) => {
    setForm({
      id: p.id,
      name: p.name,
      kind: p.kind,
      description: p.description ?? "",
      discount_pct: p.discount_pct != null ? String(p.discount_pct) : "",
      starts_at: p.starts_at ?? "",
      ends_at: p.ends_at ?? "",
      active: p.active ? "true" : "false",
      sort_order: String(p.sort_order),
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      description: form.description.trim() || null,
      discount_pct: form.discount_pct.trim() === "" ? null : Number(form.discount_pct),
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      active: form.active === "true",
      sort_order: form.sort_order.trim() === "" ? 0 : Number(form.sort_order),
    };
    try {
      if (editing) await updatePromotion({ data: { id: form.id, ...payload } });
      else await createPromotion({ data: payload });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save offer");
      return;
    }
    toast.success(editing ? "Offer updated" : "Offer created");
    refresh();
    setOpen(false);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this offer? Assigned products keep their normal price.")) return;
    try {
      await deletePromotion({ data: { id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      return;
    }
    toast.success("Offer deleted");
    refresh();
  };

  const removeProduct = async (productId: string) => {
    try {
      await assignPromotion({ data: { productIds: [productId], promotionId: null } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
      return;
    }
    refresh();
  };

  const openPicker = (p: Promotion) => {
    setPickerFor(p);
    setPickerSel(new Set());
    setPickerQuery("");
  };
  const confirmPicker = async () => {
    if (!pickerFor || pickerSel.size === 0) {
      setPickerFor(null);
      return;
    }
    try {
      await assignPromotion({
        data: { productIds: [...pickerSel], promotionId: pickerFor.id },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign");
      return;
    }
    toast.success(`Added ${pickerSel.size} product(s)`);
    refresh();
    setPickerFor(null);
  };

  const pickerList = products.filter(
    (p) =>
      p.promotion_id !== pickerFor?.id && p.title.toLowerCase().includes(pickerQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-3xl">Marketing</h1>
          <p className="text-muted-foreground mt-1">
            {promos.length} offer(s) — time-boxed promotions for the storefront.
          </p>
        </div>
        <Button onClick={openNew} className="rounded-full">
          <Plus className="size-4 mr-1.5" /> New Offer
        </Button>
      </div>

      <div className="space-y-4">
        {promos.length === 0 && (
          <p className="bg-card border rounded-2xl px-5 py-10 text-center text-muted-foreground text-sm">
            No offers yet. Create one, then assign products to it.
          </p>
        )}
        {promos.map((p) => {
          const assigned = products.filter((pr) => pr.promotion_id === p.id);
          const status = promoStatus(p);
          return (
            <div key={p.id} className="bg-card border rounded-2xl p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display font-bold text-lg">{p.name || "(untitled)"}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand border border-brand/40 rounded px-1.5 py-0.5">
                      {KIND_LABEL[p.kind] ?? p.kind}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
                    <span className="inline-flex items-center gap-1">
                      <Tag className="size-3.5" /> {period(p)}
                    </span>
                    {p.discount_pct ? (
                      <span className="inline-flex items-center gap-1 text-brand font-semibold">
                        <Percent className="size-3.5" /> {p.discount_pct}% off
                      </span>
                    ) : (
                      <span>No discount (featured only)</span>
                    )}
                  </div>
                  {p.description && (
                    <p className="text-sm text-muted-foreground mt-2">{p.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => del(p.id)} aria-label="Delete">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {assigned.length} product(s)
                  </span>
                  <Button variant="outline" size="sm" onClick={() => openPicker(p)}>
                    <Plus className="size-4 mr-1.5" /> Add products
                  </Button>
                </div>
                {assigned.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No products in this offer yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assigned.map((pr) => (
                      <span
                        key={pr.id}
                        className="inline-flex items-center gap-2 bg-muted rounded-full pl-1 pr-2 py-1 text-sm"
                      >
                        <span className="size-6 rounded-full bg-background overflow-hidden shrink-0">
                          {pr.image_url && (
                            <img src={pr.image_url} alt="" className="w-full h-full object-cover" />
                          )}
                        </span>
                        <span className="max-w-[160px] truncate">{pr.title}</span>
                        <button
                          type="button"
                          onClick={() => removeProduct(pr.id)}
                          aria-label={`Remove ${pr.title}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Promo codes */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-xl">Promo Codes</h2>
            <p className="text-muted-foreground text-sm mt-0.5">
              Discount codes customers enter at checkout.
            </p>
          </div>
          <Button onClick={openNewCode} variant="outline" className="rounded-full">
            <Plus className="size-4 mr-1.5" /> New Code
          </Button>
        </div>

        <div className="bg-card border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="text-left px-6 py-3">Code</th>
                <th className="text-left px-6 py-3">Discount</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    No promo codes yet.
                  </td>
                </tr>
              )}
              {codes.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center gap-2 font-mono font-bold">
                      <Ticket className="size-4 text-brand" /> {c.code}
                    </span>
                  </td>
                  <td className="px-6 py-3">{codeValueLabel(c)}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        c.active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.active ? "Active" : "Off"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditCode(c)}
                        aria-label="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => delCode(c.id)}
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
      </div>

      {/* Create / edit promo code */}
      <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{codeEditing ? "Edit Code" : "New Code"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveCode} className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input
                required
                value={codeForm.code}
                onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value })}
                placeholder="SAVE10"
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Saved in capitals; customers can type it any case.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={codeForm.type}
                  onValueChange={(v) => setCodeForm({ ...codeForm, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">% off</SelectItem>
                    <SelectItem value="fixed">$ off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{codeForm.type === "fixed" ? "Amount ($)" : "Percent (%)"}</Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step={codeForm.type === "fixed" ? "0.01" : "1"}
                  value={codeForm.value}
                  onChange={(e) => setCodeForm({ ...codeForm, value: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={codeForm.active}
                onValueChange={(v) => setCodeForm({ ...codeForm, active: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">
              {codeEditing ? "Save changes" : "Create code"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create / edit offer */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Offer" : "New Offer"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Summer Sashimi Sale"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="limited">Limited Offer</SelectItem>
                    <SelectItem value="seasonal">Seasonal Offer</SelectItem>
                    <SelectItem value="special">Special Offer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Discount % (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="e.g. 15"
                  value={form.discount_pct}
                  onChange={(e) => setForm({ ...form, discount_pct: e.target.value })}
                />
              </div>
              <div>
                <Label>Start date (optional)</Label>
                <Input
                  type="date"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div>
                <Label>End date (optional)</Label>
                <Input
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={form.active} onValueChange={(v) => setForm({ ...form, active: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Hidden</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Shown under the offer heading on the storefront."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leave both dates blank for an always-on offer. The offer only shows in the store while
              active and within its dates.
            </p>
            <Button type="submit" className="w-full">
              {editing ? "Save changes" : "Create offer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add products to an offer */}
      <Dialog open={!!pickerFor} onOpenChange={(o) => !o && setPickerFor(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Add products to {pickerFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search products..."
              className="pl-9"
            />
          </div>
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
            {pickerList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No products to add.</p>
            ) : (
              pickerList.map((pr) => {
                const checked = pickerSel.has(pr.id);
                return (
                  <label
                    key={pr.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setPickerSel((s) => {
                          const next = new Set(s);
                          if (checked) next.delete(pr.id);
                          else next.add(pr.id);
                          return next;
                        })
                      }
                    />
                    <span className="size-8 rounded-lg bg-muted overflow-hidden shrink-0">
                      {pr.image_url && (
                        <img src={pr.image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-sm">{pr.title}</span>
                    {pr.promotion_id && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        in another offer
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
          <Button onClick={confirmPicker} disabled={pickerSel.size === 0} className="w-full">
            Add {pickerSel.size > 0 ? pickerSel.size : ""} product(s)
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
