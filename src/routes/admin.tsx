import { createFileRoute, Link, useNavigate, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePendingOrderCount } from "@/hooks/use-products";
import { playChime } from "@/lib/chime";
import {
  LayoutDashboard,
  Package,
  Tag,
  ShoppingCart,
  Users,
  Settings,
  Image,
  GalleryHorizontalEnd,
  Megaphone,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  DatabaseBackup,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { TwoFactorSetup } from "@/components/two-factor-setup";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const SIDEBAR_KEY = "bosba:admin-sidebar-collapsed";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/banners", label: "Hero Banner", icon: GalleryHorizontalEnd },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/media", label: "Media", icon: Image },
  { to: "/admin/categories", label: "Categories", icon: Tag },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/restore", label: "Restore Backup", icon: DatabaseBackup },
] as const;

function AdminLayout() {
  const { user, isAdmin, isSales, isMarketing, isStaff, canAccessAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const { data: pendingCount = 0 } = usePendingOrderCount(!loading && !!user && isStaff);
  const prevCount = useRef<number | null>(null);

  // Whether this account has a password (credential provider). TOTP setup needs
  // one, so Google-only admins can't be forced through the 2FA gate — they rely
  // on Google's own 2FA instead. null = still loading.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) return;
    let active = true;
    authClient
      .listAccounts()
      .then((res) => {
        if (active) setHasPassword((res.data ?? []).some((a) => a.providerId === "credential"));
      })
      .catch(() => {
        if (active) setHasPassword(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  // Collapsed sidebar shows icons only. Persisted so it survives navigation/reload.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);
  const toggleSidebar = () =>
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });

  // Sales can only ever be on the Orders page.
  const salesBlocked = isSales && !isAdmin && !path.startsWith("/admin/orders");
  // Marketing is scoped to the catalog/marketing sections.
  const marketingPaths = [
    "/admin/products",
    "/admin/marketing",
    "/admin/categories",
    "/admin/media",
  ];
  const marketingBlocked =
    isMarketing && !isAdmin && path !== "/admin" && !marketingPaths.some((p) => path.startsWith(p));
  const visibleNav = isAdmin
    ? nav
    : isMarketing
      ? nav.filter((n) => n.to === "/admin" || marketingPaths.includes(n.to))
      : nav.filter((n) => n.to === "/admin/orders");

  useEffect(() => {
    if (!loading && (!user || !canAccessAdmin)) navigate({ to: "/" });
  }, [loading, user, canAccessAdmin, navigate]);

  useEffect(() => {
    if (salesBlocked) navigate({ to: "/admin/orders" });
    else if (marketingBlocked) navigate({ to: "/admin" });
  }, [salesBlocked, marketingBlocked, navigate]);

  useEffect(() => {
    // Alert only on an actual increase, never on first load.
    if (prevCount.current !== null && pendingCount > prevCount.current) {
      playChime();
      toast.success(`🛎️ New order! ${pendingCount} pending.`, { duration: 6000 });
    }
    prevCount.current = pendingCount;
  }, [pendingCount]);

  if (loading || !user || !canAccessAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Checking access...
      </div>
    );
  }

  // Admins hold the keys to the whole store — require 2FA before they can use
  // the dashboard. Google-only accounts (no password) can't set up TOTP here, so
  // they're exempt; assign such staff a password-based account. While hasPassword
  // is still loading (null), don't gate yet.
  const mustSetUp2fa = isAdmin && hasPassword === true && !user.twoFactorEnabled;
  if (mustSetUp2fa) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-4">
        <div className="w-full max-w-lg space-y-5 rounded-2xl border bg-card p-6 md:p-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-brand" />
            <h1 className="font-display font-bold text-xl">Secure your admin account</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Two-factor authentication is required for admin accounts. Set it up once to continue —
            you'll enter a code from your authenticator app each time you sign in.
          </p>
          <TwoFactorSetup enabled={false} onChanged={() => window.location.reload()} />
          <button
            onClick={() => signOut().then(() => navigate({ to: "/" }))}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-sidebar">
      <aside
        className={cn(
          "border-r border-sidebar-border flex flex-col gap-8 shrink-0 transition-[width] duration-200",
          collapsed ? "w-20 p-3 items-center" : "w-64 p-6",
        )}
      >
        <Link
          to="/"
          title="BOSBA Premium Foods"
          className={cn("flex items-center gap-2 min-w-0", collapsed && "justify-center")}
        >
          <img
            src="/logo.png"
            alt="BOSBA Premium Foods"
            className="size-9 rounded-lg object-contain shrink-0"
          />
          {!collapsed && (
            <span className="font-display text-base font-bold leading-tight text-sidebar-foreground">
              BOSBA Premium Foods
            </span>
          )}
        </Link>
        <nav className="flex-1 w-full space-y-1">
          {visibleNav.map((n) => {
            const active = "exact" in n && n.exact ? path === n.to : path.startsWith(n.to);
            const badge = n.to === "/admin/orders" ? pendingCount : 0;
            return (
              <Link
                key={n.to}
                to={n.to}
                title={collapsed ? n.label : undefined}
                className={cn(
                  "relative flex items-center rounded-lg text-sm font-medium transition-colors",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent",
                )}
              >
                <n.icon className="size-4 shrink-0" />
                {!collapsed && <span className="flex-1">{n.label}</span>}
                {badge > 0 &&
                  (collapsed ? (
                    <span className="absolute right-1 top-1 size-2 rounded-full bg-destructive" />
                  ) : (
                    <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
                      {badge}
                    </span>
                  ))}
              </Link>
            );
          })}
        </nav>
        <div className="w-full space-y-1">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center rounded-lg text-xs font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent",
              collapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2.5",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4 shrink-0" />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" />
            )}
            {!collapsed && "Collapse"}
          </button>
          <Link
            to="/"
            title={collapsed ? "Back to storefront" : undefined}
            className={cn(
              "flex items-center rounded-lg text-xs text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "justify-center p-2.5" : "gap-2 px-3 py-2.5",
            )}
          >
            <ArrowLeft className="size-3.5 shrink-0" />
            {!collapsed && "Back to storefront"}
          </Link>
        </div>
      </aside>
      <main className="flex-1 bg-background p-8 overflow-x-auto">
        {salesBlocked || marketingBlocked ? (
          <div className="text-muted-foreground">Redirecting…</div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
