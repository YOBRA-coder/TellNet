import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import type { RouterProbe } from "@/lib/types";
import { getSettingsSecret } from "./settings.server";
import { normalizeRouterHost } from "@/lib/mikrotik-host";
import {
  apiProbe,
  apiCall,
  apiUpsertHotspotUser,
  apiDisableUser,
  apiDisconnectUser,
  type ApiCreds,
} from "./routeros-api.server";
import {
  CAMOUFLAGE,
  camouflageScript,
  randomMacFromOui,
  type CamouflageKind,
} from "@/lib/camouflage";

export { normalizeRouterHost, parseRouterHost } from "@/lib/mikrotik-host";

export class MikroTikError extends Error {
  constructor(message = "Router is currently unavailable.") {
    super(message);
    this.name = "MikroTikError";
  }
}

export type HotspotUserInput = {
  username: string;
  password: string;
  downloadKbps: number;
  uploadKbps: number;
  sessionTimeoutSeconds: number;
  customerId: string;
  macAddress?: string | null;
  /** 1 or 2 — how many devices may share this hotspot login (default 1). */
  maxDevices?: number;
  /** STUDENT packages get their own hotspot profile + domain block. */
  category?: "STANDARD" | "STUDENT";
  /** Non-study domains to drop for STUDENT packages (best-effort, see below). */
  blockedDomains?: string[];
};

export type RouterCreds = {
  host: string;
  user: string;
  password: string;
  hotspot: string;
  insecureTls?: boolean;
  /** rest = RouterOS 7 REST; api6 = RouterOS 6 binary API */
  apiMode: "rest" | "api6";
  apiPort?: number;
};

function usernameForPhone(phone: string) {
  return `u${phone.replace(/\D/g, "").slice(-9)}`;
}

function randomPassword() {
  return nid("pw").slice(3, 11);
}

export async function getRouterCredentials(): Promise<RouterCreds | null> {
  const sql = await getSql();
  const primary = await sql<{
    host: string;
    api_user: string;
    api_password: string;
    hotspot_name: string | null;
    insecure_tls: boolean | null;
    api_mode: string | null;
    api_port: number | null;
  }>`
    select host, api_user, api_password, hotspot_name, insecure_tls, api_mode, api_port
    from mikrotiks
    where is_primary = true
    limit 1
  `;
  const row = primary[0];
  if (row?.host && row.api_user && row.api_password) {
    return {
      host: String(row.host).replace(/\/$/, ""),
      user: String(row.api_user),
      password: String(row.api_password),
      hotspot: String(row.hotspot_name ?? "hotspot1"),
      insecureTls: Boolean(row.insecure_tls),
      apiMode: row.api_mode === "api6" ? "api6" : "rest",
      apiPort: row.api_port != null ? Number(row.api_port) : undefined,
    };
  }
  const s = await getSettingsSecret();
  if (s.mikrotikHost && s.mikrotikUser && s.mikrotikPassword) {
    return {
      host: s.mikrotikHost.replace(/\/$/, ""),
      user: s.mikrotikUser,
      password: s.mikrotikPassword,
      hotspot: s.mikrotikHotspot ?? "hotspot1",
      apiMode: "rest",
    };
  }
  return null;
}

export async function getRouterCredentialsById(
  id: string,
): Promise<RouterCreds | null> {
  const sql = await getSql();
  const row = (
    await sql<{
      host: string;
      api_user: string;
      api_password: string;
      hotspot_name: string | null;
      insecure_tls: boolean | null;
    }>`
      select host, api_user, api_password, hotspot_name, insecure_tls, api_mode, api_port
      from mikrotiks
      where id = ${id}
      limit 1
    `
  )[0];
  if (!row?.host || !row.api_user || !row.api_password) return null;
  return {
    host: String(row.host).replace(/\/$/, ""),
    user: String(row.api_user),
    password: String(row.api_password),
    hotspot: String(row.hotspot_name ?? "hotspot1"),
    insecureTls: Boolean(row.insecure_tls),
    apiMode: (row as { api_mode?: string }).api_mode === "api6" ? "api6" : "rest",
    apiPort: (row as { api_port?: number | null }).api_port != null
      ? Number((row as { api_port?: number }).api_port)
      : undefined,
  };
}

