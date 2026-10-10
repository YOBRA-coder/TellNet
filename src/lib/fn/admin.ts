import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
//import { authMiddleware } from "@/lib/auth/middleware";
import { authMiddleware } from "@/lib/auth/operator-middleware";
import { getSql } from "@/lib/db";
import { nid, asNumber, iso } from "@/lib/utils";
import type {
  AccessPointRow,
  HealthState,
  LiveSnapshot,
  MapRouter,
  MapSite,
  NetworkMapData,
} from "@/lib/types";
import { expireDuePackages } from "@/lib/services/expiry.server";
import { resumeEligiblePackages } from "@/lib/services/resume.server";
import {
  activateFromPayment,
  blockCustomer,
  disconnectSession,
  reconnectCustomer,
  releaseDeviceBind,
  tickLiveUsage,
} from "@/lib/services/activation.server";
import { disconnectUser, probeHwRouter, probeStoredRouter } from "@/lib/services/hardware";
import { hwActiveDeviceCounts, refreshHwAccessPoints } from "@/lib/services/hardware/ap.server";
import { HARDWARE_LABELS, HARDWARE_TYPES, parseHwConfig, asHardwareType, type HardwareType } from "@/lib/hardware";
import {
  applyRadiusToRouter,
  checkRadiusOnRouter,
  getRouterCredentialsById,
  normalizeRouterHost,
  pingRouter,
  probeRouter,
  applyCamouflage as applyCamouflageLive,
} from "@/lib/services/mikrotik.server";
import { resetCustomerPin } from "@/lib/services/customer-auth.server";
import { getRadiusConfig } from "@/lib/services/radius.server";
import { apRevenue, refreshNetworkLive } from "@/lib/services/network-live.server";
import { getEffectiveCapacity } from "@/lib/services/capacity.server";
import { recordProbeResult } from "@/lib/services/outage.server";
import { applyOperatingHours, toRouterHours, TZ } from "@/lib/services/hours.server";
import {
  getRadiusListenerStatus,
  syncRadiusListener,
} from "@/lib/services/radius-listener.server";
import { getSettings, logEvent } from "@/lib/services/settings.server";
import { getPeriodStarts } from "@/lib/services/periods.server";
import { parsePhoneSearch } from "@/lib/phone";
import {
  mapCustomer,
  mapCustomerPackage,
  mapEvent,
  mapIsp,
  mapLiveUser,
  mapMikroTik,
  mapPackage,
  mapPayment,
  mapSite,
  type SqlRow,
} from "@/lib/services/rows.server";
import {
  deleteVouchers,
  generateVouchers,
  listVouchersPage,
  vouchersForPrint,
} from "@/lib/services/vouchers.server";
import { processActivationRetries } from "../services/callback.server";

/** "ALL"/undefined = every site. Payments/customers with no site count as the main site. */
const siteParam = z.object({ siteId: z.string().optional() }).optional();
const normSite = (v?: string | null) => (v && v !== "ALL" ? v : null);

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => siteParam.parse(data))
  .handler(async ({ data: input }) => {
    const site = normSite(input?.siteId);
    // Non-blocking maintenance — do not delay first paint
    void expireDuePackages().catch(() => {});
    void tickLiveUsage().catch(() => {});

    const sql = await getSql();
    const ps = await getPeriodStarts();
    const [settings, router, today, counts, ispsRaw, mikrotiksRaw, eventsRaw, recentRaw] =
      await Promise.all([
        getSettings(),
        pingRouter().catch(() => ({
          reachable: false,
          mode: "unconfigured" as const,
        })),
        sql<{
          revenue: number;
          tx: number;
          success: number;
          failed: number;
          vouchers: number;
          voucher_value: number;
        }>`
          select
            coalesce(sum(case when status = 'SUCCESS' and coalesce(mpesa_transaction_id, '') not like 'PTS-%' and coalesce(mpesa_transaction_id, '') not like 'VCH-%' then amount else 0 end), 0)::int as revenue,
            count(*)::int as tx,
            count(*) filter (where status = 'SUCCESS')::int as success,
            count(*) filter (where status in ('FAILED','CANCELLED'))::int as failed,
            count(*) filter (where status = 'SUCCESS' and mpesa_transaction_id like 'VCH-%')::int as vouchers,
            coalesce(sum(amount) filter (where status = 'SUCCESS' and mpesa_transaction_id like 'VCH-%'), 0)::int as voucher_value
          from payments
          where created_at >= ${ps.dayStart}::timestamptz
            and (${site}::text is null or coalesce(site_id, 'site_default') = ${site})
        `,
        sql<{
          online: number;
          active_pkg: number;
          expired_pkg: number;
          customers: number;
          awaiting: number;
        }>`
          select
            (select count(*) from sessions s join customers c on c.id = s.customer_id
               where s.status = 'ACTIVE' and (${site}::text is null or coalesce(c.site_id, 'site_default') = ${site}))::int as online,
            (select count(*) from customer_packages cp join customers c on c.id = cp.customer_id
               where cp.status = 'ACTIVE' and cp.expiry_time > now()
                 and (${site}::text is null or coalesce(c.site_id, 'site_default') = ${site}))::int as active_pkg,
            (select count(*) from customer_packages cp join customers c on c.id = cp.customer_id
               where cp.status = 'EXPIRED'
                 and (${site}::text is null or coalesce(c.site_id, 'site_default') = ${site}))::int as expired_pkg,
            (select count(*) from customers c
               where ${site}::text is null or coalesce(c.site_id, 'site_default') = ${site})::int as customers,
            (select count(*) from payments where status = 'SUCCESS' and activation_status = 'ACTIVATION_FAILED'
               and (${site}::text is null or coalesce(site_id, 'site_default') = ${site}))::int as awaiting
        `,
        sql<SqlRow>`select * from isps
          where ${site}::text is null or coalesce(site_id, 'site_default') = ${site}
          order by sort_order`,
        sql<SqlRow>`select * from mikrotiks
          where ${site}::text is null or coalesce(site_id, 'site_default') = ${site}
          order by is_primary desc, created_at`,
        sql<SqlRow>`select * from network_events order by created_at desc limit 8`,
        sql<SqlRow>`
          select p.*, pkg.name as package_name
          from payments p join packages pkg on pkg.id = p.package_id
          where ${site}::text is null or coalesce(p.site_id, 'site_default') = ${site}
          order by p.created_at desc limit 8
        `,
      ]);

    // Extra read-only figures for the dashboard (same "real M-Pesa money only" rule as today's revenue).
    const extra = (
      await sql<{
        yesterday: number;
        week: number;
        month: number;
        expiring: number;
        new_customers: number;
      }>`
        select
          (select coalesce(sum(amount), 0)::int from payments
             where status = 'SUCCESS' and coalesce(mpesa_transaction_id, '') not like 'PTS-%' and coalesce(mpesa_transaction_id, '') not like 'VCH-%'
               and created_at >= ${ps.prevDayStart}::timestamptz and created_at < ${ps.dayStart}::timestamptz
               and (${site}::text is null or coalesce(site_id, 'site_default') = ${site})) as yesterday,
          (select coalesce(sum(amount), 0)::int from payments
             where status = 'SUCCESS' and coalesce(mpesa_transaction_id, '') not like 'PTS-%' and coalesce(mpesa_transaction_id, '') not like 'VCH-%'
               and created_at >= ${ps.weekStart}::timestamptz
               and (${site}::text is null or coalesce(site_id, 'site_default') = ${site})) as week,
          (select coalesce(sum(amount), 0)::int from payments
             where status = 'SUCCESS' and coalesce(mpesa_transaction_id, '') not like 'PTS-%' and coalesce(mpesa_transaction_id, '') not like 'VCH-%'
               and created_at >= ${ps.monthStart}::timestamptz
               and (${site}::text is null or coalesce(site_id, 'site_default') = ${site})) as month,
          (select count(*)::int from customer_packages cp join customers c on c.id = cp.customer_id
             where cp.status = 'ACTIVE' and cp.expiry_time > now() and cp.expiry_time <= now() + interval '1 hour'
               and (${site}::text is null or coalesce(c.site_id, 'site_default') = ${site})) as expiring,
          (select count(*)::int from customers c
             where c.created_at >= ${ps.dayStart}::timestamptz
               and (${site}::text is null or coalesce(c.site_id, 'site_default') = ${site})) as new_customers
      `
    )[0];

    const isps = ispsRaw.map(mapIsp);
    const mikrotiks = mikrotiksRaw.map(mapMikroTik);
    const events = eventsRaw.map(mapEvent);
    const recent = recentRaw.map(mapPayment);

    const t = today[0];
    const c = counts[0];
    return {
      settings,
      router,
      cards: {
        todayRevenue: asNumber(t?.revenue),
        todayTx: asNumber(t?.tx),
        todaySuccess: asNumber(t?.success),
        todayFailed: asNumber(t?.failed),
        todayVouchers: asNumber(t?.vouchers),
        todayVoucherValue: asNumber(t?.voucher_value),
        onlineUsers: asNumber(c?.online),
        activePackages: asNumber(c?.active_pkg),
        expiredPackages: asNumber(c?.expired_pkg),
        totalCustomers: asNumber(c?.customers),
        awaitingActivation: asNumber(c?.awaiting),
        yesterdayRevenue: asNumber(extra?.yesterday),
        weekRevenue: asNumber(extra?.week),
        monthRevenue: asNumber(extra?.month),
        expiringSoon: asNumber(extra?.expiring),
        newCustomersToday: asNumber(extra?.new_customers),
      },
      isps,
      mikrotiks,
      events,
      recent,
    };
  });

export const getDataUsage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        // ISO date-only (yyyy-mm-dd) bounds, inclusive of the whole `to` day.
        from: z.string(),
        to: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<{ down: number; up: number }>`
      select
        coalesce(sum(bytes_down), 0)::bigint as down,
        coalesce(sum(bytes_up), 0)::bigint as up
      from sessions
      where session_start >= ${data.from}::date
        and session_start < (${data.to}::date + interval '1 day')
    `;
    const r = rows[0];
    return {
      bytesDown: Number(r?.down ?? 0),
      bytesUp: Number(r?.up ?? 0),
    };
  });

export const listCustomersAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    await expireDuePackages();
    const sql = await getSql();
    const rows = await sql<SqlRow>`
      select
        c.id, c.phone, c.status, c.created_at, c.site_id,
        (c.registered_at is not null) as registered,
        cp.id as cp_id, cp.package_id, cp.payment_id, cp.start_time, cp.expiry_time,
        cp.speed_limit_kbps, cp.status as pkg_status, cp.activation_status,
        cp.mikrotik_username, cp.bound_device_token, cp.last_resumed_at, pkg.name as package_name,
        (select count(*)::int from customer_package_devices cpd where cpd.customer_package_id = cp.id) as bound_device_count,
        (select count(*)::int from customer_packages x where x.customer_id = c.id) as package_count,
        (select count(*)::int from customer_packages x where x.customer_id = c.id and x.status = 'QUEUED') as queued_count,
        (select count(distinct d.device_token)::int from customer_package_devices d
           join customer_packages x on x.id = d.customer_package_id where x.customer_id = c.id) as device_count,
        p.amount, p.status as payment_status, p.mpesa_transaction_id,
        (select s.status from sessions s where s.customer_id = c.id order by s.session_start desc limit 1) as connection_status
      from customers c
      left join lateral (
        select * from customer_packages
        where customer_id = c.id
        order by (status = 'ACTIVE') desc, created_at desc
        limit 1
      ) cp on true
      left join packages pkg on pkg.id = cp.package_id
      left join payments p on p.id = cp.payment_id
      where c.deleted_at is null
      order by c.created_at desc
    `;
    return rows.map((row) => ({
      customer: mapCustomer(row),
      pack: row.cp_id
        ? mapCustomerPackage({
            ...row,
            id: row.cp_id,
            customer_id: row.id,
            status: row.pkg_status,
          })
        : null,
      paymentStatus: row.payment_status ? String(row.payment_status) : null,
      paymentAmount: row.amount != null ? asNumber(row.amount) : null,
      mpesaTransactionId: row.mpesa_transaction_id
        ? String(row.mpesa_transaction_id)
        : null,
      connectionStatus: row.connection_status ? String(row.connection_status) : "OFFLINE",
      registered: row.registered === true || row.registered === "t" || row.registered === "true",
      siteId: row.site_id ? String(row.site_id) : "site_default",
      packageCount: asNumber(row.package_count),
      queuedCount: asNumber(row.queued_count),
      deviceCount: asNumber(row.device_count),
    }));
  });

