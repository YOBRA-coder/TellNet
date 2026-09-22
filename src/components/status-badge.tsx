import { Badge } from "@/components/ui/badge";
import type { ActivationStatus, PaymentStatus, SessionStatus } from "@/lib/types";

const paymentTone: Record<PaymentStatus, "ok" | "warn" | "danger" | "neutral"> = {
  SUCCESS: "ok",
  PENDING: "warn",
  FAILED: "danger",
  CANCELLED: "neutral",
};

const activationTone: Record<ActivationStatus, "ok" | "warn" | "danger" | "neutral"> = {
  ACTIVATED: "ok",
  NOT_ACTIVATED: "neutral",
  ACTIVATION_FAILED: "danger",
  EXPIRED: "neutral",
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={paymentTone[status]}>{status.replace("_", " ")}</Badge>;
}

export function ActivationBadge({ status }: { status: ActivationStatus }) {
  const label =
    status === "ACTIVATION_FAILED"
      ? "Awaiting activation"
      : status.replaceAll("_", " ");
  return <Badge tone={activationTone[status]}>{label}</Badge>;
}

export function SessionBadge({ status }: { status: SessionStatus | string }) {
  const tone =
    status === "ACTIVE" ? "ok" : status === "EXPIRED" ? "neutral" : "warn";
  return <Badge tone={tone}>{status}</Badge>;
}

export function OnlineDot({ online }: { online: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span
        className={
          online
            ? "size-1.5 rounded-full bg-ok shadow-[0_0_0_3px_rgb(52,211,153,0.18)]"
            : "size-1.5 rounded-full bg-subtle"
        }
      />
      {online ? "Online" : "Offline"}
    </span>
  );
}
