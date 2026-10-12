import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { TelNetMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/brand-copy";
import {
  getOperatorLoginInfoFn,
  loginOperator,
  requestOperatorOtpFn,
  resetOperatorPasswordFn,
} from "@/lib/fn/public";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useOperatorSession } from "@/lib/operator";

/**
 * Operator login look (code-only switch, not exposed in any UI).
 *   true  -> glass login card over the background image (/public/portal-bg.jpg)
 *   false -> same glass login card, but no image (plain dark gradient)
 * Change the value, rebuild, done.
 */
const LOGIN_BACKGROUND_IMAGE = true;

const LOGIN_ROOT = `atmosphere glass-theme ${LOGIN_BACKGROUND_IMAGE ? "" : "glass-no-image"}`;

type Search = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/admin/dashboard",
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const dest =
    redirect && redirect.startsWith("/admin") ? redirect : "/admin/dashboard";
  const { isOperator, isPending } = useOperatorSession();
  const info = useQuery({ queryKey: ["operator-login-info"], queryFn: () => getOperatorLoginInfoFn() });
  const { canInstall, install } = useInstallPrompt();
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending || info.isPending) {
    return (
      <main className={`${LOGIN_ROOT} grid min-h-dvh place-items-center`}>
        <div className="h-10 w-48 animate-pulse rounded-md bg-raised" />
      </main>
    );
  }
  if (isOperator) {
    return <Navigate to="/admin/dashboard" />;
  }
  const legacy = Boolean(info.data?.legacy);
  const canOtp = Boolean(info.data?.otp);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "reset") {
        if (password !== confirm) {
          setError("The two passwords don't match.");
          return;
        }
        const res = await resetOperatorPasswordFn({ data: { phone, code: code.trim(), next: password } });
        if (!res.ok) {
          setError(res.error || "Could not reset the password.");
          return;
        }
      } else {
        const res = await loginOperator({ data: { phone: legacy ? undefined : phone, password } });
        if (!res.ok) {
          setError(res.error || "Incorrect password.");
          return;
        }
      }
      window.location.href = dest;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestOperatorOtpFn({ data: { phone } });
      if (res.ok) setNote(`If ${res.maskedPhone ?? "that number"} has an account, a 6-digit code is on its way.`);
      else setError(res.error ?? "Could not send the code.");
    } catch {
      setError("Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  const resetting = mode === "reset";
  return (
    <main className={`${LOGIN_ROOT} grid min-h-dvh place-items-center px-5 py-10`}>
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <TelNetMark className="h-10 w-10" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {resetting ? "Reset password" : "Operator login"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {resetting
                ? "We'll text a code to your phone."
                : legacy
                  ? `${APP_NAME} — shared password. Customers use the public portal.`
                  : `${APP_NAME} — sign in with your phone number. Customers use the public portal.`}
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {!legacy ? (
            <div className="space-y-2">
              <Label htmlFor="operator-phone">Phone number</Label>
              <Input
                id="operator-phone"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX"
                required
                autoFocus
              />
            </div>
          ) : null}

          {resetting ? (
            <div className="space-y-2">
              <Label htmlFor="operator-code">SMS code</Label>
              <div className="flex gap-2">
                <Input
                  id="operator-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="6-digit code"
                  required
                />
                <Button type="button" variant="secondary" disabled={busy || !phone} onClick={sendCode}>
                  {note ? "Resend" : "Send code"}
                </Button>
              </div>
              {note ? <p className="text-xs text-muted">{note}</p> : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="operator-password">{resetting ? "New password (6+ characters)" : "Password"}</Label>
            <Input
              id="operator-password"
              type="password"
              autoComplete={resetting ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={resetting ? "New password" : legacy ? "Operator password" : "Your password"}
              required
              autoFocus={legacy}
            />
          </div>
          {resetting ? (
            <div className="space-y-2">
              <Label htmlFor="operator-confirm">Confirm new password</Label>
              <Input
                id="operator-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy || !password || (!legacy && !phone)}>
            {busy ? "Checking…" : resetting ? "Set password and sign in" : "Enter operator console"}
          </Button>
        </form>

        {!legacy && !resetting ? (
          <p className="text-center text-sm">
            {canOtp ? (
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => { setMode("reset"); setError(null); }}>
                Forgot password?
              </button>
            ) : (
              <span className="text-xs text-muted">Forgot your password? Ask an owner to reset it.</span>
            )}
          </p>
        ) : null}
        {resetting ? (
          <p className="text-center text-sm">
            <button type="button" className="font-medium text-accent hover:underline" onClick={() => { setMode("signin"); setError(null); setNote(null); }}>
              Back to sign in
            </button>
          </p>
        ) : null}

        {legacy ? (
          <p className="text-center text-xs text-muted">
            Default password is <code className="rounded bg-raised px-1">telnet-admin</code>. After signing in, create your
            own account under Settings → Operators.
          </p>
        ) : null}

        {canInstall ? (
          <Button type="button" variant="outline" className="w-full" onClick={() => void install()}>
            Install the operator app
          </Button>
        ) : null}
      </div>
    </main>
  );
}
