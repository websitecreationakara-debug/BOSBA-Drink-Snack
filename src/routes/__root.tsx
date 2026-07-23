import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { CartProvider } from "@/hooks/use-cart";
import { WishlistProvider } from "@/hooks/use-wishlist";
import { ThemeProvider } from "@/hooks/use-theme";
import { LanguageProvider } from "@/lib/i18n";
import { CartDrawer } from "@/components/cart-drawer";
import { InstallPrompt } from "@/components/install-prompt";
import { Toaster } from "@/components/ui/sonner";

// Web Analytics is auto-injected by Cloudflare for this proxied domain (site tag
// 392fa229…), so no manual beacon is needed. Left empty intentionally.
const CF_ANALYTICS_TOKEN = "";

const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BOSBA Premium Foods",
  url: "https://bosbapremiumfoods.com",
  logo: "https://bosbapremiumfoods.com/logo.png",
  telephone: "+855 99 361 350",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Sangkat Tuol Svay Prey Ti Muoy",
    addressLocality: "Phnom Penh",
    addressCountry: "KH",
  },
};

const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "BOSBA Premium Foods",
  url: "https://bosbapremiumfoods.com",
};

// TikTok Pixel — fires a PageView on every page. Official base snippet (the
// pasted copy had its `||` operators stripped, which is a syntax error).
const TIKTOK_PIXEL_ID = "D8UBJ53C77UD829ULDCG";
const TIKTOK_PIXEL = `!function (w, d, t) {
  w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
  ttq.load('${TIKTOK_PIXEL_ID}');
  ttq.page();
}(window, document, 'ttq');`;

// The browser fires `beforeinstallprompt` very early — often before React
// hydrates and our InstallPrompt listener attaches, so the event is lost and no
// banner shows. Capture it here (runs in <head>, before hydration) and stash it
// on window for the component to pick up.
const BIP_CAPTURE = `
(function(){
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    window.__bipEvent = e;
    window.dispatchEvent(new Event('bip-available'));
  });
  window.addEventListener('appinstalled', function(){
    window.__bipEvent = null;
    window.dispatchEvent(new Event('bip-installed'));
  });
})();
`;

function NotFoundComponent() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center max-w-md">
        <h1 className="font-display text-8xl font-bold text-brand">404</h1>
        <h2 className="mt-4 font-display text-xl font-bold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This net came up empty. Let's get you back to the catch.
        </p>
        <Link
          to="/"
          className="inline-flex mt-6 items-center justify-center rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold hover:opacity-90"
        >
          Back to shop
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="text-center max-w-md">
        <h1 className="font-display text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "BOSBA Premium Foods" },
      { name: "description", content: "Provides High Premium Quality Foods From Japan" },
      { name: "theme-color", content: "#28457a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "BOSBA" },
      { property: "og:title", content: "BOSBA Premium Foods" },
      { property: "og:description", content: "Provides High Premium Quality Foods From Japan" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "BOSBA Premium Foods" },
      { name: "twitter:title", content: "BOSBA Premium Foods" },
      { name: "twitter:description", content: "Provides High Premium Quality Foods From Japan" },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/o2CDzeAcwUexXadSyG3Sks57zMi1/social-images/social-1779769529532-686086918_1643455840538679_1852951828791255588_n.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/o2CDzeAcwUexXadSyG3Sks57zMi1/social-images/social-1779769529532-686086918_1643455840538679_1852951828791255588_n.webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,500;1,600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: BIP_CAPTURE }} />
        <script dangerouslySetInnerHTML={{ __html: TIKTOK_PIXEL }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
      </head>
      <body>
        {children}
        <Scripts />
        <script
          type="text/javascript"
          defer
          src="https://botcommerce.planifyx.com/script/webchat-link.js?code=1779553226287033"
        />
        {CF_ANALYTICS_TOKEN && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${CF_ANALYTICS_TOKEN}"}`}
          />
        )}
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      // In dev the SW caches stale modules and survives hard refresh; tear it down.
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      caches?.keys().then((ks) => ks.forEach((k) => caches.delete(k)));
    }
  }, []);

  useEffect(() => {
    // A tab open since an earlier deploy references chunk hashes that no longer
    // exist (e.g. the lazily-imported jspdf for invoices). Vite fires this when a
    // dynamic import 404s — reload once to pull the current asset manifest.
    const onPreloadError = () => {
      const KEY = "chunk-reload-at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
      }
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <WishlistProvider>
              <CartProvider>
                <Outlet />
                <CartDrawer />
                <InstallPrompt />
                <Toaster />
              </CartProvider>
            </WishlistProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
