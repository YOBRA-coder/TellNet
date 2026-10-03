import { Outlet, createFileRoute } from "@tanstack/react-router";
import { readSite } from "@/lib/device";
import { getPortalCatalog } from "@/lib/fn/portal";

export const Route = createFileRoute("/portal")({
  // ?site=<slug> on the router's portal link scopes the package list to that site
  validateSearch: (s: Record<string, unknown>): { site?: string } =>
    typeof s.site === "string" && s.site ? { site: s.site.slice(0, 40) } : {},
  // URL link wins; otherwise the site this device last came in through, so
  // moving between portal pages (which drops ?site=) keeps the same packages.
  loaderDeps: ({ search }) => ({ site: search.site ?? readSite() }),
  loader: ({ deps }) => getPortalCatalog({ data: { site: deps.site } }),
  component: () => <Outlet />,
});
