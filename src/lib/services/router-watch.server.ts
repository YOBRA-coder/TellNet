
const POLL_INTERVAL_MS = 60_000;

async function pollOnce() {
  try {
    // Every router (not just the primary) so outages are noticed — and
    // credited — per router. Imported lazily to avoid a db.ts import cycle.
    const { probeAllRouters } = await import("@/lib/services/outage.server");
    await probeAllRouters();
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
