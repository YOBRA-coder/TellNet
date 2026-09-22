import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDevice } from "@/hooks/use-device";
import { deviceInfo } from "@/lib/device";
import { formatRemaining, formatStamp } from "@/lib/format";
import { HOTSPOT_FALLBACK } from "@/lib/brand-copy";
import { PACKAGE_IN_USE_MESSAGE } from "@/lib/device";
import { connectActive, getAccount } from "@/lib/fn/portal";

export const Route = createFileRoute("/portal/connect")({
  component: ConnectPage,
});

function ConnectPage() {
  const { device, ready, update } = useDevice();

  const account = useQuery({
    queryKey: ["account", device?.token, device?.customerId],
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

  const connect = useMutation({
    mutationFn: async () => {
      if (!device) throw new Error("Device not ready");
      return connectActive({
        data: {
          token: device.token,
          phone: device.phone ?? undefined,
          customerId: device.customerId ?? undefined,
          deviceInfo: deviceInfo(),
        },
      });
    },
    onSuccess: (res) => {
      if (res.ok && res.pack) {
        update({ customerId: res.pack.customerId });
        account.refetch();
      }
    },
  });

  const access = account.data?.access;
  const connected = Boolean(
    (connect.isSuccess && connect.data?.ok) || access?.connected,
  );

  if (!ready || account.isLoading) {
    return (
      <PortalShell hotspotName={HOTSPOT_FALLBACK}>
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto mt-5 h-10 w-56" />
        <Skeleton className="mt-8 h-40 w-full rounded-2xl" />
      </PortalShell>
    );
  }

  return (
    <PortalShell hotspotName={account.data?.hotspotName ?? HOTSPOT_FALLBACK}>
      {connected ? (
        <>
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-ok/15 text-ok">
            <Check className="size-8" />
          </div>
          <h1 className="mt-5 text-center font-display text-3xl font-semibold tracking-tight">
            You are online
          </h1>
          <p className="mt-2 text-center text-sm text-muted">
            This session is authorised on the router. The package stays valid if
            the WAN path changes.
          </p>
          {access?.pack && (
            <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm text-muted">Package</p>
              <p className="mt-1 font-display text-2xl">{access.pack.packageName}</p>
              <p className="mt-4 text-sm text-muted">Expires</p>
              <p className="mt-1 font-mono tabular-nums">
                {formatStamp(access.pack.expiryTime)} · {formatRemaining(access.pack.expiryTime)} left
              </p>
            </div>
          )}
          <Button asChild variant="secondary" className="mt-6 w-full">
            <Link to="/portal/account">View account</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            Welcome back
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
            {access
              ? "Your package is still active."
              : "Reconnect an active package"}
          </h1>
          {access?.pack ? (
            <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
              <p className="text-sm text-muted">Package</p>
              <p className="mt-1 font-display text-2xl">{access.pack.packageName}</p>
              <p className="mt-4 text-sm text-muted">Expires</p>
              <p className="mt-1 font-mono">
                {formatStamp(access.pack.expiryTime)}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              We could not recognise this device. Use Already Paid if you have an
              M-Pesa receipt.
            </p>
          )}
          {(access?.otherDevice ||
            (connect.data &&
              !connect.data.ok &&
              "code" in connect.data &&
              connect.data.code === "in_use")) && (
            <p className="mt-4 text-sm text-danger">{PACKAGE_IN_USE_MESSAGE}</p>
          )}
          {connect.data &&
            !connect.data.ok &&
            !("code" in connect.data && connect.data.code === "in_use") && (
            <p className="mt-4 text-sm text-danger">{connect.data.error}</p>
          )}
          {access?.otherDevice ? (
            <Button asChild size="xl" className="mt-6 w-full" variant="secondary">
              <Link to="/portal">Buy a new package</Link>
            </Button>
          ) : (
            <Button
              size="xl"
              className="mt-6 w-full"
              disabled={!ready || connect.isPending}
              onClick={() => connect.mutate()}
            >
              {connect.isPending ? "Connecting…" : "Connect"}
            </Button>
          )}
          <div className="mt-4 flex flex-col gap-2 text-center text-sm">
            <Link to="/portal/recover" className="text-muted hover:text-fg">
              Already paid?
            </Link>
            <Link to="/portal" className="text-subtle hover:text-muted">
              Buy a package
            </Link>
          </div>
        </>
      )}
    </PortalShell>
  );
}
