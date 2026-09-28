import { Outlet, createFileRoute } from "@tanstack/react-router";
import { getPortalCatalog } from "@/lib/fn/portal";

export const Route = createFileRoute("/portal")({
  loader: () => getPortalCatalog(),
  component: () => <Outlet />,
});
