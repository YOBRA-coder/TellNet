/**
 * Hardware abstraction layer.
 *
 * The billing code (activation, expiry, disconnect, block) calls the functions
 * exported here instead of talking to a router directly:
 *
 *   customer arrived through an Omada / Ruijie portal  -> that vendor's driver
 *   anyone else (MikroTik hotspot, admin retries ...)  -> the original MikroTik
 *                                                         code, unchanged
 *
 * "Arrived through a vendor portal" is known from hw_clients (see
 * context.server.ts): the portal redirect stores the client's MAC etc. and the
 * portal page ties it to the browser's device token.
 */
import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import type { RouterProbe } from "@/lib/types";
import { asHardwareType, parseHwConfig, type HardwareType } from "@/lib/hardware";
import {
  disableUser as legacyDisableUser,
  disconnectUser as legacyDisconnectUser,
  getRouterCredentials,
  getRouterCredentialsById,
  probeRouter,
} from "../mikrotik.server";
import { omadaDriver } from "./omada.driver";
import { ruijieDriver } from "./ruijie.driver";
import { findClientContext } from "./context.server";
import {
  HardwareError,
  emptyProbe,
  type ClientContext,
  type HardwareDriver,
  type HwAuthorization,
  type HwRouter,
} from "./types";

export { HardwareError } from "./types";
export type { HwRouter, ClientContext } from "./types";
export {
  bindClientContext,
  findClientContext,
  normMac,
  saveClientContext,
} from "./context.server";

const drivers: Record<Exclude<HardwareType, "mikrotik">, HardwareDriver> = {
  omada: omadaDriver,
  ruijie: ruijieDriver,
};

export function getDriver(type: HardwareType): HardwareDriver | null {
  return type === "mikrotik" ? null : drivers[type];
}

function mapRouter(r: Record<string, unknown>): HwRouter {
  return {
    id: String(r.id),
    name: String(r.name),
    type: asHardwareType(r.hardware_type),
    host: String(r.host ?? ""),
    user: String(r.api_user ?? ""),
    password: String(r.api_password ?? ""),
    insecureTls: Boolean(r.insecure_tls),
    config: parseHwConfig(r.hw_config),
  };
}

/** The router row when it is an Omada/Ruijie one; null for MikroTik or unknown ids. */
export async function getHwRouter(id: string): Promise<HwRouter | null> {
  const sql = await getSql();
  const row = (
    await sql<Record<string, unknown>>`
      select id, name, hardware_type, host, api_user, api_password, insecure_tls, hw_config
      from mikrotiks where id = ${id} limit 1
    `
  )[0];
  if (!row) return null;
  const r = mapRouter(row);
  return r.type === "mikrotik" ? null : r;
}

/** Probe any stored router (MikroTik or not) — used by the pollers and the admin page. */
export async function probeStoredRouter(id: string): Promise<RouterProbe | null> {
  const hw = await getHwRouter(id);
  if (hw) return getDriver(hw.type)!.probe(hw);
  const creds = await getRouterCredentialsById(id);
  if (!creds) return null;
  return probeRouter(creds);
}

export async function probeHwRouter(router: HwRouter): Promise<RouterProbe> {
  const d = getDriver(router.type);
  return d ? d.probe(router) : emptyProbe({ error: "Not a vendor-portal router." });
}

export type HardwareTarget = { router: HwRouter; client: ClientContext };

/**
 * Where should this customer be switched on? null = the original MikroTik path.
 * (explicit token: that browser only; no token: the customer's own stored one.)
 */
export async function resolveHardwareTarget(opts: {
  deviceToken?: string | null;
  customerId?: string | null;
  /**
   * The site this sale was made at. A remembered Omada/Ruijie redirect only counts when it is for
   * that same site: a customer who used an Omada site last week and now buys at a MikroTik site
   * must be switched on by the MikroTik, not sent to the old controller.
   */
  siteId?: string | null;
}): Promise<HardwareTarget | null> {
  const client = await findClientContext(opts);
  if (!client || client.vendor === "mikrotik") return null;
  const router = await getHwRouter(client.routerId);
  if (!router) return null;
  if (opts.siteId) {
    const sql = await getSql();
    const r = await sql<{ site_id: string | null }>`select site_id from mikrotiks where id = ${router.id} limit 1`;
    if ((r[0]?.site_id ?? "site_default") !== opts.siteId) {
      // Only step aside when the sale's own site really has a MikroTik to switch the customer on.
      // (If the site has none, keep the vendor redirect: the old behaviour, safe if the site was lost.)
      const mt = await sql<{ n: number }>`
        select count(*)::int as n from mikrotiks
        where hardware_type = 'mikrotik' and coalesce(site_id, 'site_default') = ${opts.siteId}
      `;
      if (Number(mt[0]?.n) > 0) return null;
    }
  }
  return { router, client };
}

