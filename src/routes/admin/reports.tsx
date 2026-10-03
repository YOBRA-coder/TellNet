import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SiteSwitcher } from "@/components/admin/site-switcher";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAdminSite } from "@/hooks/use-admin-site";
import { getReports } from "@/lib/fn/admin";
import { formatKes } from "@/lib/format";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

type Period = {
  revenue: number;
  tx: number;
  paid: number;
  failed: number;
  pending: number;
  vouchers: number;
  points: number;
  sold: number;
};

/** "+12% vs Yesterday" / "-5% vs Last week"; null when there is nothing to compare to. */
function change(now: number, before: number, label: string) {
  if (before <= 0) return now > 0 ? `New — nothing ${label.toLowerCase()}` : null;
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs ${label}`;
}

function csvCell(v: string | number) {
  const t = String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function ReportsPage() {
  const [siteId] = useAdminSite();
  const [days, setDays] = useState(14);
  const q = useQuery({
    queryKey: ["reports", siteId, days],
    queryFn: () => getReports({ data: { siteId, days } }),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
  const d = q.data;

  function exportCsv() {
    if (!d) return;
    const lines: (string | number)[][] = [
      ["TelNet report", `generated ${d.generatedAt}`, `time zone ${d.timezone}`],
      [],
      ["Summary", "Revenue (KES)", "Transactions", "Paid (M-Pesa)", "Failed/cancelled", "Pending", "Vouchers redeemed", "Points redeemed"],
      ...(
        [
          ["Today", d.today],
          ["Yesterday", d.yesterday],
          ["This week", d.week],
          ["Last week", d.prevWeek],
          ["This month", d.month],
          ["Last month", d.prevMonth],
        ] as [string, Period][]
      ).map(([name, p]) => [name, p.revenue, p.tx, p.paid, p.failed, p.pending, p.vouchers, p.points]),
      [],
      ["Day", "Revenue (KES)", "Successful"],
      ...d.daily.map((x) => [x.day, x.revenue, x.tx]),
      [],
      ["Package (this month)", "Sold", "Revenue (KES)"],
      ...d.monthPerf.map((x) => [x.name, x.sold, x.revenue]),
    ];
    const csv = lines.map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `telnet-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const monthTotal = d?.monthPerf.reduce((n, p) => n + p.revenue, 0) ?? 0;
  const peak = d ? Math.max(1, ...d.hours.map((h) => h.revenue)) : 1;
  const successRate =
    d && d.month.paid + d.month.failed > 0
      ? Math.round((d.month.paid / (d.month.paid + d.month.failed)) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted">
            Revenue is counted from verified M-Pesa SUCCESS rows only — vouchers and loyalty
            points are free packages and are shown separately.
            {d ? ` Days run midnight to midnight (${d.timezone}).` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SiteSwitcher />
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!d}>
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {q.isError ? (
        <Card className="border-danger/40 p-4 text-sm text-danger">
          Couldn't load the report. Check the connection and try again.
          <Button size="sm" variant="outline" className="ml-3" onClick={() => q.refetch()}>
            Retry
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <PeriodCard
          title="Today"
          p={d?.today}
          compare={d ? change(d.today.revenue, d.yesterday.revenue, "Yesterday") : null}
          extra={d ? [["Yesterday", formatKes(d.yesterday.revenue)]] : []}
        />
        <PeriodCard
          title="This week"
          p={d?.week}
          compare={d ? change(d.week.revenue, d.prevWeek.revenue, "Last week") : null}
          extra={[
            ["Last week", formatKes(d?.prevWeek.revenue ?? 0)],
            [
              "Best seller",
              d?.bestWeek[0] ? `${d.bestWeek[0].name} · ${d.bestWeek[0].sold}` : "—",
            ],
          ]}
        />
        <PeriodCard
          title="This month"
          p={d?.month}
          compare={d ? change(d.month.revenue, d.prevMonth.revenue, "Last month") : null}
          extra={[
            ["Last month", formatKes(d?.prevMonth.revenue ?? 0)],
            [
              "Top package",
              d?.monthPerf[0]
                ? `${d.monthPerf[0].name} · ${formatKes(d.monthPerf[0].revenue)}`
                : "—",
            ],
            ["Payment success rate", successRate == null ? "—" : `${successRate}%`],
          ]}
        />
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Daily revenue · {days} days</h2>
          <select
            aria-label="Chart range"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-raised px-2 text-xs"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d?.daily ?? []}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis dataKey="label" stroke="#71717a" fontSize={11} interval="preserveStartEnd" />
              <YAxis stroke="#71717a" fontSize={11} />
              <Tooltip
                formatter={(v: number) => [formatKes(v), "Revenue"]}
                contentStyle={{
                  background: "#18181c",
                  border: "1px solid #27272a",
                  borderRadius: 12,
                }}
              />
              <Bar dataKey="revenue" fill="#5eead4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {d && d.daily.every((x) => x.revenue === 0) ? (
          <p className="mt-2 text-sm text-muted">No M-Pesa revenue in this period yet.</p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">
            Package performance · this month
          </h2>
          {(d?.monthPerf ?? []).length === 0 ? (
            <p className="text-sm text-muted">Nothing sold this month yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(d?.monthPerf ?? []).map((p) => (
                <li key={p.name} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>{p.name}</span>
                  <span className="tabular-nums text-muted">
                    {p.sold} sold · {formatKes(p.revenue)}
                    {monthTotal > 0 ? ` · ${Math.round((p.revenue / monthTotal) * 100)}%` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-display text-lg font-semibold">Busiest hours · last 30 days</h2>
          <p className="mb-3 text-xs text-subtle">M-Pesa revenue by hour of day ({d?.timezone}).</p>
          <div className="flex h-32 items-end gap-0.5">
            {(d?.hours ?? []).map((h) => (
              <div
                key={h.hour}
                className="flex-1 rounded-t bg-accent/70"
                style={{ height: `${Math.max(2, (h.revenue / peak) * 100)}%` }}
                title={`${String(h.hour).padStart(2, "0")}:00 · ${formatKes(h.revenue)} · ${h.tx} sales`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-subtle">
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>23</span>
          </div>
        </Card>
      </div>

      {d && d.bySite.length > 1 ? (
        <Card className="p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Revenue by site · this month</h2>
          <ul className="divide-y divide-border">
            {d.bySite.map((s) => (
              <li key={s.siteId} className="flex items-center justify-between py-3 text-sm">
                <span>{s.name}</span>
                <span className="tabular-nums text-muted">
                  {s.paid} paid · {formatKes(s.revenue)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function PeriodCard({
  title,
  p,
  compare,
  extra,
}: {
  title: string;
  p?: Period;
  compare: string | null;
  extra: [string, string][];
}) {
  const rows: [string, string][] = [
    ["Revenue", formatKes(p?.revenue ?? 0)],
    ["Paid (M-Pesa)", String(p?.paid ?? 0)],
    ["Failed / cancelled", String(p?.failed ?? 0)],
    ["Pending", String(p?.pending ?? 0)],
    ["Free (vouchers / points)", `${p?.vouchers ?? 0} / ${p?.points ?? 0}`],
    ...extra,
  ];
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {compare ? <span className="text-xs text-muted">{compare}</span> : null}
      </div>
      <dl className="mt-4 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
