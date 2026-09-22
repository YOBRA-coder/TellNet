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
import { deletePackage, listPackagesAdmin, savePackage } from "@/lib/fn/admin";
import { formatDuration, formatKes, formatSpeed } from "@/lib/format";
import type { Package } from "@/lib/types";

export const Route = createFileRoute("/admin/packages")({
  component: PackagesAdminPage,
});

const empty = {
  name: "",
  price: 10,
  durationMinutes: 60,
  downloadKbps: 2048,
  uploadKbps: 1024,
  dataLimitMb: "" as number | "",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
};

function PackagesAdminPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["packages"], queryFn: () => listPackagesAdmin(),
    staleTime: 60_000, });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [form, setForm] = useState(empty);

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit package" : "New package"}</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <Field label="Name" className="sm:col-span-2">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </Field>
            <Field label="Price (KSh)">
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </Field>
            <Field label="Duration (minutes)">
              <Input
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm({ ...form, durationMinutes: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Download (kbps)">
              <Input
                type="number"
                min={64}
                value={form.downloadKbps}
                onChange={(e) =>
                  setForm({ ...form, downloadKbps: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Upload (kbps)">
              <Input
                type="number"
                min={64}
                value={form.uploadKbps}
                onChange={(e) =>
                  setForm({ ...form, uploadKbps: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Data limit MB (blank = unlimited)" className="sm:col-span-2">
              <Input
                type="number"
                min={1}
                value={form.dataLimitMb}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dataLimitMb: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </Field>
            <DialogFooter className="sm:col-span-2">
              <Button type="submit" disabled={save.isPending}>
                Save package
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
