import { Link } from "@tanstack/react-router";
import { ArrowRight, Smartphone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration, formatKes, formatSpeed } from "@/lib/format";
import type { Package } from "@/lib/types";

const BADGE_LABEL: Record<NonNullable<Package["badge"]>, string> = {
  MOST_POPULAR: "Most Popular",
  BEST_VALUE: "Best Value",
};

export function PackageCard({
  pkg,
  currency = "KES",
  maxDevices = 1,
  style,
}: {
  pkg: Package;
  currency?: string;
  /** How many devices can share this package at once (set per-package). */
  maxDevices?: number;
  style?: React.CSSProperties;
}) {
  return (
    <article
      style={style}
      className={`card-pop group relative overflow-hidden rounded-2xl border bg-surface p-5 shadow-lift transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:border-accent/50 ${
        pkg.badge ? "border-accent/40" : "border-border"
      }`}
    >
      {pkg.badge ? (
        <span className="absolute right-4 top-0 rounded-b-md bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-bg">
          {BADGE_LABEL[pkg.badge]}
        </span>
      ) : null}

      {pkg.category === "STUDENT" ? (
        <span className="mb-2 inline-flex w-fit items-center rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ok">
          Student
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
            {formatDuration(pkg.durationMinutes)}
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold tracking-tight">
            {pkg.name}
          </h3>
          <p className="mt-3 font-display text-3xl font-semibold tabular-nums">
            {formatKes(pkg.price, currency)}
          </p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent transition-transform duration-300 group-hover:scale-110">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M5 12.5c3.5-4 10.5-4 14 0M8 15.5c2-2.2 6-2.2 8 0M12 19h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-raised px-2.5 py-1 text-[11px] font-medium text-muted">
          <Smartphone className="size-3.5" />
          {maxDevices > 1 ? `Up to ${maxDevices} devices` : "1 device"}
        </span>

        <div className="flex flex-col items-end gap-2">
          {/* Styled speed badge to look sharp and perfectly aligned above the button */}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-accent">
            <Zap className="size-3 fill-current" />
            {formatSpeed(pkg.downloadKbps)}
          </span>
          
          <Button asChild size="lg" className="min-w-32">
            <Link to="/portal/payment" search={{ packageId: pkg.id, ref: "" }}>
              Choose{" "}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
