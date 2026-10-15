import { createFileRoute } from "@tanstack/react-router";

/**
 * The Android phone asks for its next job.
 *   GET /api/shop/device/next      header  Authorization: Bearer <device key>
 *   -> 200 {"order": null}  or  {"order": {"orderId","kind","phone","phone254","amount","ussd"}}
 * An order handed out here is marked SENT; report the outcome to /api/shop/device/result.
 */
async function handle(request: Request) {
  const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() || new URL(request.url).searchParams.get("key") || "";
  const { claimNextForDevice } = await import("@/lib/services/shop.server");
  const res = await claimNextForDevice(key);
  if (!res.ok) return new Response("Unauthorized", { status: res.status });
  return Response.json({ order: res.order });
}

export const Route = createFileRoute("/api/shop/device/next")({
  server: { handlers: { GET: ({ request }) => handle(request), POST: ({ request }) => handle(request) } },
});
