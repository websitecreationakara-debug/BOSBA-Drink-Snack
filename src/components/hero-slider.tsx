import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useHeroSlides, usePromotions } from "@/hooks/use-products";
import { useI18n } from "@/lib/i18n";
import type { HeroSlide } from "@/lib/types";
import imagebannerall from "../../public/bannerbosbadrinkandsnake3.jpg";

const FALLBACK_IMAGE = "/logo.png";

const FALLBACK_SLIDE: HeroSlide = {
  id: "fallback",
  eyebrow: null,
  title_top: "Japanese",
  title_accent: "Drinks & Snacks",
  title_bottom: null,
  body: null,
  image_url: FALLBACK_IMAGE,
  cta_label: "Shop now",
  cta_link: "/shop",
  sort_order: 0,
  active: true,
  created_at: "",
};

export function HeroSlider() {
  const { data: slides = [], isPending } = useHeroSlides();
  const { data: promotions = [] } = usePromotions();
  const hasOffers = promotions.length > 0;
  const { t } = useI18n();
  const [active, setActive] = useState(0);

  // Only fall back to the logo/text slide once the fetch has genuinely
  // settled with zero results — showing it while still loading meant every
  // visit briefly flashed the square logo stretched across the wide banner
  // before the real hero photo swapped in.
  const list = slides.length > 0 ? slides : isPending ? [] : [FALLBACK_SLIDE];

  useEffect(() => {
    if (list.length <= 1) return;
    setActive((a) => a % list.length);
    const id = setInterval(() => setActive((a) => (a + 1) % list.length), 6500);
    return () => clearInterval(id);
  }, [list.length]);

  if (list.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 md:px-6 pt-4 md:pt-6">
        <div className="flex flex-col gap-4">
          <div className="relative w-full overflow-hidden rounded-2xl md:rounded-3xl bg-muted">
            <div className="aspect-[2726/1135] animate-pulse" />
          </div>
          <SideTiles hasOffers={hasOffers} t={t} />
        </div>
      </section>
    );
  }

  const s = list[active] ?? list[0];
  const ctaLabel = s.cta_label || "Shop now";
  const ctaLink = s.cta_link || "/shop";

  return (
    <section className="mx-auto max-w-7xl px-4 md:px-6 pt-4 md:pt-6">
      <div className="flex flex-col gap-4">
        <div className="lantern-glow relative w-full overflow-hidden rounded-2xl md:rounded-3xl bg-muted">
          <div className="relative aspect-[2726/1135] overflow-hidden">
            {list.map((slide, i) => {
              // Shortest signed distance from the active slide, wrapped around the
              // list so cycling from the last slide back to the first still slides
              // left-to-right instead of jumping the long way around.
              const n = list.length;
              let offset = (i - active) % n;
              if (offset > n / 2) offset -= n;
              if (offset < -n / 2) offset += n;

              return (
                <img
                  key={slide.id}
                  src={slide.image_url || FALLBACK_IMAGE}
                  alt=""
                  loading={i === 0 ? "eager" : "lazy"}
                  style={{ transform: `translateX(${offset * 100}%)` }}
                  className="absolute inset-0 h-full w-full object-contain transition-transform duration-700 ease-in-out"
                />
              );
            })}

            {/* Soft scrim at the bottom so the footer row stays legible on any photo */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

            {/* Slide dots (bottom-left) + CTA (bottom-right) */}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3 sm:gap-4 sm:p-4 md:p-6">
              {list.length > 1 ? (
                <div className="flex gap-1 sm:gap-1.5">
                  {list.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActive(i)}
                      aria-label={`Slide ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        i === active ? "w-5 sm:w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                      }`}
                    />
                  ))}
                </div>
              ) : (
                <span />
              )}

              <a
                href={ctaLink}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-xs font-semibold text-brand-foreground shadow-lg transition-colors hover:bg-secondary-accent sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                {ctaLabel} <ArrowRight className="size-3.5 sm:size-4" />
              </a>
            </div>
          </div>
        </div>

        <SideTiles hasOffers={hasOffers} t={t} />
      </div>
    </section>
  );
}

// Two stacked promo tiles alongside the main carousel — the uploaded banner
// artwork already carries its own headline/branding, so these are just
// clickable images (no text overlay) linking into existing pages.
function SideTiles({ hasOffers, t }: { hasOffers: boolean; t: ReturnType<typeof useI18n>["t"] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scrollCards = (direction: "prev" | "next") => {
    const node = scrollRef.current;
    if (!node) return;

    const firstCard = node.querySelector<HTMLElement>("[data-banner-card]");
    if (!firstCard) return;

    const step = firstCard.offsetWidth + 12;
    node.scrollBy({ left: step * (direction === "next" ? 1 : -1), behavior: "smooth" });
  };

  const tileClass =
    "group relative block h-[100px] w-[78%] shrink-0 overflow-hidden rounded-2xl bg-muted shadow-sm sm:h-[150px] sm:w-[46%] lg:w-[32%]";
  const imgClass =
    "absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105";

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Featured
        </p>

        {/* Phone/tablet only: at lg the three tiles fit side by side, so there's
            nothing left to scroll toward and the arrows are just noise. */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => scrollCards("prev")}
            aria-label="Scroll left"
            className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm transition hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollCards("next")}
            aria-label="Scroll right"
            className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background/90 text-foreground shadow-sm transition hover:bg-muted"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2 pl-1 pr-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Link to={hasOffers ? "/offers" : "/shop"} className={tileClass} data-banner-card>
          <img
            src={imagebannerall}
            alt={hasOffers ? t("nav.offers") : t("shop.allProducts")}
            className={imgClass}
          />
        </Link>

        <Link to="/shop" className={tileClass} data-banner-card>
          <img
            src="/bannerbosbadrinkandsnake2.jpg"
            alt={t("home.premiumSelection")}
            className={imgClass}
          />
        </Link>

        <Link to="/shop" className={tileClass} data-banner-card>
          <img
            src="/bannerbosbadrinkandsnake4.jpg"
            alt={t("home.premiumSelection")}
            className={imgClass}
          />
        </Link>
      </div>
    </div>
  );
}
