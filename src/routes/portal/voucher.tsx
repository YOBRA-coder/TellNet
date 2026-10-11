import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevice } from "@/hooks/use-device";
import { APP_NAME } from "@/lib/brand-copy";
import { isKenyanPhone, formatPhoneDisplay } from "@/lib/phone";
import { readSite } from "@/lib/device";
import { redeemVoucherPortal } from "@/lib/fn/portal";

export const Route = createFileRoute("/portal/voucher")({
  component: VoucherRedeem,
});

function VoucherRedeem() {
  const navigate = useNavigate();
  const { device, ready, update } = useDevice();
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const redeem = useMutation({
    mutationFn: async () => {
      if (!device) throw new Error("Device not ready");
      if (!isKenyanPhone(phone)) {
        throw new Error("Enter a valid Kenyan phone number.");
      }
      return redeemVoucherPortal({
        data: { code: code.trim(), phone, deviceToken: device.token, site: readSite() },
      });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error || "That code didn't work.");
        return;
      }
      setError(null);
      update({ phone: formatPhoneDisplay(phone) });
      setOk(
        res.queued
          ? `Redeemed ${res.packageName}. You still have time left on your current package — this one is queued and will activate automatically when it ends.`
          : res.activationOk
            ? `Redeemed ${res.packageName}. You're online.`
            : `Redeemed ${res.packageName}. Activation pending — use "Already paid?" if it doesn't connect.`,
      );
      if (res.activationOk && !res.queued) {
        setTimeout(() => navigate({ to: "/portal/connect" }), 900);
      }
    },
    onError: (err) => {
      setOk(null);
      setError(err instanceof Error ? err.message : "That code didn't work.");
    },
  });

  return (
    <PortalShell hotspotName={APP_NAME}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
        Voucher
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Redeem a voucher code
      </h1>
      <p className="mt-3 text-sm text-muted">
        Got a code from the shop or an agent? Enter it below — no M-Pesa
        prompt needed.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          redeem.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="code">Voucher code</Label>
          <Input
            id="code"
            placeholder="e.g. AB12CD34EF"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="h-12 font-mono text-base tracking-wide uppercase"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-12 text-base"
            required
          />
          <p className="text-xs text-subtle">
            Used to identify your account — no charge is made.
          </p>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {ok && <p className="text-sm text-ok">{ok}</p>}
        <Button
          type="submit"
          size="xl"
          className="w-full"
          disabled={!ready || code.trim().length < 4 || redeem.isPending}
        >
          {redeem.isPending ? "Redeeming…" : "Redeem voucher"}
        </Button>
      </form>
      <Link
        to="/portal/packages"
        className="mt-5 text-center text-sm text-muted hover:text-fg"
      >
        Back to packages
      </Link>
    </PortalShell>
  );
}
