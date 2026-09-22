import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { nid, asNumber } from "@/lib/utils";
import { expireDuePackages } from "@/lib/services/expiry.server";
import {
  activateFromPayment,
  blockCustomer,
  disconnectSession,
  releaseDeviceBind,
  tickLiveUsage,
} from "@/lib/services/activation.server";
import {
  normalizeRouterHost,
  pingRouter,
  probeRouter,
  applyCamouflage as applyCamouflageLive,
} from "@/lib/services/mikrotik.server";
import { getSettings, logEvent } from "@/lib/services/settings.server";
import {
  mapCustomer,
  mapCustomerPackage,
  mapEvent,
  mapIsp,
  mapLiveUser,
  mapMikroTik,
  mapPackage,
  mapPayment,
  type SqlRow,
} from "@/lib/services/rows.server";
import { generateVouchers, listVouchers } from "../services/vouchers.server";
import { processActivationRetries } from "../services/callback.server";



export const getDashboard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    // Non-blocking maintenance — do not delay first paint
    void expireDuePackages().catch(() => {});
    void tickLiveUsage().catch(() => {});

    const sql = await getSql();
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
        }>`
          select
            coalesce(sum(case when status = 'SUCCESS' then amount else 0 end), 0)::int as revenue,
            count(*)::int as tx,
            count(*) filter (where status = 'SUCCESS')::int as success,
            count(*) filter (where status in ('FAILED','CANCELLED'))::int as failed
          from payments
          where created_at >= date_trunc('day', now())
        `,
        sql<{
          online: number;
          active_pkg: number;
          expired_pkg: number;
          customers: number;
          awaiting: number;
        }>`
          select
            (select count(*) from sessions where status = 'ACTIVE')::int as online,
            (select count(*) from customer_packages where status = 'ACTIVE' and expiry_time > now())::int as active_pkg,
            (select count(*) from customer_packages where status = 'EXPIRED')::int as expired_pkg,
            (select count(*) from customers)::int as customers,
            (select count(*) from payments where status = 'SUCCESS' and activation_status = 'ACTIVATION_FAILED')::int as awaiting
        `,
        sql<SqlRow>`select * from isps order by sort_order`,
        sql<SqlRow>`select * from mikrotiks order by is_primary desc, created_at`,
        sql<SqlRow>`select * from network_events order by created_at desc limit 8`,
        sql<SqlRow>`
          select p.*, pkg.name as package_name
          from payments p join packages pkg on pkg.id = p.package_id
          order by p.created_at desc limit 8
        `,
      ]);

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
        onlineUsers: asNumber(c?.online),
        activePackages: asNumber(c?.active_pkg),
        expiredPackages: asNumber(c?.expired_pkg),
        totalCustomers: asNumber(c?.customers),
        awaitingActivation: asNumber(c?.awaiting),
      },
      isps,
      mikrotiks,
      events,
      recent,
    };
  });

export const listCustomersAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    await expireDuePackages();
    const sql = await getSql();
    const rows = await sql<SqlRow>`
      select
        c.id, c.phone, c.status, c.created_at,
        cp.id as cp_id, cp.package_id, cp.payment_id, cp.start_time, cp.expiry_time,
        cp.speed_limit_kbps, cp.status as pkg_status, cp.activation_status,
        cp.mikrotik_username, cp.bound_device_token, pkg.name as package_name,
        p.amount, p.status as payment_status, p.mpesa_transaction_id,
        (select s.status from sessions s where s.customer_id = c.id order by s.session_start desc limit 1) as connection_status
      from customers c
      left join lateral (
        select * from customer_packages
        where customer_id = c.id
        order by created_at desc
        limit 1
      ) cp on true
      left join packages pkg on pkg.id = cp.package_id
      left join payments p on p.id = cp.payment_id
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
    }));
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
        ]),
        minutes: z.number().optional(),
        packageId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (data.action === "block") {
      await blockCustomer(data.customerId);
      return { ok: true as const };
    }
    if (data.action === "unblock") {
      await sql`update customers set status = 'ACTIVE', updated_at = now() where id = ${data.customerId}`;
      return { ok: true as const };
    }
    if (data.action === "disconnect") {
      const ses = await sql<{ id: string }>`
        select id from sessions where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
      for (const s of ses) await disconnectSession(s.id);
      return { ok: true as const };
    }
    if (data.action === "releaseDevice") {
      await releaseDeviceBind(data.customerId);
      return { ok: true as const };
    }
    if (data.action === "extend") {
      const mins = data.minutes ?? 60;
      await sql`
        update customer_packages
        set expiry_time = expiry_time + (${mins} * interval '1 minute'), updated_at = now()
        where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
      return { ok: true as const };
    }
    if (data.action === "changePackage" && data.packageId) {
      const pkg = (
        await sql<SqlRow>`select * from packages where id = ${data.packageId} limit 1`
      )[0];
      if (!pkg) return { ok: false as const, error: "Package not found." };
      await sql`
        update customer_packages
        set package_id = ${pkg.id},
            speed_limit_kbps = ${pkg.download_kbps},
            data_limit_mb = ${pkg.data_limit_mb},
            updated_at = now()
        where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
      return { ok: true as const };
    }
    if (data.action === "retry") {
      const pay = await sql<{ id: string }>`
        select p.id from payments p
        join customer_packages cp on cp.payment_id = p.id
        where cp.customer_id = ${data.customerId}
        order by p.created_at desc
        limit 1
      `;
      if (!pay[0]) return { ok: false as const, error: "No payment to retry." };
      const result = await activateFromPayment(pay[0].id);
      return result.ok
        ? { ok: true as const }
        : { ok: false as const, error: "Activation failed. Check the router." };
    }
    return { ok: false as const, error: "Unknown action." };
  });

