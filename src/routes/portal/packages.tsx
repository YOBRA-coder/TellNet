import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router";
import { PackageCard } from "@/components/portal/package-card";
import { PortalShell } from "@/components/portal/portal-shell";
import { useDevice } from "@/hooks/use-device";
import { getPortalBootstrap } from "@/lib/fn/portal";

const portalRoute = getRouteApi("/portal");

export const Route = createFileRoute("/portal/packages")({
  component: PackagesPage,
});

function PackagesPage() {
  const catalog = portalRoute.useLoaderData();
  const { device, ready } = useDevice();
  const q = useQuery({
    queryKey: ["portal", device?.token],
    enabled: ready && Boolean(device),
    queryFn: () =>
      getPortalBootstrap({
        data: { token: device!.token, phone: device?.phone ?? undefined },
      }),
  });

  const settings = q.data?.settings ?? catalog.settings;
  const packages = q.data?.packages ?? catalog.packages;

  return (
    <PortalShell
      hotspotName={settings.hotspotName}
      footer={
        <p className="pb-2 text-center text-sm">
          <Link to="/portal/recover" className="text-muted hover:text-fg">
            Already paid?
          </Link>
        </p>
      }
    >
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Available packages
      </h1>
      <p className="mt-2 text-sm text-muted">
        Speed is enforced per package on the router. Duration is counted by the
        server, not your phone.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} currency={settings.currency} />
        ))}
      </div>
    </PortalShell>
  );
}
