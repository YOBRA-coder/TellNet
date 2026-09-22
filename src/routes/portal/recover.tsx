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
import { recoverPackage } from "@/lib/fn/portal";

export const Route = createFileRoute("/portal/recover")({
  component: RecoverPage,
});

function RecoverPage() {
  const navigate = useNavigate();
  const { device, ready, update } = useDevice();
  const [tx, setTx] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "warn" | "danger">("ok");

  const mutate = useMutation({
    mutationFn: async (transactionId: string) => {
      if (!device) throw new Error("Device not ready");
      return recoverPackage({
        data: {
          transactionId,
          token: device.token,
          phone: device.phone ?? undefined,
          deviceInfo: deviceInfo(),
        },
      });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        setTone(res.code === "expired" ? "warn" : "danger");
        setMessage(res.error);
        if (res.code === "expired") navigate({ to: "/portal/expired" });
        return;
      }
      setTone("ok");
      setMessage(res.message);
      if (res.payment?.customerId) {
        update({ customerId: res.payment.customerId, phone: res.payment.phone });
      }
      if (res.activation && res.activation.ok) {
        navigate({ to: "/portal/connect" });
      }
    },
    onError: () => {
      setTone("danger");
      setMessage("Could not recover this package. Please try again.");
    },
  });

  return (
    <PortalShell hotspotName={HOTSPOT_FALLBACK}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
        Already paid?
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Recover my package
      </h1>
      <p className="mt-3 text-sm text-muted">
        Enter the M-Pesa transaction ID from your SMS. We verify it against the
        ledger — never from the number you type alone.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMessage(null);
          mutate.mutate(tx);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="tx">M-Pesa transaction ID</Label>
          <Input
            id="tx"
            placeholder="QGH7XXXXXX"
            value={tx}
            onChange={(e) => setTx(e.target.value.toUpperCase())}
            className="h-12 font-mono text-base tracking-wide"
          />
        </div>
        {message && (
          <p
            className={
              tone === "ok"
                ? "text-sm text-ok"
                : tone === "warn"
                  ? "text-sm text-warn"
                  : "text-sm text-danger"
            }
          >
            {message}
          </p>
        )}
        <Button
          type="submit"
          size="xl"
          className="w-full"
          disabled={!ready || tx.length < 6 || mutate.isPending}
        >
          {mutate.isPending ? "Checking…" : "Recover my package"}
        </Button>
      </form>
      <Link to="/portal" className="mt-6 text-center text-sm text-muted hover:text-fg">
        Back to packages
      </Link>
    </PortalShell>
  );
}
