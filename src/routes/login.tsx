import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { TelNetMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/brand-copy";
import { loginOperator } from "@/lib/fn/public";
import { markOperatorSession, useOperatorSession } from "@/lib/operator";

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
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return (
      <main className="atmosphere grid min-h-dvh place-items-center">
        <div className="h-10 w-48 animate-pulse rounded-md bg-raised" />
      </main>
    );
  }
  if (isOperator) {
    return <Navigate to="/admin/dashboard" />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await loginOperator({ data: { password } });
      if (!res.ok) {
        setError(res.error || "Incorrect password.");
        return;
      }
      markOperatorSession();
      window.location.href = dest;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="atmosphere grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <TelNetMark className="h-10 w-10" />
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Operator login
            </h1>
            <p className="mt-1 text-sm text-muted">
              {APP_NAME} — password only. Customers use the public portal.
            </p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="operator-password">Password</Label>
            <Input
              id="operator-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Operator password"
              required
              autoFocus
            />
          </div>
          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy || !password}>
            {busy ? "Checking…" : "Enter operator console"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted">
          Default password is <code className="rounded bg-raised px-1">telnet-admin</code>
          . Change it under Settings after login.
        </p>
      </div>
    </main>
  );
}
