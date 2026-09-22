import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/use-device";
import { formatKes } from "@/lib/format";
import { HOTSPOT_FALLBACK } from "@/lib/brand-copy";
import { PACKAGE_IN_USE_MESSAGE } from "@/lib/device";
import { getPaymentStatus } from "@/lib/fn/portal";

export const Route = createFileRoute("/portal/payment-status")({
  validateSearch: (s: Record<string, unknown>) => ({
    paymentId: typeof s.paymentId === "string" ? s.paymentId : "",
  }),
  component: PaymentStatusPage,
});

function PaymentStatusPage() {
  const { paymentId } = Route.useSearch();
  const navigate = useNavigate();
  const { update } = useDevice();
  const [timedOut, setTimedOut] = useState(false);

  const q = useQuery({
    queryKey: ["payment", paymentId],
    enabled: Boolean(paymentId),
    queryFn: () => getPaymentStatus({ data: { paymentId } }),
    refetchInterval: (query) => {
      const status = query.state.data?.ok ? query.state.data.payment.status : null;
      if (status === "PENDING") return 3000;
      return false;
    },
  });

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), 90_000);
    return () => window.clearTimeout(t);
  }, [paymentId]);

  const payment = q.data?.ok ? q.data.payment : null;
  const access = q.data?.ok ? q.data.access : null;

  useEffect(() => {
    if (payment?.customerId) {
      update({ customerId: payment.customerId, phone: payment.phone });
    }
  }, [payment, update]);

  useEffect(() => {
    if (payment?.status === "SUCCESS" && access?.connected) {
      navigate({ to: "/portal/connect" });
    }
  }, [payment, access, navigate]);

  return (
    <PortalShell hotspotName={HOTSPOT_FALLBACK}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
        Payment status
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        {payment?.status === "SUCCESS"
          ? "Payment received"
          : payment?.status === "FAILED" || payment?.status === "CANCELLED"
            ? "Payment did not complete"
            : "Waiting for M-Pesa"}
      </h1>

      {payment?.status === "PENDING" && (
        <>
          <p className="mt-3 text-sm text-muted">
            Check your phone and enter your M-Pesa PIN to pay{" "}
            {payment ? formatKes(payment.amount) : ""} for {payment?.packageName}.
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs uppercase tracking-wide text-subtle">Live STK Push</p>
            <p className="mt-2 font-display text-lg font-semibold">
              {payment.packageName} · {formatKes(payment.amount)}
            </p>
            <p className="mt-2 text-sm text-muted">
              Confirm the Safaricom prompt on your phone. This page updates when
              Daraja reports the result — there is no demo PIN.
            </p>
          </div>
          {timedOut && (
            <p className="mt-4 text-sm text-warn">
              Still waiting. If money was deducted, use{" "}
              <Link to="/portal/recover" className="underline">
                Already Paid?
              </Link>{" "}
              with your M-Pesa receipt.
            </p>
          )}
        </>
      )}

      {payment?.status === "SUCCESS" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-ok/20 bg-ok/10 p-5">
            <p className="text-sm text-ok">M-Pesa confirmed</p>
            {payment.mpesaTransactionId && (
              <p className="mt-2 font-mono text-lg tracking-wide">
                {payment.mpesaTransactionId}
              </p>
            )}
            <p className="mt-2 text-sm text-muted">
              Save this receipt. You can reconnect with it later.
            </p>
          </div>
          {payment.activationStatus === "ACTIVATION_FAILED" ? (
            <>
              <p className="text-sm text-warn">
                {access?.otherDevice
                  ? PACKAGE_IN_USE_MESSAGE
                  : "Payment received. Your package could not be activated yet. Please use Already Paid? to reconnect."}
              </p>
              <Button asChild size="lg" className="w-full">
                <Link to="/portal/recover">Recover my package</Link>
              </Button>
            </>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link to="/portal/connect">Connect now</Link>
            </Button>
          )}
        </div>
      )}

      {(payment?.status === "FAILED" || payment?.status === "CANCELLED") && (
        <div className="mt-6 space-y-4">
          <p className="mt-3 text-sm text-muted">
            {payment.resultDesc || "The M-Pesa request was not completed."}
          </p>
          <Button asChild size="lg" className="w-full">
            <Link to="/portal/packages">Choose a package</Link>
          </Button>
        </div>
      )}
    </PortalShell>
  );
}
