/**
 * Router probing + outage credit.
 *
 * Without credit, a package's end time is a calendar deadline: a blackout
 * eats the customer's minutes. With "pause time during outages" turned on
 * for a router, the time the router was unreachable is added back to the
 * packages that were running, so the countdown effectively stops while the
 * power/ISP is out and carries on when it returns.
 *
 * - Expiry is frozen while such a router is down, so a package can't lapse
 *   inside the blackout (see expiry.server.ts).
 * - Outages shorter than MIN_OUTAGE_MS are ignored (probe blips).
 * - Credit is capped at MAX_CREDIT_MS.
 * - Only Daily / Weekly / Monthly and voucher-redeemed packages are covered;
 *   hourly packages (e.g. Quick Connect) keep running through a blackout.
 * - Primary router: everything is provisioned there, so every covered running
 *   package is credited. Other routers: customers of that router's site.
 */
import { getSql } from "@/lib/db";
import { activateFromPayment } from "@/lib/services/activation.server";
import { probeStoredRouter } from "@/lib/services/hardware";
import {
  getRouterCredentialsById,
  probeRouter,
  type RouterCreds,
} from "@/lib/services/mikrotik.server";
import { resumeEligiblePackages } from "@/lib/services/resume.server";
import { logEvent } from "@/lib/services/settings.server";

export const MIN_OUTAGE_MS = 3 * 60_000;
export const MAX_CREDIT_MS = 72 * 3_600_000;

type ProbeLike = Awaited<ReturnType<typeof probeRouter>>;