export const listPackagesAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    return (await sql<SqlRow>`select * from packages order by sort_order, price`).map(
      mapPackage,
    );
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
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id ?? nid("pkg");
    await sql`
      insert into packages (
        id, name, price, duration_minutes, download_kbps, upload_kbps, data_limit_mb, status, sort_order
      ) values (
        ${id}, ${data.name}, ${data.price}, ${data.durationMinutes}, ${data.downloadKbps},
        ${data.uploadKbps}, ${data.dataLimitMb}, ${data.status}, 50
      )
      on conflict (id) do update set
        name = excluded.name,
        price = excluded.price,
        duration_minutes = excluded.duration_minutes,
        download_kbps = excluded.download_kbps,
        upload_kbps = excluded.upload_kbps,
        data_limit_mb = excluded.data_limit_mb,
        status = excluded.status,
        updated_at = now()
    `;
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
    const rows = await sql<SqlRow>`
      select p.*, pkg.name as package_name
      from payments p
      join packages pkg on pkg.id = p.package_id
      where (${data.phone ?? null}::text is null or p.phone like ${"%" + (data.phone ?? "") + "%"})
        and (${data.packageId ?? null}::text is null or p.package_id = ${data.packageId ?? ""})
        and (${data.status ?? null}::text is null or p.status = ${data.status ?? ""})
        and (${data.activationStatus ?? null}::text is null or p.activation_status = ${data.activationStatus ?? ""})
        and (
          ${data.period ?? "ALL"} = 'ALL'
          or (${data.period ?? "ALL"} = 'TODAY' and p.created_at >= date_trunc('day', now()))
          or (${data.period ?? "ALL"} = 'WEEK' and p.created_at >= date_trunc('week', now()))
          or (${data.period ?? "ALL"} = 'MONTH' and p.created_at >= date_trunc('month', now()))
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

export const getReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const sql = await getSql();
    const today = await sql<{
      revenue: number;
      tx: number;
      success: number;
      failed: number;
      sold: number;
    }>`
      select
        coalesce(sum(case when status = 'SUCCESS' then amount else 0 end), 0)::int as revenue,
        count(*)::int as tx,
        count(*) filter (where status = 'SUCCESS')::int as success,
        count(*) filter (where status in ('FAILED','CANCELLED'))::int as failed,
        count(*) filter (where status = 'SUCCESS')::int as sold
      from payments where created_at >= date_trunc('day', now())
    `;
    const week = await sql<{ revenue: number; tx: number }>`
      select
        coalesce(sum(case when status = 'SUCCESS' then amount else 0 end), 0)::int as revenue,
        count(*)::int as tx
      from payments where created_at >= date_trunc('week', now())
    `;
    const month = await sql<{ revenue: number; tx: number }>`
      select
        coalesce(sum(case when status = 'SUCCESS' then amount else 0 end), 0)::int as revenue,
        count(*)::int as tx
      from payments where created_at >= date_trunc('month', now())
    `;
    const best = await sql<{ name: string; sold: number; revenue: number }>`
      select pkg.name, count(*)::int as sold,
             coalesce(sum(p.amount), 0)::int as revenue
      from payments p join packages pkg on pkg.id = p.package_id
      where p.status = 'SUCCESS' and p.created_at >= date_trunc('week', now())
      group by pkg.name
      order by sold desc
    `;
    const monthPerf = await sql<{ name: string; sold: number; revenue: number }>`
      select pkg.name, count(*)::int as sold,
             coalesce(sum(p.amount), 0)::int as revenue
      from payments p join packages pkg on pkg.id = p.package_id
      where p.status = 'SUCCESS' and p.created_at >= date_trunc('month', now())
      group by pkg.name
      order by revenue desc
    `;
    const daily = await sql<{ day: string; revenue: number; tx: number }>`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             coalesce(sum(case when status = 'SUCCESS' then amount else 0 end), 0)::int as revenue,
             count(*) filter (where status = 'SUCCESS')::int as tx
      from payments
      where created_at >= now() - interval '14 days'
      group by 1
      order by 1
    `;
    return {
      today: today[0],
      week: week[0],
      month: month[0],
      bestWeek: best,
      monthPerf,
      daily: daily.map((d) => ({
        day: String(d.day),
        revenue: asNumber(d.revenue),
        tx: asNumber(d.tx),
      })),
    };
  });

export const getNetwork = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    void expireDuePackages().catch(() => {});
    const sql = await getSql();
    const [settings, router, ispsRaw, eventsRaw, mikrotiksRaw, online] = await Promise.all([
      getSettings(),
      pingRouter().catch(() => ({ reachable: false, mode: "unconfigured" as const })),
      sql<SqlRow>`select * from isps order by sort_order`,
      sql<SqlRow>`select * from network_events order by created_at desc limit 20`,
      sql<SqlRow>`select * from mikrotiks order by is_primary desc, created_at`,
      sql<{ n: number }>`select count(*)::int as n from sessions where status = 'ACTIVE'`,
    ]);
    return {
      settings,
      router,
      isps: ispsRaw.map(mapIsp),
      mikrotiks: mikrotiksRaw.map(mapMikroTik),
      events: eventsRaw.map(mapEvent),
      onlineUsers: asNumber(online[0]?.n),
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
        mpesaCallbackUrl: z.string().optional(),
        defaultUploadKbps: z.number().int().min(64),
        ispTotalKbps: z.number().int().min(1024).max(1_000_000),
        perUserMaxKbps: z.number().int().min(256).max(100_000),
        maxUsers: z.number().int().min(1).max(500),
        oneDevicePerPackage: z.boolean(),
        operatorPassword: z.string().optional(),
        radiusEnabled: z.boolean().optional(),
        radiusSecret: z.string().optional(),
        radiusAuthPort: z.number().optional(),
        radiusAcctPort: z.number().optional(),
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
        mpesa_callback_url = ${data.mpesaCallbackUrl || null},
        default_upload_kbps = ${data.defaultUploadKbps},
        isp_total_kbps = ${data.ispTotalKbps},
        per_user_max_kbps = ${data.perUserMaxKbps},
        max_users = ${data.maxUsers},
        one_device_per_package = ${data.oneDevicePerPackage},
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
    if (data.mpesaConsumerKey) {
      await sql`update settings set mpesa_consumer_key = ${data.mpesaConsumerKey} where id = 'default'`;
    }
    if (data.mpesaConsumerSecret) {
      await sql`update settings set mpesa_consumer_secret = ${data.mpesaConsumerSecret} where id = 'default'`;
    }
    if (data.mpesaPasskey) {
      await sql`update settings set mpesa_passkey = ${data.mpesaPasskey} where id = 'default'`;
    }
    return { ok: true as const };
  });

const mikrotikInput = z.object({
  id: z.string().optional(),
  name: z.string().min(2).max(60),
  host: z.string().min(3).max(200),
  port: z.number().int().min(1).max(65535).optional(),
  apiUser: z.string().min(1).max(80),
  apiPassword: z.string().max(120).optional(),
  hotspotName: z.string().min(1).max(60).default("hotspot1"),
  ssl: z.boolean().default(false),
  insecureTls: z.boolean().default(false),
  makePrimary: z.boolean().optional(),
  /** rest = RouterOS 7 REST; api6 = RouterOS 6 binary API */
  apiMode: z.enum(["rest", "api6"]).default("rest"),
  apiPort: z.number().int().min(1).max(65535).optional(),
});

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
      where is_primary = true
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
  const sql = await getSql();
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
    where id = ${id}
  `;
}