/** Returns true when a real MikroTik is configured (live only). */
async function hasLiveRouter() {
  const s = await getSettingsSecret();
  if (s.forceActivationFailure) return false;
  const creds = await getRouterCredentials();
  return Boolean(creds);
}

async function routeros(
  path: string,
  init: RequestInit = {},
  creds?: RouterCreds,
) {
  const c = creds ?? (await getRouterCredentials());
  if (!c) throw new MikroTikError();
  const host = c.host.replace(/\/$/, "");
  const auth = Buffer.from(`${c.user}:${c.password}`).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const headers = {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/json",
    ...(init.headers ?? {}),
  };
  const initOut: RequestInit & { dispatcher?: unknown } = {
    ...init,
    headers,
    signal: controller.signal,
  };
  if (c.insecureTls) {
    const { Agent } = await import("undici");
    initOut.dispatcher = new Agent({
      connect: { rejectUnauthorized: false },
    });
  }
  try {
    const res = await fetch(`${host}${path}`, initOut);
    if (!res.ok) {
      throw new MikroTikError(
        res.status === 401
          ? "Router rejected the username or password."
          : `Router returned HTTP ${res.status}.`,
      );
    }
    if (res.status === 204) return null;
    return await res.json();
  } catch (err) {
    if (err instanceof MikroTikError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new MikroTikError("Router timed out. Check the host and REST service.");
    }
    throw new MikroTikError();
  } finally {
    clearTimeout(timer);
  }
}

export async function probeRouter(creds: RouterCreds): Promise<RouterProbe> {
  if (creds.apiMode === "api6") {
    try {
      const r = await apiProbe({
        host: creds.host,
        port: creds.apiPort || 8728,
        user: creds.user,
        password: creds.password,
      });
      return {
        ok: true,
        identity: r.identity || null,
        version: r.version || null,
        boardName: r.boardName || null,
        uptime: r.uptime || null,
        cpuLoad: r.cpuLoad,
        hotspotServers: r.hotspotServers || [],
        interfaces: [],
        error: null,
      };
    } catch (err) {
      return {
        ok: false,
        identity: null,
        version: null,
        boardName: null,
        uptime: null,
        cpuLoad: null,
        hotspotServers: [],
        interfaces: [],
        error: err instanceof Error ? err.message : "RouterOS 6 API failed",
      };
    }
  }
  try {
    const resource = (await routeros("/rest/system/resource", {}, creds)) as Record<
      string,
      unknown
    > | null;
    let identity: string | null = null;
    try {
      const ident = (await routeros("/rest/system/identity", {}, creds)) as {
        name?: string;
      } | null;
      identity = ident?.name ? String(ident.name) : null;
    } catch {
      identity = null;
    }

    let hotspotServers: string[] = [];
    try {
      const hs = (await routeros("/rest/ip/hotspot", {}, creds)) as Array<{
        name?: string;
      }> | null;
      hotspotServers = (hs ?? []).map((h) => String(h.name ?? "")).filter(Boolean);
    } catch {
      hotspotServers = [];
    }

    let interfaces: RouterProbe["interfaces"] = [];
    try {
      const ifaces = (await routeros("/rest/interface", {}, creds)) as Array<{
        name?: string;
        type?: string;
        running?: string | boolean;
      }> | null;
      interfaces = (ifaces ?? [])
        .filter((i) => i.name)
        .slice(0, 16)
        .map((i) => ({
          name: String(i.name),
          type: String(i.type ?? "ether"),
          running: i.running === true || i.running === "true",
        }));
    } catch {
      interfaces = [];
    }

    const cpuRaw = resource?.["cpu-load"] ?? resource?.cpu_load;
    return {
      ok: true,
      identity,
      version: resource?.version ? String(resource.version) : null,
      boardName: resource?.["board-name"]
        ? String(resource["board-name"])
        : resource?.board_name
          ? String(resource.board_name)
          : null,
      uptime: resource?.uptime ? String(resource.uptime) : null,
      cpuLoad:
        cpuRaw == null || cpuRaw === ""
          ? null
          : Number.parseInt(String(cpuRaw), 10) || 0,
      hotspotServers,
      interfaces,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      identity: null,
      version: null,
      boardName: null,
      uptime: null,
      cpuLoad: null,
      hotspotServers: [],
      interfaces: [],
      error:
        err instanceof MikroTikError
          ? err.message
          : "Could not reach the router. Enable REST (IP → Services → www) and check the host.",
    };
  }
}

