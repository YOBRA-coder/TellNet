import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
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
  downloadKbps: 2048,
  uploadKbps: 1024,
  dataLimitMb: "" as number | "",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  siteId: "" as string, // "" = All Sites
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
  const [editing, setEditing] = useState<Package | null>(null);
  const [form, setForm] = useState(empty);

  function siteName(id: string | null) {
    if (!id) return "All sites";
    return sites.find((s) => s.id === id)?.name ?? "Unknown site";
  }

  function startEdit(pkg?: Package) {
    if (pkg) {
      setEditing(pkg);
      setForm({
        name: pkg.name,
        price: pkg.price,
        durationMinutes: pkg.durationMinutes,
        downloadKbps: pkg.downloadKbps,
        uploadKbps: pkg.uploadKbps,
        dataLimitMb: pkg.dataLimitMb ?? "",
        status: pkg.status,
        siteId: pkg.siteId ?? "",
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
          downloadKbps: Number(form.downloadKbps),
          uploadKbps: Number(form.uploadKbps),
          dataLimitMb: form.dataLimitMb === "" ? null : Number(form.dataLimitMb),
          status: form.status,
          siteId: form.siteId || null,
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
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Badge</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((pkg) => (
              <TableRow key={pkg.id}>
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
                <TableCell className="text-sm text-muted">{siteName(pkg.siteId)}</TableCell>
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

              <Field label="Duration (minutes)">
                <Input
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationMinutes: Number(e.target.value),
                    })
                  }
                />
              </Field>

              <Field label="Download (kbps)">
                <Input
                  type="number"
                  min={64}
                  value={form.downloadKbps}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      downloadKbps: Number(e.target.value),
                    })
                  }
                />
              </Field>

              <Field label="Upload (kbps)">
                <Input
                  type="number"
                  min={64}
                  value={form.uploadKbps}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      uploadKbps: Number(e.target.value),
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

              {true && (
                <Field label="Site">
                  <select
                    className="flex h-11 w-full rounded-md border border-border bg-raised px-3 text-sm"
                    value={form.siteId}
                    onChange={(e) =>
                      setForm({ ...form, siteId: e.target.value })
                    }
                  >
                    <option value="">All sites</option>

                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

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
