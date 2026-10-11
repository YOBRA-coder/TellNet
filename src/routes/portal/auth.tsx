import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDevice } from "@/hooks/use-device";
import {
  getResetOptionsFn,
  requestResetOtpFn,
  resetPasswordWithOtp,
  resetPasswordWithReceipt,
  signIn,
  signUp,
} from "@/lib/fn/portal";
import { APP_NAME } from "@/lib/brand-copy";
import { isKenyanPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode:
      s.mode === "signup"
        ? ("signup" as const)
        : ("signin" as const),

    ref:
      typeof s.ref === "string"
        ? s.ref
        : "",

    next:
      typeof s.next === "string" &&
      s.next.startsWith("/portal")
        ? s.next
        : "/portal/rewards",
  }),

  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { device, update } = useDevice();

  const [mode, setMode] = useState<"signin" | "signup" | "reset">(
    search.mode,
  );

  const [phone, setPhone] = useState(
    device?.phone ?? "",
  );

  const [secret, setSecret] = useState("");
  const [confirm, setConfirm] = useState("");

  const [referral, setReferral] = useState(
    search.ref.toUpperCase(),
  );

  const [claim, setClaim] = useState("");

  const [needClaim, setNeedClaim] = useState(false);

  // "Forgot PIN" — M-Pesa code from a payment made with this number
  const [receipt, setReceipt] = useState("");

  // Forgot PIN by SMS code (only when the operator turned it on)
  const resetOpts = useQuery({ queryKey: ["reset-options"], queryFn: () => getResetOptionsFn() });
  const canOtp = Boolean(resetOpts.data?.otp);
  const canReceipt = resetOpts.data ? resetOpts.data.receipt : true;
  const [via, setVia] = useState<"otp" | "receipt" | null>(null);
  const resetVia: "otp" | "receipt" = via ?? (canOtp ? "otp" : "receipt");
  const [otpCode, setOtpCode] = useState("");
  const [otpNote, setOtpNote] = useState<string | null>(null);
  const sendOtp = useMutation({
    mutationFn: async () => {
      if (!isKenyanPhone(phone)) throw new Error("Enter a valid Kenyan phone number.");
      return requestResetOtpFn({ data: { phone } });
    },
    onSuccess: (res) => {
      if (res.ok) {
        setError(null);
        setOtpNote(`If ${res.maskedPhone ?? "that number"} has an account, a 6-digit code is on its way.`);
      } else {
        setOtpNote(null);
        setError(res.error ?? "Could not send the code.");
      }
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not send the code."),
  });

  const [error, setError] = useState<string | null>(
    null,
  );

  const submit = useMutation({
    mutationFn: async () => {
      if (!device) {
        throw new Error(
          "Device not ready. Please reload the page and try again.",
        );
      }

      if (!isKenyanPhone(phone)) {
        throw new Error(
          "Enter a valid Kenyan phone number.",
        );
      }

      if (!secret) {
        throw new Error(
          mode === "signup"
            ? "Enter a PIN or password."
            : mode === "reset"
              ? "Enter a new PIN or password."
              : "Enter your PIN or password.",
        );
      }

      if (mode === "reset") {
        if (resetVia === "otp") {
          if (!otpCode.trim()) throw new Error("Enter the code we sent by SMS.");
        } else if (!receipt.trim()) {
          throw new Error(
            "Enter the M-Pesa transaction code from one of your payments.",
          );
        }

        if (secret.length < 4) {
          throw new Error(
            "Use at least 4 characters for your new PIN or password.",
          );
        }

        if (secret !== confirm) {
          throw new Error(
            "The two PINs/passwords don't match.",
          );
        }

        if (resetVia === "otp") {
          return resetPasswordWithOtp({
            data: { phone, code: otpCode.trim(), next: secret, token: device.token },
          });
        }

        return resetPasswordWithReceipt({
          data: {
            phone,
            transactionId: receipt.trim(),
            next: secret,
            token: device.token,
          },
        });
      }

      if (mode === "signup") {
        if (secret.length < 4) {
          throw new Error(
            "Use at least 4 characters for your PIN or password.",
          );
        }

        if (secret !== confirm) {
          throw new Error(
            "The two PINs/passwords don't match.",
          );
        }

        return signUp({
          data: {
            phone,
            secret,
            token: device.token,
            referralCode:
              referral.trim() || undefined,
            claimTransactionId:
              claim.trim() || undefined,
          },
        });
      }

      return signIn({
        data: {
          phone,
          secret,
          token: device.token,
        },
      });
    },

    onSuccess: (res) => {
      if (!res.ok) {
        setError(
          res.error || "Authentication failed.",
        );

        if (
          "code" in res &&
          res.code === "claim_required"
        ) {
          setNeedClaim(true);
        }

        if (
          "code" in res &&
          res.code === "exists"
        ) {
          setMode("signin");
          setConfirm("");
          setClaim("");
          setNeedClaim(false);
        }

        return;
      }

      update({
        phone: res.phone,
        customerId: res.customerId,
      });

      qc.invalidateQueries();

      navigate({
        to: search.next,
      });
    },

    onError: (e) => {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to connect. Please check your internet connection and try again.",
      );
    },
  });

  const switchMode = (
    nextMode: "signin" | "signup" | "reset",
  ) => {
    if (submit.isPending) return;

    setMode(nextMode);
    setError(null);
    setSecret("");
    setConfirm("");
    setReceipt("");

    if (nextMode !== "signup") {
      setClaim("");
      setNeedClaim(false);
    }
  };

  const tab = (
    m: "signin" | "signup",
    label: string,
  ) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m || (m === "signin" && mode === "reset")}
      aria-controls="auth-form"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        switchMode(m);
      }}
      className={cn(
        "flex flex-1 min-h-[44px]",
        "items-center justify-center",
        "rounded-lg px-3 py-2",
        "text-sm font-medium",
        "touch-manipulation select-none",
        "transition",
        "active:scale-[0.98]",
        mode === m || (m === "signin" && mode === "reset")
          ? "bg-accent text-accent-fg"
          : "text-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );

  return (
    <PortalShell
      hotspotName={APP_NAME}
    >
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        {mode === "signup"
          ? "Create your account"
          : mode === "reset"
            ? "Reset your PIN"
            : "Welcome back"}
      </h1>

      <p className="mt-2 text-sm text-muted">
        {mode === "signup"
          ? "Sign up to earn loyalty points and get your own referral code. You don't need an account just to buy internet."
          : mode === "reset"
            ? "Forgot your PIN or password? Enter your phone number and an M-Pesa transaction code from a payment you made with it, then choose a new one."
            : "Sign in with your phone number and PIN or password."}
      </p>

      {/* Sign in / Sign up tabs */}
      <div
        className="mt-5 flex gap-1 rounded-xl border border-border bg-surface p-1"
        role="tablist"
        aria-label="Authentication"
      >
        {tab("signin", "Sign in")}
        {tab("signup", "Sign up")}
      </div>

      {/* Authentication form */}
      <form
        id="auth-form"
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();

          if (submit.isPending) {
            return;
          }

          setError(null);
          submit.mutate();
        }}
      >
        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="auth-phone">
            Phone number
          </Label>

          <Input
            id="auth-phone"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="0712 000 000"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value)
            }
            className="h-12 text-base"
          />
        </div>

        {/* Forgot PIN: prove the number is yours */}
        {mode === "reset" && resetVia === "otp" ? (
          <div className="space-y-1.5">
            <Label htmlFor="auth-otp">SMS code</Label>
            <div className="flex gap-2">
              <Input
                id="auth-otp"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-base"
              />
              <Button
                type="button"
                variant="secondary"
                className="h-12 shrink-0"
                disabled={sendOtp.isPending}
                onClick={() => sendOtp.mutate()}
              >
                {sendOtp.isPending ? "Sending…" : otpNote ? "Resend" : "Send code"}
              </Button>
            </div>
            <p className="text-xs text-subtle">{otpNote ?? "We'll text a code to the number above."}</p>
            {canReceipt ? (
              <button
                type="button"
                onClick={() => { setVia("receipt"); setError(null); }}
                className="text-xs font-medium text-accent hover:underline"
              >
                Use an M-Pesa code instead
              </button>
            ) : null}
          </div>
        ) : null}

        {mode === "reset" && resetVia === "receipt" ? (
          <div className="space-y-1.5">
            <Label htmlFor="auth-receipt">
              M-Pesa transaction code
            </Label>

            <Input
              id="auth-receipt"
              name="receipt"
              placeholder="e.g. QGH7XXXXXX"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              value={receipt}
              onChange={(e) =>
                setReceipt(
                  e.target.value.toUpperCase(),
                )
              }
              className="h-12 text-base"
            />

            <p className="text-xs text-subtle">
              Find it in the M-Pesa message for any
              payment you made here with this number.
            </p>
            {canOtp ? (
              <button
                type="button"
                onClick={() => { setVia("otp"); setError(null); }}
                className="text-xs font-medium text-accent hover:underline"
              >
                Get an SMS code instead
              </button>
            ) : null}
          </div>
        ) : null}

        {/* PIN / Password */}
        <div className="space-y-1.5">
          <Label htmlFor="auth-secret">
            {mode === "reset"
              ? "New PIN or password"
              : "PIN or password"}
          </Label>

          <Input
            id="auth-secret"
            name="password"
            type="password"
            autoComplete={
              mode === "signin"
                ? "current-password"
                : "new-password"
            }
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={
              mode === "signin"
                ? "Your PIN / password"
                : "4+ digits or a password"
            }
            value={secret}
            onChange={(e) =>
              setSecret(e.target.value)
            }
            className="h-12 text-base"
          />
        </div>

        {/* Confirm (sign up and reset) */}
        {mode === "reset" ? (
          <div className="space-y-1.5">
            <Label htmlFor="auth-confirm-reset">
              Confirm new PIN or password
            </Label>

            <Input
              id="auth-confirm-reset"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={confirm}
              onChange={(e) =>
                setConfirm(e.target.value)
              }
              className="h-12 text-base"
            />
          </div>
        ) : null}

        {/* Sign-up-only fields */}
        {mode === "signup" ? (
          <>
            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label htmlFor="auth-confirm">
                Confirm PIN or password
              </Label>

              <Input
                id="auth-confirm"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={confirm}
                onChange={(e) =>
                  setConfirm(e.target.value)
                }
                className="h-12 text-base"
              />
            </div>

            {/* Referral */}
            <div className="space-y-1.5">
              <Label htmlFor="auth-ref">
                Referral code (optional)
              </Label>

              <Input
                id="auth-ref"
                name="referral"
                placeholder="e.g. RABC123"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={referral}
                onChange={(e) =>
                  setReferral(
                    e.target.value.toUpperCase(),
                  )
                }
                className="h-12 text-base"
              />
            </div>

            {/* M-Pesa claim */}
            {needClaim ? (
              <div className="space-y-1.5">
                <Label htmlFor="auth-claim">
                  M-Pesa transaction code
                </Label>

                <Input
                  id="auth-claim"
                  name="claim"
                  placeholder="e.g. QGH7XXXXXX"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={claim}
                  onChange={(e) =>
                    setClaim(
                      e.target.value.toUpperCase(),
                    )
                  }
                  className="h-12 text-base"
                />

                <p className="text-xs text-subtle">
                  From an M-Pesa message for a payment
                  made with this number. It proves the
                  number is yours.
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        {/* Error */}
        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            {error}
          </div>
        ) : null}

        {/* Submit */}
        <Button
          type="submit"
          size="xl"
          className="w-full min-h-[48px] touch-manipulation"
          disabled={submit.isPending}
        >
          {submit.isPending
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : mode === "reset"
                ? "Reset PIN and sign in"
                : "Sign in"}
        </Button>
      </form>

      {/* Forgot PIN */}
      {mode === "signin" ? (
        <div className="mt-4 space-y-1 text-center">
          <button
            type="button"
            onClick={() => switchMode("reset")}
            className="min-h-[44px] touch-manipulation px-3 text-sm font-medium text-accent hover:underline"
          >
            Forgot your PIN or password?
          </button>

          <p className="text-xs text-subtle">
            No M-Pesa payment on this number yet? Ask
            the hotspot operator to reset it for you.
          </p>
        </div>
      ) : null}

      {mode === "reset" ? (
        <div className="mt-4 space-y-1 text-center">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="min-h-[44px] touch-manipulation px-3 text-sm font-medium text-accent hover:underline"
          >
            Back to sign in
          </button>

          <p className="text-xs text-subtle">
            Can't find a code? The hotspot operator can
            reset your PIN for you.
          </p>
        </div>
      ) : null}

      {/* Back */}
      <Link
        to="/portal"
        className="mt-5 block text-center text-sm text-muted hover:text-fg"
      >
        Back to packages
      </Link>
    </PortalShell>
  );
}