/**
 * Full purchase/session history for one customer, by id or phone —
 * for the admin "search a number, see everything" lookup. Phone is
 * matched loosely (digits only, trailing match) so an operator can
 * type "0712345678" or "712345678" or paste the last few digits.
 */
export const getCustomerHistoryAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        customerId: z.string().optional(),
        phone: z.string().optional(),
      })
      .refine((d) => d.customerId || d.phone, "customerId or phone required")
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    let customerId = data.customerId ?? null;
    if (!customerId && data.phone) {
      // Accept 07…, 7…, 254… or +254… — compare on the number without its
      // country/trunk prefix so every format finds the same customer.
      let digits = data.phone.replace(/\D/g, "");
      if (digits.startsWith("254")) digits = digits.slice(3);
      else if (digits.startsWith("0")) digits = digits.slice(1);
      const found = await sql<{ id: string }>`
        select id from customers
        where regexp_replace(phone, '\\D', '', 'g') like ${"%" + digits + "%"}
        order by created_at desc
        limit 1
      `;
      customerId = found[0]?.id ?? null;
    }
    if (!customerId) return null;

    const customerRows = await sql<SqlRow>`
      select * from customers where id = ${customerId} limit 1
    `;
    if (!customerRows[0]) return null;

    const packages = (
      await sql<SqlRow>`
        select cp.*, pkg.name as package_name
        from customer_packages cp
        join packages pkg on pkg.id = cp.package_id
        where cp.customer_id = ${customerId}
        order by cp.created_at desc
        limit 50
      `
    ).map(mapCustomerPackage);

    const payments = (
      await sql<SqlRow>`
        select p.*, pkg.name as package_name
        from payments p
        join packages pkg on pkg.id = p.package_id
        where p.customer_id = ${customerId}
        order by p.created_at desc
        limit 50
      `
    ).map(mapPayment);

    const sessions = await sql<{
      id: string;
      session_start: string;
      session_end: string | null;
      status: string;
      bytes_down: number;
      bytes_up: number;
      device_information: string | null;
    }>`
      select id, session_start, session_end, status, bytes_down, bytes_up, device_information
      from sessions
      where customer_id = ${customerId}
      order by session_start desc
      limit 50
    `;

    const loyaltyLedger = await sql<{
      id: string;
      delta: number;
      reason: string;
      created_at: string;
    }>`
      select id, delta, reason, created_at from loyalty_ledger
      where customer_id = ${customerId}
      order by created_at desc
      limit 50
    `;

    const referralCount = (
      await sql<{ n: number }>`
        select count(*)::int as n from customers where referred_by_customer_id = ${customerId}
      `
    )[0]?.n ?? 0;

    // True totals, so the screen can say "latest 50 of 213" instead of silently cutting off.
    const totalsRow = (
      await sql<{ packages: number; payments: number; sessions: number; loyalty: number }>`
        select
          (select count(*)::int from customer_packages where customer_id = ${customerId}) as packages,
          (select count(*)::int from payments where customer_id = ${customerId}) as payments,
          (select count(*)::int from sessions where customer_id = ${customerId}) as sessions,
          (select count(*)::int from loyalty_ledger where customer_id = ${customerId}) as loyalty
      `
    )[0];

    // Devices switched on through Omada / Ruijie (MAC + which site/hardware).
    const hardwareDevices = (
      await sql<{
        id: string;
        vendor: string;
        client_mac: string;
        status: string;
        authorized_at: string;
        expires_at: string;
        router_name: string | null;
      }>`
        select a.id, a.vendor, a.client_mac, a.status, a.authorized_at, a.expires_at, m.name as router_name
        from hw_authorizations a
        join customer_packages cp on cp.id = a.customer_package_id
        left join mikrotiks m on m.id = a.router_id
        where cp.customer_id = ${customerId}
        order by a.authorized_at desc
        limit 20
      `
    ).map((d) => ({
      id: d.id,
      vendor: asHardwareType(d.vendor),
      clientMac: d.client_mac,
      status: d.status,
      authorizedAt: iso(d.authorized_at),
      expiresAt: iso(d.expires_at),
      routerName: d.router_name,
    }));

    return {
      totals: {
        packages: Number(totalsRow?.packages ?? 0),
        payments: Number(totalsRow?.payments ?? 0),
        sessions: Number(totalsRow?.sessions ?? 0),
        loyalty: Number(totalsRow?.loyalty ?? 0),
      },
      hardwareDevices,
      customer: mapCustomer(customerRows[0]),
      registered: Boolean(customerRows[0].registered_at),
      referralCode: customerRows[0].referral_code
        ? String(customerRows[0].referral_code)
        : null,
      referredByCustomerId: customerRows[0].referred_by_customer_id
        ? String(customerRows[0].referred_by_customer_id)
        : null,
      referralCount,
      loyaltyPoints: asNumber(customerRows[0].loyalty_points),
      bonusMinutesBalance: asNumber(customerRows[0].bonus_minutes_balance),
      packages,
      payments,
      sessions: sessions.map((s) => ({
        id: s.id,
        sessionStart: s.session_start,
        sessionEnd: s.session_end,
        status: s.status,
        bytesDown: asNumber(s.bytes_down),
        bytesUp: asNumber(s.bytes_up),
        deviceInformation: s.device_information,
      })),
      loyaltyLedger,
    };
  });

export const customerAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        customerId: z.string(),
        action: z.enum([
          "disconnect",
          "block",
          "unblock",
          "extend",
          "changePackage",
          "retry",
          "releaseDevice",
          "resetPin",
          "delete",
        ]),
        minutes: z.number().int().min(1).max(525_600).optional(),
        packageId: z.string().optional(),
        /** resetPin: the PIN/password the customer wants (blank = generate one) */
        pin: z.string().max(64).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const exists = await sql<{ id: string }>`
      select id from customers where id = ${data.customerId} limit 1
    `;
    if (!exists[0]) return { ok: false as const, error: "Customer not found." };

    if (data.action === "block") {
      await blockCustomer(data.customerId);
      await sql`delete from customer_sessions where customer_id = ${data.customerId}`;
      return { ok: true as const, message: "Customer blocked and disconnected." };
    }

    if (data.action === "unblock") {
      await sql`update customers set status = 'ACTIVE', updated_at = now() where id = ${data.customerId}`;
      // blockCustomer() disabled their router login — turn it back on if
      // they still have time left.
      const res = await reconnectCustomer(data.customerId).catch(() => null);
      return {
        ok: true as const,
        message:
          res && res.ok
            ? "Customer unblocked and their package re-enabled."
            : "Customer unblocked.",
      };
    }

    if (data.action === "disconnect") {
      const ses = await sql<{ id: string }>`
        select id from sessions where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
      for (const s of ses) await disconnectSession(s.id);
      // Also kick the login on the router itself, in case the local session
      // record is missing or stale.
      const user = await sql<{ mikrotik_username: string | null }>`
        select mikrotik_username from customer_packages
        where customer_id = ${data.customerId} and status = 'ACTIVE' and mikrotik_username is not null
        order by expiry_time desc limit 1
      `;
      let routerKick = false;
      if (user[0]?.mikrotik_username) {
        routerKick = await disconnectUser(user[0].mikrotik_username).then(
          () => true,
          () => false,
        );
      }
      if (ses.length === 0 && !routerKick) {
        return { ok: false as const, error: "This customer isn't connected right now." };
      }
      return {
        ok: true as const,
        message: "Disconnected. Their paid package is unchanged — they can reconnect.",
      };
    }

    if (data.action === "releaseDevice") {
      await releaseDeviceBind(data.customerId);
      return { ok: true as const, message: "Device released. Another phone can connect." };
    }

    if (data.action === "resetPin") {
      let pin: string;
      try {
        pin = await resetCustomerPin(data.customerId, data.pin?.trim() || undefined);
      } catch (err) {
        return { ok: false as const, error: err instanceof Error ? err.message : "Invalid PIN." };
      }
      await logEvent("CUSTOMER", `PIN ${data.pin?.trim() ? "set" : "reset"} for customer ${data.customerId}.`);
      return {
        ok: true as const,
        message: data.pin?.trim()
          ? "PIN/password set — the customer can sign in with it now."
          : `New PIN: ${pin} — give it to the customer; they can sign in with it now.`,
        pin,
      };
    }

    if (data.action === "delete") {
      const ses = await sql<{ id: string }>`
        select id from sessions where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
      for (const s of ses) await disconnectSession(s.id);
      await sql`
        update payments set phone = 'deleted', updated_at = now()
        where customer_id = ${data.customerId}
      `;
      await sql`delete from customer_sessions where customer_id = ${data.customerId}`;
      await sql`
        update customers
        set phone = ${"deleted-" + data.customerId},
            device_token = null,
            status = 'BLOCKED',
            pin_hash = null,
            pin_salt = null,
            referral_code = null,
            deleted_at = now(),
            updated_at = now()
        where id = ${data.customerId}
      `;
      await logEvent("CUSTOMER", `Customer ${data.customerId} data was deleted.`);
      return { ok: true as const, message: "Customer data deleted." };
    }

    if (data.action === "extend") {
      const mins = data.minutes ?? 60;
      const active = await sql<{ id: string }>`
        select id from customer_packages
        where customer_id = ${data.customerId} and status = 'ACTIVE' and expiry_time > now()
        limit 1
      `;
      if (!active[0]) {
        return { ok: false as const, error: "No active package to extend." };
      }
      await sql`
        update customer_packages
        set expiry_time = expiry_time + (${mins} * interval '1 minute'), updated_at = now()
        where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
      // Slide anything queued behind it so the extra time doesn't overlap.
      await sql`
        update customer_packages
        set start_time = start_time + (${mins} * interval '1 minute'),
            expiry_time = expiry_time + (${mins} * interval '1 minute'),
            updated_at = now()
        where customer_id = ${data.customerId} and status = 'QUEUED'
      `;
      // Push the new session timeout to the router so it actually applies.
      const res = await reconnectCustomer(data.customerId).catch(() => null);
      return {
        ok: true as const,
        message:
          res && res.ok
            ? `Extended by ${mins} min and updated on the router.`
            : `Extended by ${mins} min. The router couldn't be updated just now — use Retry activation.`,
      };
    }

    if (data.action === "changePackage") {
      if (!data.packageId) return { ok: false as const, error: "Choose a package." };
      const pkg = (
        await sql<SqlRow>`select * from packages where id = ${data.packageId} limit 1`
      )[0];
      if (!pkg) return { ok: false as const, error: "Package not found." };
      const active = await sql<{ id: string }>`
        select id from customer_packages
        where customer_id = ${data.customerId} and status = 'ACTIVE' and expiry_time > now()
        limit 1
      `;
      if (!active[0]) return { ok: false as const, error: "No active package to change." };
      await sql`
        update customer_packages
        set package_id = ${pkg.id},
            speed_limit_kbps = ${pkg.download_kbps},
            data_limit_mb = ${pkg.data_limit_mb},
            updated_at = now()
        where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
      // Remaining time is kept; only speed/limits/devices change — apply on the router.
      const res = await reconnectCustomer(data.customerId).catch(() => null);
      return {
        ok: true as const,
        message:
          res && res.ok
            ? `Switched to ${String(pkg.name)} (remaining time kept) and updated on the router.`
            : `Switched to ${String(pkg.name)}. The router couldn't be updated just now — use Retry activation.`,
      };
    }

    if (data.action === "retry") {
      // Retry a payment that was paid but never reached the router; if
      // nothing failed, re-push the running package. NEVER pick a payment
      // whose package is still queued — that would start it early.
      const failed = await sql<{ id: string }>`
        select p.id from payments p
        where p.customer_id = ${data.customerId} and p.status = 'SUCCESS'
          and p.activation_status in ('ACTIVATION_FAILED', 'NOT_ACTIVATED')
        order by p.created_at desc limit 1
      `;
      if (failed[0]) {
        const result = await activateFromPayment(failed[0].id);
        return result.ok
          ? { ok: true as const, message: "Activated." }
          : { ok: false as const, error: "Activation failed. Check the router." };
      }
      const res = await reconnectCustomer(data.customerId);
      if (res.ok) return { ok: true as const, message: "Package re-sent to the router." };
      return {
        ok: false as const,
        error:
          res.reason === "none"
            ? "Nothing to retry — this customer has no active or failed package."
            : "Activation failed. Check the router.",
      };
    }
    return { ok: false as const, error: "Unknown action." };
  });

