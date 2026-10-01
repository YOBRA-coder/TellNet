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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }
  if (q.isLoading && !q.data) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

if (q.isError) {
  return (
    <Card className="p-6">
      <h1 className="font-display text-xl font-semibold">
        Dashboard failed to load
      </h1>

      <p className="mt-2 text-sm text-muted">
        {q.error instanceof Error
          ? q.error.message
          : "The dashboard request failed."}
      </p>

      <button
        type="button"
        className="mt-4 rounded-md border border-border px-4 py-2 text-sm"
        onClick={() => q.refetch()}
      >
        Retry
      </button>
    </Card>
  );
}

if (!q.data) {
  return (
    <Card className="p-6">
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-subtle">
            {settings.hotspotName}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <SiteSwitcher />
          <Badge tone={internet === "Online" ? "ok" : "warn"}>{internet}</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent payments</h2>
            <Link to="/admin/payments" className="text-sm text-muted hover:text-fg">
              All transactions
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {recent.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {formatPhoneDisplay(p.phone)} · {p.packageName}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-subtle">
                    {p.mpesaTransactionId ?? "pending"} · {formatStamp(p.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular-nums">
                    {formatKes(p.amount, settings.currency)}
                  </span>
                  <div className="flex gap-1">
                    <PaymentBadge status={p.status} />
                    <ActivationBadge status={p.activationStatus} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <RouterIcon className="size-4 text-accent" />
              MikroTik routers
            </h2>
            {q.data.mikrotiks.length === 0 ? (
              <p className="text-sm text-subtle">
                No MikroTik registered yet — add one on Network.
              </p>
            ) : (
              <ul className="space-y-3">
                {q.data.mikrotiks.map((mt) => (
                  <li key={mt.id} className="flex items-center justify-between text-sm">
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
              className="mt-4 inline-block text-sm text-accent hover:text-fg"
            >
              Manage routers
            </Link>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Database className="size-4 text-accent" />
                Data usage
              </h2>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as UsagePreset)}
                className="rounded-md border border-border bg-transparent px-2 py-1 text-xs"
              >
                {USAGE_PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {preset === "custom" ? (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <Input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-8"
                />
                <span className="text-subtle">to</span>
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-8"
                />
              </div>
            ) : null}
            {usageQ.isLoading ? (
              <Skeleton className="h-14 rounded-lg" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-subtle">Total</p>
                  <p className="font-display text-xl font-semibold tabular-nums">
                    {formatBytes(
                      (usageQ.data?.bytesDown ?? 0) + (usageQ.data?.bytesUp ?? 0),
                    )}
                  </p>
                </div>
                <div>
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

          <Card className="p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <Radio className="size-4 text-accent" />
              ISP status
            </h2>
            <ul className="space-y-3">
              {isps.map((isp) => (
                <li key={isp.id} className="flex items-center justify-between text-sm">
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
          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Network log</h2>
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id}>
                  <p className="text-xs uppercase tracking-wide text-subtle">
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
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <p className="text-xs uppercase tracking-wide text-subtle">{label}</p>
        <Icon className={cn("size-4", warn ? "text-warn" : "text-muted")} />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums">
        {value}
      </p>
      {note ? <p className="mt-1 text-[11px] leading-snug text-subtle">{note}</p> : null}
    </Card>
  );
}
