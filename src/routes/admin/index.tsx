import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useProducts } from "@/hooks/use-products";
import { listOrders } from "@/data/orders";
import { getSiteAnalytics } from "@/data/analytics";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Package,
  ShoppingCart,
  Users,
  Eye,
  MousePointerClick,
  Globe,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

const PERIODS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

function StatList({ title, rows }: { title: string; rows: { label: string; views: number }[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">
        {title}
      </p>
      <ul className="space-y-1.5 text-sm">
        {rows.slice(0, 5).map((r) => (
          <li key={r.label} className="flex justify-between gap-3">
            <span className="truncate text-muted-foreground">{r.label}</span>
            <span className="font-semibold shrink-0">{r.views.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VisitorsSection() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["site-analytics", days],
    queryFn: () => getSiteAnalytics({ data: { days } }),
    staleTime: 5 * 60 * 1000,
  });

  const fmt = (d: string) => {
    const date = new Date(d);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <section className="bg-card border rounded-2xl p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display font-bold text-lg">Website Visitors</h2>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={String(p.value)}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {data?.configured && (
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <Eye className="size-4 text-brand" />
              <div>
                <p className="font-display font-bold text-xl leading-none">
                  {data.totalPageViews.toLocaleString()}
                </p>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Views</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MousePointerClick className="size-4 text-brand" />
              <div>
                <p className="font-display font-bold text-xl leading-none">
                  {data.totalVisits.toLocaleString()}
                </p>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Visits
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load analytics."}
        </p>
      ) : !data?.configured ? (
        <p className="text-sm text-muted-foreground">
          Analytics isn’t connected yet. Add the <code>CLOUDFLARE_API_TOKEN</code>,{" "}
          <code>CLOUDFLARE_ACCOUNT_ID</code>, and <code>CF_WEB_ANALYTICS_SITE_TAG</code> secrets to
          the Worker, then redeploy.
        </p>
      ) : (
        <>
          {data.series.length > 0 ? (
            <div className="h-56 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="views" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmt}
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "currentColor" }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip
                    labelFormatter={(l) => new Date(l as string).toLocaleDateString()}
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 12,
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      color: "var(--popover-foreground)",
                    }}
                    labelStyle={{ color: "var(--popover-foreground)" }}
                    itemStyle={{ color: "var(--popover-foreground)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pageViews"
                    name="Views"
                    stroke="var(--brand)"
                    strokeWidth={2}
                    fill="url(#views)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No visits recorded in this period — data appears once the tracking beacon receives
              traffic.
            </p>
          )}

          {(data.topPages.length > 0 ||
            data.topReferrers.length > 0 ||
            data.topCountries.length > 0) && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatList title="Top pages" rows={data.topPages} />
              <StatList title="Top referrers" rows={data.topReferrers} />
              <StatList title="Top countries" rows={data.topCountries} />
            </div>
          )}

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground border-t pt-3">
            <Globe className="size-3.5 mt-0.5 shrink-0" />
            <span>
              Figures are Cloudflare’s estimates from the privacy-first beacon — it counts real
              browsers (most bots are excluded), leaves out your own admin pages, and scales up
              sampled traffic, so totals are approximate, not exact.
            </span>
          </p>
        </>
      )}
    </section>
  );
}

function AdminHome() {
  const { data: products = [] } = useProducts({ all: true });
  const { data: orders = [] } = useQuery({
    queryKey: ["orders-admin"],
    queryFn: () => listOrders(),
  });

  const revenue = orders.reduce((a, o) => a + Number(o.total), 0);
  const active = orders.filter((o) => o.status !== "completed").length;

  const stats = [
    {
      label: "Total Revenue",
      value: `$${revenue.toFixed(2)}`,
      icon: DollarSign,
      tint: "bg-brand/10 text-brand",
    },
    {
      label: "Active Orders",
      value: active,
      icon: ShoppingCart,
      tint: "bg-accent/30 text-accent-foreground",
    },
    {
      label: "Total Products",
      value: products.length,
      icon: Package,
      tint: "bg-warning/20 text-warning",
    },
    {
      label: "Total Orders",
      value: orders.length,
      icon: Users,
      tint: "bg-success/20 text-success",
    },
  ];

  // Simple bar chart from last 7 days
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dayStr = d.toISOString().slice(0, 10);
    const total = orders
      .filter((o) => o.created_at.slice(0, 10) === dayStr)
      .reduce((a, o) => a + Number(o.total), 0);
    return { day: d.toLocaleDateString("en", { weekday: "short" }), total };
  });
  const max = Math.max(...days.map((d) => d.total), 1);

  return (
    <div className="space-y-8 max-w-7xl">
      <header>
        <h1 className="font-display font-bold text-3xl">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Store performance at a glance.</p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border rounded-2xl p-5">
            <div className={`size-10 rounded-xl grid place-items-center ${s.tint} mb-4`}>
              <s.icon className="size-5" />
            </div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
              {s.label}
            </p>
            <p className="font-display font-bold text-2xl mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="bg-card border rounded-2xl p-6">
        <h2 className="font-display font-bold text-lg mb-6">Revenue · Last 7 days</h2>
        <div className="flex items-end gap-3 h-48">
          {days.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full bg-brand/15 rounded-t-md relative overflow-hidden"
                  style={{ height: `${(d.total / max) * 100}%`, minHeight: "4px" }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-brand"
                    style={{ height: "100%" }}
                  />
                </div>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                {d.day}
              </span>
            </div>
          ))}
        </div>
      </section>

      <VisitorsSection />

      <section className="bg-card border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-display font-bold">Recent Orders</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="text-left px-6 py-3">Order</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="text-right px-6 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 5).map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-6 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="px-6 py-3">
                  <span className="px-2 py-0.5 bg-muted rounded text-xs font-bold uppercase">
                    {o.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-right font-bold">${Number(o.total).toFixed(2)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                  No orders yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