export const listPackagesAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<SqlRow>`
      select p.*,
        (select string_agg(ps.site_id, ',' order by ps.site_id)
           from package_sites ps where ps.package_id = p.id) as site_ids
      from packages p
      order by p.sort_order, p.price
    `;
    return rows.map((row) => {
      const pkg = mapPackage(row);
      const ids = row.site_ids ? String(row.site_ids).split(",").filter(Boolean) : [];
      // Older rows that only have packages.site_id still count as one site.
      const siteIds = ids.length > 0 ? ids : pkg.siteId ? [pkg.siteId] : [];
      return { ...pkg, siteIds };
    });
  });

export const savePackage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(1).max(40),
        price: z.number().int().min(0),
        durationMinutes: z.number().int().min(1),
        downloadKbps: z.number().int().min(64),
        uploadKbps: z.number().int().min(64),
        dataLimitMb: z.number().int().min(1).nullable(),
        status: z.enum(["ACTIVE", "INACTIVE"]),
        siteId: z.string().nullable().optional(),
        /** Sites this package is sold at. Empty = all sites. */
        siteIds: z.array(z.string()).max(100).optional(),
        badge: z.enum(["MOST_POPULAR", "BEST_VALUE"]).nullable().optional(),
        durationKind: z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY"]).optional(),
        pointsCost: z.number().int().min(1).nullable().optional(),
        category: z.enum(["STANDARD", "STUDENT"]).optional(),
        maxDevices: z.union([z.literal(1), z.literal(2)]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id ?? nid("pkg");
    const durationKind =
      data.durationKind ??
      (data.durationMinutes <= 90
        ? "HOURLY"
        : data.durationMinutes <= 1440
          ? "DAILY"
          : data.durationMinutes <= 10080
            ? "WEEKLY"
            : "MONTHLY");
    const maxDevices = data.maxDevices === 2 ? 2 : 1;
    // Keep only real sites, no duplicates. Empty list = sold everywhere.
    const wanted = Array.from(new Set(data.siteIds ?? (data.siteId ? [data.siteId] : [])));
    const siteIds: string[] = [];
    for (const sid of wanted) {
      const hit = await sql<{ id: string }>`select id from sites where id = ${sid} limit 1`;
      if (hit[0]) siteIds.push(hit[0].id);
    }
    const primarySite = siteIds[0] ?? null;
    await sql`
      insert into packages (
        id, name, price, duration_minutes, download_kbps, upload_kbps, data_limit_mb, status, sort_order, site_id, badge, duration_kind, points_cost, category, max_devices
      ) values (
        ${id}, ${data.name}, ${data.price}, ${data.durationMinutes}, ${data.downloadKbps},
        ${data.uploadKbps}, ${data.dataLimitMb}, ${data.status}, 50, ${primarySite}, ${data.badge ?? null}, ${durationKind}, ${data.pointsCost ?? null}, ${data.category ?? "STANDARD"}, ${maxDevices}
      )
      on conflict (id) do update set
        name = excluded.name,
        price = excluded.price,
        duration_minutes = excluded.duration_minutes,
        download_kbps = excluded.download_kbps,
        upload_kbps = excluded.upload_kbps,
        data_limit_mb = excluded.data_limit_mb,
        status = excluded.status,
        site_id = excluded.site_id,
        badge = excluded.badge,
        duration_kind = excluded.duration_kind,
        points_cost = excluded.points_cost,
        category = excluded.category,
        max_devices = excluded.max_devices,
        updated_at = now()
    `;
    await sql`delete from package_sites where package_id = ${id}`;
    for (const sid of siteIds) {
      await sql`
        insert into package_sites (package_id, site_id) values (${id}, ${sid})
        on conflict do nothing
      `;
    }
    return { ok: true as const, id };
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update packages set status = 'INACTIVE', updated_at = now() where id = ${data.id}`;
    return { ok: true as const };
  });

export const listPaymentsAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        phone: z.string().optional(),
        packageId: z.string().optional(),
        status: z.string().optional(),
        activationStatus: z.string().optional(),
        period: z.enum(["ALL", "TODAY", "WEEK", "MONTH"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const ps = await getPeriodStarts();
    // Phone search: "07…", "7…", "254…" and "+254…" all work. Numbers are stored
    // as 2547XXXXXXXX, so a leading 0 is turned into 254 and matched from the
    // START of the number; anything with letters is searched as an M-Pesa code.
    const find = parsePhoneSearch(data.phone ?? "");
    const phonePrefix = find.kind === "prefix" ? find.digits + "%" : null;
    const phoneContains = find.kind === "contains" ? "%" + find.digits + "%" : null;
    const textLike = find.kind === "text" ? "%" + find.text + "%" : null;
    const rows = await sql<SqlRow>`
      select p.*, pkg.name as package_name
      from payments p
      join packages pkg on pkg.id = p.package_id
      where (
          (${phonePrefix}::text is null and ${phoneContains}::text is null and ${textLike}::text is null)
          or regexp_replace(p.phone, '\\D', '', 'g') like ${phonePrefix}::text
          or regexp_replace(p.phone, '\\D', '', 'g') like ${phoneContains}::text
          or upper(coalesce(p.mpesa_transaction_id, '')) like ${textLike}::text
        )
        and (${data.packageId ?? null}::text is null or p.package_id = ${data.packageId ?? ""})
        and (${data.status ?? null}::text is null or p.status = ${data.status ?? ""})
        and (${data.activationStatus ?? null}::text is null or p.activation_status = ${data.activationStatus ?? ""})
        and (
          ${data.period ?? "ALL"} = 'ALL'
          or (${data.period ?? "ALL"} = 'TODAY' and p.created_at >= ${ps.dayStart}::timestamptz)
          or (${data.period ?? "ALL"} = 'WEEK' and p.created_at >= ${ps.weekStart}::timestamptz)
          or (${data.period ?? "ALL"} = 'MONTH' and p.created_at >= ${ps.monthStart}::timestamptz)
        )
      order by p.created_at desc
      limit 200
    `;
    return rows.map(mapPayment);
  });

export const retryPaymentActivation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ paymentId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const result = await activateFromPayment(data.paymentId);
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, error: "Activation failed. Check the router." };
  });

export const listLiveUsers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    await expireDuePackages();
    await tickLiveUsage();
    const sql = await getSql();
    const rows = await sql<SqlRow>`
      select
        s.id as session_id, s.customer_id, c.phone, c.status as customer_status,
        s.ip_address, pkg.name as package_name, cp.speed_limit_kbps,
        s.session_start, cp.expiry_time, s.bytes_down, s.bytes_up, s.status
      from sessions s
      join customers c on c.id = s.customer_id
      join packages pkg on pkg.id = s.package_id
      left join customer_packages cp on cp.id = s.customer_package_id
      where s.status = 'ACTIVE'
      order by s.session_start desc
    `;
    return rows.map(mapLiveUser);
  });

export const kickLiveUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ sessionId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    await disconnectSession(data.sessionId);
    return { ok: true as const };
  });

type ReportPeriod = {
  revenue: number;
  tx: number;
  /** successful M-Pesa payments (real money) */
  paid: number;
  failed: number;
  pending: number;
  /** free redemptions: vouchers and loyalty points (never counted as revenue) */
  vouchers: number;
  points: number;
  /** every package handed out: paid + vouchers + points */
  sold: number;
};

export const getReports = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        siteId: z.string().optional(),
        days: z.number().int().min(7).max(90).optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data: input }) => {
    const site = normSite(input?.siteId);
    const days = input?.days ?? 14;
    const sql = await getSql();
    const ps = await getPeriodStarts();
    const tz = TZ;

    // Money = successful M-Pesa only. Voucher (VCH-) and points (PTS-) redemptions
    // are free packages and are reported separately, never as revenue.
    const period = async (from: string, to: string | null): Promise<ReportPeriod> => {
      const r = (
        await sql<Record<string, unknown>>`
          select
            coalesce(sum(amount) filter (where status = 'SUCCESS'
              and coalesce(mpesa_transaction_id, '') not like 'PTS-%'
              and coalesce(mpesa_transaction_id, '') not like 'VCH-%'), 0)::int as revenue,
            count(*)::int as tx,
            count(*) filter (where status = 'SUCCESS'
              and coalesce(mpesa_transaction_id, '') not like 'PTS-%'
              and coalesce(mpesa_transaction_id, '') not like 'VCH-%')::int as paid,
            count(*) filter (where status in ('FAILED', 'CANCELLED'))::int as failed,
            count(*) filter (where status = 'PENDING')::int as pending,
            count(*) filter (where status = 'SUCCESS' and mpesa_transaction_id like 'VCH-%')::int as vouchers,
            count(*) filter (where status = 'SUCCESS' and mpesa_transaction_id like 'PTS-%')::int as points,
            count(*) filter (where status = 'SUCCESS')::int as sold
          from payments
          where created_at >= ${from}::timestamptz
            and (${to}::timestamptz is null or created_at < ${to}::timestamptz)
            and (${site}::text is null or coalesce(site_id, 'site_default') = ${site})
        `
      )[0];
      return {
        revenue: asNumber(r.revenue),
        tx: asNumber(r.tx),
        paid: asNumber(r.paid),
        failed: asNumber(r.failed),
        pending: asNumber(r.pending),
        vouchers: asNumber(r.vouchers),
        points: asNumber(r.points),
        sold: asNumber(r.sold),
      };
    };

    const perPackage = (from: string) => sql<{ name: string; sold: number; revenue: number }>`
      select pkg.name, count(*)::int as sold,
             coalesce(sum(p.amount) filter (where coalesce(p.mpesa_transaction_id, '') not like 'PTS-%'
               and coalesce(p.mpesa_transaction_id, '') not like 'VCH-%'), 0)::int as revenue
      from payments p join packages pkg on pkg.id = p.package_id
      where p.status = 'SUCCESS' and p.created_at >= ${from}::timestamptz
        and (${site}::text is null or coalesce(p.site_id, 'site_default') = ${site})
      group by pkg.name
      order by revenue desc, sold desc
    `;

    const [today, yesterday, week, prevWeek, month, prevMonth, bestWeekRaw, monthPerfRaw, daily, hourly, bySite] =
      await Promise.all([
        period(ps.dayStart, null),
        period(ps.prevDayStart, ps.dayStart),
        period(ps.weekStart, null),
        period(ps.prevWeekStart, ps.weekStart),
        period(ps.monthStart, null),
        period(ps.prevMonthStart, ps.monthStart),
        perPackage(ps.weekStart),
        perPackage(ps.monthStart),
        // One row per calendar day (business time zone), zero-filled so quiet days still show.
        sql<{ day: string; label: string; revenue: number; tx: number }>`
          with d as (
            select g::date as day
            from generate_series(
              (now() at time zone ${tz}::text)::date - (${days}::int - 1),
              (now() at time zone ${tz}::text)::date,
              interval '1 day'
            ) g
          )
          select to_char(d.day, 'YYYY-MM-DD') as day,
                 to_char(d.day, 'DD Mon') as label,
                 coalesce(sum(p.amount) filter (where p.status = 'SUCCESS'
                   and coalesce(p.mpesa_transaction_id, '') not like 'PTS-%'
                   and coalesce(p.mpesa_transaction_id, '') not like 'VCH-%'), 0)::int as revenue,
                 count(p.id) filter (where p.status = 'SUCCESS')::int as tx
          from d
          left join payments p
            on (p.created_at at time zone ${tz}::text)::date = d.day
           and (${site}::text is null or coalesce(p.site_id, 'site_default') = ${site})
          group by d.day
          order by d.day
        `,
        // Busiest hours (last 30 days, successful M-Pesa).
        sql<{ hour: number; revenue: number; tx: number }>`
          select extract(hour from p.created_at at time zone ${tz}::text)::int as hour,
                 coalesce(sum(p.amount), 0)::int as revenue,
                 count(*)::int as tx
          from payments p
          where p.status = 'SUCCESS'
            and coalesce(p.mpesa_transaction_id, '') not like 'PTS-%'
            and coalesce(p.mpesa_transaction_id, '') not like 'VCH-%'
            and p.created_at >= now() - interval '30 days'
            and (${site}::text is null or coalesce(p.site_id, 'site_default') = ${site})
          group by 1
          order by 1
        `,
        // This month per site (only meaningful when "All sites" is selected).
        sql<{ site_id: string; name: string; revenue: number; paid: number }>`
          select s.id as site_id, s.name,
                 coalesce(sum(p.amount) filter (where p.status = 'SUCCESS'
                   and coalesce(p.mpesa_transaction_id, '') not like 'PTS-%'
                   and coalesce(p.mpesa_transaction_id, '') not like 'VCH-%'), 0)::int as revenue,
                 count(p.id) filter (where p.status = 'SUCCESS'
                   and coalesce(p.mpesa_transaction_id, '') not like 'PTS-%'
                   and coalesce(p.mpesa_transaction_id, '') not like 'VCH-%')::int as paid
          from sites s
          left join payments p
            on coalesce(p.site_id, 'site_default') = s.id
           and p.created_at >= ${ps.monthStart}::timestamptz
          group by s.id, s.name
          order by revenue desc, s.name
        `,
      ]);

    const hours = Array.from({ length: 24 }, (_, h) => {
      const row = hourly.find((x) => Number(x.hour) === h);
      return { hour: h, revenue: asNumber(row?.revenue), tx: asNumber(row?.tx) };
    });

    return {
      generatedAt: new Date().toISOString(),
      timezone: tz,
      days,
      today,
      yesterday,
      week,
      prevWeek,
      month,
      prevMonth,
      bestWeek: bestWeekRaw.map((r) => ({ name: String(r.name), sold: asNumber(r.sold), revenue: asNumber(r.revenue) })),
      monthPerf: monthPerfRaw.map((r) => ({ name: String(r.name), sold: asNumber(r.sold), revenue: asNumber(r.revenue) })),
      daily: daily.map((d) => ({
        day: String(d.day),
        label: String(d.label),
        revenue: asNumber(d.revenue),
        tx: asNumber(d.tx),
      })),
      hours,
      bySite: site
        ? []
        : bySite.map((r) => ({
            siteId: String(r.site_id),
            name: String(r.name),
            revenue: asNumber(r.revenue),
            paid: asNumber(r.paid),
          })),
    };
  });

export const checkMpesaSetupAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const { checkMpesaSetup } = await import("@/lib/services/mpesa.server");
    return checkMpesaSetup();
  });

export const sendMpesaTestPromptAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ phone: z.string().min(9).max(20) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { sendMpesaTestPrompt } = await import("@/lib/services/mpesa.server");
      await sendMpesaTestPrompt(data.phone, 1);
      await logEvent("PAYMENT", "Operator sent a KES 1 M-Pesa test prompt.").catch(() => {});
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Could not send the prompt." };
    }
  });

export const getNetwork = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    void expireDuePackages().catch(() => {});
    const sql = await getSql();
    const [settings, router, ispsRaw, eventsRaw, mikrotiksRaw, online, sitesRaw] =
      await Promise.all([
        getSettings(),
        pingRouter().catch(() => ({ reachable: false, mode: "unconfigured" as const })),
        sql<SqlRow>`select * from isps order by sort_order`,
        sql<SqlRow>`select * from network_events order by created_at desc limit 20`,
        sql<SqlRow>`select * from mikrotiks order by is_primary desc, created_at`,
        sql<{ n: number }>`select count(*)::int as n from sessions where status = 'ACTIVE'`,
        sql<SqlRow>`select * from sites order by name`,
      ]);
    const hwCounts = await hwActiveDeviceCounts().catch(() => new Map<string, number>());
    return {
      settings,
      router,
      isps: ispsRaw.map(mapIsp),
      mikrotiks: mikrotiksRaw.map((r) => ({ ...mapMikroTik(r), hwActiveDevices: hwCounts.get(String(r.id)) ?? 0 })),
      events: eventsRaw.map(mapEvent),
      onlineUsers: asNumber(online[0]?.n),
      sites: sitesRaw.map(mapSite),
    };
  });

export const setIspStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string(),
        status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const before = await sql<{ name: string; status: string }>`
      select name, status from isps where id = ${data.id} limit 1
    `;
    await sql`
      update isps set status = ${data.status}, updated_at = now() where id = ${data.id}
    `;
    if (before[0] && before[0].status !== data.status) {
      await logEvent(
        data.status === "OFFLINE" ? "ISP_DOWN" : "ISP_RECOVER",
        `${before[0].name} is now ${data.status}. Active packages are unchanged — MikroTik handles WAN failover.`,
      );
    }
    return { ok: true as const };
  });


export const getSettingsAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => getSettings());

export const saveSettingsAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        hotspotName: z.string().min(2).max(60),
        currency: z.string().min(1).max(8),
        welcomeMessage: z.string().min(1).max(80),
        mpesaShortcode: z.string().optional(),
        mpesaConsumerKey: z.string().optional(),
        mpesaConsumerSecret: z.string().optional(),
        mpesaPasskey: z.string().optional(),
        mpesaEnv: z.enum(["sandbox", "production"]),
        mpesaAccountType: z.enum(["paybill", "till"]).optional(),
        mpesaTillNumber: z.string().max(20).optional(),
        mpesaCallbackUrl: z.string().optional(),
        defaultUploadKbps: z.number().int().min(64),
        capacityMode: z.enum(["PER_ISP", "GLOBAL"]).optional(),
        requireAccountMultiDevice: z.boolean().optional(),
        ispTotalKbps: z.number().int().min(1024).max(1_000_000),
        perUserMaxKbps: z.number().int().min(256).max(100_000),
        maxUsers: z.number().int().min(1).max(500),
        oneDevicePerPackage: z.boolean(),
        maxDevicesPerPackage: z.union([z.literal(1), z.literal(2)]).optional(),
        maintenanceMode: z.boolean().optional(),
        maintenanceMessage: z.string().max(300).nullable().optional(),
        supportPhone: z.string().max(20).nullable().optional(),
        supportWhatsapp: z.string().max(20).nullable().optional(),
        supportMessage: z.string().max(300).nullable().optional(),
        loyaltyEnabled: z.boolean().optional(),
        loyaltyPointsPerKes: z.number().min(0).max(100).optional(),
        referralBonusPoints: z.number().int().min(0).max(100_000).optional(),
        referralEnabled: z.boolean().optional(),
        referralBonusMinutes: z.number().int().min(0).max(10_000).optional(),
        welcomeBonusMinutes: z.number().int().min(0).max(10_000).optional(),
        referralMinPackagePrice: z.number().min(0).max(1_000_000).optional(),
        studentBlockedDomains: z.string().max(2000).optional(),
        operatorPassword: z.string().optional(),
        radiusEnabled: z.boolean().optional(),
        radiusSecret: z.string().optional(),
        radiusAuthPort: z.number().int().min(1).max(65535).optional(),
        radiusAcctPort: z.number().int().min(1).max(65535).optional(),
        radiusServerHost: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update settings set
        hotspot_name = ${data.hotspotName},
        currency = ${data.currency},
        welcome_message = ${data.welcomeMessage},
        demo_mode = false,
        force_activation_failure = false,
        mpesa_shortcode = ${data.mpesaShortcode || null},
        mpesa_env = ${data.mpesaEnv},
        mpesa_account_type = ${data.mpesaAccountType ?? "paybill"},
        mpesa_till_number = ${data.mpesaTillNumber?.replace(/\D/g, "") || null},
        mpesa_callback_url = ${data.mpesaCallbackUrl || null},
        default_upload_kbps = ${data.defaultUploadKbps},
        capacity_mode = ${data.capacityMode ?? "PER_ISP"},
        require_account_multi_device = ${data.requireAccountMultiDevice ?? true},
        isp_total_kbps = ${data.ispTotalKbps},
        per_user_max_kbps = ${data.perUserMaxKbps},
        max_users = ${data.maxUsers},
        one_device_per_package = ${data.oneDevicePerPackage},
        max_devices_per_package = ${data.maxDevicesPerPackage ?? 1},
        maintenance_mode = ${data.maintenanceMode ?? false},
        maintenance_message = ${data.maintenanceMessage ?? null},
        support_phone = ${data.supportPhone ?? null},
        support_whatsapp = ${data.supportWhatsapp ?? null},
        support_message = ${data.supportMessage ?? null},
        loyalty_enabled = ${data.loyaltyEnabled ?? false},
        loyalty_points_per_kes = ${data.loyaltyPointsPerKes ?? 1},
        referral_bonus_points = ${data.referralBonusPoints ?? 50},
        referral_enabled = ${data.referralEnabled ?? true},
        referral_bonus_minutes = ${data.referralBonusMinutes ?? 30},
        welcome_bonus_minutes = ${data.welcomeBonusMinutes ?? 10},
        referral_min_package_price = ${data.referralMinPackagePrice ?? 20},
        student_blocked_domains = ${data.studentBlockedDomains ?? "facebook.com,instagram.com,tiktok.com,youtube.com,netflix.com,twitter.com,x.com,snapchat.com"},
        updated_at = now()
      where id = 'default'
    `;
    if (data.operatorPassword && data.operatorPassword.length >= 4) {
      await sql`
        update settings
        set operator_password = ${data.operatorPassword}, updated_at = now()
        where id = 'default'
      `;
    }
    if (typeof data.radiusEnabled === "boolean") {
      await sql`update settings set radius_enabled = ${data.radiusEnabled}, updated_at = now() where id = 'default'`;
    }
    if (data.radiusSecret && !data.radiusSecret.includes("•")) {
      await sql`update settings set radius_secret = ${data.radiusSecret}, updated_at = now() where id = 'default'`;
    }
    if (data.radiusAuthPort) {
      await sql`update settings set radius_auth_port = ${data.radiusAuthPort}, updated_at = now() where id = 'default'`;
    }
    if (data.radiusAcctPort) {
      await sql`update settings set radius_acct_port = ${data.radiusAcctPort}, updated_at = now() where id = 'default'`;
    }
    if (typeof data.radiusServerHost === "string") {
      await sql`update settings set radius_server_host = ${data.radiusServerHost.trim() || null}, updated_at = now() where id = 'default'`;
    }
    if (data.mpesaConsumerKey) {
      await sql`update settings set mpesa_consumer_key = ${data.mpesaConsumerKey} where id = 'default'`;
    }
    if (data.mpesaConsumerSecret) {
      await sql`update settings set mpesa_consumer_secret = ${data.mpesaConsumerSecret} where id = 'default'`;
    }
    if (data.mpesaPasskey) {
      await sql`update settings set mpesa_passkey = ${data.mpesaPasskey} where id = 'default'`;
    }
    // Start/stop/rebind the RADIUS UDP listener to match what was just saved.
    const radius = await syncRadiusListener().catch((err) => ({
      running: false,
      error: err instanceof Error ? err.message : "Could not update the RADIUS listener.",
    }));
    return { ok: true as const, radius };
  });

