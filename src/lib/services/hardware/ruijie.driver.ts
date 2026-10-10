/**
 * Ruijie / Reyee — External Portal using the WiFiDog protocol ("WiFiDog V1"
 * template on the Reyee gateway: Authentication Template -> External Portal).
 *
 * The gateway redirects an unauthenticated client to  <Server URL>login/ with
 * gw_address, gw_port, gw_id, ip, mac, url. After payment we send the customer's
 * browser to  http://gw_address:gw_port/wifidog/auth?token=<token>  and the
 * gateway then calls OUR  <Server URL>auth/  endpoint (stage=login, then
 * stage=counters every minute or so). We answer "Auth: 1" while the package is
 * running and "Auth: 0" once it has ended or been disconnected — so time-based
 * disconnection and manual disconnect are enforced by the very next check-in
 * (see wifidog.server.ts). Nothing here calls the gateway directly.
 */
import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
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

/** The gateway only counts as online if it checked in within this window. */
const HEARTBEAT_WINDOW_MS = 5 * 60_000;

export function isPrivateIPv4(host: string) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([m[1], m[2], m[3], m[4]].some((x) => Number(x) > 255)) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export const ruijieDriver: HardwareDriver = {
  type: "ruijie",

  async authorize({ client }: AuthorizeInput): Promise<AuthorizeResult> {
    const gwAddress = client.extra.gwAddress ?? "";
    const gwPort = Number(client.extra.gwPort ?? 0);
    // The redirect parameters are user-controllable (anyone can open our login URL),
    // so only ever send the browser back to a LAN address — never an arbitrary site.
    if (!isPrivateIPv4(gwAddress) || !Number.isInteger(gwPort) || gwPort < 1 || gwPort > 65535) {
      throw new HardwareError(
        "Ruijie gateway address missing. Reconnect to the WiFi and open the login page again.",
      );
    }
    const token = randomBytes(18).toString("hex");
    return {
      token,
      handoffUrl: `http://${gwAddress}:${gwPort}/wifidog/auth?token=${token}`,
      extra: { gwAddress, gwPort: String(gwPort), gwId: client.extra.gwId ?? "" },
    };
  },

  // Nothing to call: the gateway asks us, and index.ts has already ended the
  // authorization row, so its next check-in is answered "Auth: 0".
  async deauthorize(_router: HwRouter, _auth: HwAuthorization): Promise<void> {},

  async probe(router: HwRouter): Promise<RouterProbe> {
    const sql = await getSql();
    const row = (
      await sql<{ hw_seen_at: string | null }>`
        select hw_seen_at from mikrotiks where id = ${router.id} limit 1
      `
    )[0];
    const seen = row?.hw_seen_at ? new Date(String(row.hw_seen_at)).getTime() : 0;
    if (seen && Date.now() - seen < HEARTBEAT_WINDOW_MS) {
      return emptyProbe({ ok: true, identity: router.name, boardName: "Ruijie / Reyee gateway" });
    }
    return emptyProbe({
      error: seen
        ? "The Ruijie gateway has not contacted the portal for over 5 minutes."
        : "Waiting for the Ruijie gateway to contact the portal for the first time.",
    });
  },
};
