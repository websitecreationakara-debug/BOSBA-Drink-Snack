import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { useHeroSlides } from "@/hooks/use-products";
import type { HeroSlide } from "@/lib/types";

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
      <section className="relative w-full overflow-hidden bg-muted">
        <div className="aspect-[4/3] sm:aspect-[16/9] md:aspect-[2726/1135] animate-pulse" />
      </section>
    );
  }

  const s = list[active] ?? list[0];
  const ctaLabel = s.cta_label || "Shop now";
  const ctaLink = s.cta_link || "/shop";

  return (
    <section className="lantern-glow relative w-full overflow-hidden bg-muted">
      <div className="relative aspect-[4/3] sm:aspect-[16/9] md:aspect-[2726/1135]">
        {list.map((slide, i) => (
          <img
            key={slide.id}
            src={slide.image_url || FALLBACK_IMAGE}
            alt=""
            loading={i === 0 ? "eager" : "lazy"}
            className={`absolute inset-0 h-full w-full object-cover object-left sm:object-center transition-opacity duration-1000 ${
              i === active ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Soft scrim at the bottom so the button stays legible on any photo */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Single CTA + slide dots */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-5 pb-10 md:pb-14">
          <a
            href={ctaLink}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-8 py-3.5 text-sm font-semibold text-brand-foreground shadow-lg transition-colors hover:bg-secondary-accent"
          >
            {ctaLabel} <ArrowRight className="size-4" />
          </a>

          {list.length > 1 && (
            <div className="flex gap-2">
              {list.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`Slide ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === active ? "w-8 bg-white" : "w-2.5 bg-white/50 hover:bg-white/80"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
