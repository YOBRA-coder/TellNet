/**
 * Network-map data for Omada / Ruijie sites.
 *
 * A vendor controller/gateway is not a RouterOS box, so there is nothing to ping
 * "from the router" and no port table. What we DO know for real:
 *  - which client devices are switched on through a site right now (hw_authorizations)
 *  - for Omada, which AP each client came through (the portal redirect carries apMac)
 * That is what the map shows for these sites; nothing is invented.
 */
import { getSql } from "@/lib/db";
import { normMac } from "./context.server";

/** Devices switched on and not yet expired, per Omada/Ruijie site. */
export async function hwActiveDeviceCounts(): Promise<Map<string, number>> {
  const sql = await getSql();
  const rows = await sql<{ router_id: string; n: number }>`
    select router_id, count(distinct mac_norm)::int as n
    from hw_authorizations
    where status = 'ACTIVE' and expires_at > now()
    group by router_id
  `;
  return new Map(rows.map((r) => [String(r.router_id), Number(r.n)]));
}

function apMacOf(extra: unknown): string {
  try {
    const p = JSON.parse(String(extra ?? "{}")) as Record<string, string>;
    return p.apMac ? normMac(String(p.apMac)) : "";
  } catch {
    return "";
  }
}

/**
 * Update the access points of Omada/Ruijie sites: connected-client count (by AP MAC)
 * and last-seen. Status is ONLINE while customers are connected through the AP,
 * otherwise UNKNOWN (we cannot ping it from here, so we never claim OFFLINE).
 */
export async function refreshHwAccessPoints(routerId?: string): Promise<void> {
  const sql = await getSql();
  const aps = await sql<{ id: string; mikrotik_id: string; mac_address: string | null; status: string }>`
    select a.id, a.mikrotik_id, a.mac_address, a.status
    from access_points a join mikrotiks m on m.id = a.mikrotik_id
    where m.hardware_type <> 'mikrotik'
      and (${routerId ?? null}::text is null or a.mikrotik_id = ${routerId ?? null})
  `;
  if (aps.length === 0) return;
  const auths = await sql<{ router_id: string; mac_norm: string; extra: string | null }>`
    select router_id, mac_norm, extra from hw_authorizations
    where status = 'ACTIVE' and expires_at > now()
  `;
  const perAp = new Map<string, Set<string>>();
  for (const a of auths) {
    const ap = apMacOf(a.extra);
    if (!ap) continue;
    const key = `${a.router_id}|${ap}`;
    perAp.set(key, (perAp.get(key) ?? new Set()).add(String(a.mac_norm)));
  }
  for (const ap of aps) {
    const mac = ap.mac_address ? normMac(ap.mac_address) : "";
    // Without a MAC we cannot tell which clients belong to this AP.
    const clients = mac ? (perAp.get(`${ap.mikrotik_id}|${mac}`)?.size ?? 0) : null;
    const status = clients && clients > 0 ? "ONLINE" : "UNKNOWN";
    await sql`
      update access_points set
        status = ${status}, clients = ${clients}, latency_ms = null, checked_at = now(),
        last_seen_at = case when ${status} = 'ONLINE' then now() else last_seen_at end
      where id = ${ap.id}
    `;
  }
}

/**
 * One revenue sample per connected paying package for Omada APs (same table the
 * MikroTik sampler uses; revenue is split by sample share). Ruijie's WiFiDog
 * protocol does not say which AP a client is on, so Ruijie sites are not sampled.
 */
export async function sampleHwApUsage(): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ router_id: string; extra: string | null; package_id: string; customer_id: string }>`
    select a.router_id, a.extra, cp.id as package_id, cp.customer_id
    from hw_authorizations a
    join customer_packages cp on cp.id = a.customer_package_id
    where a.status = 'ACTIVE' and a.expires_at > now() and cp.status = 'ACTIVE' and a.vendor = 'omada'
  `;
  if (rows.length === 0) return 0;
  const aps = await sql<{ id: string; mikrotik_id: string; mac_address: string | null }>`
    select id, mikrotik_id, mac_address from access_points where mac_address is not null
  `;
  const byKey = new Map<string, string[]>();
  for (const a of aps) {
    const k = `${a.mikrotik_id}|${normMac(String(a.mac_address))}`;
    byKey.set(k, [...(byKey.get(k) ?? []), a.id]);
  }
  const seen = new Set<string>();
  let n = 0;
  for (const r of rows) {
    const ap = apMacOf(r.extra);
    const ids = ap ? byKey.get(`${r.router_id}|${ap}`) : undefined;
    if (!ids || ids.length !== 1) continue;
    const k = `${ids[0]}|${r.package_id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    await sql`
      insert into ap_usage (ap_key, package_id, customer_id, samples)
      values (${ids[0]}, ${r.package_id}, ${r.customer_id}, 1)
      on conflict (ap_key, package_id) do update set samples = ap_usage.samples + 1, last_seen = now()
    `;
    n += 1;
  }
  return n;
}
