/**
 * RADIUS helpers for multi-AP hotspot.
 * Ledger is source of truth: Access-Accept style attributes for remaining time.
 * Enable in Settings; run UDP listener from scripts/radius-server.mjs in production.
 */
import { getSql } from "@/lib/db";
import { getSettingsSecret } from "./settings.server";

export async function radiusLookupUser(username: string) {
  const sql = await getSql();
  const now = new Date();
  const rows = await sql<{
    id: string;
    phone: string;
    expiry_time: string;
    speed_limit_kbps: number;
    radius_password: string | null;
    mikrotik_username: string | null;
    package_name: string;
  }>`
    select cp.id, c.phone, cp.expiry_time, cp.speed_limit_kbps,
           cp.radius_password, cp.mikrotik_username, pkg.name as package_name
    from customer_packages cp
    join customers c on c.id = cp.customer_id
    join packages pkg on pkg.id = cp.package_id
    where cp.status = 'ACTIVE'
      and cp.expiry_time > now()
      and (
        cp.mikrotik_username = ${username}
        or c.phone = ${username}
        or concat('u', right(regexp_replace(c.phone, '\\D', '', 'g'), 9)) = ${username}
      )
    order by cp.expiry_time desc
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const remaining = Math.max(
    0,
    Math.floor((new Date(row.expiry_time).getTime() - now.getTime()) / 1000),
  );
  if (remaining <= 0) return null;
  const password =
    row.radius_password ||
    (row.mikrotik_username || username).slice(-8);
  return {
    username: row.mikrotik_username || username,
    password,
    sessionTimeout: remaining,
    downloadKbps: Number(row.speed_limit_kbps) || 2048,
    packageName: row.package_name,
    portLimit: 1,
  };
}

export async function getRadiusConfig() {
  const s = await getSettingsSecret();
  const sql = await getSql();
  const row = (
    await sql<{
      radius_enabled: boolean;
      radius_secret: string | null;
      radius_auth_port: number;
      radius_acct_port: number;
    }>`
      select radius_enabled, radius_secret, radius_auth_port, radius_acct_port
      from settings where id = 'default' limit 1
    `
  )[0];
  return {
    enabled: Boolean(row?.radius_enabled),
    secret: row?.radius_secret || "",
    authPort: Number(row?.radius_auth_port) || 1812,
    acctPort: Number(row?.radius_acct_port) || 1813,
  };
}
