import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { ActivationBadge } from "@/components/status-badge";
import { useDevice } from "@/hooks/use-device";
import { formatPhoneDisplay } from "@/lib/phone";
import { formatRemaining, formatSpeed, formatStamp } from "@/lib/format";
import { HOTSPOT_FALLBACK } from "@/lib/brand-copy";
import { PACKAGE_IN_USE_MESSAGE } from "@/lib/device";
import { dismissNotices, getAccount, listPortalPackages, redeemPoints } from "@/lib/fn/portal";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/account")({
  component: AccountPage,
});

function AccountPage() {
  const { device, ready } = useDevice();
  const qc = useQueryClient();
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
  const loyalty = q.data?.loyalty;
  const devices = q.data?.devices ?? [];
  const maxDevices = q.data?.maxDevicesPerPackage ?? 1;
  const queued = q.data?.queued ?? [];
  const notices = q.data?.notices ?? [];
  const referralStats = q.data?.referralStats;
  const bankedMinutes = q.data?.bankedMinutes ?? 0;
  const dismiss = useMutation({
    mutationFn: () =>
      dismissNotices({
        data: {
          customerId: access!.customer.id,
          ids: notices.map((n) => n.id),
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["account"] }),
  });

  const share = useMutation({
    mutationFn: async (code: string) => {
      const link =
        typeof window !== "undefined"
          ? `${window.location.origin}/portal/packages?ref=${code}`
          : code;
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ title: "Get online", text: `Use my code ${code}`, url: link });
        return "shared";
      }
      if (typeof navigator !== "undefined" && "clipboard" in navigator) {
        await (navigator as any).clipboard.writeText(link);
        return "copied";
      }
      return "unavailable";
    },
    onSuccess: (result) => {
      if (result === "copied") toast.success("Referral link copied.");
      if (result === "unavailable") toast.error("Couldn't share — copy the code manually.");
    },
  });

  const rewardsQ = useQuery({
    queryKey: ["portal-packages"],
    queryFn: () => listPortalPackages(),
    enabled: Boolean(loyalty),
    staleTime: 60_000,
  });
  const rewards = (rewardsQ.data ?? []).filter((p) => p.pointsCost != null);

  const redeem = useMutation({
    mutationFn: (packageId: string) =>
      redeemPoints({
        data: {
          customerId: device!.customerId!,
          packageId,
          deviceToken: device?.token,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Redeemed! Connecting you now.");
      qc.invalidateQueries({ queryKey: ["account"] });
    },
    onError: () => toast.error("Could not redeem points."),
  });

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
          {queued.length < 0 ? (
            <div className="rounded-2xl border border-accent/30 bg-surface p-4">
              <p className="text-sm font-medium">
                Up next ({queued.length} queued)
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-subtle">
                {queued.map((qp, i) => (
                  <li key={i}>
                    <span className="font-medium text-fg">{qp.packageName}</span>{" "}
                    — starts {formatStamp(qp.startTime)}, ends{" "}
                    {formatStamp(qp.expiryTime)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-subtle">
                Already paid for. Each starts automatically when the one before
                it ends — no interruption. Total coverage until{" "}
                {formatStamp(queued[queued.length - 1].expiryTime)}.
              </p>
            </div>
          ) : null}
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
      {notices.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-ok/30 bg-ok/10 p-4">
          {notices.map((n) => (
            <p key={n.id} className="text-sm text-ok">
              🎉 {n.message}
            </p>
          ))}
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => dismiss.mutate()}
            disabled={dismiss.isPending}
          >
            Got it
          </Button>
        </div>
      ) : null}
      {loyalty && q.data?.referralEnabled && loyalty.referralCode ? (
        <div className="mt-6 rounded-2xl border border-accent/30 bg-surface p-5">
          <p className="font-display text-lg font-semibold">Refer a friend</p>
          <p className="mt-2 text-sm text-muted">
            Share your code — you get bonus minutes and they get a welcome
            bonus, added automatically on their first qualifying purchase.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-raised px-3 py-2.5">
            <span className="font-mono text-lg font-semibold tracking-wide">
              {loyalty.referralCode}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => share.mutate(loyalty.referralCode)}
              disabled={share.isPending}
            >
              Share
            </Button>
          </div>
          {referralStats ? (
            <p className="mt-3 text-xs text-subtle">
              {referralStats.friends} friend{referralStats.friends === 1 ? "" : "s"} joined
              · {referralStats.minutesEarned} bonus minutes earned
              {bankedMinutes > 0
                ? ` · ${bankedMinutes} min banked for your next package`
                : ""}
            </p>
          ) : null}
        </div>
      ) : null}
      {loyalty && q.data?.loyaltyEnabled ? (
        <div className="mt-6 rounded-2xl border border-accent/30 bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg font-semibold">Loyalty points</p>
            <p className="font-display text-2xl font-semibold tabular-nums text-accent">
              {loyalty.points}
            </p>
          </div>
          {rewards.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-wide text-subtle">
                Redeem for a package
              </p>
              {rewards.map((pkg) => {
                const affordable = loyalty.points >= (pkg.pointsCost ?? Infinity);
                return (
                  <div
                    key={pkg.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{pkg.name}</p>
                      <p className="text-subtle">{pkg.pointsCost} points</p>
                    </div>
                    <Button
                      size="sm"
                      variant={affordable ? "default" : "outline"}
                      disabled={!affordable || !device?.customerId || redeem.isPending}
                      onClick={() => redeem.mutate(pkg.id)}
                    >
                      Redeem
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </PortalShell>
  );
}
