import type { RouterProbe } from "@/lib/types";
import type { HardwareType, HwConfig } from "@/lib/hardware";

export class HardwareError extends Error {
  constructor(
    message = "Network hardware is currently unavailable.",
    public readonly code?: "closed",
  ) {
    super(message);
    this.name = "HardwareError";
  }
}

/** A non-MikroTik router/site row, with its vendor settings parsed. */
export type HwRouter = {
  id: string;
  name: string;
  type: HardwareType;
  /** Omada: controller URL. Ruijie: gateway label/IP (informational). */
  host: string;
  /** Omada: hotspot operator user. */
  user: string;
  /** Omada: hotspot operator password. */
  password: string;
  insecureTls: boolean;
  config: HwConfig;
};

/** What the vendor's captive-portal redirect told us about one client device. */
export type ClientContext = {
  id: string;
  routerId: string;
  vendor: HardwareType;
  clientMac: string;
  macNorm: string;
  clientIp: string | null;
  apMac: string | null;
  ssid: string | null;
  radioId: string | null;
  siteName: string | null;
  /** Vendor extras: Omada gatewayMac/vid/redirectUrl, Ruijie gwAddress/gwPort/gwId ... */
  extra: Record<string, string>;
};

/** A client device currently switched on (or recently switched off) by a package. */
export type HwAuthorization = {
  id: string;
  routerId: string;
  vendor: HardwareType;
  username: string;
  clientMac: string;
  macNorm: string;
  token: string | null;
  expiresAt: Date;
  extra: Record<string, string>;
};

export type AuthorizeInput = {
  router: HwRouter;
  client: ClientContext;
  username: string;
  /** Seconds of access to grant, counted from now. */
  seconds: number;
};

export type AuthorizeResult = {
  /** Vendor-specific one-time token (Ruijie WiFiDog). */
  token?: string;
  /** Where the customer's browser must be sent to finish login (Ruijie). */
  handoffUrl?: string;
  /** Anything the driver needs later to switch this client off again. */
  extra?: Record<string, string>;
};

/**
 * One implementation per hardware family. The billing code only ever talks
 * to this interface (through ./index.ts); vendor details stay in the drivers.
 *
 * MikroTik is deliberately NOT a driver here: it keeps its original,
 * battle-tested code path in mikrotik.server.ts (create hotspot user on the
 * primary router), which ./index.ts falls back to whenever a customer did not
 * arrive through an Omada/Ruijie portal.
 */
export interface HardwareDriver {
  readonly type: Exclude<HardwareType, "mikrotik">;
  /** Switch this client device on for `seconds`. Throws HardwareError on failure. */
  authorize(input: AuthorizeInput): Promise<AuthorizeResult>;
  /** Switch this client device off now (expiry, manual disconnect, block). */
  deauthorize(router: HwRouter, auth: HwAuthorization): Promise<void>;
  /** Reachability check shown on the Network page and used for outage credit. */
  probe(router: HwRouter): Promise<RouterProbe>;
}

export function emptyProbe(over: Partial<RouterProbe> = {}): RouterProbe {
  return {
    ok: false,
    identity: null,
    version: null,
    boardName: null,
    uptime: null,
    cpuLoad: null,
    hotspotServers: [],
    interfaces: [],
    error: null,
    ...over,
  };
}
