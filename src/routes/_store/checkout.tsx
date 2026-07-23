import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCart, itemKey, itemUnitPrice } from "@/hooks/use-cart";
import { useAuth } from "@/hooks/use-auth";
import { useStoreSettings, useMyAddresses } from "@/hooks/use-products";
import { useQueryClient } from "@tanstack/react-query";
import type { Address } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRef, useState, useEffect } from "react";
import { createOrder } from "@/data/orders";
import { saveAddress } from "@/data/addresses";
import { validatePromoCode } from "@/data/promo-codes";
import { promoCodeDiscount } from "@/lib/promo-code";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { LocationMap } from "@/components/checkout/location-map";
import {
  MapPin,
  Check,
  Tag,
  X,
  Zap,
  CalendarClock,
  Minus,
  Plus,
  Trash2,
  Banknote,
  QrCode,
  Truck,
  Store,
  Phone,
} from "lucide-react";

// Kept in sync with the address shown in the site footer/header.
const STORE_ADDRESS = "Sangkat Tuol Svay Prey Ti Muoy, Phnom Penh";
const STORE_PHONE = "+855 99 361 350";
const STORE_COORDS = { lat: 11.5487448, lng: 104.9069336 };
const STORE_MAPS_LINK = "https://maps.app.goo.gl/bApHjzPGv86ScdqN9";

// Half-hour delivery slots, 9:30 AM – 9:30 PM. Customers can only pre-order
// within this window.
const SLOT_START_MINUTES = 9 * 60 + 30;
const SLOT_END_MINUTES = 21 * 60 + 30;
const TIME_SLOTS = (() => {
  const out: string[] = [];
  for (let m = SLOT_START_MINUTES; m <= SLOT_END_MINUTES; m += 30) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
})();
const timeLabel = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const slotMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
// Minimum lead time before a same-day slot can be booked (so customers can't
// pick a slot that's already passed, or one that's only minutes away).
const LEAD_MINUTES = 30;

// Temporarily hide the KHQR/COD payment selector until online payment goes live.
// When false, every order is Cash on Delivery. Flip back to true to re-enable.
const PAYMENT_METHODS_ENABLED = false;
const localToday = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const Route = createFileRoute("/_store/checkout")({
  component: Checkout,
});

