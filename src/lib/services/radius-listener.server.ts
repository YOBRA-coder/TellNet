/**
 * In-process RADIUS UDP listener. Runs inside the app so it reads the same
 * database (Neon or embedded) and reacts to Settings changes immediately —
 * no separate script to keep alive. Needs a host that allows UDP inbound
 * (a VPS / Railway TCP+UDP service); serverless platforms cannot receive UDP.
 */
import dgram from "node:dgram";
import { getRadiusConfig } from "./radius.server";
import { CODE, handleAccessRequest, handleAccounting } from "./radius-protocol.server";

type Listener = {
  auth: dgram.Socket | null;
  acct: dgram.Socket | null;
  authPort: number;
  acctPort: number;
  error: string | null;
  requests: number;
  accepted: number;
  rejected: number;
  lastRequestAt: string | null;
};

const g = globalThis as typeof globalThis & { __radiusListener__?: Listener };
const state: Listener = (g.__radiusListener__ ??= {
  auth: null,
  acct: null,
  authPort: 0,
  acctPort: 0,
  error: null,
  requests: 0,
  accepted: 0,
  rejected: 0,
  lastRequestAt: null,
});

function closeSock(s: dgram.Socket | null) {
  if (!s) return;
  try {
    s.close();
  } catch {
    /* already closed */
  }
}

function bindSocket(port: number, kind: "auth" | "acct"): Promise<dgram.Socket> {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    sock.once("error", reject);
    sock.on("message", async (msg, rinfo) => {
      try {
        const cfg = await getRadiusConfig(); // secret changes apply without a restart
        if (!cfg.enabled || !cfg.secret || msg.length < 20) return;
        let reply: Buffer | null = null;
        if (kind === "auth" && msg[0] === CODE.ACCESS_REQUEST) {
          reply = await handleAccessRequest(msg, cfg.secret);
          state.requests += 1;
          state.lastRequestAt = new Date().toISOString();
          if (reply[0] === CODE.ACCESS_ACCEPT) state.accepted += 1;
          else state.rejected += 1;
        } else if (kind === "acct" && msg[0] === CODE.ACCOUNTING_REQUEST) {
          reply = handleAccounting(msg, cfg.secret);
        }
        if (reply) sock.send(reply, rinfo.port, rinfo.address);
      } catch (err) {
        console.error("[radius]", err instanceof Error ? err.message : err);
      }
    });
    sock.bind(port, "0.0.0.0", () => {
      sock.removeListener("error", reject);
      sock.on("error", (e) => console.error(`[radius ${kind}]`, e.message));
      resolve(sock);
    });
  });
}

/** Start, stop or rebind the listener to match Settings. Safe to call any time. */
export async function syncRadiusListener(): Promise<{
  running: boolean;
  error: string | null;
}> {
  const cfg = await getRadiusConfig();
  const want = cfg.enabled && Boolean(cfg.secret);
  const same =
    state.auth && state.acct && state.authPort === cfg.authPort && state.acctPort === cfg.acctPort;
  if (want && same) return { running: true, error: null };

  closeSock(state.auth);
  closeSock(state.acct);
  state.auth = null;
  state.acct = null;
  state.error = null;
  if (!want) return { running: false, error: null };

  try {
    state.auth = await bindSocket(cfg.authPort, "auth");
    state.acct = await bindSocket(cfg.acctPort, "acct");
    state.authPort = cfg.authPort;
    state.acctPort = cfg.acctPort;
    console.log(`[radius] listening on UDP ${cfg.authPort} (auth) / ${cfg.acctPort} (acct)`);
    return { running: true, error: null };
  } catch (err) {
    closeSock(state.auth);
    closeSock(state.acct);
    state.auth = null;
    state.acct = null;
    const code = (err as NodeJS.ErrnoException)?.code;
    state.error =
      code === "EADDRINUSE"
        ? `UDP port ${cfg.authPort}/${cfg.acctPort} is already in use on this server.`
        : code === "EACCES"
          ? "This server isn't allowed to open that UDP port."
          : `Could not open the RADIUS ports: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[radius]", state.error);
    return { running: false, error: state.error };
  }
}

export function getRadiusListenerStatus() {
  return {
    running: Boolean(state.auth && state.acct),
    authPort: state.authPort,
    acctPort: state.acctPort,
    error: state.error,
    requests: state.requests,
    accepted: state.accepted,
    rejected: state.rejected,
    lastRequestAt: state.lastRequestAt,
  };
}
