import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalShell, PortalSupportSection } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevice } from "@/hooks/use-device";
import { readSite } from "@/lib/device";
import { formatDuration, formatKes, formatSpeed } from "@/lib/format";
import { getPortalBootstrap, startPayment } from "@/lib/fn/portal";
import { formatPhoneDisplay, isKenyanPhone } from "@/lib/phone";
import type { Package } from "@/lib/types";

const portalRoute = getRouteApi("/portal");

export const Route = createFileRoute("/portal/payment")({
  validateSearch: (s: Record<string, unknown>) => ({
    packageId: typeof s.packageId === "string" ? s.packageId : "",
    ref: typeof s.ref === "string" ? s.ref : "",
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const { packageId, ref } = Route.useSearch();
  const catalog = portalRoute.useLoaderData();
  const navigate = useNavigate();
  const { device, ready, update } = useDevice();
  const [phone, setPhone] = useState("");
  const [referralCode, setReferralCode] = useState(() => ref.toUpperCase());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (device?.phone) {
      setPhone((current) => current || formatPhoneDisplay(device.phone!));
    }
  }, [device]);

  const boot = useQuery({
    queryKey: ["portal", device?.token],
    enabled: ready && Boolean(device),
    queryFn: () =>
      getPortalBootstrap({
        data: { token: device!.token, phone: device?.phone ?? undefined },
      }),
  });

  const packages = boot.data?.packages ?? catalog.packages;
  const settings = boot.data?.settings ?? catalog.settings;
  const pkg = packages.find((p: Package) => p.id === packageId);

  const start = useMutation({
    mutationFn: async () => {
      if (!device) throw new Error("Device not ready");
      if (!isKenyanPhone(phone)) {
        throw new Error("Enter a valid Kenyan M-Pesa number.");
      }
      const res = await startPayment({
        data: {
          packageId,
          phone,
          token: device.token,
          referralCode: referralCode.trim() || undefined,
          site: readSite(),
        },
      });
      if (!res.ok) {
        if ("accountRequired" in res && res.accountRequired) {
          navigate({
            to: "/portal/auth",
            search: { mode: "signup", ref: "", next: `/portal/payment?packageId=${packageId}` },
          });
        }
        throw new Error(res.error);
      }
      return res;
    },
    onSuccess: (res) => {
      update({ phone: res.phone, customerId: res.customerId });
      navigate({
        to: "/portal/payment-status",
        search: { paymentId: res.paymentId },
      });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed"),
  });

  return (
    <PortalShell
      hotspotName={settings.hotspotName}
      maintenanceMode={settings.maintenanceMode}
      maintenanceMessage={settings.maintenanceMessage}
    >
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
        M-Pesa
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Pay to connect
      </h1>
      {pkg ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <p className="font-display text-xl font-semibold">{pkg.name}</p>
          <p className="mt-1 text-sm text-muted">
            {formatDuration(pkg.durationMinutes)} · {formatSpeed(pkg.downloadKbps)}
          </p>
          <p className="mt-4 font-display text-3xl font-semibold tabular-nums text-cream">
            {formatKes(pkg.price, settings.currency)}
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Select a package first.{" "}
          <Link to="/portal/packages" className="text-accent">
            View packages
          </Link>
        </p>
      )}

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="phone">M-Pesa phone number</Label>
          <Input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-12 text-base"
            disabled={settings.maintenanceMode}
          />
          <p className="text-xs text-subtle">Safaricom numbers: 07XX or 01XX.</p>
        </div>
        {settings.referralEnabled &&
        pkg &&
        Number(pkg.price) > Number(settings.referralMinPackagePrice) ? (
          <div className="space-y-1.5">
            <Label htmlFor="referral">Referral code (optional)</Label>
            <Input
              id="referral"
              placeholder="e.g. RABC123"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className="h-12 text-base"
              disabled={settings.maintenanceMode}
            />
            <p className="text-xs text-subtle">
              Got a friend's code? Use it here — no account needed. (Your own code comes when you sign up.)
            </p>
          </div>
        ) : null}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          type="submit"
          variant="mpesa"
          size="xl"
          className="w-full"
          disabled={!pkg || start.isPending || settings.maintenanceMode}
        >
          {settings.maintenanceMode
            ? "Payments paused"
            : start.isPending
              ? "Sending prompt…"
              : "Pay with M-Pesa"}
        </Button>
      </form>
      <Link
        to="/portal/recover"
        className="mt-5 text-center text-sm text-muted hover:text-fg"
      >
        Already paid?
      </Link>

      <PortalSupportSection
              supportPhone={settings.supportPhone}
              supportWhatsapp={settings.supportWhatsapp}
              supportMessage={settings.supportMessage}
            />
    </PortalShell>
  );
}
