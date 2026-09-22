import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
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
import { customerAction, listCustomersAdmin, listPackagesAdmin } from "@/lib/fn/admin";
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
  const selected = q.data?.find((r) => r.customer.id === openId);

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
        | "releaseDevice";
      minutes?: number;
      packageId?: string;
    }) => customerAction({ data: input }),
    onSuccess: (res, vars) => {
      if (!res.ok) toast.error(res.error);
      else
        toast.success(
          vars.action === "releaseDevice"
            ? "Device released. Another phone can connect."
            : "Updated",
        );
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["live"] });
    },
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
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).map((row) => (
              <TableRow key={row.customer.id}>
                <TableCell className="font-medium tabular-nums">
                  {formatPhoneDisplay(row.customer.phone)}
                </TableCell>
                <TableCell>{row.pack?.packageName ?? "—"}</TableCell>
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
                      {row.pack?.boundDeviceToken ? (
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
                        onClick={() =>
                          act.mutate({
                            customerId: row.customer.id,
                            action: "extend",
                            minutes: 60,
                          })
                        }
                      >
                        Extend 1 hour
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={() => setOpenId(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">
                  {formatPhoneDisplay(selected.customer.phone)}
                </SheetTitle>
              </SheetHeader>
              <dl className="mt-4 space-y-3 text-sm">
                <Row k="Status" v={selected.customer.status} />
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
                    selected.pack?.boundDeviceToken
                      ? "Bound to one device"
                      : "Not bound"
                  }
                />
              </dl>
            </>
          )}
        </SheetContent>
      </Sheet>
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
