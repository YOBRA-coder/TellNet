import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deletePackage,
  listPackagesAdmin,
  listSites,
  savePackage,
} from "@/lib/fn/admin";
import { formatDuration, formatKes, formatSpeed } from "@/lib/format";
import type { Package, PackageBadge, PackageCategory, PackageDurationKind } from "@/lib/types";

type PackageRow = Package & { siteIds: string[] };

export const Route = createFileRoute("/admin/packages")({
  component: PackagesAdminPage,
});

const BADGE_LABEL: Record<PackageBadge, string> = {
  MOST_POPULAR: "Most Popular",
  BEST_VALUE: "Best Value",
};

const DURATION_KIND_LABEL: Record<PackageDurationKind, string> = {
  HOURLY: "Hourly",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

const empty = {
  name: "",
  price: 10,
  durationMinutes: 60,
  downloadKbps: 2,
  uploadKbps: 1,
  dataLimitMb: "" as number | "",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  siteIds: [] as string[], // [] = All sites
  badge: "" as "" | PackageBadge,
  durationKind: "HOURLY" as PackageDurationKind,
  pointsCost: "" as number | "",
  category: "STANDARD" as PackageCategory,
  maxDevices: 1 as 1 | 2,
};

function PackagesAdminPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["packages"], queryFn: () => listPackagesAdmin(),
    staleTime: 60_000, });
  const sitesQ = useQuery({ queryKey: ["sites"], queryFn: () => listSites(), staleTime: 60_000 });
  const sites = sitesQ.data ?? [];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PackageRow | null>(null);
  const [form, setForm] = useState(empty);

  // List filters (client-side: the package list is small).
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [catFilter, setCatFilter] = useState("ALL");
  const [sort, setSort] = useState("DEFAULT");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const siteLabel = (ids: string[]) =>
      ids.length === 0 ? "All sites" : ids.map((id) => sites.find((x) => x.id === id)?.name ?? "").join(", ");
    let list = ((q.data ?? []) as PackageRow[]).filter((p) => {
      if (term) {
        const hay = `${p.name} ${p.price} ${DURATION_KIND_LABEL[p.durationKind]} ${p.category} ${siteLabel(p.siteIds)}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      // "Sold at <site>": packages for every site, or ticked for that site.
      if (siteFilter !== "ALL" && !(p.siteIds.length === 0 || p.siteIds.includes(siteFilter))) return false;
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (kindFilter !== "ALL" && p.durationKind !== kindFilter) return false;
      if (catFilter !== "ALL" && p.category !== catFilter) return false;
      return true;
    });
    const by: Record<string, (a: PackageRow, b: PackageRow) => number> = {
      PRICE_ASC: (a, b) => a.price - b.price,
      PRICE_DESC: (a, b) => b.price - a.price,
      NAME: (a, b) => a.name.localeCompare(b.name),
      DURATION: (a, b) => a.durationMinutes - b.durationMinutes,
      SPEED: (a, b) => b.downloadKbps - a.downloadKbps,
      SITE: (a, b) => siteLabel(a.siteIds).localeCompare(siteLabel(b.siteIds)) || a.price - b.price,
    };
    if (by[sort]) list = [...list].sort(by[sort]);
    return list;
  }, [q.data, sites, search, siteFilter, statusFilter, kindFilter, catFilter, sort]);
  const filtersOn = Boolean(search) || [siteFilter, statusFilter, kindFilter, catFilter].some((v) => v !== "ALL") || sort !== "DEFAULT";

  function siteNames(ids: string[]) {
    if (ids.length === 0) return "All sites";
    return ids.map((id) => sites.find((s) => s.id === id)?.name ?? "Unknown site").join(", ");
  }

  function toggleSite(id: string) {
    setForm((f) => ({
      ...f,
      siteIds: f.siteIds.includes(id) ? f.siteIds.filter((x) => x !== id) : [...f.siteIds, id],
    }));
  }

  function startEdit(pkg?: PackageRow) {
    if (pkg) {
      setEditing(pkg);
      setForm({
        name: pkg.name,
        price: pkg.price,
        durationMinutes: pkg.durationMinutes,
        downloadKbps: pkg.downloadKbps / 1024,
        uploadKbps: pkg.uploadKbps / 1024,
        dataLimitMb: pkg.dataLimitMb ?? "",
        status: pkg.status,
        siteIds: pkg.siteIds ?? (pkg.siteId ? [pkg.siteId] : []),
        badge: pkg.badge ?? "",
        durationKind: pkg.durationKind,
        pointsCost: pkg.pointsCost ?? "",
        category: pkg.category,
        maxDevices: pkg.maxDevices >= 2 ? 2 : 1,
      });
    } else {
      setEditing(null);
      setForm(empty);
    }
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      savePackage({
        data: {
          id: editing?.id,
          name: form.name,
          price: Number(form.price),
          durationMinutes: Number(form.durationMinutes),
          downloadKbps: Number(form.downloadKbps) * 1024,
          uploadKbps: Number(form.uploadKbps) * 1024,
          dataLimitMb: form.dataLimitMb === "" ? null : Number(form.dataLimitMb),
          status: form.status,
          siteIds: form.siteIds,
          siteId: form.siteIds[0] ?? null,
          badge: form.badge || null,
          durationKind: form.durationKind,
          pointsCost: form.pointsCost === "" ? null : Number(form.pointsCost),
          category: form.category,
          maxDevices: form.maxDevices,
        },
      }),
    onSuccess: () => {
      toast.success("Package saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["packages"] });
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => deletePackage({ data: { id } }),
    onSuccess: () => {
      toast.success("Package deactivated");
      qc.invalidateQueries({ queryKey: ["packages"] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Packages
          </h1>
          <p className="mt-1 text-sm text-muted">
            Price, duration and speed are independent of which ISP is carrying traffic.
          </p>
        </div>
        <Button onClick={() => startEdit()}>New package</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Input
          className="lg:col-span-2"
          placeholder="Search name, price, site…"
          inputMode="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Site" className="h-11 rounded-md border border-border bg-raised px-3 text-sm" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="ALL">All sites</option>
          {sites.map((x) => (
            <option key={x.id} value={x.id}>Sold at {x.name}</option>
          ))}
        </select>
        <select aria-label="Status" className="h-11 rounded-md border border-border bg-raised px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select aria-label="Duration kind" className="h-11 rounded-md border border-border bg-raised px-3 text-sm" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
          <option value="ALL">Any kind</option>
          {(Object.keys(DURATION_KIND_LABEL) as PackageDurationKind[]).map((k) => (
            <option key={k} value={k}>{DURATION_KIND_LABEL[k]}</option>
          ))}
        </select>
        <select aria-label="Category" className="h-11 rounded-md border border-border bg-raised px-3 text-sm" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="ALL">Any category</option>
          <option value="STANDARD">Standard</option>
          <option value="STUDENT">Student</option>
        </select>
        <select aria-label="Sort by" className="h-11 rounded-md border border-border bg-raised px-3 text-sm sm:col-span-2 lg:col-span-1" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="DEFAULT">Sort: default</option>
          <option value="SITE">Sort: by site</option>
          <option value="PRICE_ASC">Price: low → high</option>
          <option value="PRICE_DESC">Price: high → low</option>
          <option value="NAME">Name A–Z</option>
          <option value="DURATION">Shortest duration</option>
          <option value="SPEED">Fastest first</option>
        </select>
        <div className="flex items-center gap-3 text-sm text-muted sm:col-span-2 lg:col-span-5">
          <span>Showing {rows.length} of {(q.data ?? []).length}</span>
          {filtersOn && (
            <button
              type="button"
              className="text-accent underline"
              onClick={() => {
                setSearch(""); setSiteFilter("ALL"); setStatusFilter("ALL"); setKindFilter("ALL"); setCatFilter("ALL"); setSort("DEFAULT");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="whitespace-nowrap">
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Sites</TableHead>
              <TableHead>Badge</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="py-10 text-center text-muted">
                  No packages match these filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map((pkg) => (
              <TableRow key={pkg.id} className="whitespace-nowrap">
                <TableCell className="font-medium">{pkg.name}</TableCell>
                <TableCell className="tabular-nums">{formatKes(pkg.price)}</TableCell>
                <TableCell>{formatDuration(pkg.durationMinutes)}</TableCell>
                <TableCell>
                  {formatSpeed(pkg.downloadKbps)} down · {formatSpeed(pkg.uploadKbps)} up
                </TableCell>
                <TableCell>{pkg.dataLimitMb ? `${pkg.dataLimitMb} MB` : "Unlimited"}</TableCell>
                <TableCell className="text-sm text-muted">
                  {DURATION_KIND_LABEL[pkg.durationKind]}
                </TableCell>
                <TableCell>
                  {pkg.category === "STUDENT" ? (
                    <Badge tone="ok">Student</Badge>
                  ) : (
                    <span className="text-sm text-subtle">Standard</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted">
                  {pkg.maxDevices > 1 ? `Up to ${pkg.maxDevices}` : "1 device"}
                </TableCell>
                <TableCell className="text-sm text-muted">
                  {pkg.pointsCost ? `${pkg.pointsCost} pts` : "—"}
                </TableCell>
                <TableCell className="max-w-[16rem] truncate text-sm text-muted" title={siteNames(pkg.siteIds)}>
                  {siteNames(pkg.siteIds)}
                </TableCell>
                <TableCell>
                  {pkg.badge ? (
                    <Badge tone="accent">{BADGE_LABEL[pkg.badge]}</Badge>
                  ) : (
                    <span className="text-sm text-subtle">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge tone={pkg.status === "ACTIVE" ? "ok" : "neutral"}>
                    {pkg.status}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(pkg)}>
                    Edit
                  </Button>
                  {pkg.status === "ACTIVE" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deactivate.mutate(pkg.id)}
                    >
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl"
        >
          {/* Fixed header - always visible */}
          <DialogHeader className="shrink-0 border-b border-border pb-4">
            <DialogTitle>
              {editing ? "Edit package" : "New package"}
            </DialogTitle>
          </DialogHeader>

          {/* Scrollable form area */}
          <form
            className="min-h-0 flex-1 overflow-y-auto py-4 pr-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!(Number(form.durationMinutes) >= 1)) {
                toast.error("Set a duration of at least 1 minute.");
                return;
              }
              save.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" className="sm:col-span-2">
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />
              </Field>

              <Field label="Price (KSh)">
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: Number(e.target.value) })
                  }
                />
              </Field>

              <Field label="Duration">
                <DurationInput
                  minutes={form.durationMinutes}
                  onChange={(m) => setForm({ ...form, durationMinutes: m })}
                />
              </Field>
{/* Update Download Field */}
<Field label="Download (Mbps)">
  <Input
    type="number"
    step="any" // Allows decimal points like 1.5 Mbps or 2.5 Mbps
    min={0.1}
    value={form.downloadKbps}
    onChange={(e) =>
      setForm({
        ...form,
        downloadKbps: e.target.value === "" ? 0 : Number(e.target.value),
      })
    }
  />
</Field>

{/* Update Upload Field */}
<Field label="Upload (Mbps)">
  <Input
    type="number"
    step="any"
    min={0.1}
    value={form.uploadKbps}
    onChange={(e) =>
      setForm({
        ...form,
        uploadKbps: e.target.value === "" ? 0 : Number(e.target.value),
      })
    }
  />
</Field>

              <Field
                label="Data limit MB (blank = unlimited)"
                className="sm:col-span-2"
              >
                <Input
                  type="number"
                  min={1}
                  value={form.dataLimitMb}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      dataLimitMb:
                        e.target.value === ""
                          ? ""
                          : Number(e.target.value),
                    })
                  }
                />
              </Field>

              <Field label="Duration kind (controls auto-resume eligibility)">
                <select
                  className="flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm"
                  value={form.durationKind}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationKind: e.target.value as PackageDurationKind,
                    })
                  }
                >
                  {(
                    Object.keys(
                      DURATION_KIND_LABEL
                    ) as PackageDurationKind[]
                  ).map((k) => (
                    <option key={k} value={k}>
                      {DURATION_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-xs text-subtle">
                  After a router recovers from an outage, only Weekly,
                  Monthly and Voucher-redeemed packages resume automatically.
                </p>
              </Field>

              <Field label="Sites where this package is sold" className="sm:col-span-2">
                <div className="space-y-2 rounded-md border border-border bg-raised p-3">
                  <label className="flex min-h-[32px] cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--accent,#5eead4)]"
                      checked={form.siteIds.length === 0}
                      onChange={() => setForm({ ...form, siteIds: [] })}
                    />
                    All sites
                  </label>
                  <div className="grid gap-1.5 border-t border-border pt-2 sm:grid-cols-2">
                    {sites.map((site) => (
                      <label
                        key={site.id}
                        className="flex min-h-[32px] cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--accent,#5eead4)]"
                          checked={form.siteIds.includes(site.id)}
                          onChange={() => toggleSite(site.id)}
                        />
                        {site.name}
                      </label>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {form.siteIds.length === 0
                    ? "Shown on every site's portal."
                    : `Shown only on: ${siteNames(form.siteIds)}. Tick several sites to sell it at all of them.`}
                </p>
              </Field>

              <Field label="Category">
                <select
                  className="flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value as PackageCategory,
                    })
                  }
                >
                  <option value="STANDARD">Standard</option>
                  <option value="STUDENT">
                    Student (cheap, longer, capped speed, domain filter)
                  </option>
                </select>
              </Field>

              <Field label="Devices allowed">
                <select
                  className="flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm"
                  value={form.maxDevices}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      maxDevices:
                        Number(e.target.value) === 2 ? 2 : 1,
                    })
                  }
                >
                  <option value={1}>1 device</option>
                  <option value={2}>2 devices</option>
                </select>

                <p className="mt-1 text-xs text-subtle">
                  How many devices can share a single purchase of this
                  package (subject to "Device sharing" being enabled in
                  Settings).
                </p>
              </Field>

              <Field label="Badge (optional)">
                <select
                  className="flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm"
                  value={form.badge}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      badge: e.target.value as typeof form.badge,
                    })
                  }
                >
                  <option value="">None</option>
                  <option value="MOST_POPULAR">Most Popular</option>
                  <option value="BEST_VALUE">Best Value</option>
                </select>
              </Field>

              <Field label="Points cost (leave blank = not redeemable with points)">
                <Input
                  type="number"
                  min={1}
                  value={form.pointsCost}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      pointsCost:
                        e.target.value === ""
                          ? ""
                          : Number(e.target.value),
                    })
                  }
                />
              </Field>
            </div>

            {/* Always accessible save button */}
            <DialogFooter className="sticky bottom-0 mt-6 border-t border-border bg-background pt-4">
              <Button
                type="submit"
                disabled={save.isPending}
                className="w-full sm:w-auto"
              >
                {save.isPending ? "Saving..." : "Save package"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}

/** Duration as days / hours / minutes (stored as total minutes). */
function DurationInput({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const total = Math.max(0, Math.floor(Number(minutes) || 0));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const set = (d: number, h: number, m: number) =>
    onChange(Math.max(0, d) * 1440 + Math.max(0, h) * 60 + Math.max(0, m));
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const box = "flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm";
  const presets: [string, number][] = [
    ["30 min", 30],
    ["1 hr", 60],
    ["3 hrs", 180],
    ["1 day", 1440],
    ["1 week", 10080],
    ["1 month", 43200],
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs text-subtle">
          Days
          <input type="number" inputMode="numeric" min={0} className={box + " mt-1"} value={days}
            onChange={(e) => set(num(e.target.value), hours, mins)} />
        </label>
        <label className="text-xs text-subtle">
          Hours
          <input type="number" inputMode="numeric" min={0} max={23} className={box + " mt-1"} value={hours}
            onChange={(e) => set(days, num(e.target.value), mins)} />
        </label>
        <label className="text-xs text-subtle">
          Minutes
          <input type="number" inputMode="numeric" min={0} max={59} className={box + " mt-1"} value={mins}
            onChange={(e) => set(days, hours, num(e.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map(([label, m]) => (
          <button
            key={label}
            type="button"
            onClick={() => onChange(m)}
            className={`rounded-full border px-2.5 py-1 text-xs ${
              total === m ? "border-accent text-fg" : "border-border text-muted hover:border-accent/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-subtle">
        {total < 1
          ? "Enter at least 1 minute."
          : `= ${String(days).padStart(2, "0")} days ${String(hours).padStart(2, "0")} hrs ${String(mins).padStart(2, "0")} mins (${total.toLocaleString()} minutes)`}
      </p>
    </div>
  );
}