export const saveMikroTik = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => mikrotikInput.parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const host = normalizeRouterHost(data.host, data.ssl, data.port);
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
    const password = data.apiPassword || existing?.api_password;
    if (!password) {
      return { ok: false as const, error: "Enter the RouterOS password." };
    }

    const count = await sql<{ n: number }>`select count(*)::int as n from mikrotiks`;
    const onlyRouter = asNumber(count[0]?.n) === 0 || (Boolean(existing) && asNumber(count[0]?.n) === 1);
    const makePrimary = data.makePrimary || onlyRouter || (!existing && asNumber(count[0]?.n) === 0);

    if (makePrimary) {
      await sql`update mikrotiks set is_primary = false, updated_at = now()`;
    }

    await sql`
      insert into mikrotiks (
        id, name, host, api_user, api_password, hotspot_name, ssl, insecure_tls, is_primary, status, api_mode, api_port
      ) values (
        ${id}, ${data.name}, ${host}, ${data.apiUser}, ${password},
        ${data.hotspotName || "hotspot1"}, ${data.ssl}, ${data.insecureTls}, ${makePrimary}, 'UNKNOWN',
        ${data.apiMode}, ${data.apiMode === "api6" ? (data.apiPort || data.port || 8728) : (data.port || null)}
      )
      on conflict (id) do update set
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
        updated_at = now()
    `;

    const probe = await probeRouter({
      host,
      user: data.apiUser,
      password,
      hotspot: data.hotspotName || "hotspot1",
      insecureTls: data.insecureTls,
      apiMode: data.apiMode,
      apiPort: data.apiMode === "api6" ? (data.apiPort || data.port || 8728) : undefined,
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
        ? `MikroTik ${data.name} reached${probe.identity ? ` (${probe.identity})` : ""}. REST is live.`
        : `MikroTik ${data.name} saved but unreachable. ${probe.error ?? ""}`.trim(),
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
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
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
        }>`
          select host, api_user, api_password, hotspot_name, ssl, insecure_tls
          from mikrotiks where id = ${data.id} limit 1
        `
      )[0];
      if (!row) return { ok: false as const, error: "Router not found." };
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

    const probe = await probeRouter({ host, user, password, hotspot, insecureTls, apiMode: "rest" });
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
    }>`
      select id, host, api_user, api_password, hotspot_name, insecure_tls
      from mikrotiks
      order by is_primary desc, created_at
    `;
    let online = 0;
    for (const row of rows) {
      const probe = await probeRouter({
        host: String(row.host),
        user: String(row.api_user),
        password: String(row.api_password),
        hotspot: String(row.hotspot_name || "hotspot1"),
        insecureTls: Boolean(row.insecure_tls),
        apiMode: "rest",
      });
      await persistProbe(row.id, probe);
      if (probe.ok) online += 1;
    }
    return { ok: true as const, total: rows.length, online };
  });

