import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevice } from "@/hooks/use-device";
import { deviceInfo } from "@/lib/device";
import { HOTSPOT_FALLBACK } from "@/lib/brand-copy";
import { isKenyanPhone } from "@/lib/phone";
import { joinHostPackage } from "@/lib/fn/portal";

export const Route = createFileRoute("/portal/add-device")({
  component: AddDevicePage,
});

function AddDevicePage() {
  const navigate = useNavigate();
  const { device, ready, update } = useDevice();
  const [hostPhone, setHostPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: async () => {
      if (!device) throw new Error("Device not ready");
      if (!isKenyanPhone(hostPhone)) {
        throw new Error("Enter the host's phone number.");
      }
      return joinHostPackage({
        data: { hostPhone, token: device.token, deviceInfo: deviceInfo() },
      });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error);
        setJoined(null);
        return;
      }
      setError(null);
      update({ customerId: res.pack.customerId });
      setJoined(res.pack.packageName);
      setTimeout(() => navigate({ to: "/portal/connect" }), 900);
    },
    onError: (err) => {
      setJoined(null);
      setError(err instanceof Error ? err.message : "Could not connect.");
    },
  });

  return (
    <PortalShell hotspotName={HOTSPOT_FALLBACK}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
        Add a device
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Join someone's package
      </h1>
      <p className="mt-3 text-sm text-muted">
        If a package allows more than one device, enter the phone number it
        was bought with to connect this device too — no extra payment.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          join.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="hostPhone">Host's phone number</Label>
          <Input
            id="hostPhone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 000 000"
            value={hostPhone}
            onChange={(e) => setHostPhone(e.target.value)}
            className="h-12 text-base"
            required
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {joined && (
          <p className="text-sm text-ok">
            Connected via {joined}. Taking you online…
          </p>
        )}
        <Button
          type="submit"
          size="xl"
          className="w-full"
          disabled={!ready || join.isPending}
        >
          {join.isPending ? "Connecting…" : "Connect this device"}
        </Button>
      </form>
      <Link
        to="/portal/packages"
        className="mt-5 text-center text-sm text-muted hover:text-fg"
      >
        Buy my own package instead
      </Link>
    </PortalShell>
  );
}
