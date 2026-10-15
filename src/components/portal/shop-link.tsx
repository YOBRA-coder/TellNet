import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { readSite } from "@/lib/device";
import { getShopInfo } from "@/lib/fn/portal";

/** Small "Buy airtime & data" link on the portal home. Renders nothing while the shop is off. */
export function ShopLink({ className }: { className?: string }) {
  const q = useQuery({
    queryKey: ["shop-info", readSite() ?? ""],
    queryFn: () => getShopInfo({ data: { site: readSite() } }),
    staleTime: 60_000,
  });
  if (!q.data?.enabled || q.data.products.length === 0) return null;
  return (
    <Link
      to="/portal/shop"
      search={{ order: "" }}
      className={
        className ??
        "mx-auto flex w-full max-w-sm items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium hover:border-accent"
      }
    >
      <span>{q.data.title || "Buy airtime, data & minutes"}</span>
      <span className="text-accent">→</span>
    </Link>
  );
}

function useShopInfo() {
  const q = useQuery({
    queryKey: ["shop-info", readSite() ?? ""],
    queryFn: () => getShopInfo({ data: { site: readSite() } }),
    staleTime: 60_000,
  });
  return q.data?.enabled && q.data.products.length > 0 ? q.data : null;
}

/** Prominent banner near the top of the portal, so the shop isn't hidden in the footer. */
export function ShopBanner() {
  const info = useShopInfo();
  if (!info) return null;
  return (
    <Link
      to="/portal/shop"
      search={{ order: "" }}
      className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3"
    >
      <span>
        <span className="block text-sm font-semibold">{info.title || "Buy airtime, data & minutes"}</span>
        <span className="block text-xs text-muted">Pay with M-Pesa · for you or another number</span>
      </span>
      <span className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg">Buy now</span>
    </Link>
  );
}

const SEEN_KEY = "shop-promo-seen";

/** One-time-per-visit pop-up announcing the shop. Dismissal is remembered for the browser session only. */
export function ShopPromo() {
  const info = useShopInfo();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!info) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* storage blocked: just show it */
    }
    if (seen) return;
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, [info]);
  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };
  if (!info) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{info.title || "Buy airtime, data & minutes"}</DialogTitle>
          <DialogDescription>
            Top up airtime, data bundles, minutes or SMS right here with M-Pesa — for your own number or someone else's.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:flex-col">
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              close();
              navigate({ to: "/portal/shop", search: { order: "" } });
            }}
          >
            Open the shop
          </Button>
          <Button variant="ghost" className="w-full" onClick={close}>
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
