/**
 * Server side of the WiFiDog protocol used by Ruijie / Reyee gateways.
 * Mounted at  /api/hw/wd/<routerId>/  — that URL (with the trailing slash) is
 * what goes into the gateway's "Server URL" field. Sub-paths:
 *   login/   gateway sends the unauthenticated client here -> portal page
 *   auth/    gateway asks "may this token online?"  -> "Auth: 1" / "Auth: 0"
 *   ping/    gateway heartbeat                      -> "Pong"
 *   portal/  gateway sends the client here after a successful login
 *   gw_message.php  gateway shows a message page
 */
import { getSql } from "@/lib/db";
import { getHwRouter, saveClientContext, siteSlugForRouter } from "./index";

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

async function heartbeat(routerId: string) {
  const sql = await getSql();
  await sql`
    update mikrotiks set hw_seen_at = now()
    where id = ${routerId} and (hw_seen_at is null or hw_seen_at < now() - interval '20 seconds')
  `;
}

async function portalRedirect(request: Request, routerId: string, ctxId: string | null) {
  const slug = await siteSlugForRouter(routerId);
  const u = new URL("/portal", request.url);
  if (slug) u.searchParams.set("site", slug);
  if (ctxId) u.searchParams.set("hwc", ctxId);
  return Response.redirect(u.toString(), 302);
}

export async function handleWifidog(request: Request, routerId: string, sub: string): Promise<Response> {
  const router = await getHwRouter(routerId);
  if (!router || router.type !== "ruijie") return text("Not found", 404);
  const url = new URL(request.url);
  const q = (k: string) => url.searchParams.get(k) ?? "";
  const path = sub.replace(/^\/+|\/+$/g, "").toLowerCase();

  // Optional pinning: ignore gateways whose id doesn't match the configured one.
  const expectedGw = router.config.ruijieGwId?.trim();
  if (expectedGw && q("gw_id") && q("gw_id") !== expectedGw) return text("Unknown gateway", 403);

  if (path === "ping") {
    await heartbeat(routerId);
    return text("Pong");
  }

  if (path === "login") {
    await heartbeat(routerId);
    const ctxId = await saveClientContext({
      routerId,
      vendor: "ruijie",
      clientMac: q("mac"),
      clientIp: q("ip"),
      extra: {
        gwAddress: q("gw_address"),
        gwPort: q("gw_port"),
        gwId: q("gw_id"),
        url: q("url"),
      },
    });
    return portalRedirect(request, routerId, ctxId);
  }

  if (path === "portal") {
    const u = new URL("/portal/connect", request.url);
    return Response.redirect(u.toString(), 302);
  }

  if (path === "gw_message.php") {
    return text(q("message") ? "Notice from the network." : "OK");
  }

  if (path === "auth") {
    await heartbeat(routerId);
    const stage = q("stage");
    const token = q("token");
    const sql = await getSql();
    if (stage === "logout") {
      if (token) {
        await sql`
          update hw_authorizations set status = 'ENDED', ended_at = now()
          where token = ${token} and router_id = ${routerId} and status = 'ACTIVE'
        `;
      }
      return text("Auth: 0\nMessages: logged out");
    }
    // login + counters: allowed only while the package is running.
    if (!token) return text("Auth: 0\nMessages: missing token");
    const rows = await sql<{ id: string; mac_norm: string; cp_status: string | null; cust_status: string | null }>`
      select a.id, a.mac_norm, cp.status as cp_status, c.status as cust_status
      from hw_authorizations a
      left join customer_packages cp on cp.id = a.customer_package_id
      left join customers c on c.id = cp.customer_id
      where a.token = ${token} and a.router_id = ${routerId}
        and a.status = 'ACTIVE' and a.expires_at > now()
      limit 1
    `;
    const row = rows[0];
    const mac = q("mac").toLowerCase().replace(/[^0-9a-f]/g, "");
    const stillPaid = row && (row.cp_status === null || row.cp_status === "ACTIVE") && row.cust_status !== "BLOCKED";
    if (!row || !stillPaid || (mac && mac !== row.mac_norm)) {
      if (row && !stillPaid) {
        await sql`update hw_authorizations set status = 'ENDED', ended_at = now() where id = ${row.id}`;
      }
      return text("Auth: 0\nMessages: access ended");
    }
    return text("Auth: 1\nMessages: ok");
  }

  return text("Not found", 404);
}
