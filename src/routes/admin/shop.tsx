import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createShopDeviceAdmin,
  deleteShopDeviceAdmin,
  deleteShopProductAdmin,
  getShopConfigAdmin,
  getShopOrdersAdmin,
  listSites,
  saveShopProductAdmin,
  saveShopSettingsAdmin,
  shopOrderAction,
} from "@/lib/fn/admin";
import { formatKes, formatStamp } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/phone";
import { useOperatorSession } from "@/lib/operator";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/shop")({ component: ShopAdminPage });

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "NEEDS_ATTENTION", label: "Needs attention" },
  { key: "PAID", label: "Paid" },
  { key: "DONE", label: "Delivered" },
] as const;

const selectCls = "h-10 w-full rounded-md border border-border bg-raised px-3 text-sm";

function ShopAdminPage() {
  const { isOwner } = useOperatorSession();
  const [tab, setTab] = useState<"orders" | "setup">("orders");
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Airtime & data shop</h1>
          <p className="text-sm text-muted">Orders paid through the portal shop and their delivery status.</p>
        </div>
        {isOwner ? (
          <div className="flex rounded-lg border border-border p-1 text-sm">
            {(["orders", "setup"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={cn("rounded-md px-3 py-1.5 font-medium capitalize", tab === t ? "bg-accent/15" : "text-muted")}>
                {t}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {tab === "orders" || !isOwner ? <Orders /> : <Setup />}
    </div>
  );
}

function Orders() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");
  const q = useQuery({ queryKey: ["shop-orders", filter], queryFn: () => getShopOrdersAdmin({ data: { status: filter } }), refetchInterval: 15_000 });
  const act = useMutation({
    mutationFn: (v: { id: string; action: "retry" | "refunded" | "unrefunded" | "delivered" }) => shopOrderAction({ data: v }),
    onSuccess: (r) => {
      if (!r.ok) toast.error(r.error);
      qc.invalidateQueries({ queryKey: ["shop-orders"] });
    },
  });
  const s = q.data?.summary;
  return (
    <div className="space-y-4">
      {q.data && !q.data.enabled ? <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">The shop is switched off, so customers can't see it.</p> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Today", s ? formatKes(s.today) : "—"],
          ["7 days", s ? formatKes(s.week) : "—"],
          ["30 days", s ? formatKes(s.month) : "—"],
          ["Needs attention", s ? String(s.attention) : "—"],
        ].map(([l, v]) => (
          <Card key={l} className={cn("p-4", l === "Needs attention" && s && s.attention > 0 && "border-danger/40")}>
            <p className="text-xs text-muted">{l}</p>
            <p className="mt-1 font-mono text-xl tabular-nums">{v}</p>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={cn("rounded-full border px-3 py-1.5 text-sm", filter === f.key ? "border-accent bg-accent/15" : "border-border text-muted")}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {q.isPending ? <div className="h-24 animate-pulse rounded-xl bg-raised" /> : null}
        {q.data?.orders.length === 0 ? <p className="text-sm text-muted">No orders here yet.</p> : null}
        {q.data?.orders.map((o) => (
          <Card key={o.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{o.productName} · {formatKes(o.amount)}</p>
                <p className="text-xs text-muted">
                  To {formatPhoneDisplay(o.targetPhone)}{o.targetPhone !== o.payerPhone ? ` · paid by ${formatPhoneDisplay(o.payerPhone)}` : ""} · {formatStamp(o.createdAt)}
                  {o.siteName ? ` · ${o.siteName}` : ""}{o.receipt ? ` · ${o.receipt}` : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Badge>{o.status}</Badge>
                {o.status === "PAID" ? <Badge>{o.fulfilStatus === "DONE" ? "Delivered" : o.fulfilStatus === "FAILED" ? "Failed" : o.fulfilStatus === "NONE" ? "Waiting" : "Delivering"}</Badge> : null}
                {o.refunded ? <Badge>Refunded</Badge> : null}
              </div>
            </div>
            {o.error ? <p className="text-xs text-danger">{o.error}</p> : null}
            {o.status === "PAID" && o.fulfilStatus !== "DONE" ? (
              <div className="flex flex-wrap gap-2">
                {!o.refunded ? (
                  <Button size="sm" variant="secondary" disabled={act.isPending} onClick={() => confirm("Only retry if you are sure the first attempt did NOT deliver — otherwise the customer is delivered twice.") && act.mutate({ id: o.id, action: "retry" })}>Retry delivery</Button>
                ) : null}
                <Button size="sm" variant="secondary" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, action: "delivered" })}>Mark delivered</Button>
                <Button size="sm" variant="secondary" disabled={act.isPending} onClick={() => act.mutate({ id: o.id, action: o.refunded ? "unrefunded" : "refunded" })}>{o.refunded ? "Undo refunded" : "Mark refunded"}</Button>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Setup() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["shop-config"], queryFn: () => getShopConfigAdmin() });
  const sites = useQuery({ queryKey: ["sites"], queryFn: () => listSites(), staleTime: 60_000 });
  if (q.isPending || !q.data) return <div className="h-40 animate-pulse rounded-xl bg-raised" />;
  const refresh = () => qc.invalidateQueries({ queryKey: ["shop-config"] });
  return (
    <div className="space-y-6">
      <SettingsForm s={q.data.settings} onSaved={refresh} />
      <Products products={q.data.products} sites={sites.data ?? []} onChanged={refresh} />
      {q.data.settings.fulfilment === "ANDROID" ? <Devices devices={q.data.devices} sites={sites.data ?? []} onChanged={refresh} /> : null}
    </div>
  );
}

type Cfg = Awaited<ReturnType<typeof getShopConfigAdmin>>["settings"];

function SettingsForm({ s, onSaved }: { s: Cfg; onSaved: () => void }) {
  const [f, setF] = useState({
    enabled: s.enabled, title: s.title ?? "", notice: s.notice ?? "", fulfilment: s.fulfilment, maxAttempts: String(s.maxAttempts),
    paymentMode: s.paymentMode, payAccountType: s.payAccountType, payShortcode: s.payShortcode ?? "", payTill: s.payTill ?? "",
    payPasskey: "", payKey: "", paySecret: "",
    apiUrl: s.apiUrl ?? "", apiMethod: s.apiMethod, apiContentType: s.apiContentType, apiHeaders: "", apiBody: s.apiBody ?? "",
    apiSuccessPath: s.apiSuccessPath ?? "", apiSuccessValue: s.apiSuccessValue ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const save = useMutation({
    mutationFn: () =>
      saveShopSettingsAdmin({
        data: {
          enabled: f.enabled, title: f.title || null, notice: f.notice || null, fulfilment: f.fulfilment,
          maxAttempts: Number(f.maxAttempts) || 3, paymentMode: f.paymentMode, payAccountType: f.payAccountType,
          payShortcode: f.payShortcode || null, payTill: f.payTill || null,
          ...(f.payPasskey ? { payPasskey: f.payPasskey } : {}), ...(f.payKey ? { payKey: f.payKey } : {}), ...(f.paySecret ? { paySecret: f.paySecret } : {}),
          apiUrl: f.apiUrl || null, apiMethod: f.apiMethod, apiContentType: f.apiContentType,
          ...(f.apiHeaders.trim() ? { apiHeaders: f.apiHeaders } : {}),
          apiBody: f.apiBody || null, apiSuccessPath: f.apiSuccessPath || null, apiSuccessValue: f.apiSuccessValue || null,
        },
      }),
    onSuccess: () => { toast.success("Shop settings saved."); setF((p) => ({ ...p, payPasskey: "", payKey: "", paySecret: "", apiHeaders: "" })); onSaved(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });
  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center justify-between">
        <div><p className="font-medium">Shop on the portal</p><p className="text-xs text-muted">Customers see a "Buy airtime & data" link on the portal.</p></div>
        <Switch checked={f.enabled} onCheckedChange={(v) => set("enabled", v)} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5"><Label>Title</Label><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Buy airtime, data & minutes" /></div>
        <div className="space-y-1.5"><Label>Notice (optional)</Label><Input value={f.notice} onChange={(e) => set("notice", e.target.value)} placeholder="Delivery takes about a minute." /></div>
      </div>

      <div className="space-y-2">
        <Label>How orders are delivered</Label>
        <select className={selectCls} value={f.fulfilment} onChange={(e) => set("fulfilment", e.target.value as "ANDROID" | "API")}>
          <option value="ANDROID">Option 1 — Android phone running USSD automation</option>
          <option value="API">Option 2 — Reseller API (airtime / data / minutes / SMS)</option>
        </select>
        <div className="space-y-1.5 md:w-40"><Label>Max delivery attempts</Label><Input inputMode="numeric" value={f.maxAttempts} onChange={(e) => set("maxAttempts", e.target.value.replace(/\D/g, ""))} /></div>
        <p className="text-xs text-muted">If the outcome is unknown (timeout, no reply) the order is flagged for you instead of being sent again, so a customer is never delivered twice by accident.</p>
      </div>

      {f.fulfilment === "API" ? (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Reseller API</p>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2"><Label>URL</Label><Input value={f.apiUrl} onChange={(e) => set("apiUrl", e.target.value)} placeholder="https://provider.example/api/topup" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Method</Label><select className={selectCls} value={f.apiMethod} onChange={(e) => set("apiMethod", e.target.value as "POST" | "GET")}><option>POST</option><option>GET</option></select></div>
              <div className="space-y-1.5"><Label>Format</Label><select className={selectCls} value={f.apiContentType} onChange={(e) => set("apiContentType", e.target.value as "json" | "form")}><option value="json">JSON</option><option value="form">Form</option></select></div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Headers (JSON) {s.apiHeaderNames.length ? <span className="text-muted">— saved: {s.apiHeaderNames.join(", ")} (leave blank to keep)</span> : null}</Label>
            <Textarea rows={2} value={f.apiHeaders} onChange={(e) => set("apiHeaders", e.target.value)} placeholder='{"Authorization":"Bearer YOUR_KEY"}' className="font-mono text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label>Body template</Label>
            <Textarea rows={4} value={f.apiBody} onChange={(e) => set("apiBody", e.target.value)} placeholder='{"phone":"{phone254}","amount":{amount},"product":"{code}","ref":"{order}"}' className="font-mono text-xs" />
            <p className="text-xs text-muted">Placeholders: {"{phone} {phone254} {phoneplus} {payer} {amount} {order} {code} {kind} {name}"} — {"{code}"} is the product's provider code.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Success field in reply</Label><Input value={f.apiSuccessPath} onChange={(e) => set("apiSuccessPath", e.target.value)} placeholder="status" /></div>
            <div className="space-y-1.5"><Label>Success value</Label><Input value={f.apiSuccessValue} onChange={(e) => set("apiSuccessValue", e.target.value)} placeholder="success" /></div>
          </div>
          <p className="text-xs text-muted">Get the exact URL, fields and success reply from your provider's API documentation. Leave the success fields blank to treat any 2xx reply as success.</p>
        </div>
      ) : null}

      <div className="space-y-3">
        <Label>Where shop payments go</Label>
        <select className={selectCls} value={f.paymentMode} onChange={(e) => set("paymentMode", e.target.value as "CURRENT" | "CUSTOM")}>
          <option value="CURRENT">Same M-Pesa as Wi-Fi payments (current)</option>
          <option value="CUSTOM">A separate till / paybill</option>
        </select>
        {f.paymentMode === "CUSTOM" ? (
          <div className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label>Type</Label><select className={selectCls} value={f.payAccountType} onChange={(e) => set("payAccountType", e.target.value as "paybill" | "till")}><option value="paybill">Paybill</option><option value="till">Till (Buy Goods)</option></select></div>
            <div className="space-y-1.5"><Label>Shortcode</Label><Input value={f.payShortcode} onChange={(e) => set("payShortcode", e.target.value)} /></div>
            {f.payAccountType === "till" ? <div className="space-y-1.5"><Label>Till number</Label><Input value={f.payTill} onChange={(e) => set("payTill", e.target.value)} /></div> : null}
            <div className="space-y-1.5"><Label>Passkey {s.hasPayPasskey ? <span className="text-muted">(saved)</span> : null}</Label><Input type="password" value={f.payPasskey} onChange={(e) => set("payPasskey", e.target.value)} placeholder={s.hasPayPasskey ? "Leave blank to keep" : ""} /></div>
            <div className="space-y-1.5"><Label>Consumer key {s.hasPayKey ? <span className="text-muted">(saved)</span> : null}</Label><Input type="password" value={f.payKey} onChange={(e) => set("payKey", e.target.value)} placeholder={s.hasPayKey ? "Leave blank to keep" : ""} /></div>
            <div className="space-y-1.5"><Label>Consumer secret {s.hasPaySecret ? <span className="text-muted">(saved)</span> : null}</Label><Input type="password" value={f.paySecret} onChange={(e) => set("paySecret", e.target.value)} placeholder={s.hasPaySecret ? "Leave blank to keep" : ""} /></div>
          </div>
        ) : null}
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save shop settings"}</Button>
    </Card>
  );
}

type Prod = Awaited<ReturnType<typeof getShopConfigAdmin>>["products"][number];
type SiteRow = { id: string; name: string };

function Products({ products, sites, onChanged }: { products: Prod[]; sites: SiteRow[]; onChanged: () => void }) {
  const blank = { id: "", kind: "DATA" as Prod["kind"], name: "", price: "", minAmount: "", maxAmount: "", ussdCode: "", providerCode: "", okoaOk: false, notes: "", siteId: "", status: "ACTIVE" as Prod["status"] };
  const [f, setF] = useState(blank);
  const air = f.kind === "AIRTIME";
  const num = (v: string) => (v ? Number(v) : null);
  const save = useMutation({
    mutationFn: () =>
      saveShopProductAdmin({
        data: {
          id: f.id || undefined, kind: f.kind, name: f.name.trim(),
          price: air ? null : num(f.price), minAmount: air ? num(f.minAmount) : null, maxAmount: air ? num(f.maxAmount) : null,
          ussdCode: f.ussdCode || null, providerCode: f.providerCode || null, okoaOk: f.okoaOk, notes: f.notes || null,
          siteId: f.siteId || null, status: f.status,
        },
      }),
    onSuccess: () => { toast.success("Product saved."); setF(blank); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });
  const del = useMutation({ mutationFn: (id: string) => deleteShopProductAdmin({ data: { id } }), onSuccess: onChanged });
  return (
    <Card className="space-y-4 p-5">
      <p className="font-medium">Products</p>
      <div className="space-y-2">
        {products.length === 0 ? <p className="text-sm text-muted">No products yet — add the first one below.</p> : null}
        {products.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <span>
              {p.name} <span className="text-muted">· {p.kind}{p.kind === "AIRTIME" ? ` ${p.minAmount}–${p.maxAmount}` : ` · ${formatKes(p.price ?? 0)}`}{p.status === "INACTIVE" ? " · hidden" : ""}{p.okoaOk ? " · Okoa" : ""}</span>
            </span>
            <span className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setF({ id: p.id, kind: p.kind, name: p.name, price: p.price?.toString() ?? "", minAmount: p.minAmount?.toString() ?? "", maxAmount: p.maxAmount?.toString() ?? "", ussdCode: p.ussdCode ?? "", providerCode: p.providerCode ?? "", okoaOk: p.okoaOk, notes: p.notes ?? "", siteId: p.siteId ?? "", status: p.status })}>Edit</Button>
              <Button size="sm" variant="secondary" onClick={() => confirm(`Delete ${p.name}?`) && del.mutate(p.id)}>Delete</Button>
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-3">
        <p className="text-sm font-medium md:col-span-3">{f.id ? "Edit product" : "Add product"}</p>
        <div className="space-y-1.5"><Label>Kind</Label><select className={selectCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Prod["kind"] })}><option value="DATA">Data</option><option value="MINUTES">Minutes</option><option value="SMS">SMS</option><option value="AIRTIME">Airtime (any amount)</option></select></div>
        <div className="space-y-1.5"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="1GB 1hr" /></div>
        {air ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Min</Label><Input inputMode="numeric" value={f.minAmount} onChange={(e) => setF({ ...f, minAmount: e.target.value.replace(/\D/g, "") })} /></div>
            <div className="space-y-1.5"><Label>Max</Label><Input inputMode="numeric" value={f.maxAmount} onChange={(e) => setF({ ...f, maxAmount: e.target.value.replace(/\D/g, "") })} /></div>
          </div>
        ) : (
          <div className="space-y-1.5"><Label>Price (KES)</Label><Input inputMode="numeric" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value.replace(/\D/g, "") })} /></div>
        )}
        <div className="space-y-1.5"><Label>USSD template (Android)</Label><Input value={f.ussdCode} onChange={(e) => setF({ ...f, ussdCode: e.target.value })} placeholder="*140*{amount}*{phone}#" /></div>
        <div className="space-y-1.5"><Label>Provider code (API)</Label><Input value={f.providerCode} onChange={(e) => setF({ ...f, providerCode: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Note (optional)</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <div className="space-y-1.5"><Label>Site</Label><select className={selectCls} value={f.siteId} onChange={(e) => setF({ ...f, siteId: e.target.value })}><option value="">All sites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="space-y-1.5"><Label>Status</Label><select className={selectCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Prod["status"] })}><option value="ACTIVE">Visible</option><option value="INACTIVE">Hidden</option></select></div>
        <label className="flex items-center gap-2 pt-6 text-sm"><Switch checked={f.okoaOk} onCheckedChange={(v) => setF({ ...f, okoaOk: v })} /> Okoa accepted (only if your provider supports it)</label>
        <div className="flex gap-2 md:col-span-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending || f.name.trim().length < 2}>{f.id ? "Save changes" : "Add product"}</Button>
          {f.id ? <Button variant="secondary" onClick={() => setF(blank)}>Cancel</Button> : null}
        </div>
      </div>
    </Card>
  );
}

type Dev = Awaited<ReturnType<typeof getShopConfigAdmin>>["devices"][number];

function Devices({ devices, sites, onChanged }: { devices: Dev[]; sites: SiteRow[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const add = useMutation({
    mutationFn: () => createShopDeviceAdmin({ data: { name, siteId: siteId || null } }),
    onSuccess: (r) => { setKey(r.key); setName(""); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add."),
  });
  const del = useMutation({ mutationFn: (id: string) => deleteShopDeviceAdmin({ data: { id } }), onSuccess: onChanged });
  return (
    <Card className="space-y-4 p-5">
      <p className="font-medium">Android phones</p>
      {key ? (
        <div className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm">
          <p className="font-medium">Copy this key now — it is shown only once.</p>
          <code className="mt-2 block break-all rounded bg-raised p-2 font-mono text-xs">{key}</code>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => setKey(null)}>I've copied it</Button>
        </div>
      ) : null}
      {devices.map((d) => (
        <div key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
          <span>{d.name} <span className="text-muted">· {d.keyPrefix}… · {d.siteName ?? "all sites"} · {d.lastSeenAt ? `seen ${formatStamp(d.lastSeenAt)}` : "never connected"}</span></span>
          <Button size="sm" variant="secondary" onClick={() => confirm(`Remove ${d.name}?`) && del.mutate(d.id)}>Remove</Button>
        </div>
      ))}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5"><Label>Phone name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shop phone" /></div>
        <div className="space-y-1.5"><Label>Serves</Label><select className={selectCls} value={siteId} onChange={(e) => setSiteId(e.target.value)}><option value="">All sites</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="pt-6"><Button onClick={() => add.mutate()} disabled={!name.trim() || add.isPending}>Add phone</Button></div>
      </div>
      <div className="rounded-xl border border-border p-4 text-xs text-muted">
        <p className="mb-1 font-medium text-fg">What the phone's app must do</p>
        <p>Send header <code>Authorization: Bearer &lt;key&gt;</code> on both calls.</p>
        <p><code>GET /api/shop/device/next</code> → either <code>{"{ \"order\": null }"}</code> or the next order (orderId, kind, phone, phone254, amount, ussd) to dial.</p>
        <p><code>POST /api/shop/device/result</code> with <code>{"{ \"orderId\", \"success\": true|false, \"message\" }"}</code>. A failure is flagged for you to check — it is never re-sent automatically.</p>
        <p>You must supply the Android automation app (e.g. a USSD automation tool or your own). TellNet provides the queue and the secure endpoints.</p>
      </div>
    </Card>
  );
}