export async function authorizeOnHardware(
  target: HardwareTarget,
  a: { username: string; seconds: number },
): Promise<{ clientMac: string; clientIp: string | null; token?: string; handoffUrl?: string }> {
  const driver = getDriver(target.router.type);
  if (!driver) throw new HardwareError("Unsupported hardware type.");
  const seconds = Math.max(60, Math.floor(a.seconds));
  const res = await driver.authorize({
    router: target.router,
    client: target.client,
    username: a.username,
    seconds,
  });
  const extra = { ...(res.extra ?? {}), ...(res.handoffUrl ? { handoffUrl: res.handoffUrl } : {}) };
  const sql = await getSql();
  // A re-authorize of the same device replaces its previous authorization.
  await sql`
    update hw_authorizations set status = 'ENDED', ended_at = now()
    where username = ${a.username} and mac_norm = ${target.client.macNorm} and status = 'ACTIVE'
  `;
  await sql`
    insert into hw_authorizations (id, router_id, vendor, username, client_mac, mac_norm, token, expires_at, extra)
    values (
      ${nid("hwa")}, ${target.router.id}, ${target.router.type}, ${a.username},
      ${target.client.clientMac}, ${target.client.macNorm}, ${res.token ?? null},
      ${new Date(Date.now() + seconds * 1000).toISOString()}, ${JSON.stringify(extra)}
    )
  `;
  return {
    clientMac: target.client.clientMac,
    clientIp: target.client.clientIp,
    token: res.token,
    handoffUrl: res.handoffUrl,
  };
}

/** Attach freshly created authorizations to their customer_package row. */
export async function linkAuthorization(username: string, customerPackageId: string) {
  const sql = await getSql();
  await sql`
    update hw_authorizations set customer_package_id = ${customerPackageId}
    where username = ${username} and status = 'ACTIVE' and customer_package_id is null
  `;
}

function parseExtra(raw: unknown): Record<string, string> {
  try {
    const p = JSON.parse(String(raw ?? "{}"));
    return p && typeof p === "object" ? (p as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function mapAuth(r: Record<string, unknown>): HwAuthorization {
  const extra = parseExtra(r.extra);
  return {
    id: String(r.id),
    routerId: String(r.router_id),
    vendor: asHardwareType(r.vendor),
    username: String(r.username),
    clientMac: String(r.client_mac),
    macNorm: String(r.mac_norm),
    token: r.token ? String(r.token) : null,
    expiresAt: new Date(String(r.expires_at)),
    extra,
  };
}

async function hasMikroTik() {
  return Boolean(await getRouterCredentials());
}

/**
 * Switch a login off. Drop-in replacement for the MikroTik disconnectUser():
 * usernames that were never on Omada/Ruijie go straight to the old code.
 */
export async function disconnectUser(username: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select * from hw_authorizations where username = ${username}
  `;
  if (rows.length === 0) return legacyDisconnectUser(username);

  let firstError: unknown = null;
  for (const row of rows.filter((r) => r.status === "ACTIVE")) {
    const auth = mapAuth(row);
    try {
      const router = await getHwRouter(auth.routerId);
      const driver = router ? getDriver(router.type) : null;
      if (router && driver) await driver.deauthorize(router, auth);
      await sql`update hw_authorizations set status = 'ENDED', ended_at = now() where id = ${auth.id}`;
    } catch (err) {
      firstError ??= err; // stays ACTIVE so a later disconnect/expiry retries it
    }
  }
  // A customer can also exist on a MikroTik site (mixed deployments): best effort.
  if (await hasMikroTik()) await legacyDisconnectUser(username).catch(() => {});
  if (firstError) throw firstError;
}

/**
 * "Disable" has no separate meaning for Omada/Ruijie: ending the authorization
 * is what stops the client from getting (back) online.
 */
export async function disableUser(username: string): Promise<void> {
  const sql = await getSql();
  const any = await sql<{ n: number }>`
    select count(*)::int as n from hw_authorizations where username = ${username}
  `;
  if (!Number(any[0]?.n)) return legacyDisableUser(username);
  await disconnectUser(username);
  if (await hasMikroTik()) await legacyDisableUser(username).catch(() => {});
}

/** Browser redirect that finishes a Ruijie login (null for every other case). */
export async function takeHandoffUrl(deviceToken: string): Promise<string | null> {
  const ctx = await findClientContext({ deviceToken });
  if (!ctx) return null;
  const sql = await getSql();
  const rows = await sql<{ id: string; extra: string | null }>`
    select id, extra from hw_authorizations
    where vendor = 'ruijie' and mac_norm = ${ctx.macNorm} and status = 'ACTIVE'
      and expires_at > now() and handoff_done = false
    order by authorized_at desc limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const url = parseExtra(row.extra).handoffUrl;
  if (!url) return null;
  await sql`update hw_authorizations set handoff_done = true where id = ${row.id}`;
  return url;
}

/** Slug of the TelNet site a router belongs to (for the portal link). */
export async function siteSlugForRouter(routerId: string): Promise<string | null> {
  const sql = await getSql();
  const r = await sql<{ slug: string }>`
    select s.slug from mikrotiks m join sites s on s.id = m.site_id where m.id = ${routerId} limit 1
  `;
  return r[0]?.slug ?? null;
}
