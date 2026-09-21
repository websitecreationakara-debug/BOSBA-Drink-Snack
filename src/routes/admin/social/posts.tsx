import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useProducts,
  useAllVariations,
  useProductTabs,
  useProductImages,
} from "@/hooks/use-products";
import {
  listSocialPosts,
  queueSocialPost,
  deleteSocialPost,
  publishQueuedSocialPostsNow,
} from "@/data/social";
import { useConfirm } from "@/components/common/confirm-dialog";
import { renderFormattedDescription } from "@/lib/format-description";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Facebook,
  Instagram,
  Music2,
  Send as TelegramIcon,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ChevronsUpDown,
  Check,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { SocialPlatform, SocialPost, Product } from "@/types";

export const Route = createFileRoute("/admin/social/posts")({ component: SocialPostsAdmin });

const PLATFORM_ICON: Record<SocialPlatform, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  telegram: TelegramIcon,
  tiktok: Music2,
};

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  telegram: "Telegram",
  tiktok: "Tiktok",
};

const STATUS_BADGE: Record<SocialPost["status"], string> = {
  queued: "bg-muted text-muted-foreground",
  published: "bg-success/20 text-success",
  failed: "bg-destructive/20 text-destructive",
};

function nextTopOfHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SocialPostsAdmin() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: products = [] } = useProducts({ all: true });
  const { data: variations = [] } = useAllVariations();
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["social_posts"],
    queryFn: () => listSocialPosts() as Promise<SocialPost[]>,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [extraNote, setExtraNote] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [scheduledFor, setScheduledFor] = useState(() => toLocalInputValue(nextTopOfHour()));
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [queuing, setQueuing] = useState(false);
  const [publishingNow, setPublishingNow] = useState(false);

  const { data: tabs = [] } = useProductTabs(selected?.id ?? "");
  const { data: gallery = [] } = useProductImages(selected?.id ?? "");

  const priceLabel = (p: Product) => {
    if (p.type !== "variable") return `$${(p.sale_price ?? p.price).toFixed(2)}`;
    const vs = variations.filter((v) => v.product_id === p.id);
    if (!vs.length) return "—";
    const prices = vs.map((v) => v.sale_price ?? v.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)}–$${max.toFixed(2)}`;
  };

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, search]);

  const photos = useMemo(() => {
    const urls = [selected?.image_url, ...gallery.map((g) => g.url)].filter(
      (u): u is string => !!u,
    );
    return Array.from(new Set(urls));
  }, [selected, gallery]);

  const resetForm = () => {
    setSelected(null);
    setSearch("");
    setExtraNote("");
    setSelectedImage(null);
    setScheduledFor(toLocalInputValue(nextTopOfHour()));
    setSelectedPlatforms([]);
  };

  const pickProduct = (p: Product) => {
    setSelected(p);
    setSelectedImage(p.image_url ?? null);
    setComboOpen(false);
  };

  const togglePlatform = (platform: SocialPlatform) =>
    setSelectedPlatforms((s) =>
      s.includes(platform) ? s.filter((p) => p !== platform) : [...s, platform],
    );

  const schedule = async () => {
    if (!selected) return;
    setQueuing(true);
    try {
      await queueSocialPost({
        data: {
          product_id: selected.id,
          image_url: selectedImage,
          extra_note: extraNote.trim() || null,
          scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : "",
          platforms: selectedPlatforms,
        },
      });
      toast.success(`Scheduled "${selected.title}"`);
      qc.invalidateQueries({ queryKey: ["social_posts"] });
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule post");
    } finally {
      setQueuing(false);
    }
  };

  const del = async (p: SocialPost) => {
    const ok = await confirm({
      title: `Delete this post?`,
      description: `"${p.product_title}" will be removed from the history.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    try {
      await deleteSocialPost({ data: { id: p.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["social_posts"] });
  };

  const publishNow = async () => {
    setPublishingNow(true);
    try {
      const { published, failed } = await publishQueuedSocialPostsNow();
      if (published === 0 && failed === 0) {
        toast.info("Nothing to publish yet — no queued post's scheduled time has arrived");
      } else if (failed > 0) {
        toast.error(
          published > 0
            ? `Published ${published}, but ${failed} failed — check the post for details`
            : `${failed} post${failed === 1 ? "" : "s"} failed to publish — check the post for details`,
        );
      } else {
        toast.success(`Published ${published} post${published === 1 ? "" : "s"}`);
      }
      qc.invalidateQueries({ queryKey: ["social_posts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishingNow(false);
    }
  };

  const hasQueued = posts.some((p) => p.status === "queued");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl">Social Posts</h1>
          <p className="text-muted-foreground mt-1">
            Pick a product from the catalog — the post uses its real name, description, tabs, and
            price exactly as written, and publishes automatically every hour.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {hasQueued && (
            <Button variant="outline" onClick={publishNow} disabled={publishingNow}>
              {publishingNow ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Zap className="size-4 mr-1.5" />
              )}
              Publish now
            </Button>
          )}
          <Button
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
            className="rounded-full"
          >
            <Plus className="size-4 mr-1.5" /> New Post
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
          <Loader2 className="size-4 animate-spin" /> Loading...
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-card border rounded-2xl p-10 text-center text-muted-foreground">
          No posts yet — pick a product to queue the first one.
        </div>
      ) : (
        <div className="bg-card border rounded-2xl divide-y">
          {posts.map((p) => (
            <div key={p.id} className="flex items-start gap-4 px-5 py-4">
              <div className="size-14 rounded-lg bg-muted overflow-hidden shrink-0">
                {p.image_url && (
                  <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="font-medium">{p.product_title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(p.scheduled_for).toLocaleString()} ·{" "}
                  {p.platforms
                    ? p.platforms
                        .split(",")
                        .map((pl) => PLATFORM_LABEL[pl as SocialPlatform])
                        .join(", ")
                    : "all configured platforms"}
                </p>
                {p.targets.length > 0 && (
                  <div className="space-y-0.5 pt-1">
                    {p.targets.map((t) => {
                      const Icon = PLATFORM_ICON[t.platform];
                      return (
                        <div
                          key={t.id}
                          title={t.error ?? undefined}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        >
                          {t.status === "success" ? (
                            <CheckCircle2 className="size-3.5 text-success" />
                          ) : (
                            <XCircle className="size-3.5 text-destructive" />
                          )}
                          <Icon className="size-3.5" />
                          <span>
                            {t.platform}: {t.status === "success" ? t.remote_post_id : t.error}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0 ${STATUS_BADGE[p.status]}`}
              >
                {p.status === "queued" && <Clock className="size-3 inline mr-1 -mt-0.5" />}
                {p.status}
              </span>
              <Button variant="ghost" size="icon" onClick={() => del(p)} className="shrink-0">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Post</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Product</label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between font-normal"
                >
                  {selected ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="size-6 rounded bg-muted overflow-hidden shrink-0">
                        {selected.image_url && (
                          <img
                            src={selected.image_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </span>
                      <span className="truncate">{selected.title}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Search products...</span>
                  )}
                  <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search products by name..."
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No products found.</CommandEmpty>
                    <CommandGroup>
                      {filteredProducts.map((p) => (
                        <CommandItem key={p.id} value={p.title} onSelect={() => pickProduct(p)}>
                          <span className="size-8 rounded bg-muted overflow-hidden shrink-0">
                            {p.image_url && (
                              <img
                                src={p.image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            )}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block truncate">{p.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {priceLabel(p)}
                            </span>
                          </span>
                          {selected?.id === p.id && <Check className="size-4" />}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selected && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Description &amp; Tabs</label>
                  <span className="text-xs text-muted-foreground">{priceLabel(selected)}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  This is what gets posted, straight from the product page. Edit it there, not here.
                </p>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto text-sm space-y-3 bg-muted/20">
                  {selected.description && (
                    <p className="italic whitespace-pre-line">
                      {renderFormattedDescription(selected.description)}
                    </p>
                  )}
                  {tabs.map((t) => (
                    <div key={t.id}>
                      <p className="font-semibold">{t.title}</p>
                      <p className="whitespace-pre-line">{renderFormattedDescription(t.body)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Extra note (optional)</label>
                <p className="text-xs text-muted-foreground">
                  The post uses the product's real name, description, tabs, and price exactly as
                  written on its product page — nothing is rewritten. Add a line here only for
                  something not already on that page, like a promo or a restock note.
                </p>
                <Textarea
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  placeholder="e.g. Restocked this week — limited quantity"
                  rows={2}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Photos</label>
                <p className="text-xs text-muted-foreground">
                  Choose which of this product's photos to post. Instagram and TikTok need at least
                  one.
                </p>
                {photos.length === 0 ? (
                  <div className="size-20 rounded-lg border bg-muted grid place-items-center text-muted-foreground">
                    <ImageIcon className="size-6" />
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {photos.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setSelectedImage(url)}
                        className={`relative size-20 rounded-lg overflow-hidden border-2 ${
                          selectedImage === url ? "border-brand" : "border-transparent"
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {selectedImage === url && (
                          <span className="absolute top-1 right-1 bg-brand text-brand-foreground rounded-full p-0.5">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Publish time</label>
                  <Input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Platforms</label>
                  <p className="text-xs text-muted-foreground">None checked = all configured.</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-0.5">
                    {(Object.keys(PLATFORM_LABEL) as SocialPlatform[]).map((platform) => (
                      <label key={platform} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={selectedPlatforms.includes(platform)}
                          onCheckedChange={() => togglePlatform(platform)}
                        />
                        {PLATFORM_LABEL[platform]}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <Button onClick={schedule} disabled={queuing} className="w-full">
                {queuing && <Loader2 className="size-4 mr-1.5 animate-spin" />}
                Schedule post
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
