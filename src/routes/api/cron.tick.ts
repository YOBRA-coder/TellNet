import { createFileRoute } from "@tanstack/react-router";

/**
 * Background tick for hosts that don't keep timers alive (Vercel serverless):
 * expires lapsed packages, probes EVERY router (so outages are noticed and
 * credited, and recovered routers get their customers restored), and tidies
 * vouchers. Call it every minute from an external scheduler, e.g.
 *   https://<your-app>/api/cron/tick?key=<CRON_SECRET>
 * Disabled (404) until CRON_SECRET is set. Safe to call more often: every
 * step is idempotent.
 */
async function tick(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const given = url.searchParams.get("key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (given !== secret) return new Response("Forbidden", { status: 403 });

  const { expireDuePackages } = await import("@/lib/services/expiry.server");
  const { probeAllRouters } = await import("@/lib/services/outage.server");
  const probed = await probeAllRouters().catch(() => -1);
  const expired = await expireDuePackages().catch(() => -1);
  return Response.json({ ok: true, routersProbed: probed, expired, at: new Date().toISOString() });
}

export const Route = createFileRoute("/api/cron/tick")({
  server: { handlers: { GET: ({ request }) => tick(request), POST: ({ request }) => tick(request) } },
});
