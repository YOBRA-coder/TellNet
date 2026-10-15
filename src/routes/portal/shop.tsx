import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDevice } from "@/hooks/use-device";
import { readSite } from "@/lib/device";
import { createShopOrder, getShopInfo, getShopOrderStatus } from "@/lib/fn/portal";
import { formatKes } from "@/lib/format";
import { isKenyanPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/portal/shop")({
  validateSearch: (s: Record<string, unknown>) => ({ order: typeof s.order === "string" ? s.order : "" }),
  component: ShopPage,
});

const KIND_LABEL: Record<string, string> = { DATA: "Data", MINUTES: "Minutes", SMS: "SMS", AIRTIME: "Airtime" };

function ShopPage() {
  const { order } = Route.useSearch();
  const info = useQuery({
    queryKey: ["shop-info", readSite() ?? ""],
    queryFn: () => getShopInfo({ data: { site: readSite() } }),
  });
  const title = info.data?.title || "Airtime & data";
  return (
    <PortalShell hotspotName={info.data?.hotspotName ?? "Wi-Fi"}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Shop</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">{title}</h1>
      {order ? (
        <OrderStatus orderId={order} />
      ) : info.isPending ? (
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-raised" />
      ) : !info.data?.enabled || info.data.products.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-border bg-surface p-5 text-sm text-muted">The shop is closed right now. Please check back later.</p>
      ) : (
        <Catalog info={info.data} />
      )}
      <Link to="/portal" className="mt-6 block text-center text-sm text-muted hover:text-fg">
        Back to Wi-Fi packages
      </Link>
    </PortalShell>
  );
}

type Info = NonNullable<ReturnType<typeof useQuery<Awaited<ReturnType<typeof getShopInfo>>>>["data"]>;

