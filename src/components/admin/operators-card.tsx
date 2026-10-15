import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeMyOperatorPassword,
  createOperatorAdmin,
  deleteOperatorAdmin,
  listOperatorsAdmin,
  listSites,
  updateOperatorAdmin,
} from "@/lib/fn/admin";

const field = "h-10";

/** Settings → Account: who can sign in to this console, plus "change my password". */
export function OperatorsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["operators"], queryFn: () => listOperatorsAdmin() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["operators"] });
  const me = q.data?.me ?? null;
  const operators = q.data?.operators ?? [];

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"OWNER" | "OPERATOR">("OPERATOR");
  const [siteId, setSiteId] = useState("");
  const sitesQ = useQuery({ queryKey: ["sites"], queryFn: () => listSites(), staleTime: 60_000 });
  const sites = sitesQ.data ?? [];
  const create = useMutation({
    mutationFn: () => createOperatorAdmin({ data: { name, phone, password, role, siteId: role === "OPERATOR" ? siteId : undefined } }),
    onSuccess: (res) => {
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.first ? "Owner account created. You're now signed in with it." : "Account added.");
      setName(""); setPhone(""); setPassword("");
      refresh();
      qc.invalidateQueries({ queryKey: ["operator-login-info"] });
    },
    onError: () => toast.error("Could not add the account."),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; name?: string; phone?: string; role?: "OWNER" | "OPERATOR"; status?: "ACTIVE" | "DISABLED"; siteId?: string | null; newPassword?: string }) => updateOperatorAdmin({ data: v }),
    onSuccess: (res) => (res.ok ? (toast.success("Saved."), refresh()) : toast.error(res.error)),
    onError: () => toast.error("Could not save."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteOperatorAdmin({ data: { id } }),
    onSuccess: (res) => (res.ok ? (toast.success("Account removed."), refresh()) : toast.error(res.error)),
  });

  const [resetFor, setResetFor] = useState<string | null>(null);
  const [tempPw, setTempPw] = useState("");

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({
    mutationFn: () => changeMyOperatorPassword({ data: { current: cur, next } }),
    onSuccess: (res) => {
      if (!res.ok) return void toast.error(res.error);
      toast.success("Password changed.");
      setCur(""); setNext("");
    },
    onError: () => toast.error("Could not change the password."),
  });

  if (q.isPending) return <Card className="p-5"><div className="h-6 w-40 animate-pulse rounded bg-raised" /></Card>;
  const onSharedPassword = me && me.id === null;
  const isOwner = Boolean(me?.owner);

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">Operators</h2>
        <p className="mt-1 text-sm text-muted">
          Everyone signs in with their own phone number and password, and can reset it by SMS code once TextBee is
          set up (Settings → SMS &amp; reset).
        </p>
      </div>

      {onSharedPassword ? (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
          You're signed in with the old shared password. Create your owner account below — the shared password stops
          working as soon as it exists.
        </p>
      ) : null}

      {isOwner ? (
        <>
          {operators.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {operators.map((o) => (
                <li key={o.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {o.name} {me?.id === o.id ? <span className="text-xs text-subtle">(you)</span> : null}
                      </p>
                      <p className="text-xs text-muted">
                        {o.phone} · {o.role === "OWNER" ? "Owner · all sites" : `Operator · ${o.siteName ?? "no site"}`} · {o.status === "ACTIVE" ? "Active" : "Disabled"}
                        {o.lastLoginAt ? ` · last in ${new Date(o.lastLoginAt).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {o.role === "OPERATOR" ? (
                        <select
                          aria-label="Site"
                          className="h-8 rounded-md border border-border bg-raised px-2 text-xs"
                          value={o.siteId ?? ""}
                          onChange={(e) => update.mutate({ id: o.id, siteId: e.target.value })}
                        >
                          {!o.siteId ? <option value="">Choose site…</option> : null}
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : null}
                      <Button type="button" size="sm" variant="secondary" onClick={() => { setResetFor(resetFor === o.id ? null : o.id); setTempPw(""); }}>
                        Reset password
                      </Button>
                      {me?.id !== o.id ? (
                        <>
                          <Button type="button" size="sm" variant="secondary" onClick={() => update.mutate({ id: o.id, status: o.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>
                            {o.status === "ACTIVE" ? "Disable" : "Enable"}
                          </Button>
                          {o.role === "OPERATOR" ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => update.mutate({ id: o.id, role: "OWNER" })}>
                              Make owner
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => { if (window.confirm(`Remove ${o.name}? They will be signed out.`)) remove.mutate(o.id); }}
                          >
                            Remove
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {resetFor === o.id ? (
                    <div className="flex gap-2">
                      <Input className={field} type="text" autoComplete="off" value={tempPw} onChange={(e) => setTempPw(e.target.value)} placeholder="New password (6+ characters)" />
                      <Button
                        type="button"
                        disabled={tempPw.length < 6 || update.isPending}
                        onClick={() => update.mutate({ id: o.id, newPassword: tempPw }, { onSuccess: () => setResetFor(null) })}
                      >
                        Set
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">{operators.length === 0 ? "Create your owner account" : "Add a person"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="op-name">Name</Label>
                <Input id="op-name" className={field} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="op-phone">Phone number</Label>
                <Input id="op-phone" className={field} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="op-pass">Password (6+ characters)</Label>
                <Input id="op-pass" className={field} type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {operators.length > 0 && role === "OPERATOR" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="op-site">Site (they only see this site)</Label>
                  <select id="op-site" className="h-10 w-full rounded-md border border-border bg-raised px-3 text-sm" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                    <option value="">Choose a site…</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              {operators.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="op-role">Role</Label>
                  <select id="op-role" className="h-10 w-full rounded-md border border-border bg-raised px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as "OWNER" | "OPERATOR")}>
                    <option value="OPERATOR">Operator — one site only</option>
                    <option value="OWNER">Owner — all sites, settings and accounts</option>
                  </select>
                </div>
              ) : null}
            </div>
            <Button type="button" disabled={create.isPending || !name || !phone || password.length < 6 || (operators.length > 0 && role === "OPERATOR" && !siteId)} onClick={() => create.mutate()}>
              {create.isPending ? "Saving…" : operators.length === 0 ? "Create owner account" : "Add"}
            </Button>
            <p className="text-xs text-subtle">Tell the person their password in person; they can change it themselves below or reset it by SMS.</p>
          </div>
        </>
      ) : null}

      {me && me.id ? (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium">Change my password</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input className={field} type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password" />
            <Input className={field} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (6+ characters)" />
          </div>
          <Button type="button" variant="secondary" disabled={change.isPending || !cur || next.length < 6} onClick={() => change.mutate()}>
            Change password
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
