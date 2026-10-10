import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SiteSwitcher } from "@/components/admin/site-switcher";
import { SessionBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ALL_SITES, useAdminSite } from "@/hooks/use-admin-site";
import { kickLiveUser, listLiveUsers } from "@/lib/fn/admin";
import { formatBytes, formatRemaining, formatSpeed, formatStamp } from "@/lib/format";
import { HARDWARE_LABELS, HARDWARE_TYPES } from "@/lib/hardware";
import { formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/live-users")({
  component: LiveUsersPage,
});

const SORTS: Record<string, string> = {
  NEWEST: "Newest first",
  EXPIRING: "Expiring soonest",
  DATA: "Most data used",
  SITE: "By site",
  PHONE: "Phone number",
};

function LiveUsersPage() {
  const qc = useQueryClient();
  const [siteId] = useAdminSite();
  const [search, setSearch] = useState("");
  const [hardware, setHardware] = useState("ALL");
  const [pkg, setPkg] = useState("ALL");
  const [sort, setSort] = useState("NEWEST");

  const q = useQuery({
    queryKey: ["live"],
    queryFn: () => listLiveUsers(),
    refetchInterval: 8000,
    placeholderData: (prev) => prev,
  });
  const kick = useMutation({
    mutationFn: (sessionId: string) => kickLiveUser({ data: { sessionId } }),
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["live"] });
    },
    onError: () => toast.error("Could not disconnect this user."),
  });

  const all = q.data ?? [];
  const packages = useMemo(() => [...new Set(all.map((u) => u.packageName))].sort(), [all]);

  const rows = useMemo(() => {
    // Phone search takes 07…, 7…, 254… or +254…; also matches IP, MAC, package, site.
    const raw = search.trim().toLowerCase();
    const digits = raw.replace(/\D/g, "");
    const phoneKey = digits.startsWith("0") ? "254" + digits.slice(1) : digits;
    let list = all.filter((u) => {
      if (siteId !== ALL_SITES && u.siteId !== siteId) return false;
      if (hardware !== "ALL" && u.hardwareType !== hardware) return false;
      if (pkg !== "ALL" && u.packageName !== pkg) return false;
      if (!raw) return true;
      const phoneDigits = u.phone.replace(/\D/g, "");
      return (
        (phoneKey.length >= 3 && phoneDigits.includes(phoneKey)) ||
        [u.ipAddress, u.clientMac, u.packageName, u.siteName, u.routerName]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(raw))
      );
    });
    const by: Record<string, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
      EXPIRING: (a, b) => new Date(a.expiryTime).getTime() - new Date(b.expiryTime).getTime(),
      DATA: (a, b) => b.bytesDown + b.bytesUp - (a.bytesDown + a.bytesUp),
      SITE: (a, b) => a.siteName.localeCompare(b.siteName) || a.phone.localeCompare(b.phone),
      PHONE: (a, b) => a.phone.localeCompare(b.phone),
    };
    if (by[sort]) list = [...list].sort(by[sort]);
    return list;
  }, [all, siteId, hardware, pkg, search, sort]);

  const byHw = (t: string) => rows.filter((u) => u.hardwareType === t).length;
  const filtersOn = Boolean(search) || hardware !== "ALL" || pkg !== "ALL" || siteId !== ALL_SITES || sort !== "NEWEST";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Live users</h1>
          <p className="mt-1 text-sm text-muted">
            Currently authorised on any site, whatever the hardware. Disconnecting ends the session, not the paid
            package.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SiteSwitcher />
          <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="font-medium text-fg tabular-nums">{rows.length} online</span>
        {HARDWARE_TYPES.map((t) =>
          byHw(t) > 0 ? (
            <span key={t} className="tabular-nums">
              {HARDWARE_LABELS[t]}: {byHw(t)}
            </span>
          ) : null,
        )}
        {rows.length !== all.length && <span>(of {all.length} in total)</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          className="lg:col-span-2"
          placeholder="Search phone (07…), IP, MAC, package, site"
          inputMode="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Hardware"
          className="h-11 rounded-md border border-border bg-raised px-3 text-sm"
          value={hardware}
          onChange={(e) => setHardware(e.target.value)}
        >
          <option value="ALL">All hardware</option>
          {HARDWARE_TYPES.map((t) => (
            <option key={t} value={t}>
              {HARDWARE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          aria-label="Package"
          className="h-11 rounded-md border border-border bg-raised px-3 text-sm"
          value={pkg}
          onChange={(e) => setPkg(e.target.value)}
        >
          <option value="ALL">All packages</option>
          {packages.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort by"
          className="h-11 rounded-md border border-border bg-raised px-3 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              Sort: {v}
            </option>
          ))}
        </select>
      </div>
      {filtersOn && (
        <button
          type="button"
          className="text-sm text-accent underline"
          onClick={() => {
            setSearch("");
            setHardware("ALL");
            setPkg("ALL");
            setSort("NEWEST");
          }}
        >
          Clear search, hardware, package and sort{siteId !== ALL_SITES ? " (the site is set with the site switcher)" : ""}
        </button>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="whitespace-nowrap">
              <TableHead>Phone</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Hardware</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Down</TableHead>
              <TableHead>Up</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="py-10 text-center text-muted">
                  {all.length === 0 ? "No one is online right now." : "No one online matches these filters."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((u) => (
              <TableRow key={u.sessionId} className="whitespace-nowrap">
                <TableCell className="font-medium tabular-nums">
                  {formatPhoneDisplay(u.phone)}
                </TableCell>
                <TableCell className="text-sm">{u.siteName}</TableCell>
                <TableCell>
                  <Badge tone={u.hardwareType === "mikrotik" ? "neutral" : "accent"}>
                    {HARDWARE_LABELS[u.hardwareType]}
                  </Badge>
                  {u.routerName ? <p className="text-[11px] text-subtle">{u.routerName}</p> : null}
                </TableCell>
                <TableCell className="font-mono text-xs">{u.clientMac ?? u.ipAddress ?? "—"}</TableCell>
                <TableCell>{u.packageName}</TableCell>
                <TableCell>{formatSpeed(u.speedLimitKbps)}</TableCell>
                <TableCell className="text-muted">{formatStamp(u.sessionStart)}</TableCell>
                <TableCell className="tabular-nums">{formatRemaining(u.expiryTime)}</TableCell>
                <TableCell className="tabular-nums">
                  {u.hasTraffic ? formatBytes(u.bytesDown) : <span className="text-subtle" title="This hardware does not report traffic per customer">n/a</span>}
                </TableCell>
                <TableCell className="tabular-nums">
                  {u.hasTraffic ? formatBytes(u.bytesUp) : <span className="text-subtle">n/a</span>}
                </TableCell>
                <TableCell>
                  <SessionBadge status={u.status} />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={kick.isPending}
                    onClick={() => {
                      if (window.confirm(`Disconnect ${formatPhoneDisplay(u.phone)}? Their paid package stays valid.`)) {
                        kick.mutate(u.sessionId);
                      }
                    }}
                  >
                    Disconnect
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