async function ensureDeviceProfile(creds: RouterCreds, maxDevices: number) {
  const name = maxDevices >= 2 ? "telnet-2dev" : "telnet-1dev";
  try {
    const profiles = (await routeros(
      "/rest/ip/hotspot/user/profile",
      {},
      creds,
    )) as Array<{ ".id"?: string; name?: string }> | null;
    const hit = (profiles ?? []).find((p) => p.name === name);
    const body = {
      name,
      "shared-users": String(maxDevices),
      "keepalive-timeout": "2m",
      "idle-timeout": "none",
    };
    if (hit?.[".id"]) {
      await routeros(
        `/rest/ip/hotspot/user/profile/${encodeURIComponent(hit[".id"])}`,
        { method: "PATCH", body: JSON.stringify({ "shared-users": String(maxDevices) }) },
        creds,
      );
    } else {
      await routeros("/rest/ip/hotspot/user/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      }, creds);
    }
  } catch {
    /* profile is best-effort; user still gets shared-users set directly below */
  }
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Best-effort: gives STUDENT packages their own hotspot user profile so
 * their authenticated IPs land on a dedicated address-list ("telnet-student").
 * NOTE: RouterOS REST API (v7) only — the legacy binary-API (v6) path does
 * not attempt domain blocking. Verify layer7 support on your RouterOS
 * version before relying on this in production.
 */
async function ensureStudentProfile(creds: RouterCreds, maxDevices: number) {
  try {
    const profiles = (await routeros(
      "/rest/ip/hotspot/user/profile",
      {},
      creds,
    )) as Array<{ ".id"?: string; name?: string }> | null;
    const hit = (profiles ?? []).find((p) => p.name === "telnet-student");
    const body = {
      name: "telnet-student",
      "shared-users": String(maxDevices),
      "address-list": "telnet-student",
      "keepalive-timeout": "2m",
      "idle-timeout": "none",
    };
    if (hit?.[".id"]) {
      await routeros(
        `/rest/ip/hotspot/user/profile/${encodeURIComponent(hit[".id"])}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            "shared-users": String(maxDevices),
            "address-list": "telnet-student",
          }),
        },
        creds,
      );
    } else {
      await routeros(
        "/rest/ip/hotspot/user/profile",
        { method: "PUT", body: JSON.stringify(body) },
        creds,
      );
    }
  } catch {
    /* profile is best-effort; user still gets the default profile below */
  }
}

/**
 * Best-effort: drops traffic to a configurable set of "non-study" domains
 * for anyone on the telnet-student address-list, via a layer7-protocol
 * regex match + a forward-chain firewall filter. This is a well-known
 * RouterOS pattern, but layer7 matching is CPU-heavier than simple
 * address-list drops, doesn't see traffic hidden behind DNS-over-HTTPS or a
 * VPN, and its exact behaviour differs across RouterOS versions — operators
 * should verify this actually blocks the intended domains on their own
 * router before depending on it.
 */
async function ensureStudentDomainBlock(creds: RouterCreds, domains: string[]) {
  const clean = domains.map((d) => d.trim()).filter(Boolean);
  if (clean.length === 0) return;
  try {
    const regexp = `^.*(${clean.map(escapeRegExp).join("|")}).*$`;
    const l7 = (await routeros(
      "/rest/ip/firewall/layer7-protocol",
      {},
      creds,
    )) as Array<{ ".id"?: string; name?: string }> | null;
    const l7Hit = (l7 ?? []).find((p) => p.name === "telnet-student-block");
    if (l7Hit?.[".id"]) {
      await routeros(
        `/rest/ip/firewall/layer7-protocol/${encodeURIComponent(l7Hit[".id"])}`,
        { method: "PATCH", body: JSON.stringify({ regexp }) },
        creds,
      );
    } else {
      await routeros(
        "/rest/ip/firewall/layer7-protocol",
        {
          method: "PUT",
          body: JSON.stringify({ name: "telnet-student-block", regexp }),
        },
        creds,
      );
    }

    const filters = (await routeros(
      "/rest/ip/firewall/filter",
      {},
      creds,
    )) as Array<{ ".id"?: string; comment?: string }> | null;
    const filterHit = (filters ?? []).find(
      (f) => f.comment === "telnet-student-block",
    );
    if (!filterHit) {
      await routeros(
        "/rest/ip/firewall/filter",
        {
          method: "PUT",
          body: JSON.stringify({
            chain: "forward",
            "src-address-list": "telnet-student",
            "layer7-protocol": "telnet-student-block",
            action: "drop",
            comment: "telnet-student-block",
          }),
        },
        creds,
      );
    }
  } catch {
    /* domain block is best-effort — see function comment */
  }
}

async function kickExtraActiveSessions(username: string, creds: RouterCreds) {
  try {
    const active = (await routeros(
      `/rest/ip/hotspot/active?user=${encodeURIComponent(username)}`,
      {},
      creds,
    )) as Array<{ ".id"?: string }> | null;
    const rows = active ?? [];
    for (const row of rows.slice(1)) {
      if (row[".id"]) {
        await routeros(`/rest/ip/hotspot/active/${encodeURIComponent(row[".id"])}`, {
          method: "DELETE",
        }, creds);
      }
    }
  } catch {
    /* ignore */
  }
}

export async function createAndActivateUser(input: HotspotUserInput) {
  // Live MikroTik only — no simulated activation.
  if (!(await hasLiveRouter())) throw new MikroTikError("No MikroTik router configured or router unreachable.");

  const creds = await getRouterCredentials();
  if (!creds) throw new MikroTikError("No MikroTik router configured. Add one under Operator → Network.");
  const maxDevices = input.maxDevices && input.maxDevices >= 2 ? 2 : 1;

  if (creds.apiMode === "api6") {
    await apiUpsertHotspotUser(
      {
        host: creds.host,
        port: creds.apiPort || 8728,
        user: creds.user,
        password: creds.password,
      },
      {
        username: input.username,
        password: input.password,
        profile: "default",
        limitUptime: String(input.sessionTimeoutSeconds),
        rateLimit: `${input.uploadKbps}k/${input.downloadKbps}k`,
        sharedUsers: String(maxDevices),
        comment: `telnet:${input.customerId}:${maxDevices}dev`,
      },
    );
    // A 2-device login shares one hotspot user — kicking its live sessions
    // here would boot the first device every time a second one joins.
    if (maxDevices < 2) {
      try {
        await apiDisconnectUser(
          {
            host: creds.host,
            port: creds.apiPort || 8728,
            user: creds.user,
            password: creds.password,
          },
          input.username,
        );
      } catch {
        /* optional */
      }
    }
    return { username: input.username };
  }

  await ensureDeviceProfile(creds, maxDevices);
  if (input.category === "STUDENT") {
    await ensureStudentProfile(creds, maxDevices);
    await ensureStudentDomainBlock(creds, input.blockedDomains ?? []);
  }

  const existing = (await routeros(
    `/rest/ip/hotspot/user?name=${encodeURIComponent(input.username)}`,
    {},
    creds,
  )) as Array<{ ".id"?: string }> | null;

  const payload: Record<string, string> = {
    name: input.username,
    password: input.password,
    profile:
      input.category === "STUDENT"
        ? "telnet-student"
        : maxDevices >= 2
          ? "telnet-2dev"
          : "telnet-1dev",
    "limit-uptime": String(input.sessionTimeoutSeconds),
    "rate-limit": `${input.uploadKbps}k/${input.downloadKbps}k`,
    "shared-users": String(maxDevices),
    disabled: "false",
    comment: `telnet:${input.customerId}:${maxDevices}dev`,
  };
  if (input.macAddress) {
    payload["mac-address"] = input.macAddress;
  }

  try {
    if (existing && existing[0]?.[".id"]) {
      await routeros(
        `/rest/ip/hotspot/user/${encodeURIComponent(existing[0][".id"])}`,
        { method: "PATCH", body: JSON.stringify(payload) },
        creds,
      );
    } else {
      await routeros(
        `/rest/ip/hotspot/user`,
        { method: "PUT", body: JSON.stringify(payload) },
        creds,
      );
    }
  } catch {
    const fallback = { ...payload, profile: "default" };
    if (existing && existing[0]?.[".id"]) {
      await routeros(
        `/rest/ip/hotspot/user/${encodeURIComponent(existing[0][".id"])}`,
        { method: "PATCH", body: JSON.stringify(fallback) },
        creds,
      );
    } else {
      await routeros(
        `/rest/ip/hotspot/user`,
        { method: "PUT", body: JSON.stringify(fallback) },
        creds,
      );
    }
  }

  await kickExtraActiveSessions(input.username, creds);
  return { username: input.username };
}

export async function disableUser(username: string) {
  if (!(await hasLiveRouter())) throw new MikroTikError();
  const creds = await getRouterCredentials();
  if (!creds) throw new MikroTikError();
  if (creds.apiMode === "api6") {
    await apiDisableUser(
      {
        host: creds.host,
        port: creds.apiPort || 8728,
        user: creds.user,
        password: creds.password,
      },
      username,
    );
    return;
  }
  const existing = (await routeros(
    `/rest/ip/hotspot/user?name=${encodeURIComponent(username)}`,
    {},
    creds,
  )) as Array<{ ".id"?: string }> | null;
  if (existing?.[0]?.[".id"]) {
    await routeros(
      `/rest/ip/hotspot/user/${encodeURIComponent(existing[0][".id"])}`,
      { method: "PATCH", body: JSON.stringify({ disabled: "true" }) },
      creds,
    );
  }
}

export async function disconnectUser(username: string) {
  if (!(await hasLiveRouter())) throw new MikroTikError();
  const creds = await getRouterCredentials();
  if (!creds) throw new MikroTikError();
  if (creds.apiMode === "api6") {
    await apiDisconnectUser(
      {
        host: creds.host,
        port: creds.apiPort || 8728,
        user: creds.user,
        password: creds.password,
      },
      username,
    );
    return;
  }
  const active = (await routeros(
    `/rest/ip/hotspot/active?user=${encodeURIComponent(username)}`,
    {},
    creds,
  )) as Array<{ ".id"?: string }> | null;
  for (const row of active ?? []) {
    if (row[".id"]) {
      await routeros(
        `/rest/ip/hotspot/active/${encodeURIComponent(row[".id"])}`,
        { method: "DELETE" },
        creds,
      );
    }
  }
}

export async function pingRouter(): Promise<{
  reachable: boolean;
  mode: "live" | "unconfigured";
}> {
  const creds = await getRouterCredentials();
  if (!creds) {
    return { reachable: false, mode: "unconfigured" };
  }
  const probe = await probeRouter(creds);
  return { reachable: probe.ok, mode: "live" };
}

export { usernameForPhone, randomPassword };

async function patchByQuery(
  creds: RouterCreds,
  listPath: string,
  match: (row: Record<string, unknown>) => boolean,
  body: Record<string, unknown>,
) {
  const rows = (await routeros(listPath, {}, creds)) as Array<
    Record<string, unknown>
  > | null;
  const hit = (rows ?? []).find(match);
  if (!hit?.[".id"]) return false;
  await routeros(`${listPath}/${encodeURIComponent(String(hit[".id"]))}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  }, creds);
  return true;
}

export async function applyCamouflage(input: {
  routerId: string;
  kind: CamouflageKind;
  interfaceName?: string;
}): Promise<{
  ok: boolean;
  live: boolean;
  mac: string;
  interfaceName: string;
  script: string;
  error: string | null;
}> {
  const profile = CAMOUFLAGE[input.kind];
  const mac = randomMacFromOui(profile.oui);
  const creds = await getRouterCredentialsById(input.routerId);
  const sql = await getSql();
  const stored = (
    await sql<{ camouflage_interface: string | null; interfaces_json: string | null }>`
      select camouflage_interface, interfaces_json from mikrotiks where id = ${input.routerId} limit 1
    `
  )[0];

  let iface = input.interfaceName?.trim() || stored?.camouflage_interface || "";
  if (!iface && stored?.interfaces_json) {
    try {
      const list = JSON.parse(String(stored.interfaces_json)) as Array<{
        name: string;
        type: string;
        running: boolean;
      }>;
      const wan =
        list.find((i) => i.running && /ether|lte|wwan|usb|sfp|pppoe/i.test(i.name + i.type)) ??
        list.find((i) => i.running) ??
        list[0];
      iface = wan?.name ?? "ether1";
    } catch {
      iface = "ether1";
    }
  }
  if (!iface) iface = "ether1";

  const script = camouflageScript(profile, iface, mac);

  if (!creds) {
    await sql`
      update mikrotiks set
        camouflage = ${input.kind},
        camouflage_interface = ${iface},
        camouflage_mac = ${mac},
        camouflage_applied_at = now(),
        updated_at = now()
      where id = ${input.routerId}
    `;
    return {
      ok: true,
      live: false,
      mac,
      interfaceName: iface,
      script,
      error: "No REST credentials — apply the script in Winbox Terminal.",
    };
  }

  const steps: string[] = [];
  try {
    try {
      await routeros("/rest/system/identity", {
        method: "PATCH",
        body: JSON.stringify({ name: profile.identity }),
      }, creds);
      steps.push("identity");
    } catch {
      steps.push("identity-skip");
    }

    try {
      const patched = await patchByQuery(
        creds,
        "/rest/ip/dhcp-client",
        (row) => String(row.interface ?? "") === iface,
        { "host-name": profile.hostname },
      );
      if (!patched) {
        await patchByQuery(
          creds,
          "/rest/ip/dhcp-client",
          () => true,
          { "host-name": profile.hostname },
        );
      }
      steps.push("dhcp-hostname");
    } catch {
      steps.push("dhcp-skip");
    }

    try {
      const ifaces = (await routeros("/rest/interface", {}, creds)) as Array<{
        ".id"?: string;
        name?: string;
      }> | null;
      const hit = (ifaces ?? []).find((i) => i.name === iface);
      if (hit?.[".id"]) {
        await routeros(
          `/rest/interface/${encodeURIComponent(hit[".id"])}`,
          { method: "PATCH", body: JSON.stringify({ "mac-address": mac }) },
          creds,
        );
        steps.push("mac");
      }
    } catch {
      steps.push("mac-skip");
    }

    try {
      const mangles = (await routeros("/rest/ip/firewall/mangle", {}, creds)) as Array<{
        ".id"?: string;
        comment?: string;
      }> | null;
      for (const row of mangles ?? []) {
        if (String(row.comment ?? "").includes("telnet-camouflage") && row[".id"]) {
          await routeros(
            `/rest/ip/firewall/mangle/${encodeURIComponent(row[".id"])}`,
            { method: "DELETE" },
            creds,
          );
        }
      }
      await routeros("/rest/ip/firewall/mangle", {
        method: "PUT",
        body: JSON.stringify({
          chain: "postrouting",
          action: "change-ttl",
          "new-ttl": `set:${profile.ttl}`,
          passthrough: "yes",
          comment: "telnet-camouflage-ttl",
        }),
      }, creds);
      steps.push("ttl");
    } catch {
      steps.push("ttl-skip");
    }

    await sql`
      update mikrotiks set
        camouflage = ${input.kind},
        camouflage_interface = ${iface},
        camouflage_mac = ${mac},
        camouflage_applied_at = now(),
        identity = ${profile.identity},
        updated_at = now()
      where id = ${input.routerId}
    `;

    const live = steps.includes("identity") || steps.includes("ttl") || steps.includes("mac");
    return {
      ok: true,
      live,
      mac,
      interfaceName: iface,
      script,
      error: live
        ? null
        : "Router did not accept REST writes. Paste the script in Winbox Terminal.",
    };
  } catch (err) {
    await sql`
      update mikrotiks set
        camouflage = ${input.kind},
        camouflage_interface = ${iface},
        camouflage_mac = ${mac},
        camouflage_applied_at = now(),
        updated_at = now()
      where id = ${input.routerId}
    `;
    return {
      ok: true,
      live: false,
      mac,
      interfaceName: iface,
      script,
      error:
        err instanceof MikroTikError
          ? err.message
          : "Could not reach the router. Use the Terminal script.",
    };
  }
}

// ---------------------------------------------------------------------------
// RADIUS (multi-AP) on the router
// ---------------------------------------------------------------------------

export type RadiusRouterConfig = {
  enabled: boolean;
  address: string;
  secret: string;
  authPort: number;
  acctPort: number;
};

export type RadiusRouterCheck = {
  reachable: boolean;
  /** A /radius entry tagged telnet-radius exists on the router. */
  entryFound: boolean;
  addressMatches: boolean;
  /** The router's stored secret equals the one saved in Settings. */
  secretMatches: boolean;
  portsMatch: boolean;
  entryDisabled: boolean;
  /** The hotspot server profile has use-radius=yes. null = couldn't read it. */
  hotspotUsesRadius: boolean | null;
  hotspotProfile: string | null;
  error: string | null;
};

const RADIUS_COMMENT = "telnet-radius";

function truthy(v: unknown) {
  return v === true || v === "true" || v === "yes";
}

/** REST or binary-API read of the router's radius entry + hotspot profile. */
async function readRadiusState(creds: RouterCreds) {
  if (creds.apiMode === "api6") {
    const api = {
      host: creds.host,
      port: creds.apiPort || 8728,
      user: creds.user,
      password: creds.password,
    };
    const radius = (await apiCall(api, [["/radius/print"]])).filter((r) => r.type === "re");
    const servers = (await apiCall(api, [["/ip/hotspot/print"]])).filter((r) => r.type === "re");
    const server = servers.find((s) => s.attrs.name === creds.hotspot) ?? servers[0];
    const profiles = (await apiCall(api, [["/ip/hotspot/profile/print"]])).filter(
      (r) => r.type === "re",
    );
    const profile = profiles.find((p) => p.attrs.name === (server?.attrs.profile ?? "default"));
    return {
      radius: radius.map((r) => ({ ...r.attrs }) as Record<string, string>),
      profileName: (server?.attrs.profile as string | undefined) ?? null,
      profile: profile ? ({ ...profile.attrs } as Record<string, string>) : null,
    };
  }
  const radius = ((await routeros("/rest/radius", {}, creds)) ?? []) as Array<Record<string, string>>;
  const servers = ((await routeros("/rest/ip/hotspot", {}, creds)) ?? []) as Array<
    Record<string, string>
  >;
  const server = servers.find((s) => s.name === creds.hotspot) ?? servers[0];
  const profiles = ((await routeros("/rest/ip/hotspot/profile", {}, creds)) ?? []) as Array<
    Record<string, string>
  >;
  const profile = profiles.find((p) => p.name === (server?.profile ?? "default")) ?? null;
  return { radius, profileName: server?.profile ?? null, profile };
}

export async function checkRadiusOnRouter(
  creds: RouterCreds,
  cfg: RadiusRouterConfig,
): Promise<RadiusRouterCheck> {
  const out: RadiusRouterCheck = {
    reachable: false,
    entryFound: false,
    addressMatches: false,
    secretMatches: false,
    portsMatch: false,
    entryDisabled: false,
    hotspotUsesRadius: null,
    hotspotProfile: null,
    error: null,
  };
  try {
    const st = await readRadiusState(creds);
    out.reachable = true;
    out.hotspotProfile = st.profileName;
    out.hotspotUsesRadius = st.profile ? truthy(st.profile["use-radius"]) : null;
    const entry = st.radius.find((r) => r.comment === RADIUS_COMMENT);
    if (entry) {
      out.entryFound = true;
      out.entryDisabled = truthy(entry.disabled);
      out.addressMatches = entry.address === cfg.address;
      out.secretMatches = entry.secret === cfg.secret;
      out.portsMatch =
        String(entry["authentication-port"] ?? "1812") === String(cfg.authPort) &&
        String(entry["accounting-port"] ?? "1813") === String(cfg.acctPort);
    }
  } catch (err) {
    out.error =
      err instanceof MikroTikError || err instanceof Error
        ? err.message
        : "Could not reach the router.";
  }
  return out;
}

/**
 * Point a router's hotspot at this app's RADIUS listener:
 *   /radius add service=hotspot address=<host> secret=<secret> ...
 *   /ip hotspot profile set <server's profile> use-radius=yes
 * Turning RADIUS off disables the entry and sets use-radius=no.
 * Local hotspot users keep working either way (RouterOS checks them first).
 */
export async function applyRadiusToRouter(
  creds: RouterCreds,
  cfg: RadiusRouterConfig,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const st = await readRadiusState(creds);
    const entry = st.radius.find((r) => r.comment === RADIUS_COMMENT);
    const id = (entry?.[".id"] as string | undefined) ?? null;
    const body = {
      service: "hotspot",
      address: cfg.address,
      secret: cfg.secret,
      "authentication-port": String(cfg.authPort),
      "accounting-port": String(cfg.acctPort),
      timeout: "3s",
      comment: RADIUS_COMMENT,
      disabled: cfg.enabled ? "false" : "true",
    };
    const useRadius = cfg.enabled ? "yes" : "no";

    if (creds.apiMode === "api6") {
      const api = {
        host: creds.host,
        port: creds.apiPort || 8728,
        user: creds.user,
        password: creds.password,
      };
      const words = Object.entries(body).map(([k, v]) => `=${k}=${v}`);
      if (id) await apiCall(api, [["/radius/set", `=.id=${id}`, ...words]]);
      else if (cfg.enabled) await apiCall(api, [["/radius/add", ...words]]);
      const pid = st.profile?.[".id"];
      if (pid) {
        await apiCall(api, [["/ip/hotspot/profile/set", `=.id=${pid}`, `=use-radius=${useRadius}`]]);
      }
      return { ok: true, error: null };
    }

    if (id) {
      await routeros(
        `/rest/radius/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify(body) },
        creds,
      );
    } else if (cfg.enabled) {
      await routeros("/rest/radius", { method: "PUT", body: JSON.stringify(body) }, creds);
    }
    const pid = st.profile?.[".id"];
    if (pid) {
      await routeros(
        `/rest/ip/hotspot/profile/${encodeURIComponent(pid)}`,
        { method: "PATCH", body: JSON.stringify({ "use-radius": useRadius }) },
        creds,
      );
    }
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Router rejected the RADIUS settings.",
    };
  }
}

// ---------------------------------------------------------------------------
// Generic read helpers (used by the network map)
// ---------------------------------------------------------------------------

/** Read a RouterOS menu (e.g. "/interface") as a list of attribute maps, REST or binary API. */
export async function rosList(creds: RouterCreds, path: string): Promise<Array<Record<string, string>>> {
  if (creds.apiMode === "api6") {
    const rows = await apiCall(
      { host: creds.host, port: creds.apiPort || 8728, user: creds.user, password: creds.password },
      [[`${path}/print`]],
    );
    return rows.filter((r) => r.type === "re").map((r) => ({ ...r.attrs }) as Record<string, string>);
  }
  const out = await routeros(`/rest${path}`, {}, creds);
  if (Array.isArray(out)) return out as Array<Record<string, string>>;
  return out ? [out as Record<string, string>] : [];
}

export type PingResult = { ok: boolean; lossPct: number; avgMs: number | null };

/** Ping an address FROM the router (so it works for APs on private LAN ranges). */
export async function rosPing(creds: RouterCreds, address: string): Promise<PingResult> {
  const summarize = (rows: Array<Record<string, string>>): PingResult => {
    const last = rows[rows.length - 1] ?? {};
    const sent = Number(last.sent ?? rows.length) || 0;
    const received = Number(last.received ?? rows.filter((r) => r.time || r.status === undefined).length) || 0;
    const loss = last["packet-loss"] != null ? Number(last["packet-loss"]) : sent > 0 ? ((sent - received) / sent) * 100 : 100;
    const avg = last["avg-rtt"] ?? last.time ?? null;
    const avgMs = avg == null ? null : Number.parseFloat(String(avg).replace(/[^0-9.]/g, "")) || null;
    return { ok: received > 0, lossPct: Math.max(0, Math.min(100, Math.round(loss))), avgMs };
  };
  try {
    if (creds.apiMode === "api6") {
      const rows = await apiCall(
        { host: creds.host, port: creds.apiPort || 8728, user: creds.user, password: creds.password },
        [["/ping", `=address=${address}`, "=count=2"]],
        9000,
      );
      return summarize(rows.filter((r) => r.type === "re").map((r) => ({ ...r.attrs }) as Record<string, string>));
    }
    const out = await routeros(
      "/rest/ping",
      { method: "POST", body: JSON.stringify({ address, count: "2" }) },
      creds,
    );
    return summarize(Array.isArray(out) ? (out as Array<Record<string, string>>) : []);
  } catch {
    return { ok: false, lossPct: 100, avgMs: null };
  }
}
