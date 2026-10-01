import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Banknote,
  Database,
  Radio,
  Router as RouterIcon,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ActivationBadge, PaymentBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteSwitcher } from "@/components/admin/site-switcher";
import { useAdminSite } from "@/hooks/use-admin-site";
import { formatBytes, formatKes, formatStamp } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";
import { getDashboard, getDataUsage } from "@/lib/fn/admin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
});

const USAGE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "custom", label: "Custom" },
] as const;
type UsagePreset = (typeof USAGE_PRESETS)[number]["key"];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeForPreset(preset: UsagePreset, customFrom: string, customTo: string) {
  const today = new Date();
  if (preset === "custom") return { from: customFrom, to: customTo };
  if (preset === "today") return { from: isoDate(today), to: isoDate(today) };
  const days = preset === "7d" ? 6 : 29;
  const from = new Date(today);
  from.setDate(from.getDate() - days);
  return { from: isoDate(from), to: isoDate(today) };
}

function DashboardPage() {
  const [siteId] = useAdminSite();
  const q = useQuery({
    queryKey: ["dashboard", siteId],
    queryFn: () => getDashboard({ data: { siteId } }),
    staleTime: 20_000,
    refetchInterval: 45_000,
    placeholderData: (prev) => prev,
  });

  const [preset, setPreset] = useState<UsagePreset>("today");
  const today = isoDate(new Date());
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const range = useMemo(
    () => rangeForPreset(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );
  const usageQ = useQuery({
    queryKey: ["data-usage", range.from, range.to],
    queryFn: () => getDataUsage({ data: range }),
    staleTime: 20_000,
    enabled: Boolean(range.from && range.to),
  });

  if (q.isLoading && !q.data) {
    return (
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-32 rounded-2xl border border-border/60 bg-card/70"
          />
        ))}
      </div>
    );
  }
  if (q.isLoading && !q.data) {
    return (
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-32 rounded-2xl border border-border/60 bg-card/70"
          />
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm sm:p-6">
        <div className="flex size-11 items-center justify-center rounded-xl bg-danger/10 text-danger">
          <AlertTriangle className="size-5" />
        </div>
        <h1 className="mt-4 font-display text-xl font-semibold tracking-tight">
          Dashboard failed to load
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          {q.error instanceof Error
            ? q.error.message
            : "The dashboard request failed."}
        </p>

        <button
          type="button"
          className="mt-5 min-h-10 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-muted/40 active:scale-[0.98]"
          onClick={() => q.refetch()}
        >
          Retry
        </button>
      </Card>
    );
  }

  if (!q.data) {
    return (
      <Card className="rounded-2xl border border-border/70 bg-card/90 p-5 shadow-sm sm:p-6">
        <p className="text-sm text-muted">
          No dashboard data was returned.
        </p>
      </Card>
    );
  }

  const { cards, isps, events, recent, settings, router } = q.data;
  const internet =
    isps.some((i) => i.status === "ONLINE") && router.reachable
      ? "Online"
      : "Degraded";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-6 sm:space-y-5 lg:space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-subtle sm:text-xs">
              {settings.hotspotName}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-xs text-muted sm:text-sm">
              Network, customers and payment activity at a glance.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="min-w-0 flex-1 sm:flex-none">
              <SiteSwitcher />
            </div>
            <div className="shrink-0 rounded-full">
              <Badge tone={internet === "Online" ? "ok" : "warn"}>
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />
                {internet}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Today's revenue"
          value={formatKes(cards.todayRevenue, settings.currency)}
          icon={Banknote}
          note={
            "Successful M-Pesa payments only — failed, cancelled and pending are not counted." +
            (cards.todayVouchers > 0
              ? ` ${cards.todayVouchers} voucher${cards.todayVouchers === 1 ? "" : "s"} redeemed today (${formatKes(cards.todayVoucherValue, settings.currency)}) not included.`
              : "")
          }
        />
        <Stat label="Online users" value={String(cards.onlineUsers)} icon={Wifi} />
        <Stat
          label="Active packages"
          value={String(cards.activePackages)}
          icon={Users}
        />
        <Stat
          label="Awaiting activation"
          value={String(cards.awaitingActivation)}
          icon={AlertTriangle}
          warn={cards.awaitingActivation > 0}
        />
        <Stat
          label="Expired packages"
          value={String(cards.expiredPackages)}
          icon={WifiOff}
        />
        <Stat
          label="Total customers"
          value={String(cards.totalCustomers)}
          icon={Users}
        />
        <Stat
          label="Successful payments"
          value={String(cards.todaySuccess)}
          icon={Activity}
        />
        <Stat
          label="Failed payments"
          value={String(cards.todayFailed)}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)] lg:items-start">
        <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5 lg:p-6">
          <div className="mb-4 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">
                Transactions
              </p>
              <h2 className="mt-0.5 font-display text-lg font-semibold sm:text-xl">
                Recent payments
              </h2>
            </div>
            <Link
              to="/admin/payments"
              className="inline-flex min-h-9 items-center text-sm font-medium text-accent transition hover:text-fg"
            >
              All transactions
              <span className="ml-1">→</span>
            </Link>
          </div>
          <ul className="divide-y divide-border/70">
            {recent.map((p) => (
              <li
                key={p.id}
                className="flex min-w-0 flex-col gap-2 py-3.5 text-sm min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:py-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {formatPhoneDisplay(p.phone)} · {p.packageName}
                  </p>
                  <p className="mt-1 truncate font-mono text-[10px] text-subtle sm:text-xs">
                    {p.mpesaTransactionId ?? "pending"} · {formatStamp(p.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 min-[420px]:flex-col min-[420px]:items-end">
                  <span className="font-medium tabular-nums">
                    {formatKes(p.amount, settings.currency)}
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    <PaymentBadge status={p.status} />
                    <ActivationBadge status={p.activationStatus} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <RouterIcon className="size-4 text-accent" />
              MikroTik routers
            </h2>
            {q.data.mikrotiks.length === 0 ? (
              <p className="text-sm text-subtle">
                No MikroTik registered yet — add one on Network.
              </p>
            ) : (
              <ul className="space-y-2">
                {q.data.mikrotiks.map((mt) => (
                  <li
                    key={mt.id}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          mt.status === "ONLINE" ? "bg-ok" : "bg-danger",
                        )}
                      />
                      <span className="truncate">
                        {mt.name}
                        {mt.isPrimary ? (
                          <span className="ml-1 text-xs text-subtle">(primary)</span>
                        ) : null}
                      </span>
                    </span>
                    <Badge tone={mt.status === "ONLINE" ? "ok" : "danger"}>
                      {mt.status === "ONLINE" ? "Online" : "Offline"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/admin/network"
              className="mt-4 inline-flex min-h-9 items-center text-sm font-medium text-accent transition hover:text-fg"
            >
              Manage routers <span className="ml-1">→</span>
            </Link>
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Database className="size-4 text-accent" />
                Data usage
              </h2>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as UsagePreset)}
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs font-medium outline-none transition focus:ring-2 focus:ring-accent/20 min-[420px]:w-auto"
              >
                {USAGE_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {preset === "custom" ? (
              <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                <Input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 min-w-0 rounded-xl"
                />
                <span className="text-center text-subtle">to</span>
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 min-w-0 rounded-xl"
                />
              </div>
            ) : null}
            {usageQ.isLoading ? (
              <Skeleton className="h-14 rounded-lg" />
            ) : (
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">

                  <p className="text-xs uppercase tracking-wide text-subtle">Total</p>
                  <p className="font-display text-xl font-semibold tabular-nums">
                    {formatBytes(
                      (usageQ.data?.bytesDown ?? 0) + (usageQ.data?.bytesUp ?? 0),
                    )}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-subtle">
                    Down / Up
                  </p>
                  <p className="text-sm tabular-nums text-muted">
                    {formatBytes(usageQ.data?.bytesDown ?? 0)} /{" "}
                    {formatBytes(usageQ.data?.bytesUp ?? 0)}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <Radio className="size-4 text-accent" />
              ISP status
            </h2>
            <ul className="space-y-2">
              {isps.map((isp) => (
                <li
                  key={isp.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm"
                >
                  <span>{isp.name}</span>
                  <Badge
                    tone={
                      isp.status === "ONLINE"
                        ? "ok"
                        : isp.status === "DEGRADED"
                          ? "warn"
                          : "danger"
                    }
                  >
                    {isp.status}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-subtle">
              TelNet does not steer traffic. MikroTik owns WAN failover — packages
              stay valid across every path.
            </p>
          </Card>
          <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Network log</h2>
            <ul className="space-y-2.5">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="rounded-xl border border-border/60 bg-background/40 p-3"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle sm:text-xs">
                    {e.eventType.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {e.description}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  warn,
  note,
}: {
  label: string;
  value: string;
  icon: typeof Banknote;
  warn?: boolean;
  note?: string;
}) {
  return (
    <Card
      className={cn(
        "group relative min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5",
        warn && "border-warn/30",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-7 -top-7 size-20 rounded-full blur-2xl transition group-hover:scale-125",
          warn ? "bg-warn/10" : "bg-accent/10",
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle sm:text-xs">
          {label}
        </p>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/50",
            warn ? "text-warn" : "text-accent",
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="relative mt-4 truncate font-display text-2xl font-semibold tabular-nums tracking-tight sm:text-[1.7rem]">
        {value}
      </p>
      {note ? (
        <p className="relative mt-1.5 line-clamp-3 text-[10px] leading-relaxed text-subtle sm:text-[11px]">
          {note}
        </p>
      ) : null}
    </Card>
  );
}