/** What limits are actually being enforced right now, and from where. */
export const getCapacityStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const cap = await getEffectiveCapacity();
    const fastest = (
      await sql<{ kbps: number | null }>`select max(download_kbps)::int as kbps from packages where status = 'ACTIVE'`
    )[0];
    return { ...cap, fastestPackageKbps: fastest?.kbps ? Number(fastest.kbps) : null };
  });

// --- RADIUS (multi-AP) ---------------------------------------------------

export const getRadiusStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const cfg = await getRadiusConfig();
    return {
      enabled: cfg.enabled,
      hasSecret: Boolean(cfg.secret),
      serverHost: cfg.serverHost,
      listener: getRadiusListenerStatus(),
    };
  });

/**
 * Push the saved RADIUS settings to every registered router
 * (/radius entry + use-radius on the hotspot profile).
 */
export const applyRadiusToRouters = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const cfg = await getRadiusConfig();
    if (cfg.enabled && !cfg.secret) {
      return { ok: false as const, error: "Save a shared secret first." };
    }
    if (cfg.enabled && !cfg.serverHost) {
      return {
        ok: false as const,
        error:
          "Enter this server's address (the IP/hostname your routers can reach), save, then apply.",
      };
    }
    const sql = await getSql();
    const routers = await sql<{ id: string; name: string }>`
      select id, name from mikrotiks where hardware_type = 'mikrotik' order by is_primary desc, created_at
    `;
    if (routers.length === 0) return { ok: false as const, error: "No MikroTik routers added yet." };
    const results: { id: string; name: string; ok: boolean; error: string | null }[] = [];
    for (const r of routers) {
      const creds = await getRouterCredentialsById(r.id);
      if (!creds) {
        results.push({ id: r.id, name: r.name, ok: false, error: "Missing router credentials." });
        continue;
      }
      const res = await applyRadiusToRouter(creds, {
        enabled: cfg.enabled,
        address: cfg.serverHost,
        secret: cfg.secret,
        authPort: cfg.authPort,
        acctPort: cfg.acctPort,
      });
      results.push({ id: r.id, name: r.name, ok: res.ok, error: res.error });
    }
    await logEvent(
      "RADIUS",
      `RADIUS ${cfg.enabled ? "applied to" : "removed from"} ${results.filter((x) => x.ok).length}/${results.length} router(s).`,
    );
    return { ok: true as const, results };
  });

