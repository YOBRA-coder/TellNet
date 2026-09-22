import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  generateVouchersAdmin,
  listPackagesAdmin,
  listVouchersAdmin,
} from "@/lib/fn/admin";

export const Route = createFileRoute("/admin/vouchers")({
  component: VouchersPage,
});

function VouchersPage() {
  const qc = useQueryClient();
  const pkgs = useQuery({ queryKey: ["packages"], queryFn: () => listPackagesAdmin() });
  const list = useQuery({ queryKey: ["vouchers"], queryFn: () => listVouchersAdmin() });
  const [packageId, setPackageId] = useState("");
  const [count, setCount] = useState(10);
  const [batch, setBatch] = useState("");
  const [lastCodes, setLastCodes] = useState<string[]>([]);

  const gen = useMutation({
    mutationFn: () =>
      generateVouchersAdmin({
        data: {
          packageId: packageId || (pkgs.data?.[0]?.id ?? ""),
          count,
          batchLabel: batch || undefined,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        setLastCodes(res.codes);
        toast.success(`Created ${res.codes.length} vouchers`);
        qc.invalidateQueries({ queryKey: ["vouchers"] });
      } else toast.error("Could not generate vouchers");
    },
    onError: () => toast.error("Could not generate vouchers"),
  });

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
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Package
            <select
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2"
              value={packageId || pkgs.data?.[0]?.id || ""}
              onChange={(e) => setPackageId(e.target.value)}
            >
              {(pkgs.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — KES {p.price}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Count
            <Input
              type="number"
              min={1}
              max={200}
              className="mt-1"
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 1)}
            />
          </label>
          <label className="text-sm">
            Batch label
            <Input
              className="mt-1"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="Shop till 1"
            />
          </label>
        </div>
        <Button
          disabled={gen.isPending || !(packageId || pkgs.data?.[0]?.id)}
          onClick={() => gen.mutate()}
        >
          {gen.isPending ? "Generating…" : "Generate codes"}
        </Button>
        {lastCodes.length > 0 && (
          <pre className="max-h-40 overflow-auto rounded-md bg-raised p-3 text-xs">
            {lastCodes.join("\n")}
          </pre>
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-subtle">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Package</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Batch</th>
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((v) => (
              <tr key={v.id} className="border-b border-border">
                <td className="px-4 py-2 font-mono text-xs">{v.code}</td>
                <td className="px-4 py-2">{v.packageName}</td>
                <td className="px-4 py-2">{v.status}</td>
                <td className="px-4 py-2 text-muted">{v.batchLabel ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
