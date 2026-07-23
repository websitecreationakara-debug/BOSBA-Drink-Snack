import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Plus, Pencil, Trash2, Star, User, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useMyAddresses } from "@/hooks/use-products";
import { saveAddress, updateAddress, deleteAddress, setDefaultAddress } from "@/data/addresses";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_store/addresses")({ component: MyAddresses });

type AddressForm = {
  label: string;
  recipient_name: string;
  phone: string;
  address: string;
  city: string;
  is_default: boolean;
  location_lat: number | null;
  location_lng: number | null;
};

const emptyForm: AddressForm = {
  label: "",
  recipient_name: "",
  phone: "",
  address: "",
  city: "",
  is_default: false,
  location_lat: null,
  location_lng: null,
};

function MyAddresses() {
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: addresses = [], isLoading } = useMyAddresses(!!user);
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["my-addresses"] });

  const openNew = () => {
    setForm({ ...emptyForm, recipient_name: user?.name ?? "", is_default: addresses.length === 0 });
    setEditing("new");
  };
  const openEdit = (a: Address) => {
    setForm({
      label: a.label ?? "",
      recipient_name: a.recipient_name ?? "",
      phone: a.phone ?? "",
      address: a.address ?? "",
      city: a.city ?? "",
      is_default: a.is_default,
      location_lat: a.location_lat,
      location_lng: a.location_lng,
    });
    setEditing(a);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim()) {
      toast.error("Address is required");
      return;
    }
    setSaving(true);
    try {
      if (editing && editing !== "new") {
        await updateAddress({ data: { id: editing.id, ...form } });
      } else {
        await saveAddress({ data: { ...form } });
      }
      await invalidate();
      setEditing(null);
      toast.success("Address saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save address");
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await setDefaultAddress({ data: { id } });
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update default");
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteAddress({ data: { id } });
      await invalidate();
      toast.success("Address removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove address");
    }
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`,
          );
          const data = await res.json();
          const addr = data?.address ?? {};
          const city = addr.city || addr.town || addr.village || addr.suburb || addr.county;
          setForm((f) => ({
            ...f,
            location_lat: lat,
            location_lng: lng,
            address: data?.display_name || f.address,
            city: f.city || city || f.city,
          }));
        } catch {
          // Geocoding failed — keep the coordinates; the typed address stands.
          setForm((f) => ({ ...f, location_lat: lat, location_lng: lng }));
        }
        setLocating(false);
        toast.success("Location pinned — address filled in!");
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — you can still type your address."
            : "Couldn't get your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-6 py-8 md:py-12 space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="size-20 rounded-full bg-muted grid place-items-center mx-auto mb-6">
          <User className="size-8 text-muted-foreground" />
        </div>
        <h1 className="font-display font-semibold tracking-tight text-3xl">
          Sign in to manage addresses
        </h1>
        <p className="text-muted-foreground mt-2">
          Save your delivery addresses so you don’t have to re-enter them at checkout.
        </p>
        <Link
          to="/auth"
          className="inline-flex mt-6 items-center gap-2 rounded-full bg-brand text-brand-foreground px-6 py-3 text-sm font-semibold hover:bg-secondary-accent transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-6 py-8 md:py-12">
      <div className="flex items-center justify-between mb-8 gap-4">
        <h1 className="font-display font-semibold tracking-tight text-3xl md:text-4xl">
          My Addresses
        </h1>
        <Button onClick={openNew} className="rounded-full shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Add address
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-20 rounded-3xl bg-muted">
          <div className="size-16 rounded-full bg-background grid place-items-center mx-auto mb-5">
            <MapPin className="size-7 text-muted-foreground" />
          </div>
          <p className="font-display font-semibold text-xl">No saved addresses yet</p>
          <p className="text-muted-foreground text-sm mt-1">
            Add an address once and pick it in a tap next time you check out.
          </p>
          <Button onClick={openNew} className="rounded-full mt-6">
            <Plus className="mr-2 h-4 w-4" /> Add your first address
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {addresses.map((a) => (
            <div key={a.id} className="bg-card border rounded-2xl p-5 md:p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{a.label || "Address"}</p>
                    {a.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand px-2 py-0.5 text-xs font-semibold">
                        <Star className="size-3 fill-current" /> Default
                      </span>
                    )}
                  </div>
                  {a.recipient_name && (
                    <p className="text-sm text-muted-foreground mt-1">{a.recipient_name}</p>
                  )}
                  {a.phone && <p className="text-sm text-muted-foreground">{a.phone}</p>}
                  <p className="text-sm mt-2">{a.address}</p>
                  {a.city && <p className="text-sm text-muted-foreground">{a.city}</p>}
                  {a.location_lat != null && a.location_lng != null && (
                    <a
                      href={`https://www.google.com/maps?q=${a.location_lat},${a.location_lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                    >
                      <MapPin className="size-3.5" /> View pinned location
                    </a>
                  )}
                </div>
              </div>
              <div className="mt-4 border-t pt-4 flex items-center gap-2 flex-wrap">
                {!a.is_default && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => makeDefault(a.id)}
                  >
                    <Star className="mr-2 h-4 w-4" /> Set default
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => openEdit(a)}
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-muted-foreground hover:text-destructive ml-auto"
                  onClick={() => remove(a.id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing && editing !== "new" ? "Edit address" : "Add address"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Label (optional)</Label>
                <Input
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Home, Office…"
                />
              </div>
              <div>
                <Label>Recipient name</Label>
                <Input
                  value={form.recipient_name}
                  onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+855 12 345 678"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Address</Label>
                <div className="flex gap-2">
                  <Input
                    required
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="123 Phnom Penh"
                    className="flex-1 min-w-0"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={captureLocation}
                    disabled={locating}
                    className="shrink-0 gap-2"
                  >
                    <MapPin className="size-4" />
                    {locating ? "Locating…" : form.location_lat != null ? "Pinned" : "Pin location"}
                  </Button>
                </div>
                {form.location_lat != null && (
                  <a
                    href={`https://www.google.com/maps?q=${form.location_lat},${form.location_lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                  >
                    <Check className="size-4" /> Location pinned — view on map
                  </a>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="size-4 rounded border-border accent-brand"
              />
              Set as default delivery address
            </label>
            <DialogFooter>
              <Button type="submit" disabled={saving} className="rounded-full">
                {saving ? "Saving…" : "Save address"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