/** Read each router back and report whether it really matches Settings. */
export const checkRadiusRouters = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const cfg = await getRadiusConfig();
    const sql = await getSql();
    const routers = await sql<{ id: string; name: string }>`
      select id, name from mikrotiks where hardware_type = 'mikrotik' order by is_primary desc, created_at
    `;
    const checks = [];
    for (const r of routers) {
      const creds = await getRouterCredentialsById(r.id);
      if (!creds) continue;
      const check = await checkRadiusOnRouter(creds, {
        enabled: cfg.enabled,
        address: cfg.serverHost,
        secret: cfg.secret,
        authPort: cfg.authPort,
        acctPort: cfg.acctPort,
      });
      checks.push({ id: r.id, name: r.name, ...check });
    }
    return { checks, listener: getRadiusListenerStatus(), enabled: cfg.enabled };
  });

const mikrotikInput = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(60),
  /** MikroTik (default) | Omada | Ruijie. Existing MikroTik behaviour is unchanged. */
  hardwareType: z.enum(HARDWARE_TYPES).default("mikrotik"),
  /** Omada controller ID / site / time unit, Ruijie gateway id (all optional). */
  hwOmadacId: z.string().max(80).optional(),
  hwOmadaSite: z.string().max(80).optional(),
  hwOmadaTimeUnit: z.enum(["ms", "us"]).optional(),
  hwRuijieGwId: z.string().max(80).optional(),
  host: z.string().max(200).default(""),
  port: z.number().int().min(1).max(65535).optional(),
  apiUser: z.string().max(80).default(""),
  apiPassword: z.string().max(120).optional(),
  hotspotName: z.string().min(1).max(60).default("hotspot1"),
  ssl: z.boolean().default(false),
  insecureTls: z.boolean().default(false),
  makePrimary: z.boolean().optional(),
  /** rest = RouterOS 7 REST; api6 = RouterOS 6 binary API */
  apiMode: z.enum(["rest", "api6"]).default("rest"),
  apiPort: z.number().int().min(1).max(65535).optional(),
  /** Add time lost in an outage back to running packages. */
  pauseOnOutage: z.boolean().optional(),
  /** Opening hours */
  hoursEnabled: z.boolean().optional(),
  hoursSchedule: z.record(z.string(), z.array(z.tuple([z.string().regex(/^\d{1,2}:\d{2}$/), z.string().regex(/^\d{1,2}:\d{2}$/)]))).optional(),
  hoursAllow: z.array(z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY"])).optional(),
  hoursPause: z.boolean().optional(),
  hoursMessage: z.string().max(200).optional(),
  siteId: z.string().optional(),
  /** Create a brand-new site/town on the fly (used instead of siteId). */
  newSiteName: z.string().min(2).max(80).optional(),
});

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 36) || "site"
  );
}

/**
 * Site to attach a router/ISP to: an existing one by id, a brand-new one
 * by name (created on the spot, slug made unique), or the main site.
 */
async function resolveSiteId(siteId?: string, newSiteName?: string): Promise<string> {
  const sql = await getSql();
  const name = newSiteName?.trim();
  if (name) {
    const same = await sql<{ id: string }>`
      select id from sites where lower(name) = ${name.toLowerCase()} limit 1
    `;
    if (same[0]) return same[0].id;
    const base = slugify(name);
    let slug = base;
    for (let i = 2; i < 50; i++) {
      const taken = await sql<{ id: string }>`select id from sites where slug = ${slug} limit 1`;
      if (!taken[0]) break;
      slug = `${base}-${i}`;
    }
    const id = `site_${Date.now().toString(36)}`;
    await sql`insert into sites (id, name, slug, status) values (${id}, ${name}, ${slug}, 'ACTIVE')`;
    await logEvent("SITE", `${name} (${slug}) added as a site.`);
    return id;
  }
  if (siteId) {
    const ok = await sql<{ id: string }>`select id from sites where id = ${siteId} limit 1`;
    if (ok[0]) return siteId;
  }
  return "site_default";
}

async function syncPrimaryToSettings() {
  const sql = await getSql();
  const row = (
    await sql<{
      host: string;
      api_user: string;
      api_password: string;
      hotspot_name: string;
    }>`
      select host, api_user, api_password, hotspot_name
      from mikrotiks
      where is_primary = true and hardware_type = 'mikrotik'
      limit 1
    `
  )[0];
  if (!row) return;
  await sql`
    update settings set
      mikrotik_host = ${row.host},
      mikrotik_user = ${row.api_user},
      mikrotik_password = ${row.api_password},
      mikrotik_hotspot = ${row.hotspot_name},
      updated_at = now()
    where id = 'default'
  `;
}

async function persistProbe(
  id: string,
  probe: Awaited<ReturnType<typeof probeRouter>>,
) {
  // Shared with the background poller: writes the result and handles the
  // outage start / recovery (credit + auto-resume).
  await recordProbeResult(id, probe);
}

export const saveMikroTik = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => mikrotikInput.parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const hardwareType: HardwareType = data.hardwareType;
    const isMikroTik = hardwareType === "mikrotik";
    const label = HARDWARE_LABELS[hardwareType];
    // Ruijie has no address/credentials to store (the gateway calls us), so its
    // host is just a label; Omada's host is the controller URL (https, usually :8043).
    const host =
      hardwareType === "ruijie"
        ? data.host.trim() || "Ruijie gateway"
        : normalizeRouterHost(data.host, hardwareType === "omada" ? true : data.ssl, data.port);
    if (!host) return { ok: false as const, error: isMikroTik ? "Enter the router address." : "Enter the controller address." };
    if (hardwareType !== "ruijie" && !data.apiUser.trim()) {
      return { ok: false as const, error: hardwareType === "omada" ? "Enter the Omada hotspot operator name." : "Enter the RouterOS user." };
    }
    const apiUser = hardwareType === "ruijie" ? data.apiUser.trim() || "n/a" : data.apiUser.trim();
    const hwConfig = JSON.stringify({
      ...(data.hwOmadacId?.trim() ? { omadacId: data.hwOmadacId.trim() } : {}),
      ...(data.hwOmadaSite?.trim() ? { omadaSite: data.hwOmadaSite.trim() } : {}),
      ...(data.hwOmadaTimeUnit ? { omadaTimeUnit: data.hwOmadaTimeUnit } : {}),
      ...(data.hwRuijieGwId?.trim() ? { ruijieGwId: data.hwRuijieGwId.trim() } : {}),
    });
    const id = data.id ?? nid("mt");
    const existing = data.id
      ? (
          await sql<{
            api_password: string;
            is_primary: boolean;
          }>`
            select api_password, is_primary from mikrotiks where id = ${data.id} limit 1
          `
        )[0]
      : null;
    if (data.id && !existing) {
      return { ok: false as const, error: "Router not found." };
    }
    const password = data.apiPassword || existing?.api_password || (hardwareType === "ruijie" ? "n/a" : "");
    if (!password) {
      return {
        ok: false as const,
        error: hardwareType === "omada" ? "Enter the hotspot operator password." : "Enter the RouterOS password.",
      };
    }

    // "Primary" only exists for MikroTik (it is the router that creates hotspot users).
    // Omada / Ruijie sites never take it, and saving one must never strip it from the MikroTik.
    const others = await sql<{ n: number }>`
      select count(*)::int as n from mikrotiks where hardware_type = 'mikrotik' and id <> ${id}
    `;
    const makePrimary = isMikroTik && (Boolean(data.makePrimary) || asNumber(others[0]?.n) === 0);

    if (makePrimary) {
      await sql`update mikrotiks set is_primary = false, updated_at = now() where hardware_type = 'mikrotik'`;
    }

    const siteId = await resolveSiteId(data.siteId, data.newSiteName);

    await sql`
      insert into mikrotiks (
        id, name, host, api_user, api_password, hotspot_name, ssl, insecure_tls, is_primary, status, api_mode, api_port, site_id, pause_on_outage,
        hours_enabled, hours_json, hours_allow, hours_pause, hours_message, hardware_type, hw_config
      ) values (
        ${id}, ${data.name}, ${host}, ${apiUser}, ${password},
        ${data.hotspotName || "hotspot1"}, ${data.ssl}, ${data.insecureTls}, ${makePrimary}, 'UNKNOWN',
        ${isMikroTik ? data.apiMode : "rest"}, ${isMikroTik ? (data.apiMode === "api6" ? (data.apiPort || data.port || 8728) : (data.port || null)) : null},
        ${siteId}, ${data.pauseOnOutage ?? false},
        ${data.hoursEnabled ?? false}, ${data.hoursSchedule ? JSON.stringify(data.hoursSchedule) : null},
        ${(data.hoursAllow ?? ["WEEKLY", "MONTHLY"]).join(",")}, ${data.hoursPause ?? true}, ${data.hoursMessage?.trim() || null},
        ${hardwareType}, ${hwConfig}
      )
      on conflict (id) do update set
        hardware_type = excluded.hardware_type,
        hw_config = excluded.hw_config,
        name = excluded.name,
        host = excluded.host,
        api_user = excluded.api_user,
        api_password = excluded.api_password,
        hotspot_name = excluded.hotspot_name,
        ssl = excluded.ssl,
        insecure_tls = excluded.insecure_tls,
        is_primary = excluded.is_primary,
        api_mode = excluded.api_mode,
        api_port = excluded.api_port,
        site_id = excluded.site_id,
        pause_on_outage = case when ${data.pauseOnOutage ?? null}::boolean is null
                               then mikrotiks.pause_on_outage else excluded.pause_on_outage end,
        hours_enabled = case when ${data.hoursEnabled ?? null}::boolean is null then mikrotiks.hours_enabled else excluded.hours_enabled end,
        hours_json = case when ${data.hoursSchedule ? "set" : null}::text is null then mikrotiks.hours_json else excluded.hours_json end,
        hours_allow = case when ${data.hoursAllow ? "set" : null}::text is null then mikrotiks.hours_allow else excluded.hours_allow end,
        hours_pause = case when ${data.hoursPause ?? null}::boolean is null then mikrotiks.hours_pause else excluded.hours_pause end,
        hours_message = case when ${data.hoursMessage != null ? "set" : null}::text is null then mikrotiks.hours_message else excluded.hours_message end,
        updated_at = now()
    `;

    // If this save turned the primary MikroTik into an Omada/Ruijie site (or switched primary off),
    // hand the flag to the oldest remaining MikroTik so activations keep a primary.
    await sql`
      update mikrotiks set is_primary = true, updated_at = now()
      where id = (select id from mikrotiks where hardware_type = 'mikrotik' order by created_at limit 1)
        and not exists (select 1 from mikrotiks where hardware_type = 'mikrotik' and is_primary)
    `;

    // A new/changed schedule takes effect now, not at the next tick.
    await applyOperatingHours().catch(() => {});

    const probe = isMikroTik
      ? await probeRouter({
          host,
          user: data.apiUser,
          password,
          hotspot: data.hotspotName || "hotspot1",
          insecureTls: data.insecureTls,
          apiMode: data.apiMode,
          apiPort: data.apiMode === "api6" ? (data.apiPort || data.port || 8728) : undefined,
        })
      : await probeHwRouter({
          id,
          name: data.name,
          type: hardwareType,
          host,
          user: apiUser,
          password,
          insecureTls: data.insecureTls,
          config: JSON.parse(hwConfig),
        });
    await persistProbe(id, probe);
    await syncPrimaryToSettings();
    let live = false;
    if (makePrimary && probe.ok) {
      await sql`update settings set demo_mode = false, updated_at = now() where id = 'default'`;
      live = true;
    }
    await logEvent(
      probe.ok ? "ROUTER_ONLINE" : "ROUTER_OFFLINE",
      probe.ok
        ? isMikroTik
          ? `MikroTik ${data.name} reached${probe.identity ? ` (${probe.identity})` : ""}. REST is live.`
          : `${label} ${data.name} reached${probe.identity ? ` (${probe.identity})` : ""}.`
        : `${label} ${data.name} saved but ${hardwareType === "ruijie" ? "not heard from yet" : "unreachable"}. ${probe.error ?? ""}`.trim(),
    );
    return { ok: true as const, id, probe, live };
  });

