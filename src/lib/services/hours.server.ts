/**
 * Opening hours per MikroTik.
 *
 * - Schedule: weekly windows (several per day), evaluated in the business
 *   time zone (default Africa/Nairobi, override with APP_TIMEZONE).
 * - Closing = every TelNet hotspot user on the router is disabled and active
 *   sessions are kicked (the captive portal stays reachable so customers see
 *   the "closed" banner). Opening re-enables users that still have a running
 *   package.
 * - While closed, customers may only buy the package kinds the operator
 *   allows (default Weekly + Monthly).
 * - Closed time is not counted against Daily/Weekly/Monthly/voucher packages
 *   (expiry is frozen while closed and credited on reopening), unless the
 *   operator turns that off.
 */
import { getSql } from "@/lib/db";
import { creditOutage } from "@/lib/services/outage.server";
import {
  getRouterCredentialsById,
  setTelnetUsersState,
  type RouterCreds,
} from "@/lib/services/mikrotik.server";
import { logEvent } from "@/lib/services/settings.server";

export const TZ = (typeof process !== "undefined" && process.env.APP_TIMEZONE) || "Africa/Nairobi";
export type Windows = Record<string, [string, string][]>;
export type Kind = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";
export const ALL_KINDS: Kind[] = ["HOURLY", "DAILY", "WEEKLY", "MONTHLY"];

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map((x) => Number.parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

/** Offset (minutes) of TZ from UTC at a given instant. */
function tzOffsetMin(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

export function parseSchedule(json: string | null | undefined): Windows {
  try {
    const raw = json ? JSON.parse(json) : {};
    const out: Windows = {};
    for (let d = 0; d < 7; d++) {
      const list = Array.isArray(raw?.[d]) ? raw[d] : [];
      out[String(d)] = list
        .filter((w: unknown) => Array.isArray(w) && /^\d{1,2}:\d{2}$/.test(String(w[0])) && /^\d{1,2}:\d{2}$/.test(String(w[1])))
        .map((w: string[]) => [String(w[0]), String(w[1])] as [string, string]);
    }
    return out;
  } catch {
    return Object.fromEntries(Array.from({ length: 7 }, (_, d) => [String(d), []])) as Windows;
  }
}

/** Is the minute-of-week `mow` (0 = Sunday 00:00 local) inside any window? */
function openAt(sched: Windows, mow: number): boolean {
  const day = Math.floor(mow / 1440) % 7;
  const t = mow % 1440;
  const prev = (day + 6) % 7;
  for (const [s, e] of sched[String(day)] ?? []) {
    const a = toMin(s), b = toMin(e);
    if (a < b ? t >= a && t < b : t >= a) return true; // end <= start crosses midnight
  }
  for (const [s, e] of sched[String(prev)] ?? []) {
    const a = toMin(s), b = toMin(e);
    if (a >= b && t < b) return true; // tail of yesterday's overnight window
  }
  return false;
}

export type OpenStatus = {
  enabled: boolean;
  open: boolean;
  /** next time the state flips (open→closed or closed→open), null if never */
  nextChangeAt: Date | null;
};

/** Pure: state of a schedule at `now`. */
export function evaluateHours(enabled: boolean, sched: Windows, now = new Date()): OpenStatus {
  if (!enabled) return { enabled: false, open: true, nextChangeAt: null };
  const off = tzOffsetMin(now);
  const localMin = Math.floor(now.getTime() / 60000) + off;
  const mowNow = ((localMin % 10080) + 10080 + 4 * 1440) % 10080; // epoch day 0 was a Thursday
  const open = openAt(sched, mowNow);
  for (let i = 1; i <= 10080; i++) {
    if (openAt(sched, (mowNow + i) % 10080) !== open) {
      return { enabled: true, open, nextChangeAt: new Date((Math.floor(now.getTime() / 60000) + i) * 60000) };
    }
  }
  return { enabled: true, open, nextChangeAt: null }; // always open or always closed
}

export function formatLocal(at: Date, now = new Date()): string {
  const sameDay =
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(at) ===
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(at).toUpperCase();
  if (sameDay) return time;
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short" }).format(at);
  return `${day} ${time}`;
}

export type RouterHours = {
  routerId: string;
  enabled: boolean;
  open: boolean;
  nextChangeAt: string | null;
  /** e.g. "6:00 AM" / "Mon 6:00 AM" — when it next opens (only while closed) */
  opensAtLabel: string | null;
  /** e.g. "10:00 PM" — when it next closes (only while open) */
  closesAtLabel: string | null;
  allowKinds: Kind[];
  /** closed hours are not counted against Daily/Weekly/Monthly/voucher packages */
  pause: boolean;
  message: string | null;
};

type HoursRow = {
  id: string; hours_enabled: boolean; hours_json: string | null; hours_allow: string | null; hours_message: string | null; hours_pause?: boolean | null;
};

export function toRouterHours(row: HoursRow, now = new Date()): RouterHours {
  const st = evaluateHours(Boolean(row.hours_enabled), parseSchedule(row.hours_json), now);
  const allow = String(row.hours_allow ?? "WEEKLY,MONTHLY").split(",").map((s) => s.trim()).filter((k): k is Kind => (ALL_KINDS as string[]).includes(k));
  return {
    routerId: row.id,
    enabled: st.enabled,
    open: st.open,
    nextChangeAt: st.nextChangeAt ? st.nextChangeAt.toISOString() : null,
    opensAtLabel: !st.open && st.nextChangeAt ? formatLocal(st.nextChangeAt, now) : null,
    closesAtLabel: st.open && st.enabled && st.nextChangeAt ? formatLocal(st.nextChangeAt, now) : null,
    allowKinds: allow,
    pause: row.hours_pause == null ? true : Boolean(row.hours_pause),
    message: row.hours_message ?? null,
  };
}

/**
 * The router whose hours apply for a portal visitor: a router in the visitor's
 * site (primary first), else the primary router.
 */
export async function getHoursForSite(siteId: string | null | undefined): Promise<RouterHours | null> {
  const sql = await getSql();
  const rows = await sql<HoursRow>`
    select id, hours_enabled, hours_json, hours_allow, hours_message, hours_pause
    from mikrotiks
    where (${siteId ?? null}::text is not null and coalesce(site_id, 'site_default') = ${siteId ?? null})
       or is_primary
    order by (coalesce(site_id, 'site_default') = ${siteId ?? "site_default"}) desc, is_primary desc, created_at
    limit 1
  `;
  return rows[0] ? toRouterHours(rows[0]) : null;
}

/** null = purchase allowed; otherwise the message to show. */
export function purchaseBlockedReason(h: RouterHours | null, kind: string | null | undefined, isVoucher = false): string | null {
  if (!h || !h.enabled || h.open) return null;
  const k = (kind ?? "HOURLY") as Kind;
  if (h.allowKinds.includes(k)) return null;
  const when = h.opensAtLabel ? ` Opens ${h.opensAtLabel}.` : "";
  const allowed = h.allowKinds.length ? ` You can still buy ${h.allowKinds.map((x) => x.toLowerCase()).join(" and ")} packages.` : "";
  return `We're closed right now.${when}${allowed}`.trim() + (isVoucher ? "" : "");
}

export async function isRouterClosedNow(routerId: string): Promise<boolean> {
  const sql = await getSql();
  const r = (await sql<{ hours_enabled: boolean; hours_state: string }>`
    select hours_enabled, hours_state from mikrotiks where id = ${routerId} limit 1`)[0];
  return Boolean(r?.hours_enabled) && r?.hours_state === "CLOSED";
}

/** Primary router closed? (activation provisions on the primary router) */
export async function isPrimaryClosed(): Promise<boolean> {
  const sql = await getSql();
  const r = (await sql<{ hours_enabled: boolean; hours_state: string }>`
    select hours_enabled, hours_state from mikrotiks where is_primary order by created_at limit 1`)[0];
  return Boolean(r?.hours_enabled) && r?.hours_state === "CLOSED";
}

async function usernamesToEnable(): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql<{ u: string }>`
    select distinct cp.mikrotik_username as u
    from customer_packages cp join customers c on c.id = cp.customer_id
    where cp.status = 'ACTIVE' and cp.expiry_time > now() and cp.mikrotik_username is not null
      and c.status <> 'BLOCKED'
  `;
  return rows.map((r) => r.u);
}

async function applyToRouter(creds: RouterCreds, closed: boolean) {
  if (closed) return setTelnetUsersState(creds, { disabled: true, kickActive: true });
  return setTelnetUsersState(creds, { disabled: false, only: await usernamesToEnable() });
}

/**
 * Evaluate every router's schedule: flip state at the boundaries, credit closed
 * time on reopening, and (re)apply the state to the router until it sticks.
 */
export async function applyOperatingHours(now = new Date()): Promise<number> {
  const sql = await getSql();
  const rows = await sql<HoursRow & { hours_state: string; hours_applied: boolean; hours_pause: boolean; closed_since: string | null; name: string }>`
    select id, name, hours_enabled, hours_json, hours_allow, hours_message, hours_state, hours_applied, hours_pause, closed_since
    from mikrotiks
    where hours_enabled or hours_state = 'CLOSED' or not hours_applied
  `;
  let changed = 0;
  for (const r of rows) {
    const st = evaluateHours(Boolean(r.hours_enabled), parseSchedule(r.hours_json), now);
    const desired = st.open ? "OPEN" : "CLOSED";
    if (desired !== r.hours_state) {
      changed += 1;
      if (desired === "CLOSED") {
        await sql`update mikrotiks set hours_state = 'CLOSED', closed_since = ${now.toISOString()}, hours_applied = false where id = ${r.id}`;
        await logEvent("HOURS", `${r.name} closed (scheduled).`);
      } else {
        const since = r.closed_since ? new Date(r.closed_since) : null;
        await sql`update mikrotiks set hours_state = 'OPEN', closed_since = null, hours_applied = false where id = ${r.id}`;
        if (since && r.hours_pause) {
          const ms = now.getTime() - since.getTime();
          if (ms >= 60_000) await creditOutage(r.id, since, ms, "closed hours").catch((e) => console.error("[hours] credit failed", e));
        }
        await logEvent("HOURS", `${r.name} opened.`);
      }
    }
    const fresh = (await sql<{ hours_applied: boolean; hours_state: string }>`select hours_applied, hours_state from mikrotiks where id = ${r.id}`)[0];
    if (fresh && !fresh.hours_applied) {
      const creds = await getRouterCredentialsById(r.id);
      if (!creds) continue;
      try {
        await applyToRouter(creds, fresh.hours_state === "CLOSED");
        await sql`update mikrotiks set hours_applied = true where id = ${r.id}`;
      } catch (err) {
        console.error("[hours] could not apply to router yet:", err instanceof Error ? err.message : err);
      }
    }
  }
  return changed;
}
