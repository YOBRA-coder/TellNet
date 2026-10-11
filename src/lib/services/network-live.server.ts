/**
 * Live network data for the Network Map: per-router CPU/memory/ports/traffic,
 * access-point reachability and client counts. Everything is read from the
 * routers themselves (REST or binary API) — nothing is invented:
 *  - AP status  = ping FROM the router to the AP's IP (or neighbor sighting by MAC)
 *  - AP clients = hotspot users whose MAC sits behind the AP's router port
 *  - signal     = only where the router itself is the radio (wifi/wireless registration table)
 */
import { getSql } from "@/lib/db";
import {
  getRouterCredentialsById,
  rosList,
  rosPing,
  type RouterCreds,
} from "@/lib/services/mikrotik.server";
import { logEvent } from "@/lib/services/settings.server";
import type { HealthState, LiveNeighbor, LivePort, LiveRadio, LiveSnapshot } from "@/lib/types";

const num = (v: unknown) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const isRadioType = (t: string) => /wlan|wifi|wireless|cap/i.test(t);

async function tryList(creds: RouterCreds, path: string) {
  try {
    return await rosList(creds, path);
  } catch {
    return [] as Array<Record<string, string>>;
  }
}

/** One full read of a router. Never throws — failures land in `error`. */
export async function collectRouterLive(
  creds: RouterCreds,
  previous: LiveSnapshot | null,
): Promise<LiveSnapshot> {
  const now = Date.now();
  const empty: LiveSnapshot = {
    at: new Date(now).toISOString(),
    error: null,
    cpuLoad: null,
    memTotal: null,
    memFree: null,
    uptime: null,
    activeUsers: null,
    rxBps: null,
    txBps: null,
    ports: [],
    neighbors: [],
    radios: [],
  };
  let resource: Record<string, string>;
  try {
    resource = (await rosList(creds, "/system/resource"))[0] ?? {};
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : "Router unreachable." };
  }

  const [ifaces, addrs, active, hosts, neigh] = await Promise.all([
    tryList(creds, "/interface"),
    tryList(creds, "/ip/address"),
    tryList(creds, "/ip/hotspot/active"),
    tryList(creds, "/interface/bridge/host"),
    tryList(creds, "/ip/neighbor"),
  ]);

  // Traffic rate = byte-counter delta since the previous snapshot.
  const prevByName = new Map((previous?.ports ?? []).map((p) => [p.name, p]));
  const dt = previous ? (now - new Date(previous.at).getTime()) / 1000 : 0;
  const rate = (cur: number, prev: number | undefined) =>
    prev != null && dt >= 1 && dt <= 900 && cur >= prev ? Math.round(((cur - prev) * 8) / dt) : null;

  const ipByIface = new Map<string, string>();
  for (const a of addrs) {
    if (String(a.disabled) === "true" || !a.interface || !a.address) continue;
    if (!ipByIface.has(a.interface)) ipByIface.set(a.interface, String(a.address).split("/")[0]);
  }

  // clients behind each port: active hotspot MACs found in the bridge host table
  const activeMacs = new Set(active.map((a) => String(a["mac-address"] ?? "").toUpperCase()).filter(Boolean));
  const clientsByPort = new Map<string, number>();
  for (const h of hosts) {
    const mac = String(h["mac-address"] ?? "").toUpperCase();
    const port = h["on-interface"] ?? h.interface;
    if (!mac || !port || String(h.local) === "true") continue;
    if (activeMacs.has(mac)) clientsByPort.set(port, (clientsByPort.get(port) ?? 0) + 1);
  }

  const ports: LivePort[] = ifaces
    .filter((i) => i.name)
    .map((i) => {
      const rx = num(i["rx-byte"]);
      const tx = num(i["tx-byte"]);
      const prev = prevByName.get(String(i.name));
      return {
        name: String(i.name),
        type: String(i.type ?? "ether"),
        running: String(i.running) === "true",
        disabled: String(i.disabled) === "true",
        comment: i.comment ? String(i.comment) : null,
        ip: ipByIface.get(String(i.name)) ?? null,
        rxBytes: rx,
        txBytes: tx,
        rxBps: rate(rx, prev?.rxBytes),
        txBps: rate(tx, prev?.txBytes),
        clients: clientsByPort.get(String(i.name)) ?? null,
      };
    });

  // Radios the router itself owns (only these have real signal data).
  const regRows = [
    ...(await tryList(creds, "/interface/wifi/registration-table")),
    ...(await tryList(creds, "/interface/wireless/registration-table")),
    ...(await tryList(creds, "/caps-man/registration-table")),
  ];
  const radios: LiveRadio[] = ports
    .filter((p) => isRadioType(p.type) && !p.disabled)
    .map((p) => {
      const mine = regRows.filter((r) => r.interface === p.name);
      const sigs = mine
        .map((r) => Number.parseInt(String(r.signal ?? r["signal-strength"] ?? "").match(/-?\d+/)?.[0] ?? "", 10))
        .filter((n) => Number.isFinite(n) && n < 0);
      return {
        name: p.name,
        clients: mine.length,
        signalDbm: sigs.length ? Math.round(sigs.reduce((a, b) => a + b, 0) / sigs.length) : null,
      };
    });

  const neighbors: LiveNeighbor[] = neigh.slice(0, 40).map((n) => ({
    name: String(n.identity || n["mac-address"] || "Device"),
    ip: n.address ? String(n.address) : null,
    mac: n["mac-address"] ? String(n["mac-address"]).toUpperCase() : null,
    port: n.interface ? String(n.interface).split(",")[0] : null,
    model: n.board ? String(n.board) : n.platform ? String(n.platform) : null,
  }));

  const wan = ports.filter((p) => p.rxBps != null);
  return {
    ...empty,
    cpuLoad: resource["cpu-load"] != null ? num(resource["cpu-load"]) : null,
    memTotal: resource["total-memory"] != null ? num(resource["total-memory"]) : null,
    memFree: resource["free-memory"] != null ? num(resource["free-memory"]) : null,
    uptime: resource.uptime ? String(resource.uptime) : null,
    activeUsers: active.length,
    // total = sum over ports would double-count bridged traffic; use running ether ports only
    rxBps: wan.length ? wan.filter((p) => p.type === "ether" && p.running).reduce((s, p) => s + (p.rxBps ?? 0), 0) : null,
    txBps: wan.length ? wan.filter((p) => p.type === "ether" && p.running).reduce((s, p) => s + (p.txBps ?? 0), 0) : null,
    ports,
    neighbors,
    radios,
  };
}

