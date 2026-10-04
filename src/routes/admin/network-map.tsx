import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Globe,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Router as RouterIcon,
  Trash2,
  Users,
  Wifi,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteSwitcher } from "@/components/admin/site-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAdminSite } from "@/hooks/use-admin-site";
import { deleteAccessPoint, getNetworkMap, saveAccessPoint } from "@/lib/fn/admin";
import { formatBytes } from "@/lib/format";
import type { AccessPointRow, HealthState, MapRouter } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/network-map")({ component: NetworkMapPage });

const AUTO_MS = 15_000;

/** Green = online/healthy, yellow = warning, red = offline (grey = not checked yet). */
const DOT: Record<HealthState, string> = {
  ONLINE: "bg-ok",
  WARNING: "bg-warn",
  OFFLINE: "bg-danger",
  UNKNOWN: "bg-subtle",
};
const LABEL: Record<HealthState, string> = {
  ONLINE: "Online",
  WARNING: "Warning",
  OFFLINE: "Offline",
  UNKNOWN: "Unknown",
};
const TONE: Record<HealthState, "ok" | "warn" | "danger" | "neutral"> = {
  ONLINE: "ok",
  WARNING: "warn",
  OFFLINE: "danger",
  UNKNOWN: "neutral",
};

function Dot({ state, className }: { state: HealthState; className?: string }) {
  return (
    <span
      title={LABEL[state]}
      className={cn("inline-block size-2.5 shrink-0 rounded-full", DOT[state], className)}
    />
  );
}

