import { Link } from "@tanstack/react-router";
import { ArrowUpDown, ChevronDown, Smartphone, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PackageCard } from "@/components/portal/package-card";
import { cn } from "@/lib/utils";
import type { Package, PortalOperating } from "@/lib/types";

type Filter = "ALL" | "1" | "2";
type SortKey = "PRICE_ASC" | "PRICE_DESC" | "DURATION_ASC" | "DURATION_DESC" | "SPEED_DESC" | "VALUE";

const SORT_OPTIONS: [SortKey, string][] = [
  ["PRICE_ASC", "Price: low to high"],
  ["PRICE_DESC", "Price: high to low"],
  ["DURATION_ASC", "Duration: shortest first"],
  ["DURATION_DESC", "Duration: longest first"],
  ["SPEED_DESC", "Speed: fastest first"],
  ["VALUE", "Best value (cheapest per hour)"],
];

const byPrice = (a: Package, b: Package) => a.price - b.price || a.durationMinutes - b.durationMinutes;

function sortPackages(list: Package[], key: SortKey): Package[] {
  const out = [...list];
  switch (key) {
    case "PRICE_ASC":
      return out.sort(byPrice);
    case "PRICE_DESC":
      return out.sort((a, b) => b.price - a.price || a.durationMinutes - b.durationMinutes);
    case "DURATION_ASC":
      return out.sort((a, b) => a.durationMinutes - b.durationMinutes || byPrice(a, b));
    case "DURATION_DESC":
      return out.sort((a, b) => b.durationMinutes - a.durationMinutes || byPrice(a, b));
    case "SPEED_DESC":
      return out.sort((a, b) => b.downloadKbps - a.downloadKbps || byPrice(a, b));
    case "VALUE":
      return out.sort(
        (a, b) =>
          a.price / Math.max(a.durationMinutes, 1) - b.price / Math.max(b.durationMinutes, 1) || byPrice(a, b),
      );
  }
}

const DISMISS_KEY = "telnet.guestPromptDismissed";

/**
 * Packages with a small tab bar on top (All / 1 device / 2 devices) and, for
 * guests, a short "create a free account" prompt.
 */
