import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router";
import { PackageBrowser } from "@/components/portal/package-browser";
import { PurchaseConsent } from "@/components/portal/legal-footer";
import { PortalShell, PortalSupportSection } from "@/components/portal/portal-shell";
import { useDevice } from "@/hooks/use-device";
import { readSite } from "@/lib/device";
import { getPortalBootstrap } from "@/lib/fn/portal";
import { APP_NAME } from "@/lib/brand-copy";


const portalRoute = getRouteApi("/portal");

export const Route = createFileRoute("/portal/packages")({
  component: PackagesPage,
});

function PackagesPage() {
  const catalog = portalRoute.useLoaderData();
  const { device, ready } = useDevice();
  const q = useQuery({
    queryKey: ["portal", device?.token, readSite() ?? ""],
    enabled: ready && Boolean(device),
    queryFn: () =>
      getPortalBootstrap({
        data: { token: device!.token, phone: device?.phone ?? undefined, site: readSite() },
      }),
  });

  const settings = q.data?.settings ?? catalog.settings;
  const packages = q.data?.packages ?? catalog.packages;

  return (
    <PortalShell
      hotspotName={settings.hotspotName.split(" ")[0] ?? APP_NAME}
      maintenanceMode={settings.maintenanceMode}
      maintenanceMessage={settings.maintenanceMessage}
      footer={
        <p className="pb-2 text-center text-sm">
          <Link to="/portal/recover" className="text-muted hover:text-fg">
            Already paid?
          </Link>
          <span className="mx-2 text-subtle">·</span>
          <Link to="/portal/voucher" className="text-muted hover:text-fg">
            Have a voucher code?
          </Link>
          <span className="mx-2 text-subtle">·</span>
          <Link to="/portal/add-device" className="text-muted hover:text-fg">
            Add a device
          </Link>
        </p>
      }
    >
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Available packages
      </h1>
      {settings.maintenanceMode ? (
        <p className="mt-2 text-sm text-muted">
          New purchases are paused while we do maintenance. Check back shortly.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            Speed is enforced per package on the router. Duration is counted by
            the server, not your phone. Already have an active package? A new
            purchase queues automatically and starts the moment your current
            one ends — it won't cut you off early.
          </p>
          <div className="mt-6">
            <PackageBrowser
              packages={packages}
              currency={settings.currency}
              registered={q.data ? Boolean(q.data.member?.registered) : null}
              requireAccountForMulti={Boolean(settings.requireAccountMultiDevice)}
              rewardsOn={Boolean(settings.loyaltyEnabled || settings.referralEnabled)}
              operating={q.data?.operating ?? null}
              studentBlockedDomains={settings.studentBlockedDomains}
            />
            <PurchaseConsent className="mt-4" />
          </div>
        </>
      )}
      <PortalSupportSection
        supportPhone={settings.supportPhone}
        supportWhatsapp={settings.supportWhatsapp}
        supportMessage={settings.supportMessage}
      />
    </PortalShell>
  );
}
