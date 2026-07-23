import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, MapPin, Phone, Truck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useStoreSettings } from "@/hooks/use-products";

export function SiteFooter() {
  const { t } = useI18n();
  const { data: settings } = useStoreSettings();
  const shipThreshold = Number(settings?.free_shipping_threshold ?? 50);
  return (
    <footer className="bg-surface border-t border-border text-foreground mt-24">
      <div className="mx-auto max-w-7xl px-6 py-12 md:py-16 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10 md:gap-12">
        <div className="col-span-2 md:col-span-1 space-y-4">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="BOSBA Premium Foods"
              className="size-12 rounded-lg object-contain"
            />
            <span className="font-display text-xl font-bold tracking-tight">
              BOSBA Premium Foods
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("footer.tagline")}</p>
          <div className="space-y-2 text-sm text-muted-foreground pt-1">
            <a href="tel:+85599361350" className="flex items-center gap-2 hover:text-foreground">
              <Phone className="size-4" /> +855 99 361 350
            </a>
            <p className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0" /> Sangkat Tuol Svay Prey Ti Muoy, Phnom Penh
            </p>
            <p className="flex items-center gap-2">
              <Truck className="size-4 shrink-0" /> {t("bar.delivery", { threshold: shipThreshold })}
            </p>
          </div>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-5 text-sm">{t("footer.marketplace")}</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <Link to="/shop" className="hover:text-secondary-accent transition-colors">
                {t("nav.allProducts")}
              </Link>
            </li>
            <li>
              <Link to="/shop" className="hover:text-secondary-accent transition-colors">
                {t("footer.sashimiFillets")}
              </Link>
            </li>
            <li>
              <Link to="/shop" className="hover:text-secondary-accent transition-colors">
                {t("footer.shellfish")}
              </Link>
            </li>
            <li>
              <Link to="/shop" className="hover:text-secondary-accent transition-colors">
                {t("footer.roeUni")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold mb-5 text-sm">{t("footer.company")}</h4>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li>
              <a className="hover:text-secondary-accent transition-colors" href="#">
                {t("footer.mission")}
              </a>
            </li>
            <li>
              <a className="hover:text-secondary-accent transition-colors" href="#">
                {t("footer.fisheries")}
              </a>
            </li>
            <li>
              <a className="hover:text-secondary-accent transition-colors" href="#">
                {t("footer.sustainability")}
              </a>
            </li>
            <li>
              <a className="hover:text-secondary-accent transition-colors" href="#">
                {t("footer.careers")}
              </a>
            </li>
          </ul>
        </div>

        <div className="col-span-2 md:col-span-1">
          <div className="rounded-2xl bg-muted p-6">
            <h4 className="font-display font-semibold mb-2">{t("footer.followTitle")}</h4>
            <p className="text-xs text-muted-foreground">{t("footer.followSub")}</p>
          </div>
          <div className="flex items-center gap-3 mt-5 px-1">
            <a
              href="https://www.facebook.com/bosbapremiumfoods"
              target="_blank"
              rel="noreferrer"
              aria-label="Facebook"
              className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
            >
              <Facebook className="size-4" />
            </a>
            <a
              href="https://www.instagram.com/bosbapremiumfoods/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
            >
              <Instagram className="size-4" />
            </a>
            <a
              href="https://www.tiktok.com/@bosbapremiumfoods"
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
              className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M16.5 3a5.6 5.6 0 0 0 3.9 4.6v3a8.6 8.6 0 0 1-3.9-1v6.2a5.8 5.8 0 1 1-5.8-5.8c.3 0 .6 0 .9.1v3.1a2.8 2.8 0 1 0 1.9 2.6V3h3z" />
              </svg>
            </a>
            <a
              href="https://t.me/bosbapremiumsfoods"
              target="_blank"
              rel="noreferrer"
              aria-label="Telegram"
              className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
                <path d="M21.9 4.3 18.6 19.5c-.2 1.1-.9 1.4-1.8.9l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.7 13.5l-4.8-1.5c-1.1-.3-1.1-1 .2-1.5l18.7-7.2c.9-.3 1.6.2 1.3 1z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>© 2026 BOSBA Premium Foods</span>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              {t("footer.privacy")}
            </Link>
            <a href="#">{t("footer.terms")}</a>
            <a href="/sitemap.xml">{t("footer.sitemap")}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
