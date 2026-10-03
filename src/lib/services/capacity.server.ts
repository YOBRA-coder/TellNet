/**
 * Effective hotspot capacity. Each ISP path carries its own total speed,
 * per-user cap and seat count (an Airtel 5G line is 15 or 30 Mbps, Starlink
 * is far more), so the limits TelNet enforces follow the ISPs that are
 * actually connected — not one fixed default.
 *
 * PER_ISP mode, using every path that is not OFFLINE (if all are offline,
 * every configured path, so a blip doesn't suddenly change customer speeds):
 *   total    = sum of the paths' totals
 *   per user = the highest per-user cap among them (a customer can be served
 *              by the best line that is up)
 *   seats    = sum of the paths' seats
 * No ISP paths configured, or GLOBAL mode -> the values under Settings.
 */
import { getSql } from "@/lib/db";

export type EffectiveCapacity = {
  mode: "PER_ISP" | "GLOBAL";
  source: "isp" | "global";
  totalKbps: number;
  perUserMaxKbps: number;
  maxUsers: number;
  paths: { id: string; name: string; type: string; status: string; totalKbps: number; perUserMaxKbps: number; maxUsers: number; counted: boolean }[];
};

export async function getEffectiveCapacity(siteId?: string | null): Promise<EffectiveCapacity> {
  const sql = await getSql();
  const s = (
    await sql<{ capacity_mode: string | null; isp_total_kbps: number; per_user_max_kbps: number; max_users: number }>`
      select capacity_mode, isp_total_kbps, per_user_max_kbps, max_users
      from settings where id = 'default' limit 1
    `
  )[0];
  const mode = s?.capacity_mode === "GLOBAL" ? "GLOBAL" : "PER_ISP";
  const global = {
    totalKbps: Number(s?.isp_total_kbps) || 30720,
    perUserMaxKbps: Number(s?.per_user_max_kbps) || 5120,
    maxUsers: Number(s?.max_users) || 25,
  };
  const allIsps = await sql<{ id: string; name: string; type: string; status: string; total_kbps: number; per_user_max_kbps: number; max_users: number; site_id: string | null }>`
    select id, name, type, status, total_kbps, per_user_max_kbps, max_users, site_id
    from isps order by sort_order
  `;
  // With a site given, only that site's ISP lines (plus lines not tied to a site)
  // count, so one town's capacity is not inflated or used up by another's.
  // A site with no lines of its own falls back to all of them.
  const scoped = siteId ? allIsps.filter((i) => !i.site_id || i.site_id === siteId) : allIsps;
  const isps = scoped.length > 0 ? scoped : allIsps;
  const up = isps.filter((i) => i.status !== "OFFLINE");
  const counted = up.length > 0 ? up : isps;
  const countedIds = new Set(counted.map((i) => i.id));
  const paths = isps.map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    status: i.status,
    totalKbps: Number(i.total_kbps),
    perUserMaxKbps: Number(i.per_user_max_kbps),
    maxUsers: Number(i.max_users),
    counted: mode === "PER_ISP" && countedIds.has(i.id),
  }));
  if (mode === "GLOBAL" || counted.length === 0) {
    return { mode, source: "global", ...global, paths };
  }
  return {
    mode,
    source: "isp",
    totalKbps: counted.reduce((n, i) => n + Number(i.total_kbps), 0),
    perUserMaxKbps: Math.max(...counted.map((i) => Number(i.per_user_max_kbps))),
    maxUsers: counted.reduce((n, i) => n + Number(i.max_users), 0),
    paths,
  };
}