/** Status of one manual AP, judged from the router that hosts it. */
export async function checkAccessPoint(
  creds: RouterCreds,
  ap: { ip_address: string | null; mac_address: string | null; port: string | null },
  live: LiveSnapshot,
): Promise<{ status: HealthState; latencyMs: number | null; clients: number | null }> {
  const portClients = ap.port ? (live.ports.find((p) => p.name === ap.port)?.clients ?? 0) : null;
  if (live.error) return { status: "UNKNOWN", latencyMs: null, clients: null };
  if (ap.ip_address) {
    const r = await rosPing(creds, ap.ip_address);
    if (!r.ok) return { status: "OFFLINE", latencyMs: null, clients: portClients };
    const slow = (r.avgMs ?? 0) >= 200;
    return { status: r.lossPct > 0 || slow ? "WARNING" : "ONLINE", latencyMs: r.avgMs != null ? Math.round(r.avgMs) : null, clients: portClients };
  }
  if (ap.mac_address) {
    const seen = live.neighbors.some((n) => n.mac === ap.mac_address!.toUpperCase());
    return { status: seen ? "ONLINE" : "OFFLINE", latencyMs: null, clients: portClients };
  }
  return { status: "UNKNOWN", latencyMs: null, clients: portClients };
}

/**
 * ISP paths that name a router AND an interface follow that port: link up = ONLINE, link down =
 * OFFLINE (a manually set DEGRADED stays while the link is up). This detects an unplugged cable,
 * a dead modem or a power cut on the line — it cannot tell a line that is "up" but has no data.
 * An unreachable router leaves its paths untouched: we cannot see the port, so we do not guess.
 */
