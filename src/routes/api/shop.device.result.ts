import { createFileRoute } from "@tanstack/react-router";

/**
 * The phone reports what happened.
 *   POST /api/shop/device/result   header  Authorization: Bearer <device key>
 *   body {"orderId":"so_...","success":true,"message":"optional text from the USSD reply"}
 */
async function handle(request: Request) {
  const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  let body: { orderId?: string; success?: boolean; message?: string } = {};
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!body.orderId) return new Response("Bad request", { status: 400 });
  const { reportDeviceResult } = await import("@/lib/services/shop.server");
  const res = await reportDeviceResult(key, String(body.orderId), body.success === true, body.message);
  if (!res.ok) return new Response("Not allowed", { status: res.status });
  return Response.json({ ok: true });
}

export const Route = createFileRoute("/api/shop/device/result")({
  server: { handlers: { POST: ({ request }) => handle(request) } },
});