function Catalog({ info }: { info: Info }) {
  const navigate = useNavigate();
  const { device } = useDevice();
  const kinds = useMemo(() => Array.from(new Set(info.products.map((p) => p.kind))), [info.products]);
  const [kind, setKind] = useState(kinds[0] ?? "DATA");
  const [productId, setProductId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [forOther, setForOther] = useState(false);
  const [payer, setPayer] = useState(device?.phone ?? "");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!payer && device?.phone) setPayer(device.phone);
  }, [device?.phone, payer]);

  const shown = info.products.filter((p) => p.kind === kind);
  const chosen = info.products.find((p) => p.id === productId) ?? null;
  const price = chosen ? (chosen.kind === "AIRTIME" ? Number(amount) || 0 : chosen.price ?? 0) : 0;

  const buy = useMutation({
    mutationFn: async () => {
      if (!chosen) throw new Error("Choose what you want to buy.");
      if (!isKenyanPhone(payer)) throw new Error("Enter the M-Pesa number that will pay.");
      if (forOther && !isKenyanPhone(target)) throw new Error("Enter a valid number to receive it.");
      return createShopOrder({
        data: {
          productId: chosen.id,
          amount: chosen.kind === "AIRTIME" ? Number(amount) : undefined,
          payerPhone: payer,
          targetPhone: forOther ? target : undefined,
          site: readSite(),
        },
      });
    },
    onSuccess: (res) => {
      if (!res.ok) return setError(res.error);
      setError(null);
      navigate({ to: "/portal/shop", search: { order: res.orderId } });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Something went wrong. Try again."),
  });

  return (
    <div className="mt-5 space-y-5">
      {info.notice ? <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">{info.notice}</p> : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setKind(k); setProductId(null); }}
            className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-medium", kind === k ? "border-accent bg-accent/15 text-fg" : "border-border text-muted")}
          >
            {KIND_LABEL[k] ?? k}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProductId(p.id)}
            className={cn("flex items-center justify-between rounded-xl border bg-surface px-4 py-3 text-left", productId === p.id ? "border-accent" : "border-border")}
          >
            <span>
              <span className="block text-sm font-medium">{p.name}</span>
              {p.okoaOk ? <span className="text-xs text-ok">Okoa accepted</span> : null}
              {p.notes ? <span className="block text-xs text-muted">{p.notes}</span> : null}
            </span>
            <span className="font-mono text-sm tabular-nums">
              {p.kind === "AIRTIME" ? `${p.minAmount}–${p.maxAmount}` : formatKes(p.price ?? 0, info.currency)}
            </span>
          </button>
        ))}
      </div>

      <Dialog open={chosen !== null} onOpenChange={(o) => { if (!o) { setProductId(null); setError(null); } }}>
        <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{chosen?.name}</DialogTitle>
            <DialogDescription>
              {chosen?.kind === "AIRTIME" ? "Enter the amount and who it's for." : `${formatKes(chosen?.price ?? 0, info.currency)} · enter your details to pay with M-Pesa.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
      {chosen?.kind === "AIRTIME" ? (
        <div className="space-y-1.5">
          <Label htmlFor="shop-amount">Amount ({info.currency})</Label>
          <Input id="shop-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder={`${chosen.minAmount} – ${chosen.maxAmount}`} className="h-12 text-base" />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border p-1 text-sm">
        {[false, true].map((o) => (
          <button key={String(o)} type="button" onClick={() => setForOther(o)} className={cn("rounded-lg py-2 font-medium", forOther === o ? "bg-accent/15 text-fg" : "text-muted")}>
            {o ? "Another number" : "My number"}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="shop-payer">{forOther ? "Your M-Pesa number (pays)" : "Your phone number (pays and receives)"}</Label>
        <Input id="shop-payer" type="tel" inputMode="tel" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="07XXXXXXXX" className="h-12 text-base" />
      </div>
      {forOther ? (
        <div className="space-y-1.5">
          <Label htmlFor="shop-target">Number to receive it</Label>
          <Input id="shop-target" type="tel" inputMode="tel" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="07XXXXXXXX" className="h-12 text-base" />
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}
      <Button size="xl" className="w-full" disabled={buy.isPending || !chosen || price < 1} onClick={() => buy.mutate()}>
        {buy.isPending ? "Sending M-Pesa prompt…" : chosen ? `Pay ${formatKes(price, info.currency)} with M-Pesa` : "Choose an item"}
      </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderStatus({ orderId }: { orderId: string }) {
  const q = useQuery({
    queryKey: ["shop-order", orderId],
    queryFn: () => getShopOrderStatus({ data: { orderId } }),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d?.ok) return false;
      const o = d.order;
      if (o.status === "PENDING") return 3000;
      if (o.status === "PAID" && (o.fulfilStatus === "QUEUED" || o.fulfilStatus === "SENT" || o.fulfilStatus === "NONE")) return 4000;
      return false;
    },
  });
  const o = q.data?.ok ? q.data.order : null;
  if (q.isPending) return <div className="mt-6 h-32 animate-pulse rounded-2xl bg-raised" />;
  if (!o) return <p className="mt-6 text-sm text-muted">We couldn't find that order.</p>;

  let heading = "Waiting for M-Pesa";
  let body = `Check your phone and enter your M-Pesa PIN to pay ${formatKes(o.amount)} for ${o.productName}.`;
  let tone = "text-fg";
  if (o.status === "CANCELLED" || o.status === "FAILED") {
    heading = "Payment did not complete";
    body = "No money was taken. You can try again.";
    tone = "text-danger";
  } else if (o.status === "PAID") {
    if (o.fulfilStatus === "DONE") {
      heading = "Delivered";
      body = `${o.productName} was sent to ${o.targetPhone}. Thank you!`;
      tone = "text-ok";
    } else if (o.fulfilStatus === "FAILED") {
      heading = "Payment received — we're sorting it out";
      body = `We couldn't deliver ${o.productName} automatically. Your payment is safe: the operator will deliver it or refund you. Keep your M-Pesa code${o.receipt ? ` (${o.receipt})` : ""}.`;
      tone = "text-warn";
    } else {
      heading = "Payment received";
      body = `Sending ${o.productName} to ${o.targetPhone}… this usually takes under a minute.`;
    }
  }
  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5">
      <p className={cn("font-display text-xl font-semibold", tone)}>{heading}</p>
      <p className="text-sm text-muted">{body}</p>
      {(o.status === "CANCELLED" || o.status === "FAILED" || o.fulfilStatus === "DONE") ? (
        <Button asChild variant="secondary" className="w-full">
          <Link to="/portal/shop" search={{ order: "" }}>Buy something else</Link>
        </Button>
      ) : null}
    </div>
  );
}
