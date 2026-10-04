import { Link } from "@tanstack/react-router";
import { ArrowRight, Info, Lock, Smartphone, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDuration, formatKes, formatSpeed } from "@/lib/format";
import type { Package } from "@/lib/types";

const BADGE_LABEL: Record<NonNullable<Package["badge"]>, string> = {
  MOST_POPULAR: "Popular",
  BEST_VALUE: "Best value",
};

/** "facebook.com" -> "Facebook", "x.com" -> "X" */
function siteLabel(domain: string) {
  const host = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const name = host.split(".")[0] || host;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Compact package row: name + badges, one line of facts (time · speed ·
 * devices), price and a small Choose button on the right.
 */
export function PackageCard({
  pkg,
  currency = "KES",
  maxDevices = 1,
  blockedDomains,
  locked = false,
  unavailableLabel,
  style,
}: {
  pkg: Package;
  currency?: string;
  /** How many devices can share this package at once (set per-package). */
  maxDevices?: number;
  /** Sites blocked on student packages (comma-separated), listed in the ⓘ details. */
  blockedDomains?: string;
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
        {pkg.category === "STUDENT" ? (
          <StudentInfo pkg={pkg} blockedDomains={blockedDomains} />
        ) : null}
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

/**
 * One-line summary under a student package ("Educational access · Social &
 * entertainment restricted") plus an ⓘ that opens the full explanation and the
 * list of blocked sites, so the card itself stays uncluttered.
 */
function StudentInfo({ pkg, blockedDomains }: { pkg: Package; blockedDomains?: string }) {
  const sites = Array.from(
    new Set(
      (blockedDomains ?? "")
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`About ${pkg.name}: what is restricted`}
          className="-ml-1 mt-0.5 inline-flex min-h-8 touch-manipulation items-center gap-1 rounded-md px-1 text-left text-[11px] text-ok hover:underline"
        >
          <span>Educational access · Social &amp; entertainment restricted</span>
          <Info className="size-3.5 shrink-0" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="font-display text-lg font-semibold">{pkg.name}</DialogTitle>
        <DialogDescription className="text-sm text-muted">
          A low-price package made for studying. Browsing, search, email, school and learning sites
          work as normal; social and entertainment sites are switched off while it runs.
        </DialogDescription>
        {sites.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">
              Not available on this package
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {sites.map((d) => (
                <li
                  key={d}
                  title={d}
                  className="rounded-full border border-border bg-raised px-2.5 py-1 text-xs"
                >
                  {siteLabel(d)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-subtle">
              These sites, and usually the apps that use them, won't load. Need them? Choose a
              regular package instead.
            </p>
          </div>
        ) : null}
        <DialogClose asChild>
          <Button variant="outline" className="h-11 w-full">
            Got it
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