export const testMikroTik = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        host: z.string().optional(),
        port: z.number().int().min(1).max(65535).optional(),
        apiUser: z.string().optional(),
        apiPassword: z.string().optional(),
        hotspotName: z.string().optional(),
        ssl: z.boolean().optional(),
        insecureTls: z.boolean().optional(),
        apiMode: z.enum(["rest", "api6"]).optional(),
        apiPort: z.number().int().min(1).max(65535).optional(),
        hardwareType: z.enum(HARDWARE_TYPES).optional(),
        hwOmadacId: z.string().max(80).optional(),
        hwOmadaSite: z.string().max(80).optional(),
        hwOmadaTimeUnit: z.enum(["ms", "us"]).optional(),
        hwRuijieGwId: z.string().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();

    // Omada / Ruijie: tested by their own driver (controller login / gateway heartbeat).
    let hardwareType: HardwareType = data.hardwareType ?? "mikrotik";
    const stored = data.id
      ? (
          await sql<{
            name: string;
            hardware_type: string;
            host: string;
            api_user: string;
            api_password: string;
            insecure_tls: boolean;
            hw_config: string | null;
          }>`
            select name, hardware_type, host, api_user, api_password, insecure_tls, hw_config
            from mikrotiks where id = ${data.id} limit 1
          `
        )[0]
      : undefined;
    if (!data.hardwareType && stored) hardwareType = asHardwareType(stored.hardware_type);
    if (hardwareType !== "mikrotik") {
      const host = data.host
        ? normalizeRouterHost(data.host, hardwareType === "omada" ? true : (data.ssl ?? false), data.port)
        : String(stored?.host ?? "");
      const user = data.apiUser || String(stored?.api_user ?? "");
      const password = data.apiPassword || String(stored?.api_password ?? "");
      if (hardwareType === "omada" && (!host || !user || !password)) {
        return { ok: false as const, error: "Controller URL, operator name and password are required." };
      }
      const prior = parseHwConfig(stored?.hw_config);
      const probe = await probeHwRouter({
        id: data.id ?? "test",
        name: stored?.name ?? "test",
        type: hardwareType,
        host: host || "Ruijie gateway",
        user,
        password,
        insecureTls: data.insecureTls ?? Boolean(stored?.insecure_tls),
        config: {
          ...prior,
          ...(data.hwOmadacId?.trim() ? { omadacId: data.hwOmadacId.trim() } : {}),
          ...(data.hwOmadaSite?.trim() ? { omadaSite: data.hwOmadaSite.trim() } : {}),
          ...(data.hwOmadaTimeUnit ? { omadaTimeUnit: data.hwOmadaTimeUnit } : {}),
          ...(data.hwRuijieGwId?.trim() ? { ruijieGwId: data.hwRuijieGwId.trim() } : {}),
        },
      });
      if (data.id) await persistProbe(data.id, probe);
      return probe.ok
        ? { ok: true as const, probe }
        : { ok: false as const, error: probe.error ?? "Unreachable.", probe };
    }

    let apiMode: "rest" | "api6" = data.apiMode ?? "rest";
    let apiPort: number | undefined = data.apiPort;
    let host = data.host
      ? normalizeRouterHost(data.host, data.ssl ?? false, data.port)
      : "";
    let user = data.apiUser ?? "";
    let password = data.apiPassword ?? "";
    let hotspot = data.hotspotName || "hotspot1";
    let insecureTls = data.insecureTls ?? false;

    if (data.id) {
      const row = (
        await sql<{
          host: string;
          api_user: string;
          api_password: string;
          hotspot_name: string;
          ssl: boolean;
          insecure_tls: boolean;
          api_mode: string | null;
          api_port: number | null;
        }>`
          select host, api_user, api_password, hotspot_name, ssl, insecure_tls, api_mode, api_port
          from mikrotiks where id = ${data.id} limit 1
        `
      )[0];
      if (!row) return { ok: false as const, error: "Router not found." };
      apiMode = data.apiMode ?? (row.api_mode === "api6" ? "api6" : "rest");
      apiPort = data.apiPort ?? (row.api_port != null ? Number(row.api_port) : undefined);
      host = data.host
        ? normalizeRouterHost(data.host, data.ssl ?? Boolean(row.ssl), data.port)
        : String(row.host);
      user = data.apiUser || String(row.api_user);
      password = data.apiPassword || String(row.api_password);
      hotspot = data.hotspotName || String(row.hotspot_name || "hotspot1");
      insecureTls = data.insecureTls ?? Boolean(row.insecure_tls);
    }

    if (!host || !user || !password) {
      return { ok: false as const, error: "Host, user and password are required." };
    }

    const probe = await probeRouter({
      host,
      user,
      password,
      hotspot,
      insecureTls,
      apiMode,
      apiPort: apiMode === "api6" ? apiPort || 8728 : undefined,
    });
    if (data.id) await persistProbe(data.id, probe);
    return probe.ok
      ? { ok: true as const, probe }
      : { ok: false as const, error: probe.error ?? "Unreachable.", probe };
  });

export const refreshMikroTiks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      host: string;
      api_user: string;
      api_password: string;
      hotspot_name: string;
      insecure_tls: boolean;
      api_mode: string | null;
      api_port: number | null;
      hardware_type: string;
    }>`
      select id, host, api_user, api_password, hotspot_name, insecure_tls, api_mode, api_port, hardware_type
      from mikrotiks
      order by is_primary desc, created_at
    `;
    let online = 0;
    for (const row of rows) {
      if (row.hardware_type !== "mikrotik") {
        const hwProbe = await probeStoredRouter(row.id);
        if (hwProbe) {
          await persistProbe(row.id, hwProbe);
          if (hwProbe.ok) online += 1;
        }
        continue;
      }
      const probe = await probeRouter({
        host: String(row.host),
        user: String(row.api_user),
        password: String(row.api_password),
        hotspot: String(row.hotspot_name || "hotspot1"),
        insecureTls: Boolean(row.insecure_tls),
        apiMode: row.api_mode === "api6" ? "api6" : "rest",
        apiPort: row.api_mode === "api6" ? Number(row.api_port) || 8728 : undefined,
      });
      await persistProbe(row.id, probe);
      if (probe.ok) online += 1;
    }
    return { ok: true as const, total: rows.length, online };
  });

export const resumeActivePackages = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async () => {
    const result = await resumeEligiblePackages("manual");
    return { ...result, ok: true as const };
  });

export const setPrimaryMikroTik = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const row = (
      await sql<{ name: string; hardware_type: string }>`select name, hardware_type from mikrotiks where id = ${data.id} limit 1`
    )[0];
    if (!row) return { ok: false as const, error: "Router not found." };
    if (row.hardware_type !== "mikrotik") {
      return { ok: false as const, error: "Only a MikroTik can be the primary router. Omada and Ruijie sites work alongside it." };
    }
    await sql`update mikrotiks set is_primary = false, updated_at = now() where hardware_type = 'mikrotik'`;
    await sql`
      update mikrotiks set is_primary = true, updated_at = now() where id = ${data.id}
    `;
    await sql`update settings set demo_mode = false, updated_at = now() where id = 'default'`;
    await syncPrimaryToSettings();
    await logEvent(
      "ROUTER_PRIMARY",
      `${row.name} is now the primary MikroTik. Live activations will use RouterOS REST.`,
    );
    return { ok: true as const };
  });

export const deleteMikroTik = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const row = (
      await sql<{ name: string; is_primary: boolean }>`
        select name, is_primary from mikrotiks where id = ${data.id} limit 1
      `
    )[0];
    if (!row) return { ok: false as const, error: "Router not found." };
    await sql`delete from mikrotiks where id = ${data.id}`;
    if (row.is_primary) {
      const next = (
        await sql<{ id: string }>`
          select id from mikrotiks where hardware_type = 'mikrotik' order by created_at limit 1
        `
      )[0];
      if (next) {
        await sql`
          update mikrotiks set is_primary = true, updated_at = now() where id = ${next.id}
        `;
        await syncPrimaryToSettings();
      } else {
        await sql`
          update settings set
            mikrotik_host = null,
            mikrotik_user = null,
            mikrotik_password = null,
            demo_mode = false,
            updated_at = now()
          where id = 'default'
        `;
      }
    }
    await logEvent("ROUTER_REMOVED", `${row.name} was removed from TelNet.`);
    return { ok: true as const };
  });

export const saveIsp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(2).max(40),
        type: z.enum(["STARLINK", "AIRTEL", "SAFARICOM", "FIBRE", "LTE", "OTHER"]),
        interfaceName: z.string().max(40).optional(),
        mikrotikId: z.string().optional(),
        status: z.enum(["ONLINE", "OFFLINE", "DEGRADED"]).optional(),
        totalKbps: z.number().int().min(1024).max(1_000_000).optional(),
        perUserMaxKbps: z.number().int().min(256).max(100_000).optional(),
        maxUsers: z.number().int().min(1).max(500).optional(),
        siteId: z.string().optional(),
        newSiteName: z.string().min(2).max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id ?? nid("isp");
    const maxSort = await sql<{ n: number }>`
      select coalesce(max(sort_order), 0)::int as n from isps
    `;
    const total = data.totalKbps ?? 30720;
    const perUser = data.perUserMaxKbps ?? 5120;
    const maxUsers = data.maxUsers ?? 25;
    // An ISP path hangs off a router, so it lives in that router's site.
    // Only an ISP with no router picks its own site.
    let siteId = await resolveSiteId(data.siteId, data.newSiteName);
    if (data.mikrotikId) {
      const owner = await sql<{ site_id: string | null }>`
        select site_id from mikrotiks where id = ${data.mikrotikId} limit 1
      `;
      if (!owner[0]) return { ok: false as const, error: "That router no longer exists." };
      siteId = owner[0].site_id || "site_default";
    }
    await sql`
      insert into isps (
        id, name, type, interface_name, status, sort_order, mikrotik_id,
        total_kbps, per_user_max_kbps, max_users, site_id
      )
      values (
        ${id}, ${data.name}, ${data.type}, ${data.interfaceName || null},
        ${data.status ?? "ONLINE"}, ${asNumber(maxSort[0]?.n) + 1}, ${data.mikrotikId || null},
        ${total}, ${perUser}, ${maxUsers}, ${siteId}
      )
      on conflict (id) do update set
        name = excluded.name,
        type = excluded.type,
        interface_name = excluded.interface_name,
        status = excluded.status,
        mikrotik_id = excluded.mikrotik_id,
        total_kbps = excluded.total_kbps,
        per_user_max_kbps = excluded.per_user_max_kbps,
        max_users = excluded.max_users,
        site_id = excluded.site_id,
        updated_at = now()
    `;
    await logEvent("ISP_PATH", `${data.name} (${data.type}) added as an ISP path.`);
    return { ok: true as const, id };
  });

