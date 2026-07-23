import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { requireManager } from "./_auth";

export type AnalyticsDay = { date: string; pageViews: number; visits: number };
export type AnalyticsRow = { label: string; views: number };

export type SiteAnalytics = {
  configured: boolean;
  days: number;
  totalPageViews: number;
  totalVisits: number;
  series: AnalyticsDay[];
  topPages: AnalyticsRow[];
  topReferrers: AnalyticsRow[];
  topCountries: AnalyticsRow[];
};

const EMPTY = (days: number, configured: boolean): SiteAnalytics => ({
  configured,
  days,
  totalPageViews: 0,
  totalVisits: 0,
  series: [],
  topPages: [],
  topReferrers: [],
  topCountries: [],
});

// Web Analytics (RUM) data is adaptively sampled: each returned row represents
// `sampleInterval` real events, so the true count ≈ count × sampleInterval.
type Group = {
  count: number;
  sum?: { visits?: number };
  avg?: { sampleInterval?: number };
  dimensions?: { date?: string; requestPath?: string; refererHost?: string; countryName?: string };
};

const estimate = (g: Group, field: "count" | "visits") => {
  const interval = g.avg?.sampleInterval ?? 1;
  const raw = field === "count" ? g.count : (g.sum?.visits ?? 0);
  return Math.round(raw * interval);
};

export const getSiteAnalytics = createServerFn({ method: "GET" })
  .inputValidator((d: { days?: number }) => d)
  .handler(async ({ data }): Promise<SiteAnalytics> => {
    await requireManager();

    const e = env as unknown as Record<string, string | undefined>;
    // Trim: secrets set via a piped shell command can carry a trailing newline,
    // which would corrupt the Authorization header and the GraphQL query string.
    const token = e.CLOUDFLARE_API_TOKEN?.trim();
    const accountTag = e.CLOUDFLARE_ACCOUNT_ID?.trim();
    const siteTag = e.CF_WEB_ANALYTICS_SITE_TAG?.trim();

    const days = Math.min(Math.max(Math.floor(data?.days ?? 30), 1), 90);
    if (!token || !accountTag || !siteTag) return EMPTY(days, false);

    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86400000);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    // Exclude admin traffic (the owner's own testing) so the figures reflect
    // real storefront visitors. `_notlike` with `%` covers every /admin subpath.
    const f = `siteTag: "${siteTag}", date_geq: "${startStr}", date_leq: "${endStr}", requestPath_notlike: "/admin%"`;

    const query = `query {
      viewer {
        accounts(filter: { accountTag: "${accountTag}" }) {
          byDate: rumPageloadEventsAdaptiveGroups(filter: { ${f} }, limit: 1000, orderBy: [date_ASC]) {
            count sum { visits } avg { sampleInterval } dimensions { date }
          }
          topPages: rumPageloadEventsAdaptiveGroups(filter: { ${f} }, limit: 10, orderBy: [count_DESC]) {
            count avg { sampleInterval } dimensions { requestPath }
          }
          topReferrers: rumPageloadEventsAdaptiveGroups(filter: { ${f} }, limit: 10, orderBy: [count_DESC]) {
            count avg { sampleInterval } dimensions { refererHost }
          }
          topCountries: rumPageloadEventsAdaptiveGroups(filter: { ${f} }, limit: 10, orderBy: [count_DESC]) {
            count avg { sampleInterval } dimensions { countryName }
          }
        }
      }
    }`;

    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Cloudflare API error (${res.status}): ${detail}`);
    }

    const json = (await res.json()) as {
      data?: {
        viewer?: {
          accounts?: {
            byDate?: Group[];
            topPages?: Group[];
            topReferrers?: Group[];
            topCountries?: Group[];
          }[];
        };
      };
      errors?: { message: string }[];
    };
    if (json.errors?.length) throw new Error(json.errors[0].message);

    const acct = json.data?.viewer?.accounts?.[0];
    if (!acct) return EMPTY(days, true);

    const series: AnalyticsDay[] = (acct.byDate ?? []).map((g) => ({
      date: g.dimensions?.date ?? "",
      pageViews: estimate(g, "count"),
      visits: estimate(g, "visits"),
    }));

    const rows = (groups: Group[] | undefined, key: keyof NonNullable<Group["dimensions"]>) =>
      (groups ?? [])
        .map((g) => ({ label: g.dimensions?.[key] || "(direct)", views: estimate(g, "count") }))
        .filter((r) => r.views > 0);

    return {
      configured: true,
      days,
      totalPageViews: series.reduce((a, d) => a + d.pageViews, 0),
      totalVisits: series.reduce((a, d) => a + d.visits, 0),
      series,
      topPages: rows(acct.topPages, "requestPath"),
      topReferrers: rows(acct.topReferrers, "refererHost"),
      topCountries: rows(acct.topCountries, "countryName"),
    };
  });
