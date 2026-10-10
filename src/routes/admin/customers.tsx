import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MoreHorizontal, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
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
import { formatBytes, formatDuration, formatKes, formatRemaining, formatStamp } from "@/lib/format";
import { HARDWARE_LABELS } from "@/lib/hardware";
import { formatPhoneDisplay, parsePhoneSearch, phoneMatchesSearch } from "@/lib/phone";
import { SiteSwitcher } from "@/components/admin/site-switcher";
import { ALL_SITES, useAdminSite } from "@/hooks/use-admin-site";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
});

const PAGE_SIZE = 50;

const selectCls = "h-10 w-full rounded-md border border-border bg-raised px-3 text-sm";

function CustomersPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["customers"], queryFn: () => listCustomersAdmin() });
  const pkgs = useQuery({ queryKey: ["packages"], queryFn: () => listPackagesAdmin() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [siteId] = useAdminSite();
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("ALL");
  const [connF, setConnF] = useState("ALL");
  const [pkgF, setPkgF] = useState("ALL");
  const [acctF, setAcctF] = useState("ALL");
  const [joinedF, setJoinedF] = useState("ALL");
  const [sortBy, setSortBy] = useState("NEWEST");
  const [page, setPage] = useState(0);
  // "Extend time" dialog: which customer, and the hours/minutes typed in.
  const [extendFor, setExtendFor] = useState<{ id: string; phone: string } | null>(null);
  const [extHours, setExtHours] = useState("1");
  const [extMins, setExtMins] = useState("0");
  const extendTotal =
    Math.max(0, Math.floor(Number(extHours) || 0)) * 60 +
    Math.max(0, Math.floor(Number(extMins) || 0));
  // "Reset PIN" dialog: the operator can type the PIN/password the customer wants.
  const [pinFor, setPinFor] = useState<{ id: string; phone: string } | null>(null);
  const [pinValue, setPinValue] = useState("");
  const openExtend = (id: string, phone: string) => {
    setExtHours("1");
    setExtMins("0");
    setExtendFor({ id, phone });
  };
  const selected = q.data?.find((r) => r.customer.id === openId);

  const filtersActive =
    search.trim() !== "" ||
    statusF !== "ALL" ||
    connF !== "ALL" ||
    pkgF !== "ALL" ||
    acctF !== "ALL" ||
    joinedF !== "ALL";
  const clearFilters = () => {
    setSearch("");
    setStatusF("ALL");
    setConnF("ALL");
    setPkgF("ALL");
    setAcctF("ALL");
    setJoinedF("ALL");
    setPage(0);
  };

  const inSite = useMemo(
    () => (q.data ?? []).filter((r) => siteId === ALL_SITES || r.siteId === siteId),
    [q.data, siteId],
  );

  const filtered = useMemo(() => {
    const now = Date.now();
    const find = parsePhoneSearch(search);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const joinedSince =
      joinedF === "TODAY"
        ? startOfToday.getTime()
        : joinedF === "7D"
          ? now - 7 * 86_400_000
          : joinedF === "30D"
            ? now - 30 * 86_400_000
            : null;

    const rows = inSite.filter((r) => {
      // Search: 07… / 7… / 254… phone (07… matches numbers STARTING with 07),
      // or an M-Pesa receipt code when it contains letters.
      if (find.kind === "text") {
        if (!(r.mpesaTransactionId ?? "").toUpperCase().includes(find.text)) return false;
      } else if (!phoneMatchesSearch(r.customer.phone, find)) {
        return false;
      }

      const expiry = r.pack ? new Date(r.pack.expiryTime).getTime() : 0;
      const running = Boolean(r.pack && r.pack.status === "ACTIVE" && expiry > now);
      if (statusF === "BLOCKED" && r.customer.status !== "BLOCKED") return false;
      if (statusF === "ACTIVE" && !running) return false;
      if (statusF === "QUEUED" && r.queuedCount === 0) return false;
      if (statusF === "EXPIRED" && !(r.pack && !running && r.queuedCount === 0)) return false;
      if (statusF === "AWAITING" && r.pack?.activationStatus !== "ACTIVATION_FAILED") return false;
      if (statusF === "NONE" && r.pack) return false;

      if (connF === "ONLINE" && r.connectionStatus !== "ACTIVE") return false;
      if (connF === "OFFLINE" && r.connectionStatus === "ACTIVE") return false;
      if (pkgF !== "ALL" && r.pack?.packageId !== pkgF) return false;
      if (acctF === "REGISTERED" && !r.registered) return false;
      if (acctF === "GUEST" && r.registered) return false;
      if (joinedSince != null && new Date(r.customer.createdAt).getTime() < joinedSince) return false;
      return true;
    });

    if (sortBy === "EXPIRING") {
      const key = (r: (typeof rows)[number]) => {
        const t = r.pack ? new Date(r.pack.expiryTime).getTime() : Number.POSITIVE_INFINITY;
        return t > now ? t : Number.POSITIVE_INFINITY; // running packages first, soonest expiry on top
      };
      rows.sort((a, b) => key(a) - key(b));
    } else if (sortBy === "PACKAGES") {
      rows.sort((a, b) => b.packageCount - a.packageCount);
    } else if (sortBy === "PHONE") {
      rows.sort((a, b) => a.customer.phone.localeCompare(b.customer.phone));
    }
    return rows;
  }, [inSite, search, statusF, connF, pkgF, acctF, joinedF, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

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
      pin?: string;
    }) => customerAction({ data: input }),
    onSuccess: (res, vars) => {
      if (!res.ok) toast.error(res.error);
      else if (vars.action === "resetPin" && "pin" in res) {
        toast.success(res.message, { duration: 30_000 });
      } else toast.success("message" in res && res.message ? res.message : "Updated");
      if (res.ok && vars.action === "delete") setOpenId(null);
      if (res.ok && vars.action === "extend") setExtendFor(null);
      if (res.ok && vars.action === "resetPin") {
        setPinFor(null);
        setPinValue("");
      }
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customer-history"] });
      qc.invalidateQueries({ queryKey: ["live"] });
    },
    onError: () => toast.error("That action failed. Please try again."),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Customers
          </h1>
          <p className="mt-1 text-sm text-muted">
            Disconnect, block, extend, release a bound device or retry activation
            without touching the ISP.
          </p>
        </div>
        <SiteSwitcher />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search phone (07…) or M-Pesa code…"
            className="pl-9"
            inputMode="search"
          />
        </div>
        <select
          aria-label="Status"
          className={selectCls}
          value={statusF}
          onChange={(e) => {
            setStatusF(e.target.value);
            setPage(0);
          }}
        >
          <option value="ALL">Any status</option>
          <option value="ACTIVE">Active package</option>
          <option value="QUEUED">Has queued package</option>
          <option value="EXPIRED">Expired</option>
          <option value="AWAITING">Awaiting activation</option>
          <option value="NONE">No package yet</option>
          <option value="BLOCKED">Blocked</option>
        </select>
        <select
          aria-label="Connection"
          className={selectCls}
          value={connF}
          onChange={(e) => {
            setConnF(e.target.value);
            setPage(0);
          }}
        >
          <option value="ALL">Online or offline</option>
          <option value="ONLINE">Online now</option>
          <option value="OFFLINE">Offline</option>
        </select>
        <select
          aria-label="Package"
          className={selectCls}
          value={pkgF}
          onChange={(e) => {
            setPkgF(e.target.value);
            setPage(0);
          }}
        >
          <option value="ALL">Any package</option>
          {(pkgs.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.status === "INACTIVE" ? " (inactive)" : ""}
            </option>
          ))}
        </select>
        <select
          aria-label="Account"
          className={selectCls}
          value={acctF}
          onChange={(e) => {
            setAcctF(e.target.value);
            setPage(0);
          }}
        >
          <option value="ALL">Guests and members</option>
          <option value="REGISTERED">Members (have an account)</option>
          <option value="GUEST">Guests (no account)</option>
        </select>
        <select
          aria-label="Joined"
          className={selectCls}
          value={joinedF}
          onChange={(e) => {
            setJoinedF(e.target.value);
            setPage(0);
          }}
        >
          <option value="ALL">Joined any time</option>
          <option value="TODAY">Joined today</option>
          <option value="7D">Joined last 7 days</option>
          <option value="30D">Joined last 30 days</option>
        </select>
        <select
          aria-label="Sort"
          className={selectCls}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="NEWEST">Newest first</option>
          <option value="EXPIRING">Expiring soonest</option>
          <option value="PACKAGES">Most packages bought</option>
          <option value="PHONE">Phone number</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>
          Showing {filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–
          {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          {filtered.length !== inSite.length ? ` (${inSite.length} total)` : " customers"}
        </span>
        {filtersActive ? (
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow  className="whitespace-nowrap">
              <TableHead>Phone</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Packages bought</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Connection</TableHead>
              <TableHead className="sticky right-0 bg-surface" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-muted">
                  {filtersActive ? "No customer matches these filters." : "No customers yet."}
                </TableCell>
              </TableRow>
            ) : null}
            {visibleRows.map((row) => (
              <TableRow key={row.customer.id}  className="whitespace-nowrap">
                <TableCell className="font-medium tabular-nums">
                  <button
                    type="button"
                    className="min-h-10 text-left underline-offset-2 hover:underline"
                    aria-label={`View history for ${formatPhoneDisplay(row.customer.phone)}`}
                    onClick={() => setOpenId(row.customer.id)}
                  >
                    {formatPhoneDisplay(row.customer.phone)}
                  </button>
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
                <TableCell className="sticky right-0 bg-surface shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]">
                  <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => setOpenId(row.customer.id)}
                  >
                    View
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-10" aria-label="Actions">
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
                          setPinValue("");
                          setPinFor({ id: row.customer.id, phone: row.customer.phone });
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
          >
            Previous
          </Button>
          <span className="tabular-nums text-muted">
            Page {safePage + 1} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

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

              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  className="h-11"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ customerId: selected.customer.id, action: "disconnect" })}
                >
                  Disconnect
                </Button>
                <Button
                  variant="secondary"
                  className="h-11"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ customerId: selected.customer.id, action: "retry" })}
                >
                  Retry activation
                </Button>
                <Button
                  variant="secondary"
                  className="h-11"
                  disabled={act.isPending}
                  onClick={() => {
                    const c = selected.customer;
                    setOpenId(null);
                    openExtend(c.id, c.phone);
                  }}
                >
                  Extend time…
                </Button>
                <Button
                  variant="secondary"
                  className="h-11"
                  disabled={act.isPending}
                  onClick={() => {
                    const c = selected.customer;
                    setOpenId(null);
                    setPinValue("");
                    setPinFor({ id: c.id, phone: c.phone });
                  }}
                >
                  Reset PIN
                </Button>
                {selected.pack && selected.pack.boundDeviceCount > 0 ? (
                  <Button
                    variant="outline"
                    className="h-11"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ customerId: selected.customer.id, action: "releaseDevice" })}
                  >
                    Release device
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="h-11"
                  disabled={act.isPending}
                  onClick={() =>
                    act.mutate({
                      customerId: selected.customer.id,
                      action: selected.customer.status === "BLOCKED" ? "unblock" : "block",
                    })
                  }
                >
                  {selected.customer.status === "BLOCKED" ? "Unblock" : "Block"}
                </Button>
              </div>

              {history.isError ? (
                <div className="mt-6 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
                  Could not load this customer's history.{" "}
                  <button type="button" className="underline" onClick={() => history.refetch()}>
                    Try again
                  </button>
                </div>
              ) : null}

              {history.data && history.data.hardwareDevices.length > 0 ? (
                <HistoryList
                  title="Devices on Omada / Ruijie"
                  loading={false}
                  items={history.data.hardwareDevices}
                  total={history.data.hardwareDevices.length}
                  empty=""
                  render={(d) => (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {HARDWARE_LABELS[d.vendor]}
                          {d.routerName ? ` · ${d.routerName}` : ""}
                        </p>
                        <p className="truncate font-mono text-xs text-subtle">{d.clientMac}</p>
                        <p className="text-xs text-subtle">
                          {formatStamp(d.authorizedAt)} → {formatStamp(d.expiresAt)}
                        </p>
                      </div>
                      <Badge tone={d.status === "ACTIVE" ? "ok" : "neutral"}>{d.status}</Badge>
                    </div>
                  )}
                />
              ) : null}

              <HistoryList
                title="All packages"
                loading={history.isLoading}
                items={history.data?.packages ?? []}
                total={history.data?.totals.packages ?? 0}
                empty="No packages yet."
                render={(pk) => (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{pk.packageName}</p>
                      <p className="text-xs text-subtle">
                        {formatStamp(pk.startTime)} → {formatStamp(pk.expiryTime)}
                      </p>
                    </div>
                    <Badge tone={pk.status === "ACTIVE" ? "ok" : pk.status === "QUEUED" ? "warn" : "neutral"}>
                      {pk.status}
                    </Badge>
                  </div>
                )}
              />

              <HistoryList
                title="Purchase history"
                loading={history.isLoading}
                items={history.data?.payments ?? []}
                total={history.data?.totals.payments ?? 0}
                empty="No payments yet."
                render={(p) => (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{p.packageName}</p>
                      <p className="text-xs text-subtle">
                        {formatStamp(p.createdAt)} · {p.status}
                        {p.status === "SUCCESS" ? ` · ${p.activationStatus.replaceAll("_", " ").toLowerCase()}` : ""}
                      </p>
                      <p className="font-mono text-xs text-subtle">{p.mpesaTransactionId ?? "no receipt"}</p>
                    </div>
                    <p className="tabular-nums">{formatKes(p.amount)}</p>
                  </div>
                )}
              />

              <HistoryList
                title="Session history"
                loading={history.isLoading}
                items={history.data?.sessions ?? []}
                total={history.data?.totals.sessions ?? 0}
                empty="No sessions yet."
                render={(x) => {
                  const mins = x.sessionEnd
                    ? Math.max(0, Math.round((new Date(x.sessionEnd).getTime() - new Date(x.sessionStart).getTime()) / 60_000))
                    : null;
                  const used = x.bytesDown + x.bytesUp;
                  return (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{formatStamp(x.sessionStart)}</p>
                        <p className="text-xs text-subtle">
                          {x.sessionEnd ? `Ended ${formatStamp(x.sessionEnd)}` : "Still running"}
                          {mins != null ? ` · ${formatDuration(mins)}` : ""}
                          {used > 0 ? ` · ${formatBytes(used)}` : ""}
                        </p>
                        <p className="truncate text-xs text-subtle">{x.deviceInformation ?? "Unknown device"}</p>
                      </div>
                      <Badge tone={x.status === "ACTIVE" ? "ok" : "neutral"}>{x.status}</Badge>
                    </div>
                  );
                }}
              />

              <HistoryList
                title="Loyalty points history"
                loading={history.isLoading}
                items={history.data?.loyaltyLedger ?? []}
                total={history.data?.totals.loyalty ?? 0}
                empty="No loyalty activity yet."
                render={(l) => (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{l.reason.replaceAll("_", " ")}</p>
                      <p className="text-xs text-subtle">{formatStamp(l.created_at)}</p>
                    </div>
                    <p className={`tabular-nums ${l.delta < 0 ? "text-danger" : "text-ok"}`}>
                      {l.delta > 0 ? `+${l.delta}` : l.delta}
                    </p>
                  </div>
                )}
              />
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(pinFor)} onOpenChange={(o) => !o && setPinFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set PIN / password</DialogTitle>
            <DialogDescription>
              For {pinFor ? formatPhoneDisplay(pinFor.phone) : "this customer"}. Type the PIN or password they
              want so it's easy for them to remember, or let TelNet generate one.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!pinFor) return;
              const v = pinValue.trim();
              if (v && v.length < 4) return void toast.error("Use at least 4 characters.");
              act.mutate({ customerId: pinFor.id, action: "resetPin", pin: v || undefined });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="pin-new">New PIN or password</Label>
              <Input
                id="pin-new"
                autoFocus
                autoComplete="off"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                placeholder="4+ characters — leave blank to generate"
                className="h-12 text-base"
              />
              <p className="text-xs text-subtle">
                Shown here so you can read it back to the customer. They can change it themselves after signing in.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={act.isPending}>
                {act.isPending ? "Saving…" : pinValue.trim() ? "Set this PIN" : "Generate random PIN"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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

/** One history section: first 8 rows, "Show all" for the rest, and an honest total. */
function HistoryList<T>({
  title,
  items,
  total,
  empty,
  loading,
  render,
}: {
  title: string;
  items: T[];
  total: number;
  empty: string;
  loading: boolean;
  render: (item: T) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  return (
    <section className="mt-6">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-subtle">
        {title} ({Math.max(total, items.length)})
      </h3>
      {loading ? (
        <p className="mt-2 text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <>
          <div className="mt-2 space-y-2">
            {shown.map((item, i) => (
              <div key={i}>{render(item)}</div>
            ))}
          </div>
          {items.length > 8 ? (
            <Button variant="ghost" className="mt-2 h-10 w-full" onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all ${items.length}`}
            </Button>
          ) : null}
          {total > items.length ? (
            <p className="mt-1 text-xs text-subtle">Showing the latest {items.length} of {total}.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