export const deleteIsp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const row = (
      await sql<{ name: string }>`select name from isps where id = ${data.id} limit 1`
    )[0];
    if (!row) return { ok: false as const, error: "Path not found." };
    await sql`delete from isps where id = ${data.id}`;
    await logEvent("ISP_PATH", `${row.name} was removed from ISP monitoring.`);
    return { ok: true as const };
  });

export const applyCamouflage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        routerId: z.string(),
        kind: z.enum(["IPHONE", "ANDROID", "PC"]),
        interfaceName: z.string().max(40).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const row = (
      await sql<{ name: string }>`
        select name from mikrotiks where id = ${data.routerId} limit 1
      `
    )[0];
    if (!row) return { ok: false as const, error: "Router not found." };
    const result = await applyCamouflageLive({
      routerId: data.routerId,
      kind: data.kind,
      interfaceName: data.interfaceName,
    });
    await logEvent(
      "CAMOUFLAGE",
      `${row.name} WAN identity set to ${data.kind}${
        result.live ? " via REST" : " (script ready)"
      }. MAC ${result.mac} on ${result.interfaceName}.`,
    );
    return { ...result, ok: true as const };
  });



// --- Sites (multi-tenant) ---
export const listSites = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return (await sql<SqlRow>`select * from sites order by name`).map(mapSite);
  });

export const saveSite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(2).max(80),
        slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
        status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id ?? `site_${Date.now().toString(36)}`;
    const status = data.status ?? "ACTIVE";
    await sql`
      insert into sites (id, name, slug, status, notes)
      values (${id}, ${data.name}, ${data.slug}, ${status}, ${data.notes ?? null})
      on conflict (id) do update set
        name = excluded.name,
        slug = excluded.slug,
        status = excluded.status,
        notes = excluded.notes,
        updated_at = now()
    `;
    await logEvent(
      "SITE",
      `${data.name} (${data.slug}) ${data.id ? "updated" : "added"} as a site.`,
    );
    return { ok: true as const, id };
  });

export const setSiteStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({ id: z.string(), status: z.enum(["ACTIVE", "INACTIVE"]) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (data.id === "site_default" && data.status === "INACTIVE") {
      return { ok: false as const, error: "The main site can't be deactivated." };
    }
    const row = (
      await sql<{ name: string }>`select name from sites where id = ${data.id} limit 1`
    )[0];
    if (!row) return { ok: false as const, error: "Site not found." };
    await sql`update sites set status = ${data.status}, updated_at = now() where id = ${data.id}`;
    await logEvent(
      "SITE",
      `${row.name} was ${data.status === "ACTIVE" ? "reactivated" : "deactivated"}.`,
    );
    return { ok: true as const };
  });

/**
 * Site mapping: for every site/town, which routers, ISP paths and packages
 * belong to it. Packages with no site are sold everywhere.
 */
export const getSiteMap = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const [sites, routers, isps, packages] = await Promise.all([
      sql<SqlRow>`select * from sites order by (id = 'site_default') desc, name`,
      sql<SqlRow>`select id, name, status, is_primary, site_id from mikrotiks order by is_primary desc, name`,
      sql<SqlRow>`select id, name, type, status, mikrotik_id, site_id from isps order by sort_order`,
      sql<SqlRow>`
        select p.id, p.name, p.status, p.price, p.site_id,
          (select string_agg(ps.site_id, ',') from package_sites ps where ps.package_id = p.id) as site_ids
        from packages p order by p.sort_order, p.price
      `,
    ]);
    const pkgSites = (p: SqlRow): string[] => {
      const ids = p.site_ids ? String(p.site_ids).split(",").filter(Boolean) : [];
      return ids.length > 0 ? ids : p.site_id ? [String(p.site_id)] : [];
    };
    const norm = (v: unknown) => (v ? String(v) : "site_default");
    return {
      sites: sites.map((row) => {
        const site = mapSite(row);
        return {
          site,
          routers: routers
            .filter((r) => norm(r.site_id) === site.id)
            .map((r) => ({
              id: String(r.id),
              name: String(r.name),
              status: String(r.status),
              isPrimary: Boolean(r.is_primary),
              isps: isps
                .filter((i) => i.mikrotik_id && String(i.mikrotik_id) === String(r.id))
                .map((i) => ({ id: String(i.id), name: String(i.name), type: String(i.type), status: String(i.status) })),
            })),
          // ISPs not tied to a router but assigned to this site
          looseIsps: isps
            .filter((i) => !i.mikrotik_id && norm(i.site_id) === site.id)
            .map((i) => ({ id: String(i.id), name: String(i.name), type: String(i.type), status: String(i.status) })),
          packages: packages
            .filter((p) => pkgSites(p).includes(site.id))
            .map((p) => ({ id: String(p.id), name: String(p.name), status: String(p.status), price: Number(p.price) })),
        };
      }),
      globalPackages: packages
        .filter((p) => pkgSites(p).length === 0)
        .map((p) => ({ id: String(p.id), name: String(p.name), status: String(p.status), price: Number(p.price) })),
    };
  });

// --- Network map ---------------------------------------------------------

const AP_IP = /^(\d{1,3}\.){3}\d{1,3}$/;

function rollUp(states: HealthState[]): HealthState {
  if (states.length === 0) return "UNKNOWN";
  if (states.includes("OFFLINE") && states.every((x) => x === "OFFLINE")) return "OFFLINE";
  if (states.some((x) => x === "OFFLINE" || x === "WARNING")) return "WARNING";
  if (states.every((x) => x === "UNKNOWN")) return "UNKNOWN";
  return "ONLINE";
}

async function buildNetworkMap(siteId: string | null, days = 30): Promise<NetworkMapData> {
  const sql = await getSql();
  const apMoney = await apRevenue(days).catch(() => new Map<string, { revenue: number; customers: number }>());
  const [sitesRaw, routersRaw, ispsRaw, apsRaw] = await Promise.all([
    sql<SqlRow>`select * from sites order by (id = 'site_default') desc, name`,
    sql<SqlRow>`select * from mikrotiks order by is_primary desc, created_at`,
    sql<SqlRow>`select * from isps order by sort_order`,
    sql<SqlRow>`select * from access_points order by name`,
  ]);
  const allSites = sitesRaw.map(mapSite);
  const siteOf = (id: unknown) => (id ? String(id) : "site_default");
  const hwCounts = await hwActiveDeviceCounts().catch(() => new Map<string, number>());

  const routers: MapRouter[] = routersRaw.map((row) => {
    let live: LiveSnapshot | null = null;
    try {
      live = row.live_json ? (JSON.parse(String(row.live_json)) as LiveSnapshot) : null;
    } catch {
      live = null;
    }
    const mt = mapMikroTik(row);
    const isHw = mt.hardwareType !== "mikrotik";
    const hwActive = hwCounts.get(mt.id) ?? 0;
    const site = allSites.find((x) => x.id === siteOf(row.site_id));
    const isps = ispsRaw
      .filter((i) => i.mikrotik_id && String(i.mikrotik_id) === mt.id)
      .map((i) => ({
        id: String(i.id),
        name: String(i.name),
        type: String(i.type),
        status: String(i.status),
        interfaceName: i.interface_name ? String(i.interface_name) : null,
      }));

    // Router health. Green = online & healthy, yellow = reachable but
    // strained (high CPU/RAM, a degraded/down ISP path, or a misbehaving AP),
    // red = unreachable.
    const memPct =
      live?.memTotal && live.memFree != null
        ? Math.round(((live.memTotal - live.memFree) / live.memTotal) * 100)
        : null;
    const cpu = live?.cpuLoad ?? mt.cpuLoad;
    const reasons: string[] = [];
    if (cpu != null && cpu >= 85) reasons.push(`CPU at ${cpu}%`);
    if (memPct != null && memPct >= 90) reasons.push(`Memory at ${memPct}%`);
    for (const i of isps) if (i.status !== "ONLINE") reasons.push(`${i.name} is ${i.status.toLowerCase()}`);

    // Revenue can only be judged once the system has measured *some* AP in this
    // period; right after deploy every AP would otherwise look like it earns nothing.
    const canJudgeIncome = apMoney.size > 0;
    const manual: AccessPointRow[] = apsRaw
      .filter((a) => String(a.mikrotik_id) === mt.id)
      .map((a) => {
        const status = (["ONLINE", "WARNING", "OFFLINE", "UNKNOWN"].includes(String(a.status)) ? String(a.status) : "UNKNOWN") as HealthState;
        // MikroTik attributes revenue by router port; Omada by the AP's MAC; Ruijie cannot tell which AP.
        const trackable = isHw ? mt.hardwareType === "omada" && Boolean(a.mac_address) : Boolean(a.port);
        const revenue = trackable ? (apMoney.get(String(a.id))?.revenue ?? 0) : null;
        const ageMs = a.created_at ? Date.now() - new Date(iso(a.created_at)).getTime() : 0;
        return {
        id: String(a.id),
        manual: true,
        name: String(a.name),
        label: a.label ? String(a.label) : null,
        ip: a.ip_address ? String(a.ip_address) : null,
        mac: a.mac_address ? String(a.mac_address) : null,
        model: a.model ? String(a.model) : null,
        port: a.port ? String(a.port) : null,
        notes: a.notes ? String(a.notes) : null,
        status,
        latencyMs: a.latency_ms == null ? null : Number(a.latency_ms),
        clients: a.clients == null ? null : Number(a.clients),
        signalDbm: null,
        checkedAt: a.checked_at ? iso(a.checked_at) : null,
        // revenue can only be attributed when we know which router port the AP is on
        revenue,
        paidCustomers: trackable ? (apMoney.get(String(a.id))?.customers ?? 0) : null,
        // a brand-new AP gets a day before it is flagged
        noIncome: canJudgeIncome && revenue === 0 && (status === "ONLINE" || status === "WARNING") && ageMs >= 24 * 3600_000,
        };
      });
    // The router's own wifi radios show up automatically (real signal data).
    const radios: AccessPointRow[] = (live?.radios ?? []).map((r) => {
      const p = live!.ports.find((x) => x.name === r.name);
      const radioRevenue = apMoney.get(`radio:${mt.id}:${r.name}`)?.revenue ?? 0;
      return {
        id: `radio:${mt.id}:${r.name}`,
        manual: false,
        name: `${mt.name} · ${r.name}`,
        label: null,
        ip: null,
        mac: null,
        model: "Built-in radio",
        port: r.name,
        notes: null,
        status: (p?.running ? "ONLINE" : "OFFLINE") as HealthState,
        latencyMs: null,
        clients: r.clients,
        signalDbm: r.signalDbm,
        checkedAt: live!.at,
        revenue: apMoney.get(`radio:${mt.id}:${r.name}`)?.revenue ?? 0,
        paidCustomers: apMoney.get(`radio:${mt.id}:${r.name}`)?.customers ?? 0,
        noIncome: canJudgeIncome && radioRevenue === 0 && Boolean(p?.running),
      };
    });
    const aps = [...radios, ...manual];
    if (aps.some((a) => a.status === "OFFLINE" || a.status === "WARNING")) reasons.push("An access point needs attention");

    const liveIsRecent = live ? Date.now() - new Date(live.at).getTime() < 120_000 : false;
    const unreachable = mt.status === "OFFLINE" || Boolean(live?.error && liveIsRecent);
    const state: HealthState = unreachable
      ? "OFFLINE"
      : mt.status === "ONLINE"
        ? reasons.length > 0
          ? "WARNING"
          : "ONLINE"
        : "UNKNOWN";
    const hrs = toRouterHours({
      id: mt.id,
      hours_enabled: mt.hoursEnabled,
      hours_json: JSON.stringify(mt.hoursSchedule),
      hours_allow: mt.hoursAllow.join(","),
      hours_message: mt.hoursMessage,
    });
    const opensLabel = hrs.opensAtLabel;
    const closesLabel = hrs.closesAtLabel;
    return {
      id: mt.id,
      name: mt.name,
      host: mt.host,
      hardwareType: mt.hardwareType,
      hwActiveDevices: hwActive,
      hwSeenAt: mt.hwSeenAt,
      isPrimary: mt.isPrimary,
      siteId: siteOf(row.site_id),
      siteName: site?.name ?? "Main site",
      state,
      stateReason: unreachable ? (mt.lastError ?? live?.error ?? "Router unreachable") : reasons[0] ?? null,
      hours: {
        enabled: mt.hoursEnabled,
        open: !(mt.hoursEnabled && mt.hoursState === "CLOSED"),
        opensAtLabel: opensLabel,
        closesAtLabel: closesLabel,
      },
      boardName: mt.boardName,
      version: mt.version,
      identity: mt.identity,
      live,
      isps,
      aps: unreachable ? aps.map((a) => ({ ...a, status: "UNKNOWN" as HealthState, noIncome: false })) : aps,
    };
  });

  const scopedSites = allSites.filter((x) => !siteId || x.id === siteId);
  const sites: MapSite[] = scopedSites.map((site) => {
    const rs = routers.filter((r) => r.siteId === site.id);
    return { site, state: rollUp(rs.map((r) => r.state)), routers: rs };
  });
  const visible = sites.flatMap((x) => x.routers);
  const aps = visible.flatMap((r) => r.aps);
  const count = <T extends { state: HealthState }>(rows: T[], st: HealthState) => rows.filter((r) => r.state === st).length;
  return {
    generatedAt: new Date().toISOString(),
    sites,
    allSites,
    totals: {
      routers: { online: count(visible, "ONLINE"), warning: count(visible, "WARNING"), offline: count(visible, "OFFLINE") },
      aps: {
        online: aps.filter((a) => a.status === "ONLINE").length,
        warning: aps.filter((a) => a.status === "WARNING").length,
        offline: aps.filter((a) => a.status === "OFFLINE").length,
        unknown: aps.filter((a) => a.status === "UNKNOWN").length,
        noIncome: aps.filter((a) => a.noIncome).length,
      },
      activeUsers: visible.reduce((s, r) => s + (r.live?.activeUsers ?? 0) + r.hwActiveDevices, 0),
      rxBps: visible.reduce((s, r) => s + (r.live?.rxBps ?? 0), 0),
      txBps: visible.reduce((s, r) => s + (r.live?.txBps ?? 0), 0),
    },
  };
}

