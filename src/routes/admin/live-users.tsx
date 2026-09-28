import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SessionBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { kickLiveUser, listLiveUsers } from "@/lib/fn/admin";
import { formatBytes, formatRemaining, formatSpeed, formatStamp } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";

export const Route = createFileRoute("/admin/live-users")({
  component: LiveUsersPage,
});

function LiveUsersPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["live"],
    queryFn: () => listLiveUsers(),
    refetchInterval: 8000,
  });
  const kick = useMutation({
    mutationFn: (sessionId: string) => kickLiveUser({ data: { sessionId } }),
    onSuccess: () => {
      toast.success("Disconnected");
      qc.invalidateQueries({ queryKey: ["live"] });
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Live users
        </h1>
        <p className="mt-1 text-sm text-muted">
          Currently authorised on the hotspot. Disconnecting ends the session, not
          the paid package.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>IP</TableHead>
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
            {(q.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted">
                  No one is online right now.
                </TableCell>
              </TableRow>
            )}
            {(q.data ?? []).map((u) => (
              <TableRow key={u.sessionId}>
                <TableCell className="font-medium tabular-nums">
                  {formatPhoneDisplay(u.phone)}
                </TableCell>
                <TableCell className="font-mono text-xs">{u.ipAddress ?? "—"}</TableCell>
                <TableCell>{u.packageName}</TableCell>
                <TableCell>{formatSpeed(u.speedLimitKbps)}</TableCell>
                <TableCell className="text-muted">{formatStamp(u.sessionStart)}</TableCell>
                <TableCell className="tabular-nums">
                  {formatRemaining(u.expiryTime)}
                </TableCell>
                <TableCell className="tabular-nums">{formatBytes(u.bytesDown)}</TableCell>
                <TableCell className="tabular-nums">{formatBytes(u.bytesUp)}</TableCell>
                <TableCell>
                  <SessionBadge status={u.status} />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => kick.mutate(u.sessionId)}
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
