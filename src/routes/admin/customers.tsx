import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ActivationBadge, SessionBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  customerAction,
  getCustomerHistoryAdmin,
  listCustomersAdmin,
  listPackagesAdmin,
} from "@/lib/fn/admin";
import { formatKes, formatRemaining, formatStamp } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customers"], queryFn: () => listCustomersAdmin() });
  const pkgs = useQuery({ queryKey: ["packages"], queryFn: () => listPackagesAdmin() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // "Extend time" dialog: which customer, and the hours/minutes typed in.
  const [extendFor, setExtendFor] = useState<{ id: string; phone: string } | null>(null);
  const [extHours, setExtHours] = useState("1");
  const [extMins, setExtMins] = useState("0");
  const extendTotal =
    Math.max(0, Math.floor(Number(extHours) || 0)) * 60 +
    Math.max(0, Math.floor(Number(extMins) || 0));
  const openExtend = (id: string, phone: string) => {
    setExtHours("1");
    setExtMins("0");
    setExtendFor({ id, phone });
  };
  const selected = q.data?.find((r) => r.customer.id === openId);

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    // Any format works: 07…, 7…, 254… or +254… (leading 0/254 is ignored).
    const core = (v: string) => {
      const d = v.replace(/\D/g, "");
      return d.startsWith("254") ? d.slice(3) : d.startsWith("0") ? d.slice(1) : d;
    };
    const needle = core(search);
    if (!needle) return rows;
    return rows.filter((r) => core(r.customer.phone).includes(needle));
  }, [q.data, search]);

  const history = useQuery({
    queryKey: ["customer-history", openId],
    queryFn: () => getCustomerHistoryAdmin({ data: { customerId: openId! } }),
    enabled: Boolean(openId),
  });

  const act = useMutation({
    mutationFn: (input: {
      customerId: string;
      action:
        | "disconnect"
        | "block"
        | "unblock"
        | "extend"
        | "changePackage"
        | "retry"
        | "releaseDevice"
        | "resetPin"
        | "delete";
      minutes?: number;
      packageId?: string;
    }) => customerAction({ data: input }),
    onSuccess: (res, vars) => {
      if (!res.ok) toast.error(res.error);
      else if (vars.action === "resetPin" && "pin" in res) {
        toast.success(res.message, { duration: 30_000 });
      } else toast.success("message" in res && res.message ? res.message : "Updated");
      if (res.ok && vars.action === "delete") setOpenId(null);
      if (res.ok && vars.action === "extend") setExtendFor(null);
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-history"] });
      qc.invalidateQueries({ queryKey: ["live"] });
    },
    onError: () => toast.error("That action failed. Please try again."),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Customers
        </h1>
        <p className="mt-1 text-sm text-muted">
          Disconnect, block, extend, release a bound device or retry activation
          without touching the ISP.
        </p>
      </div>
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search phone number…"
          className="pl-9"
        />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Packages bought</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted">
                  No customer matches "{search}".
                </TableCell>
              </TableRow>
            ) : null}
            {filtered.map((row) => (
              <TableRow key={row.customer.id}>
                <TableCell className="font-medium tabular-nums">
                  {formatPhoneDisplay(row.customer.phone)}
                </TableCell>
                <TableCell>
                  {row.pack?.packageName ?? "—"}
                  {row.pack?.lastResumedAt ? (
                    <span
                      title={`Auto-resumed ${formatStamp(row.pack.lastResumedAt)}`}
                      className="ml-1.5 rounded-full bg-ok/15 px-1.5 py-0.5 text-[10px] font-medium text-ok"
                    >
                      Resumed
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.packageCount}
                  {row.queuedCount > 0 ? (
                    <span className="ml-1.5 rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] font-medium text-warn">
                      {row.queuedCount} queued
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="tabular-nums">{row.deviceCount}</TableCell>
                <TableCell>
                  {row.paymentAmount != null ? formatKes(row.paymentAmount) : "—"}
                </TableCell>
                <TableCell className="text-muted">
                  {row.pack ? formatStamp(row.pack.startTime) : "—"}
                </TableCell>
                <TableCell className="text-muted">
                  {row.pack ? formatRemaining(row.pack.expiryTime) : "—"}
                </TableCell>
                <TableCell>
                  {row.customer.status === "BLOCKED" ? (
                    <Badge tone="danger">Blocked</Badge>
                  ) : row.pack ? (
                    <ActivationBadge status={row.pack.activationStatus} />
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <SessionBadge status={row.connectionStatus} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Actions">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setOpenId(row.customer.id)}>
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          act.mutate({
                            customerId: row.customer.id,
                            action: "disconnect",
                          })
                        }
                      >
                        Disconnect
                      </DropdownMenuItem>
                      {row.pack && row.pack.boundDeviceCount > 0 ? (
                        <DropdownMenuItem
                          onClick={() =>
                            act.mutate({
                              customerId: row.customer.id,
                              action: "releaseDevice",
                            })
                          }
                        >
                          Release device
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        onClick={() =>
                          act.mutate({
                            customerId: row.customer.id,
                            action: "retry",
                          })
                        }
                      >
                        Retry activation
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openExtend(row.customer.id, row.customer.phone)}
                      >
                        Extend time…
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (
                            window.confirm(
                              `Reset the PIN for ${formatPhoneDisplay(row.customer.phone)}? A new PIN is shown once for you to give them.`,
                            )
                          ) {
                            act.mutate({ customerId: row.customer.id, action: "resetPin" });
                          }
                        }}
                      >
                        Reset PIN / password
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {row.customer.status === "BLOCKED" ? (
                        <DropdownMenuItem
                          onClick={() =>
                            act.mutate({
                              customerId: row.customer.id,
                              action: "unblock",
                            })
                          }
                        >
                          Unblock
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() =>
                            act.mutate({
                              customerId: row.customer.id,
                              action: "block",
                            })
                          }
                        >
                          Block
                        </DropdownMenuItem>
                      )}
                      {(pkgs.data ?? [])
                        .filter((p) => p.status === "ACTIVE")
                        .map((p) => (
                          <DropdownMenuItem
                            key={p.id}
                            onClick={() =>
                              act.mutate({
                                customerId: row.customer.id,
                                action: "changePackage",
                                packageId: p.id,
                              })
                            }
                          >
                            Change to {p.name}
                          </DropdownMenuItem>
                        ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-danger focus:text-danger"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete all data for ${formatPhoneDisplay(row.customer.phone)}? This scrubs their phone number and can't be undone.`,
                            )
                          ) {
                            act.mutate({
                              customerId: row.customer.id,
                              action: "delete",
                            });
                          }
                        }}
                      >
                        Delete customer data
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={() => setOpenId(null)}>
        <SheetContent className="pb-10">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">
                  {formatPhoneDisplay(selected.customer.phone)}
                </SheetTitle>
              </SheetHeader>
              <dl className="mt-4 space-y-3 text-sm">
                <Row k="Status" v={selected.customer.status} />
                {history.data ? (
                  <Row
                    k="Account"
                    v={history.data.registered ? "Registered (PIN set)" : "Guest (no account)"}
                  />
                ) : null}
                <Row k="Package" v={selected.pack?.packageName ?? "—"} />
                <Row
                  k="Activation"
                  v={selected.pack?.activationStatus ?? "—"}
                />
                <Row
                  k="Receipt"
                  v={selected.mpesaTransactionId ?? "—"}
                />
                <Row
                  k="Expires"
                  v={selected.pack ? formatStamp(selected.pack.expiryTime) : "—"}
                />
                <Row k="Connection" v={selected.connectionStatus} />
                <Row
                  k="Device"
                  v={
                    selected.pack && selected.pack.boundDeviceCount > 0
                      ? `Bound to ${selected.pack.boundDeviceCount} device${selected.pack.boundDeviceCount === 1 ? "" : "s"}`
                      : "Not bound"
                  }
                />
                {history.data ? (
                  <>
                    <Row k="Referral code" v={history.data.referralCode ?? "—"} />
                    <Row k="Referred signups" v={String(history.data.referralCount)} />
                    <Row k="Loyalty points" v={String(history.data.loyaltyPoints)} />
                    <Row
                      k="Banked bonus minutes"
                      v={String(history.data.bonusMinutesBalance)}
                    />
                  </>
                ) : null}
              </dl>

              <div className="mt-6">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-subtle">
                  All packages ({history.data?.packages.length ?? 0})
                </h3>
                {!history.data || history.data.packages.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No packages yet.</p>
                ) : (
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {history.data.packages.map((pk) => (
                      <div
                        key={pk.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{pk.packageName}</p>
                          <p className="text-xs text-subtle">
                            {formatStamp(pk.startTime)} → {formatStamp(pk.expiryTime)}
                          </p>
                        </div>
                        <Badge
                          tone={
                            pk.status === "ACTIVE"
                              ? "ok"
                              : pk.status === "QUEUED"
                                ? "warn"
                                : "neutral"
                          }
                        >
                          {pk.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-subtle">
                  Purchase history
                </h3>
                {history.isLoading ? (
                  <p className="mt-2 text-sm text-muted">Loading…</p>
                ) : !history.data || history.data.payments.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No payments yet.</p>
                ) : (
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {history.data.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{p.packageName}</p>
                          <p className="text-xs text-subtle">
                            {formatStamp(p.createdAt)} · {p.status}
                          </p>
                        </div>
                        <p className="tabular-nums">{formatKes(p.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-subtle">
                  Session history
                </h3>
                {!history.data || history.data.sessions.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No sessions yet.</p>
                ) : (
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {history.data.sessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {formatStamp(s.sessionStart)}
                          </p>
                          <p className="max-w-[220px] truncate text-xs text-subtle">
                            {s.deviceInformation ?? "Unknown device"}
                          </p>
                        </div>
                        <Badge tone={s.status === "ACTIVE" ? "ok" : "neutral"}>
                          {s.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(extendFor)} onOpenChange={(o) => !o && setExtendFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Extend time</DialogTitle>
            <DialogDescription>
              Add time to {extendFor ? formatPhoneDisplay(extendFor.phone) : "this customer"}'s
              current package. Anything queued behind it moves back by the same amount.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!extendFor) return;
              if (extendTotal < 1) return void toast.error("Enter at least 1 minute.");
              if (extendTotal > 525_600) return void toast.error("That's more than a year — use a smaller amount.");
              act.mutate({ customerId: extendFor.id, action: "extend", minutes: extendTotal });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ext-h">Hours</Label>
                <Input
                  id="ext-h"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={8760}
                  value={extHours}
                  onChange={(e) => setExtHours(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ext-m">Minutes</Label>
                <Input
                  id="ext-m"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  value={extMins}
                  onChange={(e) => setExtMins(e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["30 min", 0, 30],
                ["1 hr", 1, 0],
                ["3 hrs", 3, 0],
                ["1 day", 24, 0],
              ].map(([label, h, m]) => (
                <Button
                  key={String(label)}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setExtHours(String(h));
                    setExtMins(String(m));
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-sm text-muted">
              Adding{" "}
              <span className="font-medium text-fg">
                {String(Math.floor(extendTotal / 60)).padStart(2, "0")} hrs{" "}
                {String(extendTotal % 60).padStart(2, "0")} mins
              </span>
            </p>
            <Button type="submit" className="w-full" disabled={act.isPending || extendTotal < 1}>
              {act.isPending ? "Extending…" : "Extend"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2">
      <dt className="text-subtle">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
