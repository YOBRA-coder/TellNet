import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redeemVoucherPortal } from "@/lib/fn/portal";
import { getDeviceToken } from "@/lib/device";

export const Route = createFileRoute("/portal/voucher")({
  component: VoucherRedeem,
});

function VoucherRedeem() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await redeemVoucherPortal({
        data: { code, phone, deviceToken: getDeviceToken() },
      });
      if (!res.ok) {
        setError(res.error || "Redeem failed");
        return;
      }
      setOk(
        res.activationOk
          ? `Redeemed ${res.packageName}. You are online.`
          : `Redeemed ${res.packageName}. Activation pending — use Already Paid if needed.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Redeem failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div>
        <h1 className="font-display text-2xl font-semibold">Voucher code</h1>
        <p className="mt-1 text-sm text-muted">
          Enter a code from the shop. No M-Pesa prompt.
        </p>
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="code">Code</Label>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            className="font-mono uppercase"
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="07XXXXXXXX"
            required
          />
        </div>
        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {ok && (
          <p className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700">
            {ok}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Redeeming…" : "Redeem voucher"}
        </Button>
      </form>
      <p className="text-center text-sm">
        <Link to="/portal" className="text-accent underline">
          Back to packages
        </Link>
      </p>
    </main>
  );
}
