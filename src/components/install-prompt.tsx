import { useEffect, useRef, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

// The `beforeinstallprompt` event isn't in the standard DOM lib types.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const TITLE = "Install the BOSBA Premium Foods App";
const DISMISS_KEY = "bosba:install-dismissed";
// Re-offer after a while rather than never showing again.
const DISMISS_DAYS = 14;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // iOS Safari exposes this non-standard flag instead of display-mode.
  (navigator as { standalone?: boolean }).standalone === true;

const recentlyDismissed = () => {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return Date.now() - at < DISMISS_DAYS * 86400000;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [visible, setVisible] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const reveal = () => {
      if (shownRef.current) return;
      shownRef.current = true;
      setVisible(true);
    };

    const w = window as typeof window & { __bipEvent?: BeforeInstallPromptEvent | null };

    // The install event may have already fired before hydration — it's stashed
    // on window by the capture script in __root. Pick it up if it's there...
    const adopt = () => {
      if (w.__bipEvent) {
        setDeferred(w.__bipEvent);
        reveal();
      }
    };
    adopt();

    // ...and listen for it firing later (or being re-captured).
    window.addEventListener("bip-available", adopt);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      reveal();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("bip-installed", onInstalled);

    // iOS Safari never fires beforeinstallprompt — the only path is the manual
    // Share → Add to Home Screen, so we show a short instruction instead.
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (isIos && isSafari) {
      setIosHint(true);
      reveal();
    }

    return () => {
      window.removeEventListener("bip-available", adopt);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("bip-installed", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pointer-events-none">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-card p-3 shadow-lg">
        <img
          src="/icons/icon-192.png"
          alt=""
          className="size-12 shrink-0 rounded-xl object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{TITLE}</p>
          {iosHint ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap <Share className="inline size-3.5 -mt-0.5" /> Share, then “Add to Home Screen”.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Faster checkout, right from your home screen.
            </p>
          )}
        </div>
        {!iosHint && (
          <Button size="sm" onClick={install} className="shrink-0 rounded-full gap-1.5">
            <Download className="size-4" /> Install
          </Button>
        )}
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
