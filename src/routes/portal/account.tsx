import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { ActivationBadge } from "@/components/status-badge";
import { useDevice } from "@/hooks/use-device";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatRemaining, formatSpeed, formatStamp } from "@/lib/format";
import { HOTSPOT_FALLBACK } from "@/lib/brand-copy";
import { PACKAGE_IN_USE_MESSAGE } from "@/lib/device";
import { getAccount } from "@/lib/fn/portal";

export const Route = createFileRoute("/portal/account")({
  component: AccountPage,
});

function AccountPage() {
  const { device, ready } = useDevice();
  const q = useQuery({
    queryKey: ["account", device?.token],
    enabled: ready && Boolean(device),
    queryFn: () =>
      getAccount({
        data: {
          token: device!.token,
          phone: device?.phone ?? undefined,
          customerId: device?.customerId ?? undefined,
        },
      }),
  });
  const access = q.data?.access;

  return (
    <PortalShell hotspotName={q.data?.hotspotName ?? HOTSPOT_FALLBACK}>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Your package
      </h1>
      {!access ? (
        <>
          <p className="mt-3 text-sm text-muted">
            No active package on this device.
          </p>
          <Button asChild size="lg" className="mt-6 w-full">
            <Link to="/portal/packages">Buy a package</Link>
          </Button>
        </>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-2xl">{access.pack.packageName}</p>
              <ActivationBadge status={access.pack.activationStatus} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-subtle">Phone</dt>
                <dd className="mt-1 tabular-nums">
                  {formatPhoneDisplay(access.customer.phone)}
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Speed</dt>
                <dd className="mt-1">{formatSpeed(access.pack.speedLimitKbps)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Started</dt>
                <dd className="mt-1">{formatStamp(access.pack.startTime)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Expires</dt>
                <dd className="mt-1">{formatStamp(access.pack.expiryTime)}</dd>
              </div>
            </dl>
            <p className="mt-5 font-mono text-lg tabular-nums text-accent">
              {formatRemaining(access.pack.expiryTime)} remaining
            </p>
          </div>
          {access.otherDevice ? (
            <>
              <p className="text-sm text-danger">{PACKAGE_IN_USE_MESSAGE}</p>
              <Button asChild size="lg" className="w-full" variant="secondary">
                <Link to="/portal/packages">Buy a new package</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link to="/portal/connect">
                {access.connected ? "You are connected" : "Connect"}
              </Link>
            </Button>
          )}
        </div>
      )}
    </PortalShell>
  );
}