export async function syncIspStatuses(routerId: string, live: LiveSnapshot): Promise<void> {
  if (live.error) return;
  const sql = await getSql();
  const isps = await sql<{ id: string; name: string; status: string; interface_name: string }>`
    select id, name, status, interface_name from isps
    where mikrotik_id = ${routerId} and auto_status and interface_name is not null and interface_name <> ''
  `;
  for (const isp of isps) {
    const port = live.ports.find((p) => p.name === isp.interface_name.trim());
    if (!port) continue; // interface name not on this router: nothing to judge
    const up = port.running && !port.disabled;
    const next = up ? (isp.status === "DEGRADED" ? "DEGRADED" : "ONLINE") : "OFFLINE";
    await sql`update isps set status_checked_at = now() where id = ${isp.id}`;
    if (next === isp.status) continue;
    await sql`update isps set status = ${next}, updated_at = now() where id = ${isp.id}`;
    await logEvent(
      next === "OFFLINE" ? "ISP_DOWN" : "ISP_RECOVER",
      `${isp.name} is now ${next} (router port ${isp.interface_name} is ${up ? "up" : "down"}). Active packages are unchanged.`,
    ).catch(() => {});
  }
}

/**
 * Refresh every router (or one): collect the snapshot, judge its APs and
 * store the result. Snapshots younger than `maxAgeMs` are reused so several
 * admins with auto-refresh on don't hammer the routers.
 */
export async function refreshNetworkLive(opts: { routerId?: string; maxAgeMs?: number } = {}) {
  const sql = await getSql();
  const rows = await sql<{ id: string; live_json: string | null; live_at: string | null }>`
    select id, live_json, live_at from mikrotiks
    where hardware_type = 'mikrotik'
      and (${opts.routerId ?? null}::text is null or id = ${opts.routerId ?? null})
    order by is_primary desc, created_at
  `;
  const maxAge = opts.maxAgeMs ?? 0;
  const out: { id: string; live: LiveSnapshot; creds: RouterCreds | null; fresh: boolean }[] = [];
  await Promise.all(
    rows.map(async (row) => {
      let previous: LiveSnapshot | null = null;
      try {
        previous = row.live_json ? (JSON.parse(row.live_json) as LiveSnapshot) : null;
      } catch {
        previous = null;
      }
      if (maxAge && previous && row.live_at && Date.now() - new Date(row.live_at).getTime() < maxAge) {
        out.push({ id: row.id, live: previous, creds: null, fresh: false });
        return;
      }
      const creds = await getRouterCredentialsById(row.id);
      if (!creds) {
        out.push({
          id: row.id,
          live: { ...(previous ?? ({} as LiveSnapshot)), at: new Date().toISOString(), error: "Missing router credentials.", ports: [], neighbors: [], radios: [] } as LiveSnapshot,
          creds: null,
          fresh: true,
        });
        return;
      }
      const live = await collectRouterLive(creds, previous);
      out.push({ id: row.id, live, creds, fresh: true });
    }),
  );

  for (const r of out.filter((x) => x.fresh)) {
    await sql`
      update mikrotiks set live_json = ${JSON.stringify(r.live)}, live_at = now()
      where id = ${r.id}
    `;
    await syncIspStatuses(r.id, r.live).catch((e) => console.error("[isp-sync]", e));
    if (!r.creds) continue;
    const aps = await sql<{ id: string; ip_address: string | null; mac_address: string | null; port: string | null }>`
      select id, ip_address, mac_address, port from access_points where mikrotik_id = ${r.id}
    `;
    await Promise.all(
      aps.map(async (ap) => {
        const res = await checkAccessPoint(r.creds!, ap, r.live);
        await sql`
          update access_points set
            status = ${res.status}, latency_ms = ${res.latencyMs}, clients = ${res.clients},
            checked_at = now(),
            last_seen_at = case when ${res.status} in ('ONLINE','WARNING') then now() else last_seen_at end
          where id = ${ap.id}
        `;
      }),
    );
  }
  return out.map((o) => ({ id: o.id, live: o.live, fresh: o.fresh }));
}

/**
 * Record which access point each currently-connected paying customer is
 * behind. A customer's device MAC is learned by the router on the port the AP
 * is plugged into (bridge host table), so MAC -> port -> AP. Called every
 * minute by the background tick; each call adds one "sample" per connected
 * package, and revenue is later split across APs by sample share.
 * Ports shared by several APs (or a switch) can't be told apart and are skipped.
 */
