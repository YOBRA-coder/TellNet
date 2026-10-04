import { Outlet, createFileRoute } from "@tanstack/react-router";
import { getPortalCatalog } from "@/lib/fn/portal";

export const Route = createFileRoute("/portal")({
  // ?site=<slug> on the router's portal link scopes the package list to that site
  validateSearch: (s: Record<string, unknown>): { site?: string } =>
    typeof s.site === "string" && s.site ? { site: s.site.slice(0, 40) } : {},
  loaderDeps: ({ search }) => ({ site: search.site }),
  loader: ({ deps }) => getPortalCatalog({ data: { site: deps.site } }),
  component: () => <Outlet />,
});
