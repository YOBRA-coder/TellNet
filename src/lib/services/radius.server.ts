/**
 * RADIUS helpers for multi-AP hotspot.
 * The ledger (customer_packages) is the source of truth: Access-Accept carries the
 * REMAINING seconds, so roaming between APs never starts a new bill.
 * The UDP listener lives in radius-listener.server.ts and starts with the app.
 */
import { getSql } from "@/lib/db";
import { getEffectiveCapacity } from "@/lib/services/capacity.server";

export type RadiusUser = {
  username: string;
  password: string;
  sessionTimeout: number;
  downloadKbps: number;
  uploadKbps: number;
  packageName: string;
  portLimit: number;
  classId: string;
};

export async function radiusLookupUser(username: string): Promise<RadiusUser | null> {
  const name = String(username || "").trim();
  if (!name) return null;
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    expiry_time: string;
    speed_limit_kbps: number;
    upload_kbps: number | null;
    radius_password: string | null;
    mikrotik_username: string | null;
    package_name: string;
    max_devices: number | null;
  }>`
    select cp.id, cp.expiry_time, cp.speed_limit_kbps, cp.radius_password,
           cp.mikrotik_username, pkg.name as package_name, pkg.upload_kbps,
           pkg.max_devices
    from customer_packages cp
    join customers c on c.id = cp.customer_id
    join packages pkg on pkg.id = cp.package_id
    where cp.status = 'ACTIVE'
      and cp.expiry_time > now()
      and c.status <> 'BLOCKED'
      and (
        cp.mikrotik_username = ${name}
        or c.phone = ${name}
        or concat('u', right(regexp_replace(c.phone, '\\D', '', 'g'), 9)) = ${name}
      )
    order by cp.expiry_time desc
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const remaining = Math.floor((new Date(row.expiry_time).getTime() - Date.now()) / 1000);
  if (remaining <= 0) return null;
  // No stored secret = this package predates RADIUS support; it can't be
  // authenticated over RADIUS until it is next (re)activated on the router.
  if (!row.radius_password) return null;
  const cap = (await getEffectiveCapacity()).perUserMaxKbps || Infinity;
  return {
    username: row.mikrotik_username || name,
    password: row.radius_password,
    sessionTimeout: remaining,
    downloadKbps: Math.min(Number(row.speed_limit_kbps) || 2048, cap),
    uploadKbps: Math.min(Number(row.upload_kbps) || 1024, cap),
    packageName: row.package_name,
    portLimit: Number(row.max_devices) >= 2 ? 2 : 1,
    classId: row.id,
  };
}

export async function getRadiusConfig() {
  const sql = await getSql();
  const row = (
    await sql<{
      radius_enabled: boolean;
      radius_secret: string | null;
      radius_auth_port: number;
      radius_acct_port: number;
      radius_server_host: string | null;
    }>`
      select radius_enabled, radius_secret, radius_auth_port, radius_acct_port, radius_server_host
      from settings where id = 'default' limit 1
    `
  )[0];
  return {
    enabled: Boolean(row?.radius_enabled),
    secret: row?.radius_secret || "",
    authPort: Number(row?.radius_auth_port) || 1812,
    acctPort: Number(row?.radius_acct_port) || 1813,
    serverHost: row?.radius_server_host || "",
  };
}