export async function sampleApUsage(): Promise<number> {
  const sql = await getSql();
  const routers = await sql<{ id: string }>`select id from mikrotiks where hardware_type = 'mikrotik'`;
  let recorded = 0;
  for (const r of routers) {
    const aps = await sql<{ id: string; port: string | null }>`
      select id, port from access_points where mikrotik_id = ${r.id} and port is not null
    `;
    const creds = await getRouterCredentialsById(r.id);
    if (!creds) continue;
    try {
      const [active, hosts, ifaces] = await Promise.all([
        tryList(creds, "/ip/hotspot/active"),
        tryList(creds, "/interface/bridge/host"),
        tryList(creds, "/interface"),
      ]);
      if (active.length === 0) continue;
      // port -> AP keys (manual APs plus the router's own radios)
      const byPort = new Map<string, string[]>();
      const add = (port: string, key: string) => byPort.set(port, [...(byPort.get(port) ?? []), key]);
      for (const a of aps) if (a.port) add(a.port, a.id);
      for (const i of ifaces) {
        if (i.name && isRadioType(String(i.type ?? "")) && String(i.disabled) !== "true") add(String(i.name), `radio:${r.id}:${i.name}`);
      }
      const portOfMac = new Map<string, string>();
      for (const h of hosts) {
        const mac = String(h["mac-address"] ?? "").toUpperCase();
        const port = h["on-interface"] ?? h.interface;
        if (mac && port && String(h.local) !== "true") portOfMac.set(mac, String(port));
      }
      const users = active.map((a) => String(a.user)).filter(Boolean);
      const pkgs = await sql<{ id: string; customer_id: string; mikrotik_username: string }>`
        select id, customer_id, mikrotik_username from customer_packages
        where status = 'ACTIVE' and mikrotik_username = any(${users})
      `;
      const pkgByUser = new Map(pkgs.map((p) => [p.mikrotik_username, p]));
      const seen = new Set<string>();
      for (const a of active) {
        const pkg = pkgByUser.get(String(a.user));
        const port = portOfMac.get(String(a["mac-address"] ?? "").toUpperCase());
        const keys = port ? byPort.get(port) : undefined;
        if (!pkg || !keys || keys.length !== 1) continue; // unknown or ambiguous port
        const k = `${keys[0]}|${pkg.id}`;
        if (seen.has(k)) continue; // two devices on one package count once per tick
        seen.add(k);
        await sql`
          insert into ap_usage (ap_key, package_id, customer_id, samples)
          values (${keys[0]}, ${pkg.id}, ${pkg.customer_id}, 1)
          on conflict (ap_key, package_id) do update
            set samples = ap_usage.samples + 1, last_seen = now()
        `;
        recorded += 1;
      }
    } catch (err) {
      console.error("[ap-usage]", r.id, err instanceof Error ? err.message : err);
    }
  }
  return recorded;
}

/** Revenue and paying customers per AP over the last `days` days (successful M-Pesa payments only). */
export async function apRevenue(days: number): Promise<Map<string, { revenue: number; customers: number }>> {
  const sql = await getSql();
  const rows = await sql<{ ap_key: string; revenue: number; customers: number }>`
    select u.ap_key,
           sum(pay.amount * u.samples::float8 / t.tot)::float8 as revenue,
           count(distinct u.customer_id)::int as customers
    from ap_usage u
    join (select package_id, sum(samples) as tot from ap_usage group by package_id) t on t.package_id = u.package_id
    join customer_packages cp on cp.id = u.package_id
    join payments pay on pay.id = cp.payment_id
    where pay.status = 'SUCCESS'
      and coalesce(pay.mpesa_transaction_id, '') not like 'PTS-%'
      and coalesce(pay.mpesa_transaction_id, '') not like 'VCH-%'
      and cp.start_time >= now() - (${days} * interval '1 day')
    group by u.ap_key
  `;
  return new Map(rows.map((r) => [r.ap_key, { revenue: Math.round(Number(r.revenue)), customers: Number(r.customers) }]));
}
