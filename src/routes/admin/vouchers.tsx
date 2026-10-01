import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Printer, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deleteVouchersAdmin,
  generateVouchersAdmin,
  getVouchersForPrint,
  listPackagesAdmin,
  listVouchersAdmin,
  setVoucherAutoClean,
} from "@/lib/fn/admin";
import { formatDuration, formatKes } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/vouchers")({
  component: VouchersPage,
});

type Status = "AVAILABLE" | "REDEEMED" | "EXPIRED";
const STATUS_TONE: Record<Status, "ok" | "neutral" | "warn"> = {
  AVAILABLE: "ok",
  REDEEMED: "neutral",
  EXPIRED: "warn",
};
const batchName = (label: string) => label || "No label";
const sel = "mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm";

function VouchersPage() {
  const qc = useQueryClient();
  const pkgs = useQuery({ queryKey: ["packages"], queryFn: () => listPackagesAdmin() });

  // list filters
  const [status, setStatus] = useState<Status | undefined>("AVAILABLE");
  const [batch, setBatch] = useState<string | undefined>(undefined); // "" = no label
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [status, batch, searchDebounced]);

  const list = useQuery({
    queryKey: ["vouchers", status, batch, searchDebounced, page],
    queryFn: () =>
      listVouchersAdmin({ data: { status, batch, search: searchDebounced || undefined, page } }),
    placeholderData: (prev) => prev,
  });
  const d = list.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ["vouchers"] });

  // generate form
  const [packageId, setPackageId] = useState("");
  const [count, setCount] = useState(10);
  const [label, setLabel] = useState("");
  const [validDays, setValidDays] = useState<number | "">("");
  const [lastCodes, setLastCodes] = useState<string[]>([]);
  const [lastBatch, setLastBatch] = useState<string | undefined>(undefined);

  const gen = useMutation({
    mutationFn: () =>
      generateVouchersAdmin({
        data: {
          packageId: packageId || (pkgs.data?.[0]?.id ?? ""),
          count,
          batchLabel: label || undefined,
          validDays: validDays === "" ? undefined : validDays,
        },
      }),
    onSuccess: (res) => {
      setLastCodes(res.codes);
      setLastBatch(label.trim());
      toast.success(`Created ${res.codes.length} vouchers`);
      setStatus("AVAILABLE");
      setBatch(label.trim() || undefined);
      refresh();
    },
    onError: () => toast.error("Could not generate vouchers"),
  });

  const del = useMutation({
    mutationFn: (input: { mode: "redeemed" | "expired" | "batch" | "ids"; batch?: string; ids?: string[] }) =>
      deleteVouchersAdmin({ data: input }),
    onSuccess: (r) => {
      toast.success(r.deleted === 1 ? "1 voucher deleted" : `${r.deleted} vouchers deleted`);
      refresh();
    },
    onError: () => toast.error("Could not delete."),
  });
  const autoClean = useMutation({
    mutationFn: (days: number) => setVoucherAutoClean({ data: { days } }),
    onSuccess: (r, days) => {
      toast.success(
        days === 0
          ? "Redeemed vouchers will be kept."
          : `Redeemed vouchers are now removed ${days} day${days === 1 ? "" : "s"} after use.${r.removed ? ` ${r.removed} removed now.` : ""}`,
      );
      refresh();
    },
  });

  const confirmDelete = (msg: string, run: () => void) => {
    if (window.confirm(msg)) run();
  };

  async function printBatch(b?: string, ids?: string[]) {
    const res = await getVouchersForPrint({ data: { batch: b, ids } });
    if (res.vouchers.length === 0) return void toast.error("No unused vouchers to print here.");
    const esc = (t: string) =>
      t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    const slips = res.vouchers
      .map(
        (v) => `<div class="slip">
          <div class="hs">${esc(res.hotspotName)}</div>
          <div class="pkg">${esc(v.packageName)}</div>
          <div class="meta">${esc(formatDuration(v.durationMinutes))} · ${v.maxDevices > 1 ? v.maxDevices + " devices" : "1 device"} · ${esc(formatKes(v.price, res.currency))}</div>
          <div class="code">${esc(v.code)}</div>
          <div class="how">Connect to the Wi-Fi, open the login page, tap <b>Have a voucher code?</b> and enter the code with your phone number.</div>
          ${v.expiresAt ? `<div class="exp">Use before ${esc(new Date(v.expiresAt).toLocaleDateString())}</div>` : ""}
        </div>`,
      )
      .join("");
    const w = window.open("", "_blank");
    if (!w) return void toast.error("Allow pop-ups to print, or use Download CSV.");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Vouchers</title><style>
      @page{margin:10mm} body{font-family:system-ui,sans-serif;margin:0}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0}
      .slip{box-sizing:border-box;border:1px dashed #888;padding:10px;height:48mm;page-break-inside:avoid;display:flex;flex-direction:column;justify-content:space-between}
      .hs{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#555}
      .pkg{font-size:15px;font-weight:700}.meta{font-size:11px;color:#444}
      .code{font:700 18px ui-monospace,monospace;letter-spacing:.08em;text-align:center;border:1px solid #222;padding:6px;border-radius:4px}
      .how{font-size:8.5px;color:#444;line-height:1.3}.exp{font-size:9px;color:#a00}
    </style></head><body><div class="grid">${slips}</div><script>window.onload=function(){window.print()}<\/script></body></html>`);
    w.document.close();
  }

  async function downloadCsv(b?: string) {
    const res = await getVouchersForPrint({ data: { batch: b } });
    if (res.vouchers.length === 0) return void toast.error("No unused vouchers to export.");
    const rows = [
      "code,package,price,duration_minutes,devices,batch,expires",
      ...res.vouchers.map((v) =>
        [v.code, v.packageName, v.price, v.durationMinutes, v.maxDevices, v.batchLabel ?? "", v.expiresAt ?? ""]
          .map((x) => `"${String(x).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `vouchers-${(b || "all").replace(/\W+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pages = d ? Math.max(1, Math.ceil(d.total / d.pageSize)) : 1;
  const tabs: [Status | undefined, string, number][] = [
    ["AVAILABLE", "Available", d?.counts.AVAILABLE ?? 0],
    ["REDEEMED", "Redeemed", d?.counts.REDEEMED ?? 0],
    ["EXPIRED", "Expired", d?.counts.EXPIRED ?? 0],
    [undefined, "All", (d?.counts.AVAILABLE ?? 0) + (d?.counts.REDEEMED ?? 0) + (d?.counts.EXPIRED ?? 0)],
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Vouchers</h1>
        <p className="mt-1 text-sm text-muted">
          Offline codes for cash desks. Redeem on the portal without STK.
        </p>
      </div>

      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Generate batch</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Package
            <select className={sel} value={packageId || pkgs.data?.[0]?.id || ""} onChange={(e) => setPackageId(e.target.value)}>
              {(pkgs.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — KES {p.price}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Count
            <Input type="number" min={1} max={200} className="mt-1" value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
          </label>
          <label className="text-sm">
            Batch label
            <Input className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Shop till 1" />
          </label>
          <label className="text-sm">
            Valid for
            <select className={sel} value={validDays} onChange={(e) => setValidDays(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">Never expires</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </label>
        </div>
        <Button disabled={gen.isPending || !(packageId || pkgs.data?.[0]?.id)} onClick={() => gen.mutate()}>
          {gen.isPending ? "Generating…" : "Generate codes"}
        </Button>
        {lastCodes.length > 0 && (
          <div className="space-y-2 rounded-md bg-raised p-3">
            <pre className="max-h-32 overflow-auto text-xs">{lastCodes.join("\n")}</pre>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => printBatch(lastBatch)}>
                <Printer className="size-4" /> Print slips
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadCsv(lastBatch)}>
                <Download className="size-4" /> CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(lastCodes.join("\n")).then(() => toast.success("Copied"))}
              >
                <Copy className="size-4" /> Copy
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Keep the list tidy */}
      <Card className="space-y-3 p-5">
        <h2 className="font-display text-lg font-semibold">Keep it tidy</h2>
        <p className="text-sm text-muted">
          Redeemed vouchers are kept as a record by default. Their payment history stays in Payments even
          after the voucher is deleted, so clearing them is safe.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-sm">
            Automatically delete redeemed vouchers
            <select
              className={sel}
              value={d?.autoCleanDays ?? 0}
              onChange={(e) => autoClean.mutate(Number(e.target.value))}
            >
              <option value={0}>Never — keep them</option>
              <option value={1}>1 day after they're used</option>
              <option value={7}>7 days after they're used</option>
              <option value={30}>30 days after they're used</option>
              <option value={90}>90 days after they're used</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!d?.counts.REDEEMED || del.isPending}
              onClick={() =>
                confirmDelete(`Delete all ${d?.counts.REDEEMED} redeemed vouchers${batch !== undefined ? " in this batch" : ""}?`, () =>
                  del.mutate({ mode: "redeemed", batch }),
                )
              }
            >
              <Trash2 className="size-4" /> Clear redeemed ({d?.counts.REDEEMED ?? 0})
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!d?.counts.EXPIRED || del.isPending}
              onClick={() =>
                confirmDelete(`Delete all ${d?.counts.EXPIRED} expired vouchers?`, () => del.mutate({ mode: "expired", batch }))
              }
            >
              <Trash2 className="size-4" /> Clear expired ({d?.counts.EXPIRED ?? 0})
            </Button>
          </div>
        </div>
      </Card>

      {/* Batches */}
      {d && d.batches.length > 0 && (
        <Card className="space-y-2 p-5">
          <h2 className="font-display text-lg font-semibold">Batches</h2>
          <ul className="divide-y divide-border">
            {d.batches.map((b) => (
              <li key={b.label || "__none"} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <button
                  type="button"
                  className={cn("text-left", batch === b.label ? "text-accent" : "")}
                  onClick={() => setBatch(batch === b.label ? undefined : b.label)}
                >
                  <p className="font-medium">{batchName(b.label)}</p>
                  <p className="text-xs text-muted">
                    {b.available} unused · {b.redeemed} redeemed{b.expired ? ` · ${b.expired} expired` : ""} · {b.total} total
                  </p>
                </button>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" disabled={!b.available} onClick={() => printBatch(b.label)}>
                    <Printer className="size-4" /> Print
                  </Button>
                  <Button size="sm" variant="outline" disabled={!b.available} onClick={() => downloadCsv(b.label)}>
                    <Download className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Delete batch ${batchName(b.label)}`}
                    onClick={() =>
                      confirmDelete(
                        b.available > 0
                          ? `Delete the whole "${batchName(b.label)}" batch? ${b.available} unused voucher(s) will stop working.`
                          : `Delete the "${batchName(b.label)}" batch (${b.total} used/expired vouchers)?`,
                        () => del.mutate({ mode: "batch", batch: b.label }),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Codes */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1 rounded-xl border border-border bg-surface p-1">
          {tabs.map(([key, name, n]) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={status === key}
              onClick={() => setStatus(key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium",
                status === key ? "bg-accent text-bg" : "text-muted hover:text-fg",
              )}
            >
              {name} <span className="tabular-nums opacity-80">{n}</span>
            </button>
          ))}
        </div>
        <Input className="h-9 w-40" placeholder="Search code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {batch !== undefined ? (
          <button type="button" className="rounded-full border border-accent px-3 py-1 text-xs text-accent" onClick={() => setBatch(undefined)}>
            Batch: {batchName(batch)} ✕
          </button>
        ) : null}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-subtle">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Batch</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {(d?.rows ?? []).map((v) => (
              <tr key={v.id} className="border-b border-border">
                <td className="px-4 py-2 font-mono text-xs">{v.code}</td>
                <td className="px-4 py-2">{v.packageName}</td>
                <td className="px-4 py-2">
                  <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
                  {v.redeemedAt ? (
                    <p className="mt-0.5 text-[11px] text-subtle">{new Date(v.redeemedAt).toLocaleDateString()}</p>
                  ) : v.expiresAt ? (
                    <p className="mt-0.5 text-[11px] text-subtle">until {new Date(v.expiresAt).toLocaleDateString()}</p>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-muted">{v.batchLabel ?? "—"}</td>
                <td className="pr-3 text-right">
                  <button
                    type="button"
                    aria-label={`Delete ${v.code}`}
                    className="rounded p-1.5 text-muted hover:text-danger"
                    onClick={() =>
                      confirmDelete(
                        v.status === "AVAILABLE" ? `Delete ${v.code}? It will stop working.` : `Delete ${v.code}?`,
                        () => del.mutate({ mode: "ids", ids: [v.id] }),
                      )
                    }
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {d && d.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  No vouchers here.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {d && d.total > d.pageSize ? (
        <div className="flex items-center justify-between text-sm text-muted">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pages} · {d.total} vouchers
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
