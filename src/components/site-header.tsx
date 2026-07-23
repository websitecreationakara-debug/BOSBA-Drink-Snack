import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  ShoppingBag,
  User,
  Heart,
  Sun,
  Moon,
  MapPin,
  Phone,
  LogOut,
  LayoutDashboard,
  Package,
  Truck,
  Menu,
  Globe,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { useWishlist } from "@/hooks/use-wishlist";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { useI18n, LOCALES } from "@/lib/i18n";
import { useCategories, useStoreSettings, usePromotions } from "@/hooks/use-products";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";

export function SiteHeader() {
  const { count, setDrawerOpen } = useCart();
  const { count: wishlistCount } = useWishlist();
  const { user, isAdmin, signOut } = useAuth();
  const { data: categories = [] } = useCategories();
  const { data: promotions = [] } = usePromotions();
  const hasOffers = promotions.length > 0;
  const { data: settings } = useStoreSettings();
  const shipThreshold = Number(settings?.free_shipping_threshold ?? 50);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const { theme, toggle } = useTheme();
  const { locale, setLocale, t } = useI18n();

  const runSearch = (value: string) => {
    const v = value.trim();
    if (v) window.location.href = `/shop?q=${encodeURIComponent(v)}`;
  };

  return (
    <>
      {/* Apple-style single nav bar */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b">
        <div className="mx-auto max-w-7xl px-4 md:px-6 h-14 md:h-16 flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="lg:hidden grid size-9 shrink-0 place-items-center rounded-full hover:bg-muted transition-colors -ml-1"
            aria-label={t("nav.browse")}
          >
            <Menu className="size-5" />
          </button>

          <Link to="/" className="flex items-center shrink-0" aria-label="BOSBA Premium Foods">
            <img
              src="/logo.png"
              alt="BOSBA Premium Foods"
              className="size-10 md:size-12 rounded-md object-contain"
            />
          </Link>

          {/* Centered category links */}
          <nav className="hidden lg:flex flex-1 min-w-0 items-center justify-center gap-x-5 xl:gap-x-7 px-2 text-[13px] text-foreground/80">
            <Link to="/shop" className="hover:text-foreground transition-colors whitespace-nowrap">
              {t("nav.allProducts")}
            </Link>
            {hasOffers && (
              <Link
                to="/offers"
                className="font-medium text-brand hover:text-brand/80 transition-colors whitespace-nowrap"
              >
                {t("nav.offers")}
              </Link>
            )}
            {categories.map((c) => (
              <Link
                key={c.id}
                to="/shop"
                search={{ category: c.slug }}
                className="hover:text-foreground transition-colors whitespace-nowrap"
              >
                {c.name}
              </Link>
            ))}
          </nav>

          {/* Right icons */}
          <div className="flex items-center gap-0.5 ml-auto lg:ml-0">
            <button
              onClick={() => setSearchOpen((o) => !o)}
              aria-label={t("nav.searchPlaceholder")}
              aria-expanded={searchOpen}
              className="grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
            >
              <Search className="size-[18px]" />
            </button>

            <Button variant="ghost" size="icon" asChild className="relative text-foreground size-9">
              <Link to="/wishlist" aria-label={t("nav.wishlist")}>
                <Heart className="size-[18px]" />
                {wishlistCount > 0 && (
                  <span className="absolute top-0 right-0 size-4 rounded-full bg-brand text-brand-foreground text-[9px] font-bold grid place-items-center ring-2 ring-background">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-foreground size-9">
                  <User className="size-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user ? (
                  <>
                    <DropdownMenuLabel className="truncate max-w-[200px]">
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/account">
                        <User className="size-4 mr-2" /> {t("nav.account")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/orders">
                        <Package className="size-4 mr-2" /> {t("nav.myOrders")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/addresses">
                        <MapPin className="size-4 mr-2" /> {t("nav.myAddresses")}
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link to="/admin">
                          <LayoutDashboard className="size-4 mr-2" /> {t("nav.adminDashboard")}
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="size-4 mr-2" /> {t("nav.signOut")}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/auth">
                      <User className="size-4 mr-2" /> {t("nav.signIn")}
                    </Link>
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Globe className="size-3.5" /> {LOCALES.find((l) => l.code === locale)?.label}
                </DropdownMenuLabel>
                {LOCALES.map((l) => (
                  <DropdownMenuItem
                    key={l.code}
                    onClick={() => setLocale(l.code)}
                    className="justify-between gap-6"
                  >
                    {l.label}
                    {locale === l.code && <Check className="size-4" />}
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggle}>
                  {theme === "dark" ? (
                    <Sun className="size-4 mr-2" />
                  ) : (
                    <Moon className="size-4 mr-2" />
                  )}
                  {theme === "dark" ? t("theme.light") : t("theme.dark")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              onClick={() => setDrawerOpen(true)}
              className="relative grid size-9 place-items-center rounded-full hover:bg-muted transition-colors"
              aria-label={t("nav.cart")}
            >
              <ShoppingBag className="size-[18px]" />
              {count > 0 && (
                <span className="absolute top-0 right-0 size-4 rounded-full bg-brand text-brand-foreground text-[9px] font-bold grid place-items-center ring-2 ring-background">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search field — revealed by the icon, Apple-style */}
        {searchOpen && (
          <div className="border-t bg-background/95 backdrop-blur-xl">
            <div className="mx-auto max-w-3xl px-4 md:px-6 py-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  type="search"
                  autoFocus
                  placeholder={t("nav.searchPlaceholder")}
                  className="w-full h-11 pl-10 pr-4 rounded-full bg-muted border border-transparent text-sm text-foreground outline-none focus:bg-background focus:border-border transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") runSearch((e.target as HTMLInputElement).value);
                    if (e.key === "Escape") setSearchOpen(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile navigation */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[86%] max-w-sm flex flex-col p-0">
          <SheetHeader className="px-5 py-4 border-b text-left">
            <SheetTitle className="font-display text-lg text-brand">BOSBA Premium Foods</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
            <nav className="space-y-1">
              <p className="px-2 pb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t("nav.browse")}
              </p>
              <SheetClose asChild>
                <Link
                  to="/shop"
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  {t("nav.allProducts")}
                </Link>
              </SheetClose>
              {hasOffers && (
                <SheetClose asChild>
                  <Link
                    to="/offers"
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-brand hover:bg-muted"
                  >
                    {t("nav.offers")}
                  </Link>
                </SheetClose>
              )}
              {categories.map((c) => (
                <SheetClose asChild key={c.id}>
                  <Link
                    to="/shop"
                    search={{ category: c.slug }}
                    className="block rounded-lg px-3 py-2.5 text-sm hover:bg-muted"
                  >
                    {c.name}
                  </Link>
                </SheetClose>
              ))}
            </nav>

            <nav className="space-y-1 border-t pt-4">
              <SheetClose asChild>
                <Link
                  to="/wishlist"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <Heart className="size-4" /> {t("nav.wishlist")}
                </Link>
              </SheetClose>
              {user ? (
                <>
                  <SheetClose asChild>
                    <Link
                      to="/account"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                    >
                      <User className="size-4" /> {t("nav.account")}
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      to="/orders"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                    >
                      <Package className="size-4" /> {t("nav.myOrders")}
                    </Link>
                  </SheetClose>
                  <SheetClose asChild>
                    <Link
                      to="/addresses"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                    >
                      <MapPin className="size-4" /> {t("nav.myAddresses")}
                    </Link>
                  </SheetClose>
                  {isAdmin && (
                    <SheetClose asChild>
                      <Link
                        to="/admin"
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                      >
                        <LayoutDashboard className="size-4" /> {t("nav.adminDashboard")}
                      </Link>
                    </SheetClose>
                  )}
                  <button
                    onClick={() => {
                      signOut();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    <LogOut className="size-4" /> {t("nav.signOut")}
                  </button>
                </>
              ) : (
                <SheetClose asChild>
                  <Link
                    to="/auth"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    <User className="size-4" /> {t("nav.signIn")}
                  </Link>
                </SheetClose>
              )}
            </nav>

            <div className="space-y-1 border-t pt-4">
              <p className="px-2 pb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {LOCALES.find((l) => l.code === locale)?.label}
              </p>
              <div className="flex flex-wrap gap-2 px-2">
                {LOCALES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLocale(l.code)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      locale === l.code
                        ? "border-brand bg-brand/10 text-brand font-medium"
                        : "hover:bg-muted"
                    }`}
                  >
                    {locale === l.code && <Check className="size-3.5" />}
                    {l.label}
                  </button>
                ))}
              </div>
              <button
                onClick={toggle}
                className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {theme === "dark" ? t("theme.light") : t("theme.dark")}
              </button>
            </div>
          </div>

          <div className="border-t px-5 py-4 space-y-2 text-sm text-muted-foreground">
            <a href="tel:+85599361350" className="flex items-center gap-2 hover:text-foreground">
              <Phone className="size-4" /> +855 99 361 350
            </a>
            <p className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" /> Sangkat Tuol Svay Prey Ti Muoy, Phnom Penh
            </p>
            <p className="flex items-center gap-2">
              <Truck className="size-4 shrink-0" />{" "}
              {t("bar.delivery", { threshold: shipThreshold })}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
