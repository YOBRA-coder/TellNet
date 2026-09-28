import { getSql } from "@/lib/db";
import { probeRouter, type RouterCreds } from "@/lib/services/mikrotik.server";
import { resumeEligiblePackages } from "@/lib/services/resume.server";

const POLL_INTERVAL_MS = 60_000;

/**
 * Mirrors persistProbe() in lib/fn/admin.ts (write the probe result, then
 * auto-resume on a down/unknown -> up edge for the primary router). Kept as
 * a separate copy rather than importing admin.ts, which would pull in the
 * whole admin server-function module graph -- including auth middleware --
 * into a background loop, and risks a circular import back through db.ts.
 */
async function probePrimaryAndPersist() {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    status: string;
    host: string;
    api_user: string;
    api_password: string;
    hotspot_name: string | null;
    insecure_tls: boolean | null;
    api_mode: string | null;
    api_port: number | null;
  }>`
    select id, status, host, api_user, api_password, hotspot_name, insecure_tls, api_mode, api_port
    from mikrotiks
    where is_primary = true
    limit 1
  `;
  const row = rows[0];
  if (!row || !row.host || !row.api_user || !row.api_password) return; // unconfigured -- nothing to probe

  const creds: RouterCreds = {
    host: row.host,
    user: row.api_user,
    password: row.api_password,
    hotspot: row.hotspot_name ?? "hotspot1",
    insecureTls: Boolean(row.insecure_tls),
    apiMode: row.api_mode === "api6" ? "api6" : "rest",
    apiPort: row.api_port ?? undefined,
  };
  const probe = await probeRouter(creds);
  const wasDown = row.status !== "ONLINE";

  await sql`
    update mikrotiks set
      status = ${probe.ok ? "ONLINE" : "OFFLINE"},
      identity = ${probe.identity},
      version = ${probe.version},
      board_name = ${probe.boardName},
      uptime = ${probe.uptime},
      cpu_load = ${probe.cpuLoad},
      last_ping_at = now(),
      last_error = ${probe.error},
      interfaces_json = ${JSON.stringify(probe.interfaces)},
      updated_at = now()
    where id = ${row.id}
  `;

  if (wasDown && probe.ok) {
    await resumeEligiblePackages("auto");
  }
}

async function pollOnce() {
  try {
    await probePrimaryAndPersist();
  } catch (err) {
    console.error("[router-watch] poll failed:", err);
  }
}

const globalRef = globalThis as typeof globalThis & {
  __routerWatchStarted__?: boolean;
};

/**
 * Starts the periodic primary-router probe, once per process. Only makes
 * sense on a long-lived server (this app's dev/VPS deploy -- see
 * startup.sh), not a per-request serverless function; harmless no-op
 * either way since it just skips probing when unconfigured.
 */
export function startRouterWatch() {
  if (typeof window !== "undefined") return; // never in the browser bundle
  if (globalRef.__routerWatchStarted__) return; // survive HMR re-imports
  globalRef.__routerWatchStarted__ = true;
  setInterval(() => {
    void pollOnce();
  }, POLL_INTERVAL_MS);
}

startRouterWatch();