export const setPrimaryMikroTik = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const row = (
      await sql<{ name: string }>`select name from mikrotiks where id = ${data.id} limit 1`
    )[0];
    if (!row) return { ok: false as const, error: "Router not found." };
    await sql`update mikrotiks set is_primary = false, updated_at = now()`;
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
          select id from mikrotiks order by created_at limit 1
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
    await sql`
      insert into isps (
        id, name, type, interface_name, status, sort_order, mikrotik_id,
        total_kbps, per_user_max_kbps, max_users
      )
      values (
        ${id}, ${data.name}, ${data.type}, ${data.interfaceName || null},
        ${data.status ?? "ONLINE"}, ${asNumber(maxSort[0]?.n) + 1}, ${data.mikrotikId || null},
        ${total}, ${perUser}, ${maxUsers}
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
    return sql<{ id: string; name: string; slug: string; status: string }>`
      select id, name, slug, status from sites order by name
    `;
  });

export const saveSite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(2).max(80),
        slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id ?? `site_${Date.now().toString(36)}`;
    await sql`
      insert into sites (id, name, slug, status)
      values (${id}, ${data.name}, ${data.slug}, 'ACTIVE')
      on conflict (id) do update set
        name = excluded.name,
        slug = excluded.slug,
        updated_at = now()
    `;
    return { ok: true as const, id };
  });

// --- Vouchers ---
export const listVouchersAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const rows = await listVouchers({ limit: 200 });
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      packageName: String(r.package_name ?? ""),
      status: String(r.status),
      batchLabel: r.batch_label ? String(r.batch_label) : null,
      redeemedAt: r.redeemed_at ? String(r.redeemed_at) : null,
      createdAt: String(r.created_at),
    }));
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
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const codes = await generateVouchers({
      packageId: data.packageId,
      count: data.count,
      batchLabel: data.batchLabel,
      siteId: data.siteId,
    });
    return { ok: true as const, codes };
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