function bps(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)} Gbps`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)} Mbps`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} kbps`;
  return `${v} bps`;
}

function emptyAp(mikrotikId: string) {
  return { id: "", mikrotikId, name: "", label: "", ip: "", mac: "", model: "", port: "", notes: "" };
}

function NetworkMapPage() {
  const qc = useQueryClient();
  const [siteId] = useAdminSite();
  const [auto, setAuto] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [apOpen, setApOpen] = useState(false);
  const [apForm, setApForm] = useState(emptyAp(""));
  const [days, setDays] = useState(30);

  const key = ["network-map", siteId, days] as const;
  // Cheap read of the stored snapshot; the refresh below reads the routers.
  const q = useQuery({
    queryKey: key,
    queryFn: () => getNetworkMap({ data: { siteId, days } }),
    refetchInterval: 10_000,
    placeholderData: (prev) => prev,
  });
  const refresh = useMutation({
    mutationFn: () => getNetworkMap({ data: { siteId, refresh: true, days } }),
    onSuccess: (d) => qc.setQueryData(key, d),
  });

  // Read the routers once on open and on every site change, then on a timer.
  useEffect(() => {
    refresh.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, days]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => refresh.mutate(), AUTO_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, siteId, days]);

  const d = q.data;
  const allRouters = useMemo(() => (d?.sites ?? []).flatMap((s) => s.routers), [d]);
  const selected: MapRouter | null =
    allRouters.find((r) => r.id === selectedId) ?? allRouters[0] ?? null;

  const saveAp = useMutation({
    mutationFn: () =>
      saveAccessPoint({
        data: {
          id: apForm.id || undefined,
          mikrotikId: apForm.mikrotikId,
          name: apForm.name,
          label: apForm.label || undefined,
          ip: apForm.ip || undefined,
          mac: apForm.mac || undefined,
          model: apForm.model || undefined,
          port: apForm.port || undefined,
          notes: apForm.notes || undefined,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) return void toast.error(res.error);
      toast.success("Access point saved.");
      setApOpen(false);
      qc.invalidateQueries({ queryKey: ["network-map"] });
    },
    onError: () => toast.error("Could not save the access point."),
  });
  const delAp = useMutation({
    mutationFn: (id: string) => deleteAccessPoint({ data: { id } }),
    onSuccess: () => {
      toast.success("Access point removed.");
      qc.invalidateQueries({ queryKey: ["network-map"] });
    },
  });

  const t = d?.totals;
  const routerForm = allRouters.find((r) => r.id === apForm.mikrotikId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Network map</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <span
              className={cn(
                "inline-block size-2 rounded-full",
                refresh.isError ? "bg-danger" : "bg-ok",
                refresh.isPending && "animate-pulse",
              )}
            />
            {refresh.isPending ? "Reading routers…" : auto ? "Live monitoring" : "Paused"}
            {d ? ` · updated ${new Date(d.generatedAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SiteSwitcher />
          <label className="flex items-center gap-2 text-sm text-muted">
            Auto refresh
            <Switch checked={auto} onCheckedChange={setAuto} />
          </label>
          <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            <RefreshCw className={cn("size-4", refresh.isPending && "animate-spin")} />
            Refresh now
          </Button>
          <Button variant="outline" asChild>
            <Link to="/admin/network">Manage</Link>
          </Button>
        </div>
      </div>

      {/* Summary cards — follow the selected site */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Summary
          icon={<RouterIcon className="size-4" />}
          title="MikroTik routers"
          value={String((t?.routers.online ?? 0) + (t?.routers.warning ?? 0) + (t?.routers.offline ?? 0))}
          chips={[
            ["ONLINE", t?.routers.online ?? 0],
            ["WARNING", t?.routers.warning ?? 0],
            ["OFFLINE", t?.routers.offline ?? 0],
          ]}
        />
        <Summary
          icon={<Wifi className="size-4" />}
          title="Access points"
          value={String((t?.aps.online ?? 0) + (t?.aps.warning ?? 0) + (t?.aps.offline ?? 0) + (t?.aps.unknown ?? 0))}
          chips={[
            ["ONLINE", t?.aps.online ?? 0],
            ["WARNING", t?.aps.warning ?? 0],
            ["OFFLINE", t?.aps.offline ?? 0],
          ]}
          note={
            (t?.aps.noIncome ?? 0) > 0
              ? `${t!.aps.noIncome} on but earning nothing (${days} days)`
              : undefined
          }
        />
        <Summary
          icon={<Users className="size-4" />}
          title="Active users"
          value={String(t?.activeUsers ?? 0)}
          note="connected to hotspots now"
        />
        <Summary
          icon={<Globe className="size-4" />}
          title="Traffic"
          value={bps((t?.rxBps ?? 0) + (t?.txBps ?? 0))}
          note={`↓ ${bps(t?.rxBps)} · ↑ ${bps(t?.txBps)}`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Topology grouped by site/town */}
        <Card className="p-4 md:p-5">
          <h2 className="font-display text-lg font-semibold">Network topology</h2>
          <p className="text-xs text-subtle">Grouped by town. Tap a router for its details.</p>

          {!d ? (
            <div className="mt-4 h-40 animate-pulse rounded-xl bg-raised" />
          ) : d.sites.every((s) => s.routers.length === 0) ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted">
              No MikroTik routers{siteId !== "ALL" ? " in this site" : ""} yet. Add one on the{" "}
              <Link to="/admin/network" className="text-accent underline">
                Network page
              </Link>
              .
            </p>
          ) : (
            <div className="mt-4">
              <div className="mx-auto flex w-fit items-center gap-2 rounded-xl border border-border bg-raised px-4 py-2 text-sm font-medium">
                <Globe className="size-4 text-accent" />
                Internet
              </div>
              {d.sites
                .filter((s) => s.routers.length > 0 || siteId !== "ALL")
                .map((s) => (
                  <div key={s.site.id} className="relative">
                    <div className="mx-auto h-4 w-px bg-border" />
                    <div className="rounded-2xl border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1.5 font-display font-semibold">
                          <MapPin className="size-4 shrink-0 text-accent" />
                          <span className="truncate">{s.site.name}</span>
                          {s.site.status === "INACTIVE" ? <Badge tone="neutral">Inactive</Badge> : null}
                        </p>
                        <Badge tone={TONE[s.state]}>{LABEL[s.state]}</Badge>
                      </div>
                      {s.site.notes ? <p className="mt-0.5 text-xs text-subtle">{s.site.notes}</p> : null}

                      <div className="mt-3 space-y-3">
                        {s.routers.length === 0 ? (
                          <p className="text-sm text-muted">No routers in this town yet.</p>
                        ) : null}
                        {s.routers.map((r) => (
                          <div key={r.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(r.id)}
                              className={cn(
                                "w-full rounded-xl border p-3 text-left transition",
                                selected?.id === r.id
                                  ? "border-accent bg-accent/5"
                                  : "border-border bg-surface hover:border-accent/40",
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-2 font-medium">
                                  <Dot state={r.state} />
                                  <span className="truncate">{r.name}</span>
                                  {r.isPrimary ? <Badge tone="accent">Primary</Badge> : null}
                                </span>
                                <span className="shrink-0 text-xs text-muted">{LABEL[r.state]}</span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-subtle">
                                {[r.boardName, r.version ? `RouterOS ${r.version}` : null, r.host.replace(/^https?:\/\//, "")]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                                <MapPin className="size-3" />
                                {r.siteName}
                              </p>
                              {r.hours.enabled ? (
                                <p className={cn("mt-1 text-xs", r.hours.open ? "text-muted" : "text-warn")}>
                                  {r.hours.open
                                    ? `Open${r.hours.closesAtLabel ? ` until ${r.hours.closesAtLabel}` : ""}`
                                    : `Closed (scheduled)${r.hours.opensAtLabel ? ` · opens ${r.hours.opensAtLabel}` : ""}`}
                                </p>
                              ) : null}
                              {r.stateReason && r.state !== "ONLINE" ? (
                                <p className={cn("mt-1 text-xs", r.state === "OFFLINE" ? "text-danger" : "text-warn")}>
                                  {r.stateReason}
                                </p>
                              ) : null}
                              {r.isps.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {r.isps.map((i) => (
                                    <span
                                      key={i.id}
                                      className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
                                    >
                                      <Dot
                                        state={i.status === "ONLINE" ? "ONLINE" : i.status === "DEGRADED" ? "WARNING" : "OFFLINE"}
                                        className="size-2"
                                      />
                                      {i.name}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </button>
                            {/* Access points hang under their router */}
                            {r.aps.length > 0 ? (
                              <ul className="ml-4 mt-1 space-y-1 border-l border-dashed border-border pl-3">
                                {r.aps.map((a) => (
                                  <li
                                    key={a.id}
                                    className="flex items-center justify-between gap-2 rounded-lg bg-raised px-3 py-2 text-sm"
                                  >
                                    <span className="flex min-w-0 items-center gap-2">
                                      <Dot state={!a.port || a.revenue === 0 ? "WARNING" : a.status} />
                                      <Wifi className="size-3.5 shrink-0 text-muted" />
                                      {a.label ? (
                                        <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                                          #{a.label}
                                        </span>
                                      ) : null}
                                      <span className="truncate">{a.name}</span>
                                    </span>
                                    <span className={cn("shrink-0 text-xs", !a.port || a.revenue === 0 ? "text-warn" : "text-muted")}>
                                      {!a.port || a.revenue === 0
                                        ? "No income"
                                        : a.clients != null
                                          ? `${a.clients} client${a.clients === 1 ? "" : "s"}`
                                          : LABEL[a.status]}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="ml-4 mt-1 border-l border-dashed border-border pl-3 text-xs text-subtle">
                                No access points added.
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg border border-border p-3 text-xs text-muted">
            <span className="font-medium text-fg">Status</span>
            {(["ONLINE", "WARNING", "OFFLINE"] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <Dot state={s} />
                {s === "ONLINE" ? "Online / Healthy" : s === "WARNING" ? "Warning" : "Offline"}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <Dot state="UNKNOWN" />
              Not checked
            </span>
          </div>
        </Card>

        {/* Details for the selected router */}
        <div className="space-y-4">
          {selected ? (
            <>
              <RouterStatus r={selected} />
              <ApTable
                r={selected}
                days={days}
                onDays={setDays}
                onAdd={() => {
                  setApForm(emptyAp(selected.id));
                  setApOpen(true);
                }}
                onEdit={(a) => {
                  setApForm({
                    id: a.id,
                    mikrotikId: selected.id,
                    name: a.name,
                    label: a.label ?? "",
                    ip: a.ip ?? "",
                    mac: a.mac ?? "",
                    model: a.model ?? "",
                    port: a.port ?? "",
                    notes: a.notes ?? "",
                  });
                  setApOpen(true);
                }}
                onDelete={(a) => {
                  if (window.confirm(`Remove ${a.name} from the map?`)) delAp.mutate(a.id);
                }}
              />
              <PortsTable r={selected} />
            </>
          ) : (
            <Card className="p-5 text-sm text-muted">Select a router to see its status, access points and ports.</Card>
          )}
        </div>
      </div>

      <Dialog open={apOpen} onOpenChange={setApOpen}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{apForm.id ? "Edit access point" : "Add access point"}</DialogTitle>
            <DialogDescription>
              The AP belongs to a MikroTik and automatically shows in that router's town. Its status is
              checked by pinging it from the router.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveAp.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>MikroTik</Label>
              <select
                className="flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm"
                value={apForm.mikrotikId}
                onChange={(e) => setApForm({ ...apForm, mikrotikId: e.target.value, port: "" })}
              >
                {allRouters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {r.siteName}
                  </option>
                ))}
              </select>
            </div>

            {routerForm && (routerForm.live?.neighbors.length ?? 0) > 0 && !apForm.id ? (
              <div className="space-y-1.5">
                <Label>Found on this router</Label>
                <div className="flex flex-wrap gap-1.5">
                  {routerForm.live!.neighbors.slice(0, 12).map((n, i) => (
                    <button
                      key={`${n.mac}-${i}`}
                      type="button"
                      className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-fg"
                      onClick={() =>
                        setApForm({
                          ...apForm,
                          name: apForm.name || n.name,
                          ip: n.ip ?? apForm.ip,
                          mac: n.mac ?? apForm.mac,
                          model: n.model ?? apForm.model,
                          port: n.port ?? apForm.port,
                        })
                      }
                    >
                      {n.name}
                      {n.ip ? ` · ${n.ip}` : ""}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-subtle">Tap a device to fill in the details below.</p>
              </div>
            ) : null}

            <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ap-label">AP number</Label>
                <Input id="ap-label" value={apForm.label} maxLength={20} placeholder="e.g. 3" onChange={(e) => setApForm({ ...apForm, label: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-name">Name</Label>
                <Input id="ap-name" required minLength={2} value={apForm.name} placeholder="e.g. Lobby AP" onChange={(e) => setApForm({ ...apForm, name: e.target.value })} />
              </div>
            </div>
            <p className="-mt-1 text-xs text-subtle">
              The name is how this AP is shown everywhere. If you have marked the device with a number or tag, enter it
              as the AP number so you can spot the right one on site.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ap-ip">IP address</Label>
                <Input id="ap-ip" inputMode="decimal" value={apForm.ip} placeholder="192.168.88.20" onChange={(e) => setApForm({ ...apForm, ip: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ap-mac">MAC (optional)</Label>
                <Input id="ap-mac" value={apForm.mac} placeholder="AA:BB:CC:DD:EE:FF" onChange={(e) => setApForm({ ...apForm, mac: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-port">Router port it's plugged into</Label>
              <select
                id="ap-port"
                className="flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm"
                value={apForm.port}
                onChange={(e) => setApForm({ ...apForm, port: e.target.value })}
              >
                <option value="">Not sure / skip</option>
                {(routerForm?.live?.ports ?? []).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                    {p.comment ? ` — ${p.comment}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-subtle">Used to count how many clients are connected through this AP.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-model">Model (optional)</Label>
              <Input id="ap-model" value={apForm.model} placeholder="e.g. TP-Link EAP225" onChange={(e) => setApForm({ ...apForm, model: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={saveAp.isPending || !apForm.mikrotikId}>
              {saveAp.isPending ? "Saving…" : "Save access point"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Summary({
  icon,
  title,
  value,
  chips,
  note,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  chips?: [HealthState, number][];
  note?: string;
}) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-subtle">
        {icon}
        {title}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {chips ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {chips.map(([s, n]) => (
            <span key={s} className="flex items-center gap-1">
              <Dot state={s} className="size-2" />
              {n}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">{note}</p>
      )}
      {chips && note ? <p className="mt-1.5 text-xs text-warn">{note}</p> : null}
    </Card>
  );
}

function Bar({ pct, state }: { pct: number; state: HealthState }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
      <div className={cn("h-full rounded-full", DOT[state])} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </div>
  );
}

function RouterStatus({ r }: { r: MapRouter }) {
  const l = r.live;
  const cpu = l?.cpuLoad ?? null;
  const memPct =
    l?.memTotal && l.memFree != null ? Math.round(((l.memTotal - l.memFree) / l.memTotal) * 100) : null;
  const level = (v: number | null, warn: number): HealthState =>
    v == null ? "UNKNOWN" : v >= warn ? "WARNING" : "ONLINE";
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold">
          <Dot state={r.state} />
          <span className="truncate">{r.name}</span>
        </h2>
        <span className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3" />
          {r.siteName}
        </span>
      </div>
      {l?.error ? <p className="mt-2 text-sm text-danger">{l.error}</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-subtle">CPU usage</p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums">{cpu != null ? `${cpu}%` : "—"}</p>
          {cpu != null ? <Bar pct={cpu} state={level(cpu, 85)} /> : null}
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-subtle">Memory usage</p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums">{memPct != null ? `${memPct}%` : "—"}</p>
          {memPct != null ? <Bar pct={memPct} state={level(memPct, 90)} /> : null}
          {l?.memTotal ? (
            <p className="mt-1 text-[11px] text-subtle">
              {formatBytes(l.memTotal - (l.memFree ?? 0))} / {formatBytes(l.memTotal)}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-subtle">Uptime</p>
          <p className="mt-1 font-display text-xl font-semibold">{l?.uptime ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-subtle">Active users</p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums">{l?.activeUsers ?? "—"}</p>
          <p className="text-[11px] text-subtle">hotspot clients</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border p-3 text-sm">
        <span className="text-xs text-subtle">Bandwidth (ether ports)</span>
        <span className="flex items-center gap-3 tabular-nums">
          <span className="flex items-center gap-1"><ArrowDown className="size-3.5 text-ok" />{bps(l?.rxBps)}</span>
          <span className="flex items-center gap-1"><ArrowUp className="size-3.5 text-accent" />{bps(l?.txBps)}</span>
        </span>
      </div>
    </Card>
  );
}

/** APs earning well under the average of the tracked ones (needs at least 3 with data). */
function findLowEarners(aps: AccessPointRow[]): Set<string> {
  const tracked = aps.filter((a) => a.revenue != null);
  const total = tracked.reduce((n, a) => n + (a.revenue ?? 0), 0);
  if (tracked.length < 3 || total <= 0) return new Set();
  const avg = total / tracked.length;
  return new Set(tracked.filter((a) => (a.revenue ?? 0) < avg * 0.25).map((a) => a.id));
}

function ApTable({
  r,
  days,
  onDays,
  onAdd,
  onEdit,
  onDelete,
}: {
  r: MapRouter;
  days: number;
  onDays: (d: number) => void;
  onAdd: () => void;
  onEdit: (a: AccessPointRow) => void;
  onDelete: (a: AccessPointRow) => void;
}) {
  const lowEarners = findLowEarners(r.aps);
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Access points ({r.aps.length})</h2>
        <div className="flex items-center gap-2">
          <select
            aria-label="Revenue period"
            value={days}
            onChange={(e) => onDays(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-raised px-2 text-xs"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="size-4" />
          Add AP
        </Button>
        </div>
      </div>
      {r.aps.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No access points on this router. Add the APs that connect through it so their health shows on the map.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-subtle">
                <th className="py-1.5 pr-2 font-medium">Access point</th>
                <th className="py-1.5 pr-2 font-medium">Status</th>
                <th className="py-1.5 pr-2 font-medium">Port</th>
                <th className="py-1.5 pr-2 text-right font-medium">Clients</th>
                <th className="py-1.5 pr-2 text-right font-medium">Signal</th>
                <th className="py-1.5 pr-2 text-right font-medium">Revenue</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {r.aps.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="py-2 pr-2">
                    <p className="flex items-center gap-1.5 font-medium">
                      {a.label ? (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-xs font-semibold text-accent">#{a.label}</span>
                      ) : null}
                      {a.name}
                    </p>
                    <p className="text-xs text-subtle">{[a.ip, a.model].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-1.5">
                      <Dot state={!a.port || a.revenue === 0 ? "WARNING" : a.status} />
                      {!a.port || a.revenue === 0 ? "On · no income" : LABEL[a.status]}
                    </span>
                    {a.latencyMs != null ? <span className="text-[11px] text-subtle">{a.latencyMs} ms</span> : null}
                  </td>
                  <td className="py-2 pr-2 text-muted">{a.port ?? "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{a.clients ?? "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-muted">
                    {a.signalDbm != null ? `${a.signalDbm} dBm` : "—"}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {a.revenue == null ? (
                      <span className="text-[11px] text-subtle" title="Set the router port this AP is plugged into to track revenue">set port</span>
                    ) : (
                      <>
                        <p className="font-medium">KES {a.revenue.toLocaleString()}</p>
                        <p className="text-[11px] text-subtle">{a.paidCustomers ?? 0} paying</p>
                        {lowEarners.has(a.id) ? <p className="text-[11px] text-warn">Low earner</p> : null}
                      </>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {a.manual ? (
                      <span className="flex justify-end gap-1">
                        <button type="button" aria-label={`Edit ${a.name}`} className="rounded p-1 text-muted hover:text-fg" onClick={() => onEdit(a)}>
                          <Pencil className="size-4" />
                        </button>
                        <button type="button" aria-label={`Remove ${a.name}`} className="rounded p-1 text-muted hover:text-danger" onClick={() => onDelete(a)}>
                          <Trash2 className="size-4" />
                        </button>
                      </span>
                    ) : (
                      <span className="text-[11px] text-subtle">auto</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
<p className="mt-3 text-xs text-subtle">
  Status comes from pinging each AP from the router. Client counts and revenue need the AP's router port (each AP on its own port); signal strength is only available for radios built into the MikroTik itself. Revenue is successful M-Pesa payments, split by where each customer was connected, and builds up as customers use the Wi-Fi.
</p>
    </Card>
  );
}

function PortsTable({ r }: { r: MapRouter }) {
  const ports = (r.live?.ports ?? []).filter((p) => !p.disabled && (p.running || p.type === "ether"));
  return (
    <Card className="p-4">
      <h2 className="font-display text-lg font-semibold">Active ports / interfaces</h2>
      {ports.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {r.live?.error ? "Router unreachable — no port data." : "No port data yet. Press Refresh now."}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-subtle">
                <th className="py-1.5 pr-2 font-medium">Port</th>
                <th className="py-1.5 pr-2 font-medium">Status</th>
                <th className="py-1.5 pr-2 font-medium">IP</th>
                <th className="py-1.5 pr-2 text-right font-medium">In</th>
                <th className="py-1.5 text-right font-medium">Out</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((p) => (
                <tr key={p.name} className="border-t border-border">
                  <td className="py-2 pr-2">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-subtle">
                      {p.type}
                      {p.comment ? ` · ${p.comment}` : ""}
                    </p>
                  </td>
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-1.5">
                      <Dot state={p.running ? "ONLINE" : "OFFLINE"} />
                      {p.running ? "Up" : "Down"}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-muted">{p.ip ?? "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{bps(p.rxBps)}</td>
                  <td className="py-2 text-right tabular-nums">{bps(p.txBps)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