function Checkout() {
  const { items, subtotal, clear, setQty, remove } = useCart();
  const { user } = useAuth();
  const { data: addresses = [] } = useMyAddresses(!!user);
  const qc = useQueryClient();
  const { data: settings } = useStoreSettings();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; type: string; value: number } | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  // Once the customer types into Address/City themselves, stop letting the
  // pin (drag, tap, or GPS) clobber it — only auto-fill fields they haven't
  // touched yet, so refining the pin never wipes out typed details like an
  // apartment number or landmark note.
  const addressDirty = useRef(false);
  const cityDirty = useRef(false);
  const [schedMode, setSchedMode] = useState<"asap" | "schedule">("asap");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [payment, setPayment] = useState<"cod" | "khqr">("cod");
  const [deliveryMethod, setDeliveryMethod] = useState<"delivery" | "pickup">("delivery");
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const appliedDefault = useRef(false);
  const scheduledAt =
    schedMode === "schedule" && schedDate && schedTime ? `${schedDate}T${schedTime}` : null;

  // For a same-day delivery, only offer slots at least LEAD_MINUTES from now so a
  // customer can't schedule a time that's already passed. Future dates: all slots.
  const isToday = schedDate === localToday();
  const earliestToday = (() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes() + LEAD_MINUTES;
  })();
  const availableSlots = isToday
    ? TIME_SLOTS.filter((t) => slotMinutes(t) >= earliestToday)
    : TIME_SLOTS;

  // If the day changes (or time passes) and the chosen slot is no longer valid,
  // clear it so a stale past time can't be submitted.
  useEffect(() => {
    if (schedTime && !availableSlots.includes(schedTime)) setSchedTime("");
  }, [schedTime, availableSlots]);

  const applyAddress = (a: Address) => {
    if (nameRef.current) nameRef.current.value = a.recipient_name || user?.name || "";
    if (phoneRef.current) phoneRef.current.value = a.phone || "";
    if (addressRef.current) addressRef.current.value = a.address || "";
    if (cityRef.current) cityRef.current.value = a.city || "";
    // A saved address is a deliberate, complete choice — treat it like manual
    // input so a follow-up pin drag refines the pin without rewriting it.
    addressDirty.current = true;
    cityDirty.current = true;
    setCoords(
      a.location_lat != null && a.location_lng != null
        ? { lat: a.location_lat, lng: a.location_lng }
        : null,
    );
  };
  const clearAddressFields = () => {
    if (phoneRef.current) phoneRef.current.value = "";
    if (addressRef.current) addressRef.current.value = "";
    if (cityRef.current) cityRef.current.value = "";
    addressDirty.current = false;
    cityDirty.current = false;
    setCoords(null);
  };

  // Pre-fill the form once with the customer's default saved address on load.
  useEffect(() => {
    if (appliedDefault.current || !user || addresses.length === 0) return;
    appliedDefault.current = true;
    const a = addresses.find((x) => x.is_default) ?? addresses[0];
    setSelectedAddressId(a.id);
    if (nameRef.current) nameRef.current.value = a.recipient_name || user.name || "";
    if (phoneRef.current) phoneRef.current.value = a.phone || "";
    if (addressRef.current) addressRef.current.value = a.address || "";
    if (cityRef.current) cityRef.current.value = a.city || "";
    addressDirty.current = true;
    cityDirty.current = true;
    if (a.location_lat != null && a.location_lng != null)
      setCoords({ lat: a.location_lat, lng: a.location_lng });
  }, [user, addresses]);

  const discount = applied ? promoCodeDiscount(applied.type, applied.value, subtotal) : 0;
  const discountedSubtotal = Math.max(0, subtotal - discount);
  const threshold = Number(settings?.free_shipping_threshold ?? 50);
  const shipping =
    deliveryMethod === "pickup" || discountedSubtotal >= threshold || discountedSubtotal === 0
      ? 0
      : 2.5;
  const total = discountedSubtotal + shipping;

  const applyCode = async () => {
    const c = code.trim();
    if (!c) return;
    setChecking(true);
    try {
      const r = await validatePromoCode({ data: { code: c, subtotal } });
      if (!r.valid) {
        setApplied(null);
        toast.error(r.message ?? "Invalid code");
      } else if (r.discount <= 0) {
        setApplied(null);
        toast.error("This code doesn't apply to your cart.");
      } else {
        setApplied({ code: r.code, type: r.type, value: r.value });
        toast.success(`Code ${r.code} applied`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't apply code");
    } finally {
      setChecking(false);
    }
  };

  // Reverse-geocodes a pin (free, no API key) and fills the address/city
  // fields. Shared by the GPS button and by dragging/clicking the map.
  const applyCoords = async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`,
      );
      const data = await res.json();
      if (data?.display_name && addressRef.current && !addressDirty.current)
        addressRef.current.value = data.display_name;
      const a = data?.address ?? {};
      const city = a.city || a.town || a.village || a.suburb || a.county;
      if (city && cityRef.current && !cityDirty.current) cityRef.current.value = city;
    } catch {
      // Geocoding failed — coordinates are still saved; customer can type the address.
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
        await applyCoords(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
        toast.success("Location pinned — address filled in!");
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — you can still order with your address."
            : "Couldn't get your location. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    // Guard against a scheduled time that has already passed (e.g. the slot
    // lapsed while the form sat open).
    if (scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) {
      toast.error("That delivery time has already passed — please pick a later time.");
      return;
    }
    setSubmitting(true);
    const orderItems = items.map((i) => ({
      id: i.variation?.id ?? i.product.id,
      title: i.variation ? `${i.product.title} (${i.variation.weight})` : i.product.title,
      qty: i.qty,
      price: itemUnitPrice(i),
    }));
    const customerName = nameRef.current?.value?.trim() || (user?.name ?? "");
    const customerEmail = emailRef.current?.value?.trim() ?? "";
    let res;
    try {
      res = await createOrder({
        data: {
          items: orderItems,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: phoneRef.current?.value ?? "",
          address: deliveryMethod === "pickup" ? "" : (addressRef.current?.value ?? ""),
          city: deliveryMethod === "pickup" ? "" : (cityRef.current?.value ?? ""),
          location_lat: deliveryMethod === "pickup" ? null : (coords?.lat ?? null),
          location_lng: deliveryMethod === "pickup" ? null : (coords?.lng ?? null),
          promo_code: applied?.code ?? null,
          scheduled_at: scheduledAt,
          delivery_method: deliveryMethod,
          payment_method: payment,
        },
      });
    } catch (err) {
      setSubmitting(false);
      toast.error(err instanceof Error ? err.message : "Failed to place order");
      return;
    }
    setSubmitting(false);
    // Persist a newly typed address to the customer's address book if they opted in.
    if (deliveryMethod === "delivery" && user && selectedAddressId === null && saveNewAddress) {
      try {
        await saveAddress({
          data: {
            recipient_name: customerName,
            phone: phoneRef.current?.value ?? "",
            address: addressRef.current?.value ?? "",
            city: cityRef.current?.value ?? "",
            location_lat: coords?.lat ?? null,
            location_lng: coords?.lng ?? null,
            is_default: addresses.length === 0,
          },
        });
        qc.invalidateQueries({ queryKey: ["my-addresses"] });
      } catch {
        // Non-fatal: the order is already placed; saving the address is a convenience.
      }
    }
    try {
      sessionStorage.setItem(
        "bosba:last-order",
        JSON.stringify({
          id: res.id,
          total: res.total,
          discount,
          promo_code: applied?.code ?? null,
          scheduled_at: scheduledAt,
          items: orderItems,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: phoneRef.current?.value ?? "",
          address: deliveryMethod === "pickup" ? "" : (addressRef.current?.value ?? ""),
          city: deliveryMethod === "pickup" ? "" : (cityRef.current?.value ?? ""),
          delivery_method: deliveryMethod,
          created_at: new Date().toISOString(),
        }),
      );
    } catch {
      // sessionStorage unavailable — the page falls back to a generic thank-you.
    }
    clear();
    // KHQR orders aren't confirmed yet — send the customer to pay first; the pay
    // screen advances to /thank-you once payment lands. COD is done immediately.
    if (res.payment_method === "khqr") {
      navigate({ to: "/pay/$id", params: { id: res.id }, search: { ret: false, failed: false } });
    } else {
      navigate({ to: "/thank-you" });
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display font-semibold tracking-tight text-3xl">Your cart is empty</h1>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/shop">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 grid lg:grid-cols-[1fr_400px] gap-10">
      <form onSubmit={placeOrder} className="space-y-6">
        <h1 className="font-display font-semibold tracking-tight text-3xl">Checkout</h1>

        <section className="space-y-4 bg-muted rounded-2xl p-6">
          <h2 className="font-display font-semibold text-lg">Delivery Details</h2>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { key: "delivery", label: "Delivery", icon: Truck },
                { key: "pickup", label: "Pickup at store", icon: Store },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setDeliveryMethod(opt.key)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
                  deliveryMethod === opt.key
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border hover:bg-background",
                )}
              >
                <opt.icon className="size-4" />
                {opt.label}
              </button>
            ))}
          </div>

          {deliveryMethod === "pickup" && (
            <div className="rounded-xl border bg-background p-4 space-y-3 text-sm">
              <div className="space-y-1.5">
                <p className="font-medium">Collect your order from our store</p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 shrink-0" /> {STORE_ADDRESS}
                </p>
                <a
                  href={`tel:${STORE_PHONE.replace(/\s+/g, "")}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground w-fit"
                >
                  <Phone className="size-4 shrink-0" /> {STORE_PHONE}
                </a>
              </div>
              <LocationMap coords={STORE_COORDS} readOnly />
              <a
                href={STORE_MAPS_LINK}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                <MapPin className="size-4" /> Open in Google Maps for directions
              </a>
            </div>
          )}

          {deliveryMethod === "delivery" && user && addresses.length > 0 && (
            <div className="space-y-2">
              <Label>Saved addresses</Label>
              <div className="flex flex-wrap gap-2">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedAddressId(a.id);
                      applyAddress(a);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selectedAddressId === a.id
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border hover:bg-background",
                    )}
                  >
                    {a.label || a.address.slice(0, 24)}
                    {a.is_default ? " · Default" : ""}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAddressId(null);
                    clearAddressFields();
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    selectedAddressId === null
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border hover:bg-background",
                  )}
                >
                  + New address
                </button>
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Full name</Label>
              <Input ref={nameRef} required defaultValue={user?.name ?? ""} />
            </div>
            <div>
              <Label>
                Email{!user && <span className="text-muted-foreground"> (optional)</span>}
              </Label>
              <Input
                ref={emailRef}
                required={!!user}
                type="email"
                defaultValue={user?.email ?? ""}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Phone</Label>
              <Input ref={phoneRef} required type="tel" placeholder="+855 12 345 678" />
            </div>
            {deliveryMethod === "delivery" && (
              <>
                <div className="sm:col-span-2">
                  <Label>Address</Label>
                  <div className="flex gap-2">
                    <Input
                      ref={addressRef}
                      required
                      placeholder="123 Phnom Penh"
                      className="flex-1 min-w-0"
                      onChange={() => {
                        addressDirty.current = true;
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={captureLocation}
                      disabled={locating}
                      className="shrink-0 gap-2"
                    >
                      <MapPin className="size-4" />
                      {locating ? "Locating…" : coords ? "Pinned" : "Pin location"}
                    </Button>
                  </div>
                  {coords && (
                    <a
                      href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
                    >
                      <Check className="size-4" /> Location pinned — view on map
                    </a>
                  )}
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Or drag the pin to your exact location</Label>
                  <LocationMap coords={coords} onChange={(c) => applyCoords(c.lat, c.lng)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>City</Label>
                  <Input
                    ref={cityRef}
                    required
                    onChange={() => {
                      cityDirty.current = true;
                    }}
                  />
                </div>
                {user && selectedAddressId === null && (
                  <label className="sm:col-span-2 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={saveNewAddress}
                      onChange={(e) => setSaveNewAddress(e.target.checked)}
                      className="size-4 rounded border-border accent-brand"
                    />
                    Save this address to my address book
                  </label>
                )}
              </>
            )}
            <div className="sm:col-span-2">
              <Label>Delivery time</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(
                  [
                    { key: "asap", label: "As soon as possible", icon: Zap },
                    { key: "schedule", label: "Schedule (pre-order)", icon: CalendarClock },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSchedMode(opt.key)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
                      schedMode === opt.key
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border hover:bg-background",
                    )}
                  >
                    <opt.icon className="size-4" />
                    {opt.label}
                  </button>
                ))}
              </div>

              {schedMode === "schedule" && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      min={localToday()}
                      value={schedDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        // Mobile pickers don't always enforce `min`; reject past dates here.
                        if (v && v < localToday()) {
                          toast.error("Please choose today or a later date.");
                          return;
                        }
                        setSchedDate(v);
                      }}
                      className="bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Time</Label>
                    <Select
                      value={schedTime}
                      onValueChange={setSchedTime}
                      disabled={!schedDate || availableSlots.length === 0}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Pick a time" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {availableSlots.map((t) => (
                          <SelectItem key={t} value={t}>
                            {timeLabel(t)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {isToday && availableSlots.length === 0 ? (
                    <p className="col-span-2 text-xs text-destructive">
                      No more delivery slots today — please choose another date.
                    </p>
                  ) : (
                    (!schedDate || !schedTime) && (
                      <p className="col-span-2 text-xs text-muted-foreground">
                        Pick a date and time, or switch back to “As soon as possible.”
                      </p>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {PAYMENT_METHODS_ENABLED && (
          <section className="space-y-4 bg-muted rounded-2xl p-6">
            <h2 className="font-display font-semibold text-lg">Payment Method</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  {
                    key: "cod",
                    label: "Cash on Delivery",
                    desc: "Pay with cash when your order arrives.",
                    icon: Banknote,
                  },
                  {
                    key: "khqr",
                    label: "KHQR",
                    desc: "Scan & pay now with any bank app.",
                    icon: QrCode,
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setPayment(opt.key)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    payment === opt.key
                      ? "border-brand bg-brand/10"
                      : "border-border hover:bg-background",
                  )}
                >
                  <opt.icon
                    className={cn("size-5 mt-0.5 shrink-0", payment === opt.key && "text-brand")}
                  />
                  <span>
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{opt.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <Button type="submit" disabled={submitting} size="lg" className="w-full rounded-full">
          {submitting
            ? "Placing order..."
            : payment === "khqr"
              ? `Continue to payment — $${total.toFixed(2)}`
              : `Place order — $${total.toFixed(2)}`}
        </Button>
      </form>

      <aside className="bg-muted rounded-2xl p-6 h-fit sticky top-28 space-y-4">
        <h2 className="font-display font-semibold text-lg">Order Summary</h2>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {items.map((item) => {
            const key = itemKey(item);
            const unit = itemUnitPrice(item);
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() =>
                    item.product.image_url &&
                    setPreview({ url: item.product.image_url, title: item.product.title })
                  }
                  disabled={!item.product.image_url}
                  title={item.product.image_url ? `View ${item.product.title} image` : undefined}
                  className="size-10 rounded-lg bg-background overflow-hidden shrink-0 hover:ring-2 hover:ring-brand transition-shadow disabled:cursor-default"
                >
                  {item.product.image_url && (
                    <img
                      src={item.product.image_url}
                      alt={item.product.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">
                    {item.product.title}
                    {item.variation ? ` (${item.variation.weight})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">${unit.toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-1 border rounded-full shrink-0">
                  <button
                    type="button"
                    onClick={() => setQty(key, item.qty - 1)}
                    className="size-7 grid place-items-center hover:bg-background rounded-full"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="text-xs font-semibold w-5 text-center">{item.qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(key, item.qty + 1)}
                    className="size-7 grid place-items-center hover:bg-background rounded-full"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <span className="font-bold w-16 text-right shrink-0">
                  ${(unit * item.qty).toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(key)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t pt-4">
          {applied ? (
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 font-medium text-brand">
                <Tag className="size-4" /> {applied.code}
              </span>
              <button
                type="button"
                onClick={() => {
                  setApplied(null);
                  setCode("");
                }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" /> Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCode();
                  }
                }}
                placeholder="Promo code"
                className="flex-1 min-w-0 uppercase"
              />
              <Button
                type="button"
                variant="outline"
                onClick={applyCode}
                disabled={checking || !code.trim()}
                className="shrink-0"
              >
                {checking ? "…" : "Apply"}
              </Button>
            </div>
          )}
        </div>
        <div className="border-t pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-brand">
              <span>Discount{applied ? ` (${applied.code})` : ""}</span>
              <span>−${discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between font-display font-semibold text-lg pt-2 border-t">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </aside>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
          </DialogHeader>
          {preview && (
            <img
              src={preview.url}
              alt={preview.title}
              className="w-full max-h-[70vh] rounded-lg object-contain bg-muted"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
