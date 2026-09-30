import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { useEffect } from "react";
import { ALL_SITES, useAdminSite } from "@/hooks/use-admin-site";
import { listSites } from "@/lib/fn/admin";

/** "All sites / <town>" dropdown. Renders nothing when there is only one site. */
export function SiteSwitcher({ className }: { className?: string }) {
  const [site, setSite] = useAdminSite();
  const q = useQuery({ queryKey: ["sites"], queryFn: () => listSites(), staleTime: 60_000 });
  const sites = q.data ?? [];

  // A remembered site that was deleted/renamed away falls back to All.
  useEffect(() => {
    if (q.data && site !== ALL_SITES && !q.data.some((s) => s.id === site)) setSite(ALL_SITES);
  }, [q.data, site, setSite]);

  if (sites.length <= 1) return null;
  return (
    <label className={"flex items-center gap-1.5 " + (className ?? "")}>
      <MapPin className="size-4 text-accent" />
      <select
        aria-label="Site / town"
        value={site}
        onChange={(e) => setSite(e.target.value)}
        className="h-9 rounded-md border border-border bg-raised px-3 text-sm"
      >
        <option value={ALL_SITES}>All sites</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.status === "INACTIVE" ? " (inactive)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
