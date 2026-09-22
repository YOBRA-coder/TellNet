import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration, formatKes, formatSpeed } from "@/lib/format";
import type { Package } from "@/lib/types";

export function PackageCard({
  pkg,
  currency = "KES",
}: {
  pkg: Package;
  currency?: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-lift">
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
            <span className="ml-2 text-sm font-normal text-muted">
              {formatSpeed(pkg.downloadKbps)}
            </span>
          </p>
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
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
      <div className="mt-5 flex justify-end">
        <Button asChild size="lg" className="min-w-32">
          <Link to="/portal/payment" search={{ packageId: pkg.id }}>
            Choose
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}
