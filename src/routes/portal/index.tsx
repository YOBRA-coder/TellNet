import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";
import { PackageCard } from "@/components/portal/package-card";
import { PortalShell, PortalSupportSection } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/use-device";
import { readSite } from "@/lib/device";
import { HOTSPOT_FALLBACK } from "@/lib/brand-copy";
import { PACKAGE_IN_USE_MESSAGE } from "@/lib/device";
import { getPortalBootstrap } from "@/lib/fn/portal";
import type { Package } from "@/lib/types";

const portalRoute = getRouteApi("/portal");

export const Route = createFileRoute("/portal/")({ component: PortalHome });

function PortalHome() {
  const catalog = portalRoute.useLoaderData();
  const { device, ready, update } = useDevice();
  const q = useQuery({
    queryKey: ["portal", device?.token, readSite() ?? ""],
    enabled: ready && Boolean(device),
    queryFn: () =>
      getPortalBootstrap({
        data: {
          token: device!.token,
          phone: device?.phone ?? undefined,
          customerId: device?.customerId ?? undefined,
          site: readSite(),
        },
      }),
  });

  useEffect(() => {
    if (q.data?.access?.customer) {
      update({
        customerId: q.data.access.customer.id,
        phone: q.data.access.customer.phone,
      });
    }
  }, [q.data, update]);

  const settings = q.data?.settings ?? catalog.settings;
  const packages = q.data?.packages ?? catalog.packages;
  const internetUp = q.data?.internetUp ?? catalog.internetUp;
  const access = q.data?.access;
  const hotspot = settings.hotspotName ?? HOTSPOT_FALLBACK;

  if (access && access.pack.status === "ACTIVE") {
    if (access.otherDevice) {
      return (
        <PortalShell hotspotName={hotspot}>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-danger">
            Device limit
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
            {PACKAGE_IN_USE_MESSAGE}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            {access.pack.packageName} is already connected on another phone.
            Ask the operator to release the device if this is your package.
          </p>
          <Button asChild size="xl" className="mt-6 w-full" variant="secondary">
            <Link to="/portal/packages">Buy a new package</Link>
          </Button>
          <Link
            to="/portal/recover"
            className="mt-4 text-center text-sm text-muted hover:text-fg"
          >
            Already paid?
          </Link>
        </PortalShell>
      );
    }
    return (
      <PortalShell hotspotName={hotspot}>
      {(q.data?.unreadNotices ?? 0) > 0 ? (
        <Link
          to="/portal/rewards"
          className="mb-4 block rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok"
        >
          🎉 You have {q.data?.unreadNotices} new reward alert{q.data?.unreadNotices === 1 ? "" : "s"} — tap to view
        </Link>
      ) : null}
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Welcome back
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
          Your package is still active.
        </h1>
        <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <p className="text-sm text-muted">Package</p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {access.pack.packageName}
          </p>
          <p className="mt-4 text-sm text-muted">Expires</p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            {new Date(access.pack.expiryTime).toLocaleString()}
          </p>
        </div>
        <Button asChild size="xl" className="mt-6 w-full">
          <Link to="/portal/connect">Connect</Link>
        </Button>
        <Link
          to="/portal/account"
          className="mt-4 text-center text-sm text-muted hover:text-fg"
        >
          View account
        </Link>
      </PortalShell>
    );
  }

  return (
    <PortalShell
      hotspotName={hotspot}
      maintenanceMode={settings.maintenanceMode}
      maintenanceMessage={settings.maintenanceMessage}
      footer={
        <div className="flex flex-col gap-2 pb-2 text-center text-sm">
          <Link to="/portal/recover" className="text-muted hover:text-fg">
            Already paid? Recover my package
          </Link>
          <Link to="/portal/connect" className="text-subtle hover:text-muted">
            Returning customer — connect
          </Link>
          <Link to="/portal/voucher" className="text-muted hover:text-fg">
            Have a voucher code?
          </Link>
          <Link
            to="/portal/auth"
            search={{ mode: "signin", ref: "", next: "/portal/rewards" }}
            className="text-muted hover:text-fg"
          >
            Sign in / Sign up
          </Link>
          <Link to="/portal/add-device" className="text-muted hover:text-fg">
            Add a device
          </Link>
        </div>
      }
    >
      {(q.data?.unreadNotices ?? 0) > 0 ? (
        <Link
          to="/portal/rewards"
          className="mb-4 block rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok"
        >
          🎉 You have {q.data?.unreadNotices} new reward alert{q.data?.unreadNotices === 1 ? "" : "s"} — tap to view
        </Link>
      ) : null}
      <div className="relative mx-auto mb-6 size-20">
        <span className="radar-ring" />
        <div className="absolute inset-0 m-auto flex size-12 items-center justify-center rounded-full border border-accent/30 bg-surface">
          <span className="size-2.5 rounded-full bg-accent" />
        </div>
      </div>
      <p className="text-center text-xs font-medium uppercase tracking-[0.22em] text-accent">
        {hotspot}
      </p>
      <h1 className="mt-3 text-center font-display text-4xl font-semibold tracking-tight">
        {settings.welcomeMessage ?? "Welcome to Wi-Fi"}
      </h1>
      {settings.maintenanceMode ? (
        <p className="mt-3 text-center text-sm text-muted">
          Packages are paused for maintenance right now — check back shortly.
        </p>
      ) : (
        <>
          <p className="mt-3 text-center text-sm text-muted">
            Choose a package. Pay with M-Pesa. You are online the moment the
            payment is confirmed.
          </p>
          {internetUp && (
            <p className="mt-4 rounded-lg border border-warn/20 bg-warn/10 px-3 py-2 text-sm text-warn">
            Connected to the Internet.
            </p>
          )}
          <div className="mt-8 flex flex-col gap-3">
            {packages.map((pkg: Package, i: number) => (
             <PackageCard
                key={pkg.id}
                pkg={pkg}
                currency={settings.currency}
                maxDevices={pkg.maxDevices}
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
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
