import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useStoreSettings } from "@/hooks/use-products";

const STORAGE = "bosba:banner-dismissed";

// Thin promo bar driven by the admin Settings "Promotional Banner Text" field.
// Empty text = hidden. Dismissal is remembered per-message, so editing the text
// makes the bar reappear for everyone who had dismissed the previous one.
export function AnnouncementBanner() {
  const { data: settings } = useStoreSettings();
  const text = settings?.banner_text?.trim() ?? "";
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE) === text);
    } catch {
      // localStorage unavailable — just keep showing the bar.
    }
  }, [text]);

  if (!text || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE, text);
    } catch {
      // ignore — dismissal just won't persist
    }
    setDismissed(true);
  };

  return (
    <div className="bg-brand text-brand-foreground">
      <div className="relative mx-auto flex max-w-7xl items-center justify-center gap-3 px-10 py-2 text-center text-sm font-medium">
        <span>{text}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-3 top-1/2 -translate-y-1/2 grid size-6 place-items-center rounded-full transition-colors hover:bg-brand-foreground/15"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
