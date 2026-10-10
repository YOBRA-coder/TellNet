import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ActivationBadge, PaymentBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { SiteSwitcher } from "@/components/admin/site-switcher";
import { Input } from "@/components/ui/input";
import { useAdminSite } from "@/hooks/use-admin-site";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listPackagesAdmin,
  listPaymentsAdmin,
  retryPaymentActivation,
  listActivationQueue,
  retryActivationAdmin,
} from "@/lib/fn/admin";
import { formatKes, formatStamp } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";

export const Route = createFileRoute("/admin/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const qc = useQueryClient();
  const queue = useQuery({
    queryKey: ["activation-queue"],
    queryFn: () => listActivationQueue(),
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  const retryAct = useMutation({
    mutationFn: (paymentId: string) =>
      retryActivationAdmin({ data: { paymentId } }),
    onSuccess: (r) => {
      if (r.ok) toast.success("Activation retried");
      else toast.error(("error" in r && r.error) || "Retry failed");
      queue.refetch();
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("ALL");
  const [activation, setActivation] = useState("ALL");
  const [packageId, setPackageId] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const [siteId] = useAdminSite();
  const pkgs = useQuery({ queryKey: ["packages"], queryFn: () => listPackagesAdmin() });
  const q = useQuery({
    queryKey: ["payments", phone, status, activation, packageId, period, siteId],
    placeholderData: (prev) => prev,
    queryFn: () =>
      listPaymentsAdmin({
        data: {
          siteId,
          phone: phone || undefined,
          status: status === "ALL" ? undefined : status,
          activationStatus: activation === "ALL" ? undefined : activation,
          packageId: packageId === "ALL" ? undefined : packageId,
          period: period === "ALL" ? "ALL" : (period as "TODAY" | "WEEK" | "MONTH"),
        },
      }),
  });

  const retry = useMutation({
    mutationFn: (paymentId: string) => retryPaymentActivation({ data: { paymentId } }),
    onSuccess: (res) => {
      if (!res.ok) toast.error(res.error);
      else toast.success("Activation retried");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const list = q.data?.rows ?? [];
  // Money = real M-Pesa only (voucher VCH- and points PTS- redemptions are free packages), as on Reports.
  const isFree = (id: string | null) => Boolean(id && (id.startsWith("VCH-") || id.startsWith("PTS-")));
  const paidRows = list.filter((p) => p.status === "SUCCESS" && !isFree(p.mpesaTransactionId));
  const total = paidRows.reduce((n, p) => n + p.amount, 0);

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const head = ["Receipt", "Phone", "Amount", "Package", "Site", "Payment", "Activation", "Date"];
    const lines = list.map((p) =>
      [p.mpesaTransactionId, p.phone, p.amount, p.packageName, p.siteName, p.status, p.activationStatus, p.createdAt].map(esc).join(","),
    );
    const blob = new Blob([[head.map(esc).join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5">
      {(queue.data?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Paid but activation failed — retry queue</p>
          <ul className="mt-2 space-y-2">
            {queue.data!.slice(0, 8).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">
                  {row.phone} · {row.package_name} · attempts {row.activation_attempts} ·{" "}
                  {row.last_activation_error || row.activation_status}
                </span>
                <Button size="sm" variant="outline" onClick={() => retryAct.mutate(row.id)}>
                  Retry now
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-muted">
            Every M-Pesa attempt is stored. Success never depends on the captive portal
            reporting back.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SiteSwitcher />
          <Button variant="outline" onClick={exportCsv} disabled={list.length === 0}>
            Export CSV
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted">
        <span className="font-medium text-fg tabular-nums">{list.length}</span> shown ·{" "}
        <span className="font-medium text-fg tabular-nums">{formatKes(total)}</span> paid by M-Pesa in this list (
        {paidRows.length})
        {q.data?.truncated ? " · only the latest 200 are shown — narrow the filters to see older ones" : ""}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Phone (07…) or M-Pesa code"
          inputMode="search"
          value={phone}
          onChange={(e) => setPhone(e.target.value.trimStart())}
        />
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger>
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All dates</SelectItem>
            <SelectItem value="TODAY">Today</SelectItem>
            <SelectItem value="WEEK">This week</SelectItem>
            <SelectItem value="MONTH">This month</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Payment status" />
          </SelectTrigger>
          <SelectContent>
            {["ALL", "PENDING", "SUCCESS", "FAILED", "CANCELLED"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={activation} onValueChange={setActivation}>
          <SelectTrigger>
            <SelectValue placeholder="Activation" />
          </SelectTrigger>
          <SelectContent>
            {["ALL", "NOT_ACTIVATED", "ACTIVATED", "ACTIVATION_FAILED", "EXPIRED"].map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Select value={packageId} onValueChange={setPackageId}>
          <SelectTrigger>
            <SelectValue placeholder="Package" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">ALL</SelectItem>
            {(pkgs.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="whitespace-nowrap">
              <TableHead>Receipt</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Activation</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted">
                  No transactions match these filters.
                </TableCell>
              </TableRow>
            )}
            {list.map((p) => (
              <TableRow key={p.id} className="whitespace-nowrap">
                <TableCell className="font-mono text-xs">
                  {p.mpesaTransactionId ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatPhoneDisplay(p.phone)}
                </TableCell>
                <TableCell className="tabular-nums">{formatKes(p.amount)}</TableCell>
                <TableCell>{p.packageName}</TableCell>
                <TableCell className="text-sm text-muted">{p.siteName}</TableCell>
                <TableCell>
                  <PaymentBadge status={p.status} />
                </TableCell>
                <TableCell>
                  <ActivationBadge status={p.activationStatus} />
                </TableCell>
                <TableCell className="text-muted">{formatStamp(p.createdAt)}</TableCell>
                <TableCell>
                  {p.status === "SUCCESS" &&
                    p.activationStatus === "ACTIVATION_FAILED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retry.mutate(p.id)}
                      >
                        Retry activation
                      </Button>
                    )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
