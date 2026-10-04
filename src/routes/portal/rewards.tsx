import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/use-device";
import { APP_NAME } from "@/lib/brand-copy";
import { changePin, dismissNotices, getRewards, redeemPoints, signOut } from "@/lib/fn/portal";
import { formatStamp } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/rewards")({ component: RewardsPage });

const REASON: Record<string, string> = {
  EARNED_PURCHASE: "Earned from a purchase",
  REDEEMED: "Redeemed for a package",
};

function RewardsPage() {
  const { device, ready, update } = useDevice();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["rewards", device?.token],
    enabled: ready && Boolean(device),
    refetchInterval: 15_000,
    queryFn: () => getRewards({ data: { token: device!.token } }),
  });
  const d = q.data;

  const dismiss = useMutation({
    mutationFn: () => dismissNotices({ data: { token: device!.token } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rewards"] });
      qc.invalidateQueries({ queryKey: ["portal"] });
    },
  });

  const redeem = useMutation({
    mutationFn: (packageId: string) =>
      redeemPoints({ data: { packageId, token: device!.token } }),
    onSuccess: (res) => {
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.queued ? "Redeemed! It will start when your current package ends." : "Redeemed! Connecting you now.");
      qc.invalidateQueries();
    },
    onError: () => toast.error("Could not redeem points."),
  });

  const share = useMutation({
    mutationFn: async (code: string) => {
      const link = `${window.location.origin}/portal/auth?mode=signup&ref=${code}`;
      const text = `Use my code ${code} to get bonus minutes on your first package.`;
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Get online", text, url: link });
        return "shared";
      }
      await navigator.clipboard.writeText(`${text} ${link}`);
      return "copied";
    },
    onSuccess: (r) => r === "copied" && toast.success("Referral link copied."),
    onError: () => toast.error("Couldn't share — copy the code manually."),
  });

  const [pinOpen, setPinOpen] = useState(false);
  const [curPin, setCurPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const change = useMutation({
    mutationFn: () => changePin({ data: { token: device!.token, current: curPin, next: newPin } }),
    onSuccess: (res) => {
      if (!res.ok) return void toast.error(res.error);
      toast.success("PIN changed. Other devices were signed out.");
      setPinOpen(false);
      setCurPin("");
      setNewPin("");
    },
    onError: () => toast.error("Could not change your PIN."),
  });

  const out = useMutation({
    mutationFn: () => signOut({ data: { token: device!.token } }),
    onSuccess: () => {
      update({ customerId: null });
      qc.invalidateQueries();
    },
  });

  return (
    <PortalShell hotspotName={d?.hotspotName.split(" ")[0] ?? APP_NAME}>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Rewards</h1>

      {q.isLoading || !d ? (
        <div className="mt-6 h-40 animate-pulse rounded-2xl border border-border bg-surface" />
      ) : d.state !== "member" ? (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-5">
          <p className="font-display text-lg font-semibold">
            {d.state === "guest" ? "Finish setting up your account" : "Sign in to see your rewards"}
          </p>
          <p className="mt-2 text-sm text-muted">
            Loyalty points and referral codes are for registered customers. Create an account with your phone
            number and a PIN — it takes 20 seconds. Buying internet never needs an account.
          </p>
          <div className="mt-4 flex gap-2">
            <Button asChild className="flex-1">
              <Link to="/portal/auth" search={{ mode: "signup", ref: "", next: "/portal/rewards" }}>
                Sign up
              </Link>
            </Button>
            <Button asChild variant="secondary" className="flex-1">
              <Link to="/portal/auth" search={{ mode: "signin", ref: "", next: "/portal/rewards" }}>
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted">Signed in as {formatPhoneDisplay(d.phone)}</p>

          {d.notices.some((n) => n.unread) ? (
            <div className="rounded-2xl border border-ok/30 bg-ok/10 p-4">
              {d.notices
                .filter((n) => n.unread)
                .map((n) => (
                  <p key={n.id} className="text-sm text-ok">
                    🎉 {n.message}
                  </p>
                ))}
              <Button size="sm" variant="outline" className="mt-3" onClick={() => dismiss.mutate()} disabled={dismiss.isPending}>
                Got it
              </Button>
            </div>
          ) : null}

          {d.referralEnabled && d.referralCode ? (
            <section className="rounded-2xl border border-accent/30 bg-surface p-5">
              <p className="font-display text-lg font-semibold">Refer a friend</p>
              <p className="mt-2 text-sm text-muted">
                Share your code. When a friend buys their first package over {d.currency} {d.referralMinPackagePrice},
                you get {d.referralBonusMinutes} bonus minutes and they get {d.welcomeBonusMinutes + d.referralBonusMinutes}.
                You'll get an alert here as soon as they join.
              </p>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-raised px-3 py-2.5">
                <span className="font-mono text-lg font-semibold tracking-wide">{d.referralCode}</span>
                <Button size="sm" variant="outline" onClick={() => share.mutate(d.referralCode!)} disabled={share.isPending}>
                  Share
                </Button>
              </div>
              <p className="mt-3 text-xs text-subtle">
                {d.referralStats.joined} friend{d.referralStats.joined === 1 ? "" : "s"} joined ·{" "}
                {d.referralStats.paid} bought a package · {d.referralStats.minutesEarned} bonus minutes earned
                {d.bankedMinutes > 0 ? ` · ${d.bankedMinutes} min saved for your next package` : ""}
              </p>
            </section>
          ) : null}

          {d.loyaltyEnabled ? (
            <section className="rounded-2xl border border-accent/30 bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="font-display text-lg font-semibold">Loyalty points</p>
                <p className="font-display text-2xl font-semibold tabular-nums text-accent">{d.points}</p>
              </div>
              <p className="mt-1 text-xs text-subtle">
                You earn {d.loyaltyPointsPerKes} point{d.loyaltyPointsPerKes === 1 ? "" : "s"} for every {d.currency} 1 you pay.
              </p>
              {d.rewards.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-subtle">Redeem for a package</p>
                  {d.rewards.map((pkg) => {
                    const affordable = d.points >= (pkg.pointsCost ?? Infinity);
                    return (
                      <div key={pkg.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
                        <div>
                          <p className="font-medium">{pkg.name}</p>
                          <p className="text-subtle">{pkg.pointsCost} points</p>
                        </div>
                        <Button
                          size="sm"
                          variant={affordable ? "default" : "outline"}
                          disabled={!affordable || redeem.isPending}
                          onClick={() => redeem.mutate(pkg.id)}
                        >
                          Redeem
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted">No reward packages are available yet.</p>
              )}
              {d.ledger.length > 0 ? (
                <ul className="mt-4 space-y-1 text-xs text-subtle">
                  {d.ledger.map((l) => (
                    <li key={l.id} className="flex justify-between">
                      <span>{REASON[l.reason] ?? l.reason} · {formatStamp(l.createdAt)}</span>
                      <span className={l.delta >= 0 ? "text-ok" : ""}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {!d.referralEnabled && !d.loyaltyEnabled ? (
            <p className="text-sm text-muted">Rewards aren't running right now. Check back later.</p>
          ) : null}

          {pinOpen ? (
            <form
              className="space-y-2 rounded-2xl border border-border bg-surface p-4"
              onSubmit={(e) => {
                e.preventDefault();
                change.mutate();
              }}
            >
              <p className="font-medium">Change PIN / password</p>
              <Input type="password" autoComplete="current-password" placeholder="Current PIN / password" value={curPin} onChange={(e) => setCurPin(e.target.value)} />
              <Input type="password" autoComplete="new-password" placeholder="New PIN / password (4+ characters)" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={change.isPending || !curPin || newPin.length < 4}>
                  {change.isPending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setPinOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPinOpen(true)}>
                Change PIN
              </Button>
              <Button variant="ghost" size="sm" onClick={() => out.mutate()} disabled={out.isPending}>
                Sign out
              </Button>
            </div>
          )}
        </div>
      )}
      <Link to="/portal/account" className="mt-6 text-center text-sm text-muted hover:text-fg">
        Back to my package
      </Link>
    </PortalShell>
  );
}
