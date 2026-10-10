/**
 * TP-Link Omada — External Portal Server mode.
 *
 * Flow (per TP-Link's "API and Code Sample for External Portal Server"):
 *   1. The controller redirects the client to our portal URL with
 *      clientMac/apMac/ssidName/radioId/site/t/redirectUrl (see the
 *      /api/hw/entry route, which stores them as a ClientContext).
 *   2. After the M-Pesa payment we log in to the controller as a *Hotspot
 *      Operator* and call  POST /{omadacId}/api/v2/hotspot/extPortal/auth
 *      with authType 4 and an expiry time. The controller then lets the
 *      client online and ends the session itself when the time is up.
 *   3. Manual disconnect: the documented API has no "unauthorize" call, so we
 *      re-authorize the client for a few seconds (the controller then drops
 *      it back to the portal). VERIFY THIS ON REAL HARDWARE — see README.
 *
 * Everything vendor-specific is in this file so it is easy to adjust.
 */
import type { RouterProbe } from "@/lib/types";
import {
  HardwareError,
  emptyProbe,
  type AuthorizeInput,
  type AuthorizeResult,
  type HardwareDriver,
  type HwAuthorization,
  type HwRouter,
} from "./types";

const TIMEOUT_MS = 10_000;
/** Access given by the "switch off" re-authorize call. */
const DEAUTH_SECONDS = 1;
const SESSION_TTL_MS = 10 * 60_000;

type Session = { prefix: string; csrf: string; cookie: string; at: number };
const sessions = new Map<string, Session>();

function base(router: HwRouter) {
  return router.host.replace(/\/$/, "");
}

async function http(router: HwRouter, url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const out: RequestInit & { dispatcher?: unknown } = { ...init, signal: controller.signal };
  if (router.insecureTls) {
    // Omada controllers ship with a self-signed certificate.
    const { Agent } = await import("undici");
    out.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  }
  try {
    return await fetch(url, out);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new HardwareError("Omada controller timed out. Check the controller URL and that it is reachable from this server.");
    }
    throw new HardwareError("Could not reach the Omada controller. Check the URL, port and firewall.");
  } finally {
    clearTimeout(timer);
  }
}

type Info = { omadacId: string; version: string | null };

/** Controller 5.0.15+ needs its ID in the URL. Unauthenticated /api/info tells us. */
async function discover(router: HwRouter): Promise<Info> {
  const configured = router.config.omadacId?.trim();
  let version: string | null = null;
  let id = configured ?? "";
  try {
    const res = await http(router, `${base(router)}/api/info`);
    const json = (await res.json().catch(() => null)) as {
      errorCode?: number;
      result?: { omadacId?: string; controllerVer?: string };
    } | null;
    if (json?.errorCode === 0) {
      version = json.result?.controllerVer ?? null;
      if (!id) id = json.result?.omadacId ?? "";
    }
  } catch (err) {
    if (!configured) throw err;
  }
  return { omadacId: id, version };
}

async function login(router: HwRouter): Promise<Session> {
  const { omadacId } = await discover(router);
  const prefix = omadacId ? `/${omadacId}` : "";
  const res = await http(router, `${base(router)}${prefix}/api/v2/hotspot/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: router.user, password: router.password }),
  });
  if (!res.ok) throw new HardwareError(`Omada controller returned HTTP ${res.status} on hotspot login.`);
  const json = (await res.json().catch(() => null)) as {
    errorCode?: number;
    msg?: string;
    result?: { token?: string };
  } | null;
  if (!json || json.errorCode !== 0 || !json.result?.token) {
    throw new HardwareError(json?.msg ? `Omada: ${json.msg}` : "Omada rejected the hotspot operator login.");
  }
  const cookies =
    (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const cookie = cookies.map((c) => c.split(";")[0]).join("; ");
  const s: Session = { prefix, csrf: json.result.token, cookie, at: Date.now() };
  sessions.set(router.id, s);
  return s;
}

async function session(router: HwRouter, fresh = false): Promise<Session> {
  const cached = sessions.get(router.id);
  if (!fresh && cached && Date.now() - cached.at < SESSION_TTL_MS) return cached;
  return login(router);
}

function unitMultiplier(router: HwRouter) {
  return router.config.omadaTimeUnit === "us" ? 1_000_000 : 1000;
}

type AuthParams = {
  clientMac: string;
  apMac?: string | null;
  ssid?: string | null;
  radioId?: string | null;
  site?: string | null;
  gatewayMac?: string | null;
  vid?: string | null;
};

async function sendAuth(router: HwRouter, p: AuthParams, seconds: number, retry = true): Promise<void> {
  const s = await session(router, !retry);
  const site = p.site || router.config.omadaSite || "";
  const time = Math.max(1, Math.floor(seconds)) * unitMultiplier(router);
  const body: Record<string, unknown> = p.gatewayMac
    ? { clientMac: p.clientMac, gatewayMac: p.gatewayMac, vid: p.vid ?? "", site, time, authType: 4 }
    : {
        clientMac: p.clientMac,
        apMac: p.apMac ?? "",
        ssidName: p.ssid ?? "",
        radioId: Number(p.radioId ?? 0) || 0,
        site,
        time,
        authType: 4,
      };
  const url = `${base(router)}${s.prefix}/api/v2/hotspot/extPortal/auth?token=${encodeURIComponent(s.csrf)}`;
  const res = await http(router, url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Csrf-Token": s.csrf, ...(s.cookie ? { Cookie: s.cookie } : {}) },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { errorCode?: number; msg?: string } | null;
  if (res.ok && json && json.errorCode === 0) return;
  sessions.delete(router.id);
  if (retry) return sendAuth(router, p, seconds, false); // stale session: log in again once
  throw new HardwareError(json?.msg ? `Omada: ${json.msg}` : `Omada authorize failed (HTTP ${res.status}).`);
}

export const omadaDriver: HardwareDriver = {
  type: "omada",

  async authorize({ router, client, seconds }: AuthorizeInput): Promise<AuthorizeResult> {
    const extra: Record<string, string> = {
      apMac: client.apMac ?? "",
      ssid: client.ssid ?? "",
      radioId: client.radioId ?? "",
      site: client.siteName ?? router.config.omadaSite ?? "",
      gatewayMac: client.extra.gatewayMac ?? "",
      vid: client.extra.vid ?? "",
    };
    await sendAuth(
      router,
      {
        clientMac: client.clientMac,
        apMac: extra.apMac,
        ssid: extra.ssid,
        radioId: extra.radioId,
        site: extra.site,
        gatewayMac: extra.gatewayMac || null,
        vid: extra.vid || null,
      },
      seconds,
    );
    return { extra };
  },

  async deauthorize(router: HwRouter, auth: HwAuthorization): Promise<void> {
    const e = auth.extra;
    await sendAuth(
      router,
      {
        clientMac: auth.clientMac,
        apMac: e.apMac,
        ssid: e.ssid,
        radioId: e.radioId,
        site: e.site,
        gatewayMac: e.gatewayMac || null,
        vid: e.vid || null,
      },
      DEAUTH_SECONDS,
    );
  },

  async probe(router: HwRouter): Promise<RouterProbe> {
    try {
      const info = await discover(router);
      await login(router);
      return emptyProbe({
        ok: true,
        identity: info.omadacId ? `Omada ${info.omadacId.slice(0, 8)}` : "Omada controller",
        version: info.version,
        boardName: "TP-Link Omada",
      });
    } catch (err) {
      return emptyProbe({ error: err instanceof Error ? err.message : "Controller unreachable." });
    }
  },
};
