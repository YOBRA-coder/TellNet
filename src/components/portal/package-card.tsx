import { Link } from "@tanstack/react-router";
import { ArrowRight, Lock, Smartphone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration, formatKes, formatSpeed } from "@/lib/format";
import type { Package } from "@/lib/types";

const BADGE_LABEL: Record<NonNullable<Package["badge"]>, string> = {
  MOST_POPULAR: "Popular",
  BEST_VALUE: "Best value",
};

/**
 * Compact package row: name + badges, one line of facts (time · speed ·
 * devices), price and a small Choose button on the right.
 */
export function PackageCard({
  pkg,
  currency = "KES",
  maxDevices = 1,
  locked = false,
  unavailableLabel,
  style,
}: {
  pkg: Package;
  currency?: string;
  /** How many devices can share this package at once (set per-package). */
  maxDevices?: number;
  /** Guest who must create a free account before buying this package. */
  locked?: boolean;
  /** Set when the package can't be bought right now (e.g. "Opens 6:00 AM"). */
  unavailableLabel?: string;
  style?: React.CSSProperties;
}) {
  return (
    <article
      style={style}
      className={`card-pop flex items-center gap-3 rounded-xl border bg-surface px-3.5 py-3 transition-colors hover:border-accent/50 ${
        pkg.badge ? "border-accent/40" : "border-border"
      } ${unavailableLabel ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate font-display text-base font-semibold tracking-tight">{pkg.name}</h3>
          {pkg.badge ? (
            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-bg">
              {BADGE_LABEL[pkg.badge]}
            </span>
          ) : null}
          {pkg.category === "STUDENT" ? (
            <span className="rounded-full border border-ok/30 bg-ok/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ok">
              Student
            </span>
          ) : null}
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted">
          <span className="font-semibold uppercase tracking-wide text-subtle">
            {formatDuration(pkg.durationMinutes)}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-accent">
            <Zap className="size-3 fill-current" />
            {formatSpeed(pkg.downloadKbps)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Smartphone className="size-3" />
            {maxDevices > 1 ? `${maxDevices} devices` : "1 device"}
          </span>
        </p>
        {locked ? (
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent">
            <Lock className="size-3" />
            Free account needed
          </p>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p className="font-display text-lg font-semibold tabular-nums leading-none">
          {formatKes(pkg.price, currency)}
        </p>
        {unavailableLabel ? (
          <Button size="sm" variant="outline" disabled className="mt-2 h-8 min-w-20">
            {unavailableLabel}
          </Button>
        ) : (
        <Button asChild size="sm" className="mt-2 h-8 min-w-20">
          {locked ? (
            <Link
              to="/portal/auth"
              search={{ mode: "signup", ref: "", next: `/portal/payment?packageId=${pkg.id}` }}
            >
              Sign up <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <Link to="/portal/payment" search={{ packageId: pkg.id, ref: "" }}>
              Choose <ArrowRight className="size-3.5" />
            </Link>
          )}
        </Button>
        )}
      </div>
    </article>
  );
}
