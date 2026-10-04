import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { ActivationBadge } from "@/components/status-badge";
import { useDevice } from "@/hooks/use-device";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatRemaining, formatSpeed, formatStamp } from "@/lib/format";
import { APP_NAME } from "@/lib/brand-copy";
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
    // Poll so a friend's referral bonus or a queue promotion shows up
    // without the customer having to reload the page.
    refetchInterval: 15_000,
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
  const devices = q.data?.devices ?? [];
  const maxDevices = q.data?.maxDevicesPerPackage ?? 1;
  const queued = q.data?.queued ?? [];
  const queuedCount = q.data?.queuedCount ?? queued.length;
  const member = q.data?.member;
  const rewardsOn = Boolean(q.data?.loyaltyEnabled || q.data?.referralEnabled);

  return (
    <PortalShell hotspotName={q.data?.hotspotName?.split(" ")[0] ?? APP_NAME}>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Your package
      </h1>
      {!access ? (
        <>
          <p className="mt-3 text-sm text-muted">
            No active package on this device.
          </p>
          {queuedCount > 0 ? <QueuedCard queued={queued} count={queuedCount} /> : null}
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
          {queuedCount > 0 ? <QueuedCard queued={queued} count={queuedCount} /> : null}
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
          {maxDevices > 1 ? (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Connected devices ({devices.length}/{maxDevices})
                </p>
              </div>
              {devices.length > 0 ? (
                <ul className="mt-2 space-y-1.5 text-xs text-subtle">
                  {devices.map((d, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {d.isThisDevice ? "This device" : d.info ?? "Unknown device"}
                      </span>
                      <span>{formatStamp(d.boundAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {devices.length < maxDevices ? (
                <p className="mt-2 text-xs text-muted">
                  Another phone can join by entering{" "}
                  {formatPhoneDisplay(access.customer.phone)} on{" "}
                  <Link to="/portal/add-device" className="text-accent">
                    Add a device
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
        {member?.registered ? (
          <p className="text-sm text-muted">
            Signed in as {formatPhoneDisplay(member.phone)}.
          </p>
        ) : (
          <p className="text-sm text-muted">
            Create an account to earn loyalty points and get your own referral code.
          </p>
        )}
        <div className="mt-3 flex gap-2">
          {rewardsOn && member?.registered ? (
            <Button asChild variant="secondary" size="sm" className="flex-1">
              <Link to="/portal/rewards">Rewards &amp; referrals</Link>
            </Button>
          ) : null}
          {!member?.registered ? (
            <>
              <Button asChild size="sm" className="flex-1">
                <Link to="/portal/auth" search={{ mode: "signup", ref: "", next: "/portal/rewards" }}>
                  Sign up
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm" className="flex-1">
                <Link to="/portal/auth" search={{ mode: "signin", ref: "", next: "/portal/account" }}>
                  Sign in
                </Link>
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </PortalShell>
  );
}

function QueuedCard({
  queued,
  count,
}: {
  queued: { packageName: string; startTime: string; expiryTime: string }[];
  count: number;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-accent/30 bg-surface p-4">
      <p className="text-sm font-medium">Up next ({count} queued)</p>
      {queued.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-xs text-subtle">
          {queued.map((qp, i) => (
            <li key={i}>
              <span className="font-medium text-fg">{qp.packageName}</span> — starts{" "}
              {formatStamp(qp.startTime)}, ends {formatStamp(qp.expiryTime)}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-subtle">
        Already paid for. Each one starts automatically when the one before it ends — no interruption.
        {queued.length > 0
          ? ` Total coverage until ${formatStamp(queued[queued.length - 1].expiryTime)}.`
          : ""}
      </p>
    </div>
  );
}