/**
 * refresh=true reads the routers now (a snapshot younger than 5 s is reused
 * so several open screens don't hammer them); false just returns what's stored.
 */
export const getNetworkMap = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ siteId: z.string().optional(), refresh: z.boolean().optional(), days: z.number().int().min(1).max(365).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    if (data.refresh) {
      // Omada / Ruijie sites: re-check the controller / gateway heartbeat (not more than every 20 s per site)
      // so the map follows them too. recordProbeResult keeps outage credit and recovery working.
      const sqlHw = await getSql();
      const hwStale = await sqlHw<{ id: string }>`
        select id from mikrotiks
        where hardware_type <> 'mikrotik'
          and (last_ping_at is null or last_ping_at < now() - interval '20 seconds')
      `;
      await Promise.all(
        hwStale.map(async (r) => {
          try {
            const p = await probeStoredRouter(String(r.id));
            if (p) await persistProbe(String(r.id), p);
          } catch (err) {
            console.error("[map-probe]", r.id, err);
          }
        }),
      );
      await refreshHwAccessPoints().catch(() => {});
      const results = await refreshNetworkLive({ maxAgeMs: 5000 }).catch(() => []);
      // Keep the router's stored status in step with what we just read, through
      // the same path the Network page uses (so recovery auto-resume still fires).
      const sql = await getSql();
      for (const r of results.filter((x) => x.fresh)) {
        const row = (
          await sql<{ identity: string | null; version: string | null; board_name: string | null; uptime: string | null }>`
            select identity, version, board_name, uptime from mikrotiks where id = ${r.id} limit 1
          `
        )[0];
        if (!row) continue;
        await persistProbe(r.id, {
          ok: !r.live.error,
          identity: row.identity,
          version: row.version,
          boardName: row.board_name,
          uptime: r.live.error ? null : (r.live.uptime ?? row.uptime),
          cpuLoad: r.live.error ? null : r.live.cpuLoad,
          hotspotServers: [],
          interfaces: r.live.ports.slice(0, 16).map((p) => ({ name: p.name, type: p.type, running: p.running })),
          error: r.live.error,
        }).catch(() => {});
      }
    }
    return buildNetworkMap(normSite(data.siteId), data.days ?? 30);
  });

export const saveAccessPoint = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        mikrotikId: z.string(),
        name: z.string().trim().min(2, "Give the AP a name (at least 2 letters).").max(60),
        /** number/tag marked on the physical device */
        label: z.string().max(20).optional(),
        ip: z.string().max(45).optional(),
        mac: z.string().max(20).optional(),
        model: z.string().max(60).optional(),
        port: z.string().max(40).optional(),
        notes: z.string().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const ip = data.ip?.trim() || null;
    const mac = data.mac?.trim().toUpperCase() || null;
    if (ip && !AP_IP.test(ip)) return { ok: false as const, error: "Enter a valid IPv4 address, e.g. 192.168.88.20." };
    if (mac && !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) return { ok: false as const, error: "MAC must look like AA:BB:CC:DD:EE:FF." };
    if (!ip && !mac) return { ok: false as const, error: "Give the AP's IP address (best) or its MAC so its status can be checked." };
    const router = await sql<{ id: string }>`select id from mikrotiks where id = ${data.mikrotikId} limit 1`;
    if (!router[0]) return { ok: false as const, error: "Choose the router or controller this AP belongs to." };
    const id = data.id ?? nid("ap");
    const label = data.label?.trim() || null;
    if (label) {
      const clash = await sql<{ name: string }>`
        select name from access_points where lower(label) = lower(${label}) and id <> ${id} limit 1
      `;
      if (clash[0]) {
        return { ok: false as const, error: `Number "${label}" is already used by ${clash[0].name}. Pick a different number.` };
      }
    }
    await sql`
      insert into access_points (id, mikrotik_id, name, label, ip_address, mac_address, model, port, notes)
      values (${id}, ${data.mikrotikId}, ${data.name.trim()}, ${label}, ${ip}, ${mac}, ${data.model?.trim() || null}, ${data.port?.trim() || null}, ${data.notes?.trim() || null})
      on conflict (id) do update set
        mikrotik_id = excluded.mikrotik_id, name = excluded.name, label = excluded.label, ip_address = excluded.ip_address,
        mac_address = excluded.mac_address, model = excluded.model, port = excluded.port,
        notes = excluded.notes, status = 'UNKNOWN', updated_at = now()
    `;
    await logEvent("AP", `Access point ${data.name.trim()} ${data.id ? "updated" : "added"}.`);
    // Check it straight away so it doesn't sit grey until the next refresh.
    await refreshNetworkLive({ routerId: data.mikrotikId }).catch(() => {});
    await refreshHwAccessPoints(data.mikrotikId).catch(() => {});
    return { ok: true as const, id };
  });

export const deleteAccessPoint = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from access_points where id = ${data.id}`;
    return { ok: true as const };
  });

// --- Vouchers ---
export const listVouchersAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        status: z.enum(["AVAILABLE", "REDEEMED", "EXPIRED"]).optional(),
        batch: z.string().max(60).optional(),
        search: z.string().max(20).optional(),
        page: z.number().int().min(1).optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const res = await listVouchersPage({ ...data, pageSize: 50 });
    const cfg = (
      await sql<{ d: number | null; name: string | null; currency: string | null }>`
        select voucher_auto_clean_days as d, hotspot_name as name, currency from settings where id = 'default' limit 1
      `
    )[0];
    return {
      rows: res.rows.map((r) => ({
        id: String(r.id),
        code: String(r.code),
        packageName: String(r.package_name ?? ""),
        status: String(r.eff_status) as "AVAILABLE" | "REDEEMED" | "EXPIRED",
        batchLabel: r.batch_label ? String(r.batch_label) : null,
        redeemedAt: r.redeemed_at ? String(r.redeemed_at) : null,
        expiresAt: r.expires_at ? String(r.expires_at) : null,
        createdAt: String(r.created_at),
      })),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
      counts: {
        AVAILABLE: res.counts.AVAILABLE ?? 0,
        REDEEMED: res.counts.REDEEMED ?? 0,
        EXPIRED: res.counts.EXPIRED ?? 0,
      },
      batches: res.batches.map((b) => ({
        label: String(b.label),
        total: Number(b.total),
        available: Number(b.available),
        redeemed: Number(b.redeemed),
        expired: Number(b.expired),
        lastCreated: String(b.last_created),
      })),
      autoCleanDays: Number(cfg?.d ?? 0),
      hotspotName: cfg?.name ?? "Wi-Fi",
      currency: cfg?.currency ?? "KES",
    };
  });

export const generateVouchersAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        packageId: z.string(),
        count: z.number().int().min(1).max(200),
        batchLabel: z.string().max(60).optional(),
        siteId: z.string().optional(),
        /** vouchers stop working this many days after creation (omit = never) */
        validDays: z.number().int().min(1).max(3650).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const codes = await generateVouchers({
      packageId: data.packageId,
      count: data.count,
      batchLabel: data.batchLabel?.trim() || undefined,
      siteId: data.siteId,
      expiresAt: data.validDays
        ? new Date(Date.now() + data.validDays * 86_400_000).toISOString()
        : undefined,
    });
    return { ok: true as const, codes };
  });

export const deleteVouchersAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        mode: z.enum(["redeemed", "expired", "batch", "ids"]),
        batch: z.string().max(60).optional(),
        ids: z.array(z.string()).max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const deleted = await deleteVouchers(data);
    return { ok: true as const, deleted };
  });

export const setVoucherAutoClean = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ days: z.number().int().min(0).max(365) }).parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update settings set voucher_auto_clean_days = ${data.days}, updated_at = now() where id = 'default'`;
    const { autoCleanVouchers } = await import("@/lib/services/vouchers.server");
    const removed = await autoCleanVouchers();
    return { ok: true as const, removed };
  });

export const getVouchersForPrint = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z.object({ batch: z.string().max(60).optional(), ids: z.array(z.string()).max(500).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await vouchersForPrint(data);
    const cfg = (
      await sql<{ name: string | null; currency: string | null }>`
        select hotspot_name as name, currency from settings where id = 'default' limit 1
      `
    )[0];
    return {
      hotspotName: cfg?.name ?? "Wi-Fi",
      currency: cfg?.currency ?? "KES",
      vouchers: rows.map((r) => ({
        code: String(r.code),
        packageName: String(r.package_name),
        price: Number(r.price),
        durationMinutes: Number(r.duration_minutes),
        maxDevices: Number(r.max_devices),
        expiresAt: r.expires_at ? String(r.expires_at) : null,
        batchLabel: r.batch_label ? String(r.batch_label) : null,
      })),
    };
  });

export const listActivationQueue = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    await processActivationRetries(5);
    const sql = await getSql();
    return sql<{
      id: string;
      phone: string;
      amount: number;
      mpesa_transaction_id: string | null;
      activation_status: string;
      activation_attempts: number;
      last_activation_error: string | null;
      next_activation_retry_at: string | null;
      package_name: string;
      created_at: string;
    }>`
      select p.id, p.phone, p.amount, p.mpesa_transaction_id, p.activation_status,
             p.activation_attempts, p.last_activation_error, p.next_activation_retry_at,
             pkg.name as package_name, p.created_at
      from payments p
      join packages pkg on pkg.id = p.package_id
      where p.status = 'SUCCESS'
        and p.activation_status in ('ACTIVATION_FAILED', 'NOT_ACTIVATED')
      order by p.updated_at desc
      limit 50
    `;
  });

export const retryActivationAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ paymentId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const result = await activateFromPayment(data.paymentId);
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, error: String(result.reason || "Activation failed") };
  });
