import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import type { RouterProbe } from "@/lib/types";
import { getSettingsSecret } from "./settings.server";
import { normalizeRouterHost } from "@/lib/mikrotik-host";
import {
  apiProbe,
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

async function ensureOneDeviceProfile(creds: RouterCreds) {
  try {
    const profiles = (await routeros(
      "/rest/ip/hotspot/user/profile",
      {},
      creds,
    )) as Array<{ ".id"?: string; name?: string }> | null;
    const hit = (profiles ?? []).find((p) => p.name === "telnet-1dev");
    const body = {
      name: "telnet-1dev",
      "shared-users": "1",
      "keepalive-timeout": "2m",
      "idle-timeout": "none",
    };
    if (hit?.[".id"]) {
      await routeros(
        `/rest/ip/hotspot/user/profile/${encodeURIComponent(hit[".id"])}`,
        { method: "PATCH", body: JSON.stringify({ "shared-users": "1" }) },
        creds,
      );
    } else {
      await routeros("/rest/ip/hotspot/user/profile", {
        method: "PUT",
        body: JSON.stringify(body),
      }, creds);
    }
  } catch {
    /* profile is best-effort; user still gets shared-users=1 */
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
        sharedUsers: "1",
        comment: `telnet:${input.customerId}:1dev`,
      },
    );
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
    return { username: input.username };
  }

  await ensureOneDeviceProfile(creds);

  const existing = (await routeros(
    `/rest/ip/hotspot/user?name=${encodeURIComponent(input.username)}`,
    {},
    creds,
  )) as Array<{ ".id"?: string }> | null;

  const payload: Record<string, string> = {
    name: input.username,
    password: input.password,
    profile: "telnet-1dev",
    "limit-uptime": String(input.sessionTimeoutSeconds),
    "rate-limit": `${input.uploadKbps}k/${input.downloadKbps}k`,
    "shared-users": "1",
    disabled: "false",
    comment: `telnet:${input.customerId}:1dev`,
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