export function PackageBrowser({
  packages,
  currency,
  registered,
  requireAccountForMulti,
  rewardsOn,
  operating,
  studentBlockedDomains,
}: {
  packages: Package[];
  currency: string;
  /** true = signed in with an account; false = guest; null = still loading (no prompt, no locks) */
  registered: boolean | null;
  requireAccountForMulti: boolean;
  rewardsOn: boolean;
  /** opening hours of the router serving this visitor (null/disabled = always open) */
  operating?: PortalOperating | null;
  /** comma-separated sites blocked on student packages (shown in the card's ⓘ details) */
  studentBlockedDomains?: string;
}) {
  // Set default filter to "1" instead of "ALL"
  const [filter, setFilter] = useState<Filter>("1");
  const [sort, setSort] = useState<SortKey>("PRICE_ASC"); // cheapest first by default
  const [dismissed, setDismissed] = useState(true); // hidden until we know (avoids a flash)

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const single = packages.filter((p) => p.maxDevices <= 1);
  const multi = packages.filter((p) => p.maxDevices > 1);

  const showTabs = single.length > 0 && multi.length > 0;

  const shown = useMemo(
    () => sortPackages(!showTabs || filter === "ALL" ? packages : filter === "1" ? single : multi, sort),
    [packages, single, multi, filter, showTabs, sort],
  );

  const known = registered !== null;
  const lockMulti = known && !registered && requireAccountForMulti;
  const closed = Boolean(operating?.enabled && !operating.open);

  const cannotBuy = (p: Package) => closed && !operating!.allowKinds.includes(p.durationKind);
  const kindNames = (operating?.allowKinds ?? []).map((k) => k.toLowerCase());

  const tabs: [Filter, string, number][] = [
    // ["ALL", "All", packages.length],
    ["1", "1 device", single.length],
    ["2", "2 devices", multi.length],
  ];

  const promptText =
    lockMulti && rewardsOn
      ? "Create a free account to unlock 2 devices and referral rewards."
      : lockMulti
        ? "Create a free account to unlock 2 devices."
        : rewardsOn
          ? "Create a free account to earn loyalty points and referral rewards."
          : null;

  return (
    <div>
      {closed ? (
        <div className="mb-4 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-3" role="status">
          <p className="text-sm font-semibold">
            We're closed right now{operating?.opensAtLabel ? ` — opens ${operating.opensAtLabel}` : ""}.
          </p>
          {operating?.message ? <p className="mt-1 text-xs text-muted">{operating.message}</p> : null}
          <p className="mt-1 text-xs text-muted">
            {kindNames.length > 0
              ? `You can still buy ${kindNames.join(" and ")} packages${
                  operating?.pause ? "; the closed hours aren't counted" : ""
                }. Other packages are available again when we open.`
              : "Packages are available again when we open."}
          </p>
        </div>
      ) : operating?.enabled && operating.closesAtLabel ? (
        <p className="mb-3 text-center text-xs text-subtle">Open until {operating.closesAtLabel}</p>
      ) : null}

      {known && !registered && promptText && !dismissed ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/[0.015] px-4 py-3.5 backdrop-blur-[6px]">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{promptText}</p>
            <div className="mt-2 flex gap-2">
              <Link
                to="/portal/auth"
                search={{ mode: "signup", ref: "", next: "/portal" }}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-bg"
              >
                Sign up free
              </Link>
              <Link
                to="/portal/auth"
                search={{ mode: "signin", ref: "", next: "/portal" }}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-fg"
              >
                Sign in
              </Link>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded p-1 text-subtle hover:text-fg"
            onClick={() => {
              setDismissed(true);
              try {
                sessionStorage.setItem(DISMISS_KEY, "1");
              } catch {
                /* ignore */
              }
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {showTabs ? (
        <div role="tablist" className="mb-3 flex gap-1 rounded-full border border-border bg-surface p-1">
          {tabs.map(([key, label, n]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={filter === key}
              onClick={() => setFilter(key)} // Clean switch, no toggle
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-medium transition",
                filter === key ? "bg-accent text-bg" : "text-muted hover:text-fg",
              )}
            >
              {key !== "ALL" ? <Smartphone className="size-3.5" /> : null}
              {label}
              <span className={cn("tabular-nums", filter === key ? "opacity-80" : "text-subtle")}>{n}</span>
            </button>
          ))}
        </div>
      ) : null}

      {packages.length > 1 ? (
        <label className="relative mb-3 ml-auto flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] py-1 pl-3 pr-2 text-xs text-muted backdrop-blur-md transition focus-within:border-accent/60 hover:bg-white/[0.07]">
          <ArrowUpDown className="size-3.5 shrink-0" />
          <span className="shrink-0">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="cursor-pointer appearance-none rounded-full bg-transparent py-1 pl-1 pr-5 text-xs font-medium text-fg outline-none"
            aria-label="Sort packages"
          >
            {SORT_OPTIONS.map(([key, label]) => (
              <option key={key} value={key} className="bg-neutral-900 text-white">
                {label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-subtle" />
        </label>
      ) : null}

      <div className="flex flex-col gap-2">
        {shown.map((pkg, i) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            currency={currency}
            maxDevices={pkg.maxDevices}
            blockedDomains={studentBlockedDomains}
            locked={lockMulti && pkg.maxDevices > 1}
            unavailableLabel={
              cannotBuy(pkg) ? (operating?.opensAtLabel ? `Opens ${operating.opensAtLabel}` : "Closed") : undefined
            }
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}

        {shown.length === 0 ? <p className="py-6 text-center text-sm text-muted">No packages in this group.</p> : null}
      </div>
    </div>
  );
}