function fmtMs(ms: number) {
  const m = Math.round(ms / 60_000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/**
 * Add `outageMs` to every package that was running when the router went down.
 * Returns how many packages were credited (and how many re-pushed to the router).
 */
export async function creditOutage(
  routerId: string,
  downSince: Date,
  outageMs: number,
  label: "unreachable" | "closed hours" = "unreachable",
) {
  const sql = await getSql();
  const router = (
    await sql<{ name: string; is_primary: boolean; site_id: string | null }>`
      select name, is_primary, site_id from mikrotiks where id = ${routerId} limit 1
    `
  )[0];
  if (!router) return { credited: 0, reactivated: 0 };
  const credit = Math.min(outageMs, MAX_CREDIT_MS);
  const secs = Math.round(credit / 1000);
  const site = router.site_id || "site_default";

  // Covered packages: Daily / Weekly / Monthly, or redeemed from a voucher.
  const active = await sql<{ id: string; payment_id: string; customer_id: string }>`
    update customer_packages cp
    -- credit only the time the package actually existed during the outage/closure
    set expiry_time = cp.expiry_time + (
          greatest(0, least(${secs}::double precision,
            extract(epoch from (now() - greatest(cp.start_time, ${downSince.toISOString()}::timestamptz)))))
          * interval '1 second'),
        updated_at = now()
    from customers c, packages pkg, payments pay
    where c.id = cp.customer_id and pkg.id = cp.package_id and pay.id = cp.payment_id
      and cp.status = 'ACTIVE'
      and cp.expiry_time > ${downSince.toISOString()}
      and (coalesce(pkg.duration_kind, '') in ('DAILY', 'WEEKLY', 'MONTHLY')
           or coalesce(pay.mpesa_transaction_id, '') like 'VCH-%')
      and (${router.is_primary}::boolean or coalesce(c.site_id, 'site_default') = ${site})
    returning cp.id, cp.payment_id, cp.customer_id
  `;
  // Anything queued behind a credited package slides back by the same amount
  // so the schedule stays contiguous.
  const creditedCustomers = [...new Set(active.map((r) => r.customer_id))];
  const queued =
    creditedCustomers.length === 0
      ? []
      : await sql<{ id: string }>`
          update customer_packages
          set start_time = start_time + (${secs} * interval '1 second'),
              expiry_time = expiry_time + (${secs} * interval '1 second'),
              updated_at = now()
          where status = 'QUEUED' and customer_id = any(${creditedCustomers})
          returning id
        `;
  const rows = [...active.map((r) => ({ ...r, status: "ACTIVE" })), ...queued.map((q) => ({ id: q.id, payment_id: "", status: "QUEUED" }))];

  // The router may have rebooted and lost its user table: put every credited
  // running package back with its new remaining time.
  let reactivated = 0;
  for (const r of rows.filter((x) => x.status === "ACTIVE")) {
    try {
      const res = await activateFromPayment(String(r.payment_id));
      if (res.ok) reactivated += 1;
    } catch {
      /* router still flaky: the normal retry/resume paths pick it up */
    }
  }
  await logEvent(
    "OUTAGE",
    label === "closed hours"
      ? `${router.name} was closed for ${fmtMs(outageMs)}. Closed time added back to ${rows.length} package(s) (${reactivated} re-activated on the router).`
      : `${router.name} was unreachable for ${fmtMs(outageMs)}. Added ${fmtMs(credit)} back to ${rows.length} package(s) (${reactivated} re-activated on the router).`,
  );
  return { credited: rows.length, reactivated };
}

/**
 * Store a probe result and handle the down/up edges:
 *  - first failure  -> remember down_since
 *  - answers again  -> credit the outage (if the router has it switched on),
 *                      then restore Weekly/Monthly/Voucher logins as before.
 */
export async function recordProbeResult(routerId: string, probe: ProbeLike) {
  const sql = await getSql();
  const prior = (
    await sql<{ status: string; is_primary: boolean; down_since: string | null; pause_on_outage: boolean }>`
      select status, is_primary, down_since, pause_on_outage from mikrotiks where id = ${routerId} limit 1
    `
  )[0];
  if (!prior) return;

  await sql`
    update mikrotiks set
      status = ${probe.ok ? "ONLINE" : "OFFLINE"},
      identity = ${probe.identity},
      version = ${probe.version},
      board_name = ${probe.boardName},
      uptime = ${probe.uptime},
      cpu_load = ${probe.cpuLoad},
      mem_total = ${probe.memTotal ?? null},
      mem_free = ${probe.memFree ?? null},
      last_ping_at = now(),
      last_error = ${probe.error},
      interfaces_json = ${JSON.stringify(probe.interfaces)},
      down_since = case
        when ${probe.ok} then null
        when down_since is null then now()
        else down_since
      end,
      updated_at = now()
    where id = ${routerId}
  `;

  const wasDown = prior.status !== "ONLINE";
  if (!probe.ok || !prior.down_since) {
    // still down, or never recorded as down: nothing to credit
    if (wasDown && probe.ok && prior.is_primary) {
      resumeEligiblePackages("auto").catch((e) => console.error("[resume] failed:", e));
    }
    return;
  }
  const downSince = new Date(prior.down_since);
  const outageMs = Date.now() - downSince.getTime();
  if (prior.pause_on_outage && outageMs >= MIN_OUTAGE_MS) {
    await creditOutage(routerId, downSince, outageMs).catch((e) =>
      console.error("[outage] credit failed:", e),
    );
  }
  if (prior.is_primary) {
    resumeEligiblePackages("auto").catch((e) => console.error("[resume] failed:", e));
  }
}

/** Probe every router (not just the primary) and record the results. */
export async function probeAllRouters(): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ id: string; hardware_type: string }>`
    select id, hardware_type from mikrotiks order by is_primary desc, created_at
  `;
  let n = 0;
  await Promise.all(
    rows.map(async (r) => {
      if (r.hardware_type !== "mikrotik") {
        // Omada / Ruijie: probed by their own driver (controller login / gateway heartbeat).
        try {
          const probe = await probeStoredRouter(r.id);
          if (probe) {
            await recordProbeResult(r.id, probe);
            n += 1;
          }
        } catch (err) {
          console.error("[probe]", r.id, err);
        }
        return;
      }
      const creds: RouterCreds | null = await getRouterCredentialsById(r.id);
      if (!creds || !creds.host || !creds.user) return;
      try {
        const probe = await probeRouter(creds);
        await recordProbeResult(r.id, probe);
        n += 1;
      } catch (err) {
        console.error("[probe]", r.id, err);
      }
    }),
  );
  // Which access point each connected customer is behind (for revenue per AP).
  try {
    const { sampleApUsage, refreshNetworkLive } = await import("./network-live.server");
    // Reads each MikroTik's ports (snapshots under 45 s old are reused): keeps ISP status and AP
    // health current without anyone having the Network map open.
    await refreshNetworkLive({ maxAgeMs: 45_000 });
    await sampleApUsage();
    // Omada sites: same sampling, keyed by the AP MAC the controller reports.
    const hw = await import("./hardware/ap.server");
    await hw.sampleHwApUsage();
    await hw.refreshHwAccessPoints();
  } catch (err) {
    console.error("[ap-usage]", err);
  }
  // Opening hours: flip routers open/closed at the schedule boundaries.
  try {
    const { applyOperatingHours } = await import("./hours.server");
    await applyOperatingHours();
  } catch (err) {
    console.error("[hours]", err);
  }
  return n;
}
