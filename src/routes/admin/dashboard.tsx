import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Database,
  Radio,
  Router as RouterIcon,
  UserPlus,
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
import { HARDWARE_LABELS } from "@/lib/hardware";
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

  const { cards, isps, events, recent, settings, router, mikrotiks } = q.data;
  const cur = settings.currency;

  // Network health is judged from every registered router/AP (MikroTik, Omada, Ruijie),
  // not only the legacy MikroTik ping.
  const routersOnline = mikrotiks.filter((m) => m.status === "ONLINE");
  const routersDown = mikrotiks.filter((m) => m.status !== "ONLINE");
  const routerOk = mikrotiks.length > 0 ? routersOnline.length > 0 : router.reachable;
  const ispsDown = isps.filter((i) => i.status !== "ONLINE");
  const ispOk = isps.length === 0 || isps.some((i) => i.status === "ONLINE");
  const internet = routerOk && ispOk ? "Online" : "Degraded";

  // The few things that need the operator's attention right now, most urgent first.
  const attention: { tone: "danger" | "warn" | "info"; text: string; to: string }[] = [];
  if (cards.awaitingActivation > 0)
    attention.push({
      tone: "danger",
      text: `${cards.awaitingActivation} paid customer${cards.awaitingActivation === 1 ? "" : "s"} not activated yet — use "Retry activation".`,
      to: "/admin/customers",
    });
  if (routersDown.length > 0)
    attention.push({
      tone: "danger",
      text: `${routersDown.length} of ${mikrotiks.length} router${mikrotiks.length === 1 ? "" : "s"}/access point${mikrotiks.length === 1 ? "" : "s"} offline: ${routersDown.map((m) => m.name).join(", ")}.`,
      to: "/admin/network",
    });
  if (ispsDown.length > 0)
    attention.push({
      tone: "warn",
      text: `Internet path ${ispsDown.map((i) => `${i.name} (${i.status.toLowerCase()})`).join(", ")}.`,
      to: "/admin/network",
    });
  if (cards.todayFailed > 0)
    attention.push({
      tone: "info",
      text: `${cards.todayFailed} failed or cancelled payment${cards.todayFailed === 1 ? "" : "s"} today.`,
      to: "/admin/payments",
    });
  if (cards.expiringSoon > 0)
    attention.push({
      tone: "info",
      text: `${cards.expiringSoon} package${cards.expiringSoon === 1 ? "" : "s"} expire within the hour.`,
      to: "/admin/live-users",
    });

  const quick = [
    { to: "/admin/customers", label: "Customers" },
    { to: "/admin/live-users", label: "Live users" },
    { to: "/admin/payments", label: "Payments" },
    { to: "/admin/packages", label: "Packages" },
    { to: "/admin/vouchers", label: "Vouchers" },
    { to: "/admin/network", label: "Network" },
    { to: "/admin/reports", label: "Reports" },
  ] as const;

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
              {routersOnline.length}/{mikrotiks.length} router{mikrotiks.length === 1 ? "" : "s"} online · {cards.onlineUsers} user{cards.onlineUsers === 1 ? "" : "s"} connected now
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

      {/* 1. What needs me right now */}
      {attention.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-ok/25 bg-ok/10 px-4 py-3 text-sm text-ok">
          <CheckCircle2 className="size-5 shrink-0" />
          All clear — payments are activating, routers are online.
        </div>
      ) : (
        <Card className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-0 shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-border/70 px-4 py-3 font-display text-base font-semibold sm:px-5">
            <AlertTriangle className="size-4 text-warn" />
            Needs attention ({attention.length})
          </h2>
          <ul className="divide-y divide-border/70">
            {attention.map((a, i) => (
              <li key={i}>
                <Link
                  to={a.to}
                  className="flex min-h-12 items-center gap-3 px-4 py-3 text-sm transition hover:bg-muted/30 sm:px-5"
                >
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      a.tone === "danger" ? "bg-danger" : a.tone === "warn" ? "bg-warn" : "bg-accent",
                    )}
                  />
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <span className="shrink-0 text-accent">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 2. The four numbers that matter */}
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Today's revenue"
          value={formatKes(cards.todayRevenue, cur)}
          icon={Banknote}
          note={
            `Yesterday ${formatKes(cards.yesterdayRevenue, cur)}. Successful M-Pesa payments only.` +
            (cards.todayVouchers > 0
              ? ` ${cards.todayVouchers} voucher${cards.todayVouchers === 1 ? "" : "s"} (${formatKes(cards.todayVoucherValue, cur)}) not included.`
              : "")
          }
        />
        <Stat label="Online now" value={String(cards.onlineUsers)} icon={Wifi} note="Devices connected right now." />
        <Stat
          label="Active packages"
          value={String(cards.activePackages)}
          icon={Users}
          note={cards.expiringSoon > 0 ? `${cards.expiringSoon} expiring within the hour.` : "Paid and running."}
        />
        <Stat
          label="Paid, not activated"
          value={String(cards.awaitingActivation)}
          icon={AlertTriangle}
          warn={cards.awaitingActivation > 0}
          note={cards.awaitingActivation > 0 ? "Customers paid but have no internet yet." : "Everyone who paid is online."}
        />
      </div>

      {/* 3. Supporting numbers, smaller */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Mini label="This week" value={formatKes(cards.weekRevenue, cur)} icon={Banknote} />
        <Mini label="This month" value={formatKes(cards.monthRevenue, cur)} icon={Banknote} />
        <Mini
          label="Payments today"
          value={`${cards.todaySuccess} ok · ${cards.todayFailed} failed`}
          icon={Activity}
          warn={cards.todayFailed > 0}
        />
        <Mini label="New customers today" value={String(cards.newCustomersToday)} icon={UserPlus} />
        <Mini label="Total customers" value={String(cards.totalCustomers)} icon={Users} />
        <Mini label="Expired packages" value={String(cards.expiredPackages)} icon={WifiOff} />
      </div>

      {/* 4. One tap to the pages used most */}
      <nav aria-label="Quick links" className="flex gap-2 overflow-x-auto pb-1">
        {quick.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-border bg-card/90 px-4 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            {l.label}
          </Link>
        ))}
      </nav>

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
              className="inline-flex min-h-10 items-center text-sm font-medium text-accent transition hover:text-fg"
            >
              All transactions
              <span className="ml-1">→</span>
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No payments yet.</p>
          ) : (
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
                      {formatKes(p.amount, cur)}
                    </span>
                    <div className="flex flex-wrap justify-end gap-1">
                      <PaymentBadge status={p.status} />
                      <ActivationBadge status={p.activationStatus} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <RouterIcon className="size-4 text-accent" />
              Routers &amp; access points
              {mikrotiks.length > 0 ? (
                <span className="ml-auto text-xs font-normal text-muted">
                  {routersOnline.length}/{mikrotiks.length} online
                </span>
              ) : null}
            </h2>
            {mikrotiks.length === 0 ? (
              <p className="text-sm text-subtle">
                Nothing registered yet — add a MikroTik, Omada or Ruijie site on Network.
              </p>
            ) : (
              <ul className="space-y-2">
                {mikrotiks.map((mt) => (
                  <li
                    key={mt.id}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          mt.status === "ONLINE" ? "bg-ok" : "bg-danger",
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate">
                          {mt.name}
                          {mt.isPrimary ? (
                            <span className="ml-1 text-xs text-subtle">(primary)</span>
                          ) : null}
                        </span>
                        <span className="block truncate text-xs text-subtle">
                          {HARDWARE_LABELS[mt.hardwareType]}
                          {mt.status !== "ONLINE" && mt.lastPingAt ? ` · last seen ${formatStamp(mt.lastPingAt)}` : ""}
                        </span>
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
              className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-accent transition hover:text-fg"
            >
              Manage network <span className="ml-1">→</span>
            </Link>
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <Radio className="size-4 text-accent" />
              ISP status
            </h2>
            {isps.length === 0 ? (
              <p className="text-sm text-subtle">No internet paths added yet.</p>
            ) : (
              <ul className="space-y-2">
                {isps.map((isp) => (
                  <li
                    key={isp.id}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-sm"
                  >
                    <span className="truncate">{isp.name}</span>
                    <Badge
                      tone={
                        isp.status === "ONLINE" ? "ok" : isp.status === "DEGRADED" ? "warn" : "danger"
                      }
                    >
                      {isp.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs leading-relaxed text-subtle">
              TelNet does not steer traffic. The router owns WAN failover — packages
              stay valid across every path.
            </p>
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
                aria-label="Data usage period"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-medium outline-none transition focus:ring-2 focus:ring-accent/20 min-[420px]:w-auto"
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
                  className="h-10 min-w-0 rounded-xl"
                />
                <span className="text-center text-subtle">to</span>
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  max={today}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-10 min-w-0 rounded-xl"
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
                    {formatBytes((usageQ.data?.bytesDown ?? 0) + (usageQ.data?.bytesUp ?? 0))}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs uppercase tracking-wide text-subtle">Down / Up</p>
                  <p className="text-sm tabular-nums text-muted">
                    {formatBytes(usageQ.data?.bytesDown ?? 0)} / {formatBytes(usageQ.data?.bytesUp ?? 0)}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
              <Clock className="size-4 text-accent" />
              Network log
            </h2>
            {events.length === 0 ? (
              <p className="text-sm text-subtle">Nothing logged yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {events.map((e) => (
                  <li key={e.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle sm:text-xs">
                      {e.eventType.replaceAll("_", " ")} · {formatStamp(e.createdAt)}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{e.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Compact supporting figure. */
function Mini({
  label,
  value,
  icon: Icon,
  warn,
}: {
  label: string;
  value: string;
  icon: typeof Banknote;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-border/70 bg-card/90 px-3 py-2.5",
        warn && "border-warn/30",
      )}
    >
      <p className="flex items-center gap-1.5 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-subtle">
        <Icon className={cn("size-3.5 shrink-0", warn ? "text-warn" : "text-accent")} />
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</p>
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
