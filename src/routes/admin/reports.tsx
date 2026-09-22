import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { getReports } from "@/lib/fn/admin";
import { formatKes } from "@/lib/format";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const q = useQuery({ queryKey: ["reports"], queryFn: () => getReports() });
  const d = q.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted">
          Revenue is counted from verified M-Pesa SUCCESS rows — not from frontend
          confirmations.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Period
          title="Today"
          items={[
            ["Revenue", formatKes(d?.today.revenue ?? 0)],
            ["Transactions", String(d?.today.tx ?? 0)],
            ["Successful", String(d?.today.success ?? 0)],
            ["Failed", String(d?.today.failed ?? 0)],
            ["Packages sold", String(d?.today.sold ?? 0)],
          ]}
        />
        <Period
          title="This week"
          items={[
            ["Revenue", formatKes(d?.week.revenue ?? 0)],
            ["Transactions", String(d?.week.tx ?? 0)],
            [
              "Best seller",
              d?.bestWeek[0] ? `${d.bestWeek[0].name} · ${d.bestWeek[0].sold}` : "—",
            ],
          ]}
        />
        <Period
          title="This month"
          items={[
            ["Revenue", formatKes(d?.month.revenue ?? 0)],
            ["Transactions", String(d?.month.tx ?? 0)],
            [
              "Top package",
              d?.monthPerf[0]
                ? `${d.monthPerf[0].name} · ${formatKes(d.monthPerf[0].revenue)}`
                : "—",
            ],
          ]}
        />
      </div>
      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">
          Daily revenue · 14 days
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d?.daily ?? []}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis dataKey="day" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} />
              <Tooltip
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
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">
          Package performance · this month
        </h2>
        <ul className="divide-y divide-border">
          {(d?.monthPerf ?? []).map((p) => (
            <li key={p.name} className="flex items-center justify-between py-3 text-sm">
              <span>{p.name}</span>
              <span className="tabular-nums text-muted">
                {p.sold} sold · {formatKes(p.revenue)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Period({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <Card className="p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <dl className="mt-4 space-y-2">
        {items.map(([k, v]) => (
          <div key={k} className="flex justify-between text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
