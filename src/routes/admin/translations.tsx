import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getTranslationOverrides,
  saveTranslations,
  type TranslationOverrides,
} from "@/data/translations";
import { BUILTIN_DICTS, EN_DEFAULTS, I18N_SECTIONS, LOCALES } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Search } from "lucide-react";

export const Route = createFileRoute("/admin/translations")({ component: TranslationsAdmin });

type LocaleCode = (typeof LOCALES)[number]["code"];

const ALL_KEYS = Object.keys(EN_DEFAULTS).filter((k) => k !== "lang.name");

const SECTION_FOR = (key: string) =>
  I18N_SECTIONS.find((s) => key === s.prefix || key.startsWith(s.prefix + "."))?.label ?? "Other";

// Effective built-in value for a locale, falling back to the English default.
const builtin = (locale: LocaleCode, key: string) =>
  BUILTIN_DICTS[locale]?.[key] ?? EN_DEFAULTS[key] ?? "";

type Draft = Record<string, Partial<Record<LocaleCode, string>>>;

function TranslationsAdmin() {
  const qc = useQueryClient();
  const { data: overrides, isLoading } = useQuery<TranslationOverrides>({
    queryKey: ["translations"],
    queryFn: () => getTranslationOverrides(),
  });

  // Only edited fields live here; everything else renders from overrides/builtin.
  const [draft, setDraft] = useState<Draft>({});
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // Current value shown in a field: unsaved edit → saved override → built-in.
  const valueOf = (locale: LocaleCode, key: string) =>
    draft[key]?.[locale] ?? overrides?.[locale]?.[key] ?? builtin(locale, key);

  const setValue = (locale: LocaleCode, key: string, v: string) =>
    setDraft((d) => ({ ...d, [key]: { ...d[key], [locale]: v } }));

  // A field is an "override" when it differs from the English-derived built-in.
  const isOverride = (locale: LocaleCode, key: string) =>
    valueOf(locale, key).trim() !== builtin(locale, key).trim() &&
    valueOf(locale, key).trim() !== "";

  const dirtyEntries = useMemo(() => {
    const out: { locale: string; key: string; value: string }[] = [];
    for (const [key, byLocale] of Object.entries(draft)) {
      for (const [locale, v] of Object.entries(byLocale)) {
        const saved = overrides?.[locale as LocaleCode]?.[key] ?? "";
        // Sending the built-in default clears the override server-side.
        const normalized = v.trim() === builtin(locale as LocaleCode, key).trim() ? "" : v;
        if (normalized.trim() !== saved.trim()) out.push({ locale, key, value: normalized });
      }
    }
    return out;
  }, [draft, overrides]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byLabel = new Map<string, string[]>();
    for (const key of ALL_KEYS) {
      if (
        q &&
        !key.toLowerCase().includes(q) &&
        !LOCALES.some((l) => valueOf(l.code, key).toLowerCase().includes(q))
      )
        continue;
      const label = SECTION_FOR(key);
      const arr = byLabel.get(label) ?? [];
      arr.push(key);
      byLabel.set(label, arr);
    }
    const ordered = [...I18N_SECTIONS.map((s) => s.label), "Other"];
    return ordered
      .filter((l) => byLabel.has(l))
      .map((label) => ({ label, keys: byLabel.get(label)! }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, draft, overrides]);

  const save = async () => {
    if (dirtyEntries.length === 0) return;
    setSaving(true);
    try {
      await saveTranslations({ data: { entries: dirtyEntries } });
      await qc.invalidateQueries({ queryKey: ["translations"] });
      setDraft({});
      toast.success(
        `Saved ${dirtyEntries.length} translation${dirtyEntries.length === 1 ? "" : "s"}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save translations");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6 pb-24">
      <div>
        <h1 className="font-display font-bold text-3xl">Translations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit the storefront text for English, ខ្មែរ (Khmer) and 日本語 (Japanese). Leave a field
          on its default (or clear it) to use the built-in wording. Keep placeholders like{" "}
          <code className="bg-muted px-1 rounded">{"{threshold}"}</code> and{" "}
          <code className="bg-muted px-1 rounded">{"{n}"}</code> unchanged.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by key or text…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} className="bg-card border rounded-2xl overflow-hidden">
            <h2 className="font-display font-bold px-5 py-3 border-b bg-muted/40">{group.label}</h2>
            <div className="divide-y">
              {group.keys.map((key) => (
                <div key={key} className="px-5 py-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-muted-foreground">{key}</code>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {LOCALES.map((l) => (
                      <div key={l.code} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-muted-foreground">
                            {l.label}
                          </label>
                          <div className="flex items-center gap-1">
                            {isOverride(l.code, key) && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                edited
                              </Badge>
                            )}
                            {valueOf(l.code, key) !== builtin(l.code, key) && (
                              <button
                                type="button"
                                onClick={() => setValue(l.code, key, builtin(l.code, key))}
                                title="Reset to built-in default"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <RotateCcw className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <Textarea
                          value={valueOf(l.code, key)}
                          onChange={(e) => setValue(l.code, key, e.target.value)}
                          rows={2}
                          className="text-sm min-h-[2.5rem] resize-y"
                          dir={l.code === "km" ? "ltr" : undefined}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      {groups.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No strings match “{query}”.</p>
      )}

      {dirtyEntries.length > 0 && (
        <div className="fixed bottom-4 right-4 z-20 flex items-center gap-3 rounded-full border bg-background/95 py-2 pl-5 pr-2 shadow-lg backdrop-blur">
          <span className="text-sm text-muted-foreground">
            {dirtyEntries.length} unsaved change{dirtyEntries.length === 1 ? "" : "s"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setDraft({})} disabled={saving}>
            Discard
          </Button>
          <Button size="sm" className="rounded-full" onClick={save} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-1.5 animate-spin" />}
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
