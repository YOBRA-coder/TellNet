import { useEffect } from "react";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { bindHardwareClient, getPortalCatalog } from "@/lib/fn/portal";
import { readDevice } from "@/lib/device";

export const Route = createFileRoute("/portal")({
  // ?site=<slug> on the router's portal link scopes the package list to that site.
  // ?hwc=<id> is added by the Omada / Ruijie portal entry (see /api/hw/...).
  validateSearch: (s: Record<string, unknown>): { site?: string; hwc?: string } => ({
    ...(typeof s.site === "string" && s.site ? { site: s.site.slice(0, 40) } : {}),
    ...(typeof s.hwc === "string" && /^hwc_[0-9a-f]{24}$/.test(s.hwc) ? { hwc: s.hwc } : {}),
  }),
  loaderDeps: ({ search }) => ({ site: search.site }),
  loader: ({ deps }) => getPortalCatalog({ data: { site: deps.site } }),
  component: PortalLayout,
});

function PortalLayout() {
  const { hwc } = Route.useSearch();
  useEffect(() => {
    if (!hwc) return;
    const device = readDevice();
    void bindHardwareClient({ data: { token: device.token, ctx: hwc } }).catch(() => {});
  }, [hwc]);
  return <Outlet />;
}
