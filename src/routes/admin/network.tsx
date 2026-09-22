import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Radio, Router, Smartphone, Wifi } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  applyCamouflage,
  deleteIsp,
  deleteMikroTik,
  getNetwork,
  saveIsp,
  saveMikroTik,
  setIspStatus,
  setPrimaryMikroTik,
  testMikroTik,
  refreshMikroTiks,
} from "@/lib/fn/admin";
import { CAMOUFLAGE, type CamouflageKind } from "@/lib/camouflage";
import { formatSpeed, formatStamp } from "@/lib/format";
import { parseRouterHost } from "@/lib/mikrotik-host";
import type { Isp, IspStatus, MikroTik, RouterProbe } from "@/lib/types";

export const Route = createFileRoute("/admin/network")({
  component: NetworkPage,
});

const emptyRouter = {
  name: "",
  host: "",
  port: 80,
  apiUser: "admin",
  apiPassword: "",
  hotspotName: "hotspot1",
  ssl: false,
  insecureTls: false,
  apiMode: "rest" as "rest" | "api6",
  apiPort: 8728,
  makePrimary: true,
};

const emptyIsp = {
  id: "" as string,
  name: "",
  type: "AIRTEL" as const,
  interfaceName: "",
  mikrotikId: "",
  totalKbps: 30720,
  perUserMaxKbps: 5120,
  maxUsers: 25,
};

function NetworkPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["network"],
    queryFn: () => getNetwork(),
    refetchInterval: 45_000,
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });
  const [open, setOpen] = useState(false);
  const [ispOpen, setIspOpen] = useState(false);
  const [editing, setEditing] = useState<MikroTik | null>(null);
  const [form, setForm] = useState(emptyRouter);
  const [ispForm, setIspForm] = useState(emptyIsp);
  const [probe, setProbe] = useState<RouterProbe | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [scriptText, setScriptText] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");

  const d = q.data;
  const routers = d?.mikrotiks ?? [];
  const isps = d?.isps ?? [];

  function startAdd(mt?: MikroTik) {
    setProbe(null);
    if (mt) {
      const parsed = parseRouterHost(mt.host);
      setEditing(mt);
      setForm({
        name: mt.name,
        host: parsed.address,
        port: parsed.port,
        apiUser: mt.apiUser,
        apiPassword: "",
        hotspotName: mt.hotspotName,
        apiMode: mt.apiMode === "api6" ? "api6" : "rest",
        apiPort: mt.apiPort || 8728,
        ssl: mt.ssl,
        insecureTls: mt.insecureTls,
        makePrimary: mt.isPrimary,
      });
    } else {
      setEditing(null);
      setForm({ ...emptyRouter, makePrimary: routers.length === 0 });
    }
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      saveMikroTik({
        data: {
          id: editing?.id,
          name: form.name,
          host: form.host,
          port: form.port,
          apiUser: form.apiUser,
          apiPassword: form.apiPassword || undefined,
          hotspotName: form.hotspotName,
          ssl: form.ssl,
          apiMode: form.apiMode,
          apiPort: form.apiMode === "api6" ? form.apiPort || form.port || 8728 : form.port,
          insecureTls: form.insecureTls,
          makePrimary: form.makePrimary,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setProbe(res.probe);
      if (res.probe.hotspotServers.length) {
        setForm((f) =>
          res.probe.hotspotServers.includes(f.hotspotName)
            ? f
            : { ...f, hotspotName: res.probe.hotspotServers[0] ?? f.hotspotName },
        );
      }
      toast.success(
        res.live
          ? "Router reachable. Activations go to this live MikroTik."
          : res.probe.ok
            ? "Router saved and reachable."
            : "Router saved. REST probe failed — check IP → Services → www.",
      );
      qc.invalidateQueries({ queryKey: ["network"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
      if (res.probe.ok) setOpen(false);
    },
    onError: () => toast.error("Could not save the router."),
  });

  const test = useMutation({
    mutationFn: (input: { id?: string } | typeof form) => {
      if ("id" in input && input.id) {
        return testMikroTik({ data: { id: input.id } });
      }
      const f = input as typeof form;
      return testMikroTik({
        data: {
          host: f.host,
          port: f.port,
          apiUser: f.apiUser,
          apiPassword: f.apiPassword || undefined,
          hotspotName: f.hotspotName,
          ssl: f.ssl,
          apiMode: f.apiMode,
          apiPort: f.apiMode === "api6" ? f.apiPort || f.port || 8728 : f.port,
          insecureTls: f.insecureTls,
          id: editing?.id,
        },
      });
    },
    onSuccess: (res) => {
      if (res.probe) setProbe(res.probe);
      if (res.ok) toast.success("RouterOS REST is reachable.");
      else toast.error(res.error ?? "Unreachable.");
      if (res.probe?.hotspotServers.length) {
        setForm((f) =>
          res.probe!.hotspotServers.includes(f.hotspotName)
            ? f
            : { ...f, hotspotName: res.probe!.hotspotServers[0] ?? f.hotspotName },
        );
      }
      qc.invalidateQueries({ queryKey: ["network"] });
    },
  });

  const primary = useMutation({
    mutationFn: (id: string) => setPrimaryMikroTik({ data: { id } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("This router now handles live activations.");
      qc.invalidateQueries({ queryKey: ["network"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteMikroTik({ data: { id } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Router removed.");
      qc.invalidateQueries({ queryKey: ["network"] });
    },
  });

  const refresh = useMutation({
    mutationFn: () => refreshMikroTiks(),
    onSuccess: (res) => {
      toast.success(
        res.total === 0
          ? "No routers to probe."
          : `Probed ${res.total} router${res.total === 1 ? "" : "s"} · ${res.online} online.`,
      );
      qc.invalidateQueries({ queryKey: ["network"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not probe routers."),
  });

  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: IspStatus }) =>
      setIspStatus({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["network"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const savePath = useMutation({
    mutationFn: (input: {
      id?: string;
      name: string;
      type: "STARLINK" | "AIRTEL" | "SAFARICOM" | "FIBRE" | "LTE" | "OTHER";
      interfaceName?: string;
      mikrotikId?: string;
      status?: IspStatus;
      totalKbps?: number;
      perUserMaxKbps?: number;
      maxUsers?: number;
    }) => saveIsp({ data: input }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error("Could not save this path.");
        return;
      }
      toast.success("ISP path saved.");
      setIspOpen(false);
      setIspForm(emptyIsp);
      qc.invalidateQueries({ queryKey: ["network"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const removePath = useMutation({
    mutationFn: (id: string) => deleteIsp({ data: { id } }),
    onSuccess: () => {
      toast.success("ISP path removed.");
      qc.invalidateQueries({ queryKey: ["network"] });
    },
  });

  const disguise = useMutation({
    mutationFn: (input: {
      routerId: string;
      kind: CamouflageKind;
      interfaceName?: string;
    }) => applyCamouflage({ data: input }),
    onSuccess: (res, vars) => {
      if (!res.ok) {
        toast.error("error" in res ? res.error : "Could not apply camouflage.");
        return;
      }
      setScriptTitle(`${CAMOUFLAGE[vars.kind].label} · ${res.interfaceName}`);
      setScriptText(res.script);
      if (res.live && !res.error) {
        toast.success(
          `WAN now appears as ${CAMOUFLAGE[vars.kind].label} (${res.mac}).`,
        );
      } else {
        toast.message(
          res.error ?? "REST write skipped. Copy the Terminal script.",
        );
        setScriptOpen(true);
      }
      qc.invalidateQueries({ queryKey: ["network"] });
    },
    onError: () => toast.error("Could not apply camouflage."),
  });

  function alreadyIsp(interfaceName: string) {
    return isps.some((i) => i.interfaceName === interfaceName);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Network
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Register a real MikroTik with RouterOS REST. TelNet never load-balances
            WANs — it only activates users. When a path drops, the same package
            stays valid.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => startAdd()}>
            <Plus className="size-4" />
            Add router
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Router className="size-4 text-accent" />
          <h2 className="font-display text-lg font-semibold">Add routers</h2>
        </div>
        {routers.length === 0 ? (
          <Card className="p-6">
            <p className="font-display text-lg font-semibold">Add a real MikroTik</p>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
              Register any RouterOS 7 box — hAP, RB750, CCR, HEX, LTE. TelNet
              supports RouterOS 7 REST (www) and RouterOS 6 binary API (8728) — pick below when adding a router. After it
              is reachable, one-click camouflage can make the WAN look like a
              phone or PC to the ISP.
            </p>
            <ol className="mt-4 max-w-lg space-y-2 text-sm text-muted">
              <li>1. ROS7: IP → Services → www/www-ssl. ROS6: IP → Services → api (8728).</li>
              <li>2. Create a user in the full group, or a group that can write hotspot users.</li>
              <li>3. If this app is in the cloud, expose REST with a tunnel or public IP — 192.168.88.1 will not route from here.</li>
            </ol>
            <Button className="mt-5" onClick={() => startAdd()}>
              Add router
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {routers.map((mt) => (
              <RouterCard
                key={mt.id}
                mt={mt}
                isps={isps}
                onTest={() => test.mutate({ id: mt.id })}
                onPrimary={() => primary.mutate(mt.id)}
                onEdit={() => startAdd(mt)}
                onRemove={() => remove.mutate(mt.id)}
                testing={test.isPending}
                promoting={primary.isPending}
                removing={remove.isPending}
                disguising={disguise.isPending}
                onCamouflage={(kind, iface) =>
                  disguise.mutate({
                    routerId: mt.id,
                    kind,
                    interfaceName: iface,
                  })
                }
                onImportIface={(iface) => {
                  if (alreadyIsp(iface.name)) {
                    toast.message("That interface is already an ISP path.");
                    return;
                  }
                  savePath.mutate({
                    name: iface.name,
                    type: "OTHER",
                    interfaceName: iface.name,
                    mikrotikId: mt.id,
                    status: iface.running ? "ONLINE" : "OFFLINE",
                    totalKbps: 30720,
                    perUserMaxKbps: 5120,
                    maxUsers: 25,
                  });
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wifi className="size-4 text-accent" />
            <h2 className="font-display text-lg font-semibold">ISP paths</h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => {
            setIspForm(emptyIsp);
            setIspOpen(true);
          }}>
            <Plus className="size-4" />
            Add ISP
          </Button>
        </div>
        {isps.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted">
              No ISP paths yet. Add Starlink, Airtel, Safaricom or fibre so the
              dashboard can show WAN health. TelNet still will not steer traffic.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {isps.map((isp) => (
              <Card key={isp.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-subtle">
                      {isp.type}
                    </p>
                    <h3 className="mt-1 font-display text-xl font-semibold">
                      {isp.name}
                    </h3>
                  </div>
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
                </div>
                <p className="mt-3 text-sm text-muted">
                  {isp.interfaceName ?? "WAN"}
                  {isp.latencyMs != null ? ` · ${isp.latencyMs} ms` : ""}
                </p>
                <p className="mt-2 text-sm tabular-nums text-fg">
                  {formatSpeed(isp.totalKbps)} pool · {formatSpeed(isp.perUserMaxKbps)}
                  /user · {isp.maxUsers} seats
                </p>
                <p className="mt-1 text-xs text-subtle">
                  {d ? `${d.onlineUsers} online now` : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["ONLINE", "DEGRADED", "OFFLINE"] as const).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={isp.status === s ? "accent" : "outline"}
                      onClick={() => setStatus.mutate({ id: isp.id, status: s })}
                    >
                      {s}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIspForm({
                        id: isp.id,
                        name: isp.name,
                        type: (["STARLINK", "AIRTEL", "SAFARICOM", "FIBRE", "LTE", "OTHER"].includes(
                          isp.type,
                        )
                          ? isp.type
                          : "OTHER") as typeof emptyIsp.type,
                        interfaceName: isp.interfaceName ?? "",
                        mikrotikId: isp.mikrotikId ?? "",
                        totalKbps: isp.totalKbps,
                        perUserMaxKbps: isp.perUserMaxKbps,
                        maxUsers: isp.maxUsers,
                      });
                      setIspOpen(true);
                    }}
                  >
                    Capacity
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removePath.mutate(isp.id)}
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Radio className="size-4 text-accent" />
          <h2 className="font-display text-lg font-semibold">Events</h2>
        </div>
        <ul className="space-y-4">
          {(d?.events ?? []).map((e) => (
            <li key={e.id} className="border-b border-border pb-3 last:border-0">
              <p className="text-xs uppercase tracking-wide text-subtle">
                {e.eventType.replaceAll("_", " ")} · {formatStamp(e.createdAt)}
              </p>
              <p className="mt-1 text-sm leading-relaxed">{e.description}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit MikroTik" : "Add MikroTik"}
            </DialogTitle>
            <DialogDescription>
              RouterOS 7 REST — IP → Services → www (80) or www-ssl (443). Not
              the Winbox API on 8728. Credentials stay on the server.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm font-medium">RouterOS version</p>
              <p className="text-xs text-muted">
                v7 uses REST (www). v6 uses the binary API on port 8728.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border ${
                    form.apiMode === "rest"
                      ? "border-accent bg-accent/10 text-fg"
                      : "border-border text-muted"
                  }`}
                  onClick={() =>
                    setForm({
                      ...form,
                      apiMode: "rest",
                      port: form.ssl ? 443 : 80,
                    })
                  }
                >
                  RouterOS 7 (REST)
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border ${
                    form.apiMode === "api6"
                      ? "border-accent bg-accent/10 text-fg"
                      : "border-border text-muted"
                  }`}
                  onClick={() =>
                    setForm({
                      ...form,
                      apiMode: "api6",
                      port: 8728,
                      apiPort: 8728,
                      ssl: false,
                    })
                  }
                >
                  RouterOS 6 (API 8728)
                </button>
              </div>
            </div>

            <Field label="Name">
              <Input
                required
                placeholder="Main RB750"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <Field label="Address">
                <Input
                  required
                  placeholder="192.168.88.1"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                />
              </Field>
              <Field label="REST port">
                <Input
                  required
                  type="number"
                  min={1}
                  max={65535}
                  value={form.port}
                  onChange={(e) =>
                    setForm({ ...form, port: Number(e.target.value) || 80 })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="User">
                <Input
                  required
                  value={form.apiUser}
                  onChange={(e) => setForm({ ...form, apiUser: e.target.value })}
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  autoComplete="off"
                  required={!editing}
                  placeholder={editing ? "Leave blank to keep" : ""}
                  value={form.apiPassword}
                  onChange={(e) =>
                    setForm({ ...form, apiPassword: e.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Hotspot server">
              <Input
                value={form.hotspotName}
                onChange={(e) =>
                  setForm({ ...form, hotspotName: e.target.value })
                }
              />
            </Field>
            {probe && probe.hotspotServers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {probe.hotspotServers.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-fg"
                    onClick={() => setForm({ ...form, hotspotName: name })}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">HTTPS (www-ssl)</p>
                <p className="text-xs text-muted">REST on 443 instead of 80.</p>
              </div>
              <Switch
                checked={form.ssl}
                onCheckedChange={(v) =>
                  setForm({
                    ...form,
                    ssl: v,
                    port:
                      form.port === 80 || form.port === 443 ? (v ? 443 : 80) : form.port,
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Allow self-signed TLS</p>
                <p className="text-xs text-muted">
                  Needed for most RouterOS certificates.
                </p>
              </div>
              <Switch
                checked={form.insecureTls}
                onCheckedChange={(v) => setForm({ ...form, insecureTls: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Primary router</p>
                <p className="text-xs text-muted">
                  Live activations and hotspot users are created on this router.
                </p>
              </div>
              <Switch
                checked={form.makePrimary}
                onCheckedChange={(v) => setForm({ ...form, makePrimary: v })}
              />
            </div>
            {probe && (
              <div
                className={
                  probe.ok
                    ? "rounded-lg border border-ok/20 bg-ok/10 px-3 py-2 text-sm text-ok"
                    : "rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
                }
              >
                {probe.ok
                  ? `Reachable${probe.identity ? ` · ${probe.identity}` : ""}${
                      probe.version ? ` · ${probe.version}` : ""
                    }${
                      probe.interfaces.length
                        ? ` · ${probe.interfaces.filter((i) => i.running).length} interfaces up`
                        : ""
                    }`
                  : probe.error}
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={test.isPending || !form.host || !form.apiUser}
                onClick={() => test.mutate(form)}
              >
                {test.isPending ? "Testing…" : "Test REST"}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editing ? "Save router" : "Add router"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={ispOpen} onOpenChange={setIspOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ispForm.id ? "Edit ISP path" : "Add ISP path"}</DialogTitle>
            <DialogDescription>
              Monitoring plus pool caps. MikroTik still owns failover.
              Typical 5G pack: 30 Mbps total, 5 Mbps per user, 20–30 seats.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              savePath.mutate({
                id: ispForm.id || undefined,
                name: ispForm.name,
                type: ispForm.type,
                interfaceName: ispForm.interfaceName || undefined,
                mikrotikId: ispForm.mikrotikId || undefined,
                totalKbps: ispForm.totalKbps,
                perUserMaxKbps: ispForm.perUserMaxKbps,
                maxUsers: ispForm.maxUsers,
              });
            }}
          >
            <Field label="Name">
              <Input
                required
                placeholder="Starlink"
                value={ispForm.name}
                onChange={(e) => setIspForm({ ...ispForm, name: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <select
                className="flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm"
                value={ispForm.type}
                onChange={(e) => {
                  const type = e.target.value as typeof ispForm.type;
                  const mobile = type === "AIRTEL" || type === "SAFARICOM" || type === "LTE";
                  setIspForm({
                    ...ispForm,
                    type,
                    totalKbps: mobile ? 30720 : ispForm.totalKbps,
                    maxUsers: mobile ? 25 : ispForm.maxUsers,
                  });
                }}
              >
                {["STARLINK", "AIRTEL", "SAFARICOM", "FIBRE", "LTE", "OTHER"].map(
                  (t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Router interface (optional)">
              <Input
                placeholder="ether1"
                value={ispForm.interfaceName}
                onChange={(e) =>
                  setIspForm({ ...ispForm, interfaceName: e.target.value })
                }
              />
            </Field>
            {routers.length > 0 && (
              <Field label="MikroTik">
                <select
                  className="flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm"
                  value={ispForm.mikrotikId}
                  onChange={(e) =>
                    setIspForm({ ...ispForm, mikrotikId: e.target.value })
                  }
                >
                  <option value="">Any / unassigned</option>
                  {routers.map((mt) => (
                    <option key={mt.id} value={mt.id}>
                      {mt.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Total (Mbps)">
                <Input
                  type="number"
                  min={1}
                  value={Math.round(ispForm.totalKbps / 1024)}
                  onChange={(e) =>
                    setIspForm({
                      ...ispForm,
                      totalKbps: Math.max(1, Number(e.target.value) || 1) * 1024,
                    })
                  }
                />
              </Field>
              <Field label="Per user (Mbps)">
                <Input
                  type="number"
                  min={1}
                  value={Math.round(ispForm.perUserMaxKbps / 1024)}
                  onChange={(e) =>
                    setIspForm({
                      ...ispForm,
                      perUserMaxKbps: Math.max(1, Number(e.target.value) || 1) * 1024,
                    })
                  }
                />
              </Field>
              <Field label="Max users">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={ispForm.maxUsers}
                  onChange={(e) =>
                    setIspForm({
                      ...ispForm,
                      maxUsers: Number(e.target.value) || 1,
                    })
                  }
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savePath.isPending}>
                {savePath.isPending ? "Saving…" : ispForm.id ? "Save path" : "Add path"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={scriptOpen} onOpenChange={setScriptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{scriptTitle || "Terminal script"}</DialogTitle>
            <DialogDescription>
              REST could not write the identity. Paste this into Winbox Terminal
              so the WAN still looks like a phone or PC to the ISP.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            readOnly
            className="min-h-40 font-mono text-xs"
            value={scriptText}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(scriptText);
                  toast.success("Script copied.");
                } catch {
                  toast.message("Copy from the box above.");
                }
              }}
            >
              Copy script
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RouterCard({
  mt,
  isps,
  onTest,
  onPrimary,
  onEdit,
  onRemove,
  onImportIface,
  onCamouflage,
  testing,
  promoting,
  removing,
  disguising,
}: {
  mt: MikroTik;
  isps: Isp[];
  onTest: () => void;
  onPrimary: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onImportIface: (iface: MikroTik["interfaces"][number]) => void;
  onCamouflage: (kind: CamouflageKind, iface?: string) => void;
  testing: boolean;
  promoting: boolean;
  removing: boolean;
  disguising: boolean;
}) {
  const [wan, setWan] = useState(
    mt.camouflageInterface ||
      mt.interfaces.find((i) => i.running)?.name ||
      mt.interfaces[0]?.name ||
      "",
  );
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-subtle">
            {mt.boardName ?? "RouterOS"}
            {mt.isPrimary ? " · Primary" : ""}
          </p>
          <h3 className="mt-1 font-display text-xl font-semibold">{mt.name}</h3>
          <p className="mt-1 font-mono text-xs text-muted">{mt.host}</p>
        </div>
        <Badge
          tone={
            mt.status === "ONLINE" ? "ok" : mt.status === "OFFLINE" ? "danger" : "neutral"
          }
        >
          {mt.status}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-subtle">Identity</dt>
          <dd className="mt-0.5">{mt.identity ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-subtle">Version</dt>
          <dd className="mt-0.5">{mt.version ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-subtle">Hotspot</dt>
          <dd className="mt-0.5">{mt.hotspotName} · {mt.apiMode === "api6" ? "ROS6 API" : "ROS7 REST"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-subtle">CPU</dt>
          <dd className="mt-0.5">{mt.cpuLoad == null ? "—" : `${mt.cpuLoad}%`}</dd>
        </div>
      </dl>
      {mt.interfaces.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {mt.interfaces.slice(0, 8).map((iface) => {
            const linked = isps.some((i) => i.interfaceName === iface.name);
            return (
              <li
                key={iface.name}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="font-mono text-muted">
                  {iface.name}
                  <span className="ml-2 uppercase tracking-wide text-subtle">
                    {iface.type}
                    {iface.running ? " · up" : " · down"}
                  </span>
                </span>
                {!linked && (
                  <button
                    type="button"
                    className="text-accent hover:text-fg"
                    onClick={() => onImportIface(iface)}
                  >
                    Add as ISP
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {mt.lastError && mt.status !== "ONLINE" && (
        <p className="mt-3 text-sm text-danger">{mt.lastError}</p>
      )}
      {mt.lastPingAt && (
        <p className="mt-2 text-xs text-subtle">
          Last probe {formatStamp(mt.lastPingAt)}
        </p>
      )}
      <div className="mt-4 rounded-lg border border-border p-3">
        <div className="flex items-center gap-2">
          <Smartphone className="size-4 text-accent" />
          <p className="text-sm font-medium">WAN camouflage</p>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          One click makes this MikroTik look like an iPhone, Android phone or PC
          to the ISP — identity, DHCP hostname, MAC OUI and TTL.
        </p>
        {(mt.interfaces.length > 0 || wan) && (
          <label className="mt-2 block">
            <span className="text-[10px] uppercase tracking-wide text-subtle">
              WAN interface
            </span>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-border bg-raised px-2 text-xs"
              value={wan}
              onChange={(e) => setWan(e.target.value)}
            >
              {mt.interfaces.length === 0 && wan ? (
                <option value={wan}>{wan}</option>
              ) : null}
              {mt.interfaces.map((i) => (
                <option key={i.name} value={i.name}>
                  {i.name}
                  {i.running ? " · up" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        {mt.camouflage && (
          <p className="mt-2 text-xs text-accent">
            Appearing as {CAMOUFLAGE[mt.camouflage].label}
            {mt.camouflageMac ? ` · ${mt.camouflageMac}` : ""}
            {mt.camouflageInterface ? ` on ${mt.camouflageInterface}` : ""}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(["IPHONE", "ANDROID", "PC"] as const).map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant={mt.camouflage === kind ? "accent" : "outline"}
              disabled={disguising}
              onClick={() => onCamouflage(kind, wan || undefined)}
            >
              {CAMOUFLAGE[kind].label}
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onTest} disabled={testing}>
          Test REST
        </Button>
        {!mt.isPrimary && (
          <Button size="sm" variant="accent" onClick={onPrimary} disabled={promoting}>
            Use for activations
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit}>
          Edit
        </Button>
        <Button size="sm" variant="danger" onClick={onRemove} disabled={removing}>
          Remove
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
