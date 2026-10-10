import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { asHardwareType } from "@/lib/hardware";
import type { ClientContext } from "./types";

/** "AA-BB-CC-DD-EE-FF" / "aa:bb:..." -> "aabbccddeeff" (for comparing MACs). */
export function normMac(mac: string) {
  return mac.toLowerCase().replace(/[^0-9a-f]/g, "");
}

const clip = (v: string | null | undefined, n = 120) => (v ?? "").toString().trim().slice(0, n);

/** How long a stored portal redirect stays usable for activating a package. */
const CONTEXT_TTL_DAYS = 7;

export async function saveClientContext(input: {
  routerId: string;
  vendor: string;
  clientMac: string;
  clientIp?: string | null;
  apMac?: string | null;
  ssid?: string | null;
  radioId?: string | null;
  siteName?: string | null;
  extra?: Record<string, string>;
}): Promise<string | null> {
  const mac = clip(input.clientMac, 40);
  const norm = normMac(mac);
  if (norm.length !== 12) return null; // not a MAC address
  const id = `hwc_${randomBytes(12).toString("hex")}`;
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(input.extra ?? {})) extra[clip(k, 30)] = clip(v, 300);
  const sql = await getSql();
  await sql`
    insert into hw_clients (id, router_id, vendor, client_mac, mac_norm, client_ip, ap_mac, ssid, radio_id, site_name, extra)
    values (
      ${id}, ${input.routerId}, ${asHardwareType(input.vendor)}, ${mac}, ${norm},
      ${clip(input.clientIp, 60) || null}, ${clip(input.apMac, 40) || null},
      ${clip(input.ssid, 80) || null}, ${clip(input.radioId, 10) || null},
      ${clip(input.siteName, 80) || null}, ${JSON.stringify(extra)}
    )
  `;
  // keep the table small
  await sql`delete from hw_clients where seen_at < now() - interval '30 days'`;
  return id;
}

/** Tie a portal redirect (hwc id from the URL) to this browser's device token. */
export async function bindClientContext(ctxId: string, deviceToken: string): Promise<boolean> {
  if (!/^hwc_[0-9a-f]{24}$/.test(ctxId) || deviceToken.length < 8) return false;
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    update hw_clients set device_token = ${deviceToken}, seen_at = now()
    where id = ${ctxId} and (device_token is null or device_token = ${deviceToken})
    returning id
  `;
  return rows.length > 0;
}

function mapContext(r: Record<string, unknown>): ClientContext {
  let extra: Record<string, string> = {};
  try {
    const p = JSON.parse(String(r.extra ?? "{}"));
    if (p && typeof p === "object") extra = p as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {
    id: String(r.id),
    routerId: String(r.router_id),
    vendor: asHardwareType(r.vendor),
    clientMac: String(r.client_mac),
    macNorm: String(r.mac_norm),
    clientIp: r.client_ip ? String(r.client_ip) : null,
    apMac: r.ap_mac ? String(r.ap_mac) : null,
    ssid: r.ssid ? String(r.ssid) : null,
    radioId: r.radio_id ? String(r.radio_id) : null,
    siteName: r.site_name ? String(r.site_name) : null,
    extra,
  };
}

/**
 * Latest portal redirect for a browser. With an explicit device token only that
 * token is considered; otherwise (background jobs: callbacks, promotions,
 * retries) the customer's own stored device token is used.
 */
export async function findClientContext(opts: {
  deviceToken?: string | null;
  customerId?: string | null;
}): Promise<ClientContext | null> {
  const sql = await getSql();
  let token = opts.deviceToken?.trim() || null;
  if (!token && opts.customerId) {
    const c = await sql<{ device_token: string | null }>`
      select device_token from customers where id = ${opts.customerId} limit 1
    `;
    token = c[0]?.device_token ?? null;
  }
  if (!token) return null;
  const rows = await sql<Record<string, unknown>>`
    select * from hw_clients
    where device_token = ${token}
      and seen_at > now() - (${CONTEXT_TTL_DAYS}::int * interval '1 day')
    order by seen_at desc
    limit 1
  `;
  return rows[0] ? mapContext(rows[0]) : null;
}
