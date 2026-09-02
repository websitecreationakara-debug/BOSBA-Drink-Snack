import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AnnouncementBanner } from "@/components/layout/announcement-banner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";

export const Route = createFileRoute("/_store")({
  component: StoreLayout,
});

function StoreLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnnouncementBanner />
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
