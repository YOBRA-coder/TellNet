import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
