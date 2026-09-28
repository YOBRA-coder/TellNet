import { createFileRoute, Link } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/portal-shell";
import { Button } from "@/components/ui/button";
import { HOTSPOT_FALLBACK } from "@/lib/brand-copy";

export const Route = createFileRoute("/portal/expired")({
  component: ExpiredPage,
});

function ExpiredPage() {
  return (
    <PortalShell hotspotName={HOTSPOT_FALLBACK}>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-subtle">
        Session ended
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight">
        Your package has expired.
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Internet access was removed on the router when the timer ran out. Buy a
        new package to get back online — previous receipts cannot be reused.
      </p>
      <Button asChild size="xl" className="mt-8 w-full">
        <Link to="/portal/packages">Purchase a new package</Link>
      </Button>
      <Link
        to="/portal/recover"
        className="mt-4 text-center text-sm text-muted hover:text-fg"
      >
        Think this is a mistake? Recover with a receipt
      </Link>
    </PortalShell>
  );
}
