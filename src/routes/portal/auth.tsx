import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevice } from "@/hooks/use-device";
import { signIn, signUp } from "@/lib/fn/portal";
import { HOTSPOT_FALLBACK } from "@/lib/brand-copy";
import { isKenyanPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "signup" ? ("signup" as const) : ("signin" as const),
    ref: typeof s.ref === "string" ? s.ref : "",
    next: typeof s.next === "string" && s.next.startsWith("/portal") ? s.next : "/portal/rewards",
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { device, update } = useDevice();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode);
  const [phone, setPhone] = useState(device?.phone ?? "");
  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referral, setReferral] = useState(search.ref.toUpperCase());
  const [claim, setClaim] = useState("");
  const [needClaim, setNeedClaim] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      if (!device) throw new Error("Device not ready. Reload the page.");
      if (!isKenyanPhone(phone)) throw new Error("Enter a valid Kenyan phone number.");
      if (mode === "signup") {
        if (secret.length < 4) throw new Error("Use at least 4 characters for your PIN or password.");
        if (secret !== confirm) throw new Error("The two PINs/passwords don't match.");
        return signUp({
          data: {
            phone,
            secret,
            token: device.token,
            referralCode: referral.trim() || undefined,
            claimTransactionId: claim.trim() || undefined,
          },
        });
      }
      return signIn({ data: { phone, secret, token: device.token } });
    },
    onSuccess: (res) => {
      if (!res.ok) {
        setError(res.error);
        if ("code" in res && res.code === "claim_required") setNeedClaim(true);
        if ("code" in res && res.code === "exists") setMode("signin");
        return;
      }
      update({ phone: res.phone, customerId: res.customerId });
      qc.invalidateQueries();
      navigate({ to: search.next });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Something went wrong."),
  });

  const tab = (m: "signin" | "signup", label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(m);
        setError(null);
      }}
      className={cn(
        "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition",
        mode === m ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );

  return (
    <PortalShell hotspotName={HOTSPOT_FALLBACK}>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "signup"
          ? "Sign up to earn loyalty points and get your own referral code. You don't need an account just to buy internet."
          : "Sign in with your phone number and PIN or password."}
      </p>

      <div className="mt-5 flex gap-1 rounded-xl border border-border bg-surface p-1">
        {tab("signin", "Sign in")}
        {tab("signup", "Sign up")}
      </div>

      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          submit.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="auth-phone">Phone number</Label>
          <Input
            id="auth-phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0712 000 000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="auth-secret">PIN or password</Label>
          <Input
            id="auth-secret"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "4+ digits or a password" : "Your PIN / password"}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        {mode === "signup" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="auth-confirm">Confirm PIN or password</Label>
              <Input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-ref">Referral code (optional)</Label>
              <Input
                id="auth-ref"
                placeholder="e.g. RABC123"
                value={referral}
                onChange={(e) => setReferral(e.target.value.toUpperCase())}
                className="h-12 text-base"
              />
            </div>
            {needClaim ? (
              <div className="space-y-1.5">
                <Label htmlFor="auth-claim">M-Pesa transaction code</Label>
                <Input
                  id="auth-claim"
                  placeholder="e.g. QGH7XXXXXX"
                  value={claim}
                  onChange={(e) => setClaim(e.target.value.toUpperCase())}
                  className="h-12 text-base"
                />
                <p className="text-xs text-subtle">
                  From an M-Pesa message for a payment made with this number. It proves the number is yours.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" size="xl" className="w-full" disabled={submit.isPending}>
          {submit.isPending ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      {mode === "signin" ? (
        <p className="mt-4 text-center text-xs text-subtle">
          Forgot your PIN? Ask the hotspot operator to reset it for you.
        </p>
      ) : null}
      <Link to="/portal" className="mt-5 text-center text-sm text-muted hover:text-fg">
        Back to packages
      </Link>
    </PortalShell>
  );
}
