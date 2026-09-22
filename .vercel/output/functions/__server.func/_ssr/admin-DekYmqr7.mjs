import { r as createServerFn } from "./ssr.mjs";
import { A as boolean, D as _enum, F as object, P as number, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { r as getSql } from "./db-8ZrWNzfw.mjs";
import { a as nid, n as asNumber } from "./utils-DITYiIRO.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { t as authMiddleware } from "./middleware-DzwTqOc6.mjs";
import { a as mapCustomerPackage, c as mapLiveUser, d as mapPayment, i as mapCustomer, l as mapMikroTik, o as mapEvent, r as logEvent, s as mapIsp, t as getSettings, u as mapPackage } from "./settings.server-DGdR6vBM.mjs";
import { a as expireDuePackages, c as pingRouter, f as releaseDeviceBind, i as disconnectSession, l as probeRouter, n as applyCamouflage$1, p as tickLiveUsage, r as blockCustomer, t as activateFromPayment } from "./mpesa.server-BgRtZTCv.mjs";
import { t as normalizeRouterHost } from "./mikrotik-host-LARBMA8_.mjs";
import { n as listVouchers, t as generateVouchers } from "./vouchers.server-RDMNoJ5u.mjs";
import { processActivationRetries } from "./callback.server-D3i_WM1b.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-DekYmqr7.js
var getDashboard_createServerFn_handler = createServerRpc({
	id: "646be9f450386a7d3f62c477cf1a66df87cc474ba37495b39b475d26b63e7b77",
	name: "getDashboard",
	filename: "src/lib/fn/admin.ts"
}, (opts) => getDashboard.__executeServer(opts));
var getDashboard = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getDashboard_createServerFn_handler, async () => {
	expireDuePackages().catch(() => {});
	tickLiveUsage().catch(() => {});
	const sql = await getSql();
	const [settings, router, today, counts, ispsRaw, mikrotiksRaw, eventsRaw, recentRaw] = await Promise.all([
		getSettings(),
		pingRouter().catch(() => ({
			reachable: false,
			mode: "unconfigured"
		})),
		sql`
          select
            coalesce(sum(case when status = 'SUCCESS' then amount else 0 end), 0)::int as revenue,
            count(*)::int as tx,
            count(*) filter (where status = 'SUCCESS')::int as success,
            count(*) filter (where status in ('FAILED','CANCELLED'))::int as failed
          from payments
          where created_at >= date_trunc('day', now())
        `,
		sql`
          select
            (select count(*) from sessions where status = 'ACTIVE')::int as online,
            (select count(*) from customer_packages where status = 'ACTIVE' and expiry_time > now())::int as active_pkg,
            (select count(*) from customer_packages where status = 'EXPIRED')::int as expired_pkg,
            (select count(*) from customers)::int as customers,
            (select count(*) from payments where status = 'SUCCESS' and activation_status = 'ACTIVATION_FAILED')::int as awaiting
        `,
		sql`select * from isps order by sort_order`,
		sql`select * from mikrotiks order by is_primary desc, created_at`,
		sql`select * from network_events order by created_at desc limit 8`,
		sql`
          select p.*, pkg.name as package_name
          from payments p join packages pkg on pkg.id = p.package_id
          order by p.created_at desc limit 8
        `
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
			awaitingActivation: asNumber(c?.awaiting)
		},
		isps,
		mikrotiks,
		events,
		recent
	};
});
var listCustomersAdmin_createServerFn_handler = createServerRpc({
	id: "f1f61f798206618a2a3acb3b8fd4c106b729e496bb3ea9673d6639567606d826",
	name: "listCustomersAdmin",
	filename: "src/lib/fn/admin.ts"
}, (opts) => listCustomersAdmin.__executeServer(opts));
var listCustomersAdmin = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listCustomersAdmin_createServerFn_handler, async () => {
	await expireDuePackages();
	return (await (await getSql())`
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
    `).map((row) => ({
		customer: mapCustomer(row),
		pack: row.cp_id ? mapCustomerPackage({
			...row,
			id: row.cp_id,
			customer_id: row.id,
			status: row.pkg_status
		}) : null,
		paymentStatus: row.payment_status ? String(row.payment_status) : null,
		paymentAmount: row.amount != null ? asNumber(row.amount) : null,
		mpesaTransactionId: row.mpesa_transaction_id ? String(row.mpesa_transaction_id) : null,
		connectionStatus: row.connection_status ? String(row.connection_status) : "OFFLINE"
	}));
});
var customerAction_createServerFn_handler = createServerRpc({
	id: "0cfa829a8431afd704ec928765eab5489763164a21868aa9b36916b21a4120e3",
	name: "customerAction",
	filename: "src/lib/fn/admin.ts"
}, (opts) => customerAction.__executeServer(opts));
var customerAction = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	customerId: string(),
	action: _enum([
		"disconnect",
		"block",
		"unblock",
		"extend",
		"changePackage",
		"retry",
		"releaseDevice"
	]),
	minutes: number().optional(),
	packageId: string().optional()
}).parse(data)).handler(customerAction_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	if (data.action === "block") {
		await blockCustomer(data.customerId);
		return { ok: true };
	}
	if (data.action === "unblock") {
		await sql`update customers set status = 'ACTIVE', updated_at = now() where id = ${data.customerId}`;
		return { ok: true };
	}
	if (data.action === "disconnect") {
		const ses = await sql`
        select id from sessions where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
		for (const s of ses) await disconnectSession(s.id);
		return { ok: true };
	}
	if (data.action === "releaseDevice") {
		await releaseDeviceBind(data.customerId);
		return { ok: true };
	}
	if (data.action === "extend") {
		await sql`
        update customer_packages
        set expiry_time = expiry_time + (${data.minutes ?? 60} * interval '1 minute'), updated_at = now()
        where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
		return { ok: true };
	}
	if (data.action === "changePackage" && data.packageId) {
		const pkg = (await sql`select * from packages where id = ${data.packageId} limit 1`)[0];
		if (!pkg) return {
			ok: false,
			error: "Package not found."
		};
		await sql`
        update customer_packages
        set package_id = ${pkg.id},
            speed_limit_kbps = ${pkg.download_kbps},
            data_limit_mb = ${pkg.data_limit_mb},
            updated_at = now()
        where customer_id = ${data.customerId} and status = 'ACTIVE'
      `;
		return { ok: true };
	}
	if (data.action === "retry") {
		const pay = await sql`
        select p.id from payments p
        join customer_packages cp on cp.payment_id = p.id
        where cp.customer_id = ${data.customerId}
        order by p.created_at desc
        limit 1
      `;
		if (!pay[0]) return {
			ok: false,
			error: "No payment to retry."
		};
		return (await activateFromPayment(pay[0].id)).ok ? { ok: true } : {
			ok: false,
			error: "Activation failed. Check the router."
		};
	}
	return {
		ok: false,
		error: "Unknown action."
	};
});
var listPackagesAdmin_createServerFn_handler = createServerRpc({
	id: "0aa00b4dde7d21716291aff23be9c68390d72e97ea72df91c4cff9e895591e1a",
	name: "listPackagesAdmin",
	filename: "src/lib/fn/admin.ts"
}, (opts) => listPackagesAdmin.__executeServer(opts));
var listPackagesAdmin = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listPackagesAdmin_createServerFn_handler, async () => {
	return (await (await getSql())`select * from packages order by sort_order, price`).map(mapPackage);
});
var savePackage_createServerFn_handler = createServerRpc({
	id: "d234638b769edf6f3aebda6603b511772a934c60a8366af7b81535cfded01b33",
	name: "savePackage",
	filename: "src/lib/fn/admin.ts"
}, (opts) => savePackage.__executeServer(opts));
var savePackage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string().optional(),
	name: string().min(1).max(40),
	price: number().int().min(0),
	durationMinutes: number().int().min(1),
	downloadKbps: number().int().min(64),
	uploadKbps: number().int().min(64),
	dataLimitMb: number().int().min(1).nullable(),
	status: _enum(["ACTIVE", "INACTIVE"])
}).parse(data)).handler(savePackage_createServerFn_handler, async ({ data }) => {
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
	return {
		ok: true,
		id
	};
});
var deletePackage_createServerFn_handler = createServerRpc({
	id: "ebe7a968b73484f01ea9af08ae0d7c06ff566c0113fa9cd13ce3a0d098c367be",
	name: "deletePackage",
	filename: "src/lib/fn/admin.ts"
}, (opts) => deletePackage.__executeServer(opts));
var deletePackage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ id: string() }).parse(data)).handler(deletePackage_createServerFn_handler, async ({ data }) => {
	await (await getSql())`update packages set status = 'INACTIVE', updated_at = now() where id = ${data.id}`;
	return { ok: true };
});
var listPaymentsAdmin_createServerFn_handler = createServerRpc({
	id: "cb1556ebdf94fcb5b5cb409a8c68d5cbb288e501a1fe2f44d945eb4b08687c2b",
	name: "listPaymentsAdmin",
	filename: "src/lib/fn/admin.ts"
}, (opts) => listPaymentsAdmin.__executeServer(opts));
var listPaymentsAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	phone: string().optional(),
	packageId: string().optional(),
	status: string().optional(),
	activationStatus: string().optional(),
	period: _enum([
		"ALL",
		"TODAY",
		"WEEK",
		"MONTH"
	]).optional()
}).parse(data)).handler(listPaymentsAdmin_createServerFn_handler, async ({ data }) => {
	return (await (await getSql())`
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
    `).map(mapPayment);
});
var retryPaymentActivation_createServerFn_handler = createServerRpc({
	id: "053019b17bee865f6e03d878f77381970165b006cd991cd8b087499b0a479939",
	name: "retryPaymentActivation",
	filename: "src/lib/fn/admin.ts"
}, (opts) => retryPaymentActivation.__executeServer(opts));
var retryPaymentActivation = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ paymentId: string() }).parse(data)).handler(retryPaymentActivation_createServerFn_handler, async ({ data }) => {
	return (await activateFromPayment(data.paymentId)).ok ? { ok: true } : {
		ok: false,
		error: "Activation failed. Check the router."
	};
});
var listLiveUsers_createServerFn_handler = createServerRpc({
	id: "a63713b734e0332b914b934e1e9be33a35be504760990a6a022594b458cc62d9",
	name: "listLiveUsers",
	filename: "src/lib/fn/admin.ts"
}, (opts) => listLiveUsers.__executeServer(opts));
var listLiveUsers = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listLiveUsers_createServerFn_handler, async () => {
	await expireDuePackages();
	await tickLiveUsage();
	return (await (await getSql())`
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
    `).map(mapLiveUser);
});
var kickLiveUser_createServerFn_handler = createServerRpc({
	id: "c58905778fbb9432f27496411f9a112498614b5201c03c06c2cdc0e68df208c1",
	name: "kickLiveUser",
	filename: "src/lib/fn/admin.ts"
}, (opts) => kickLiveUser.__executeServer(opts));
var kickLiveUser = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ sessionId: string() }).parse(data)).handler(kickLiveUser_createServerFn_handler, async ({ data }) => {
	await disconnectSession(data.sessionId);
	return { ok: true };
});
var getReports_createServerFn_handler = createServerRpc({
	id: "23709e74da8e72ad5f6b87487bdb5bcc52928bdfba64a4ed6f54c8338642a711",
	name: "getReports",
	filename: "src/lib/fn/admin.ts"
}, (opts) => getReports.__executeServer(opts));
var getReports = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getReports_createServerFn_handler, async () => {
	const sql = await getSql();
	const today = await sql`
      select
        coalesce(sum(case when status = 'SUCCESS' then amount else 0 end), 0)::int as revenue,
        count(*)::int as tx,
        count(*) filter (where status = 'SUCCESS')::int as success,
        count(*) filter (where status in ('FAILED','CANCELLED'))::int as failed,
        count(*) filter (where status = 'SUCCESS')::int as sold
      from payments where created_at >= date_trunc('day', now())
    `;
	const week = await sql`
      select
        coalesce(sum(case when status = 'SUCCESS' then amount else 0 end), 0)::int as revenue,
        count(*)::int as tx
      from payments where created_at >= date_trunc('week', now())
    `;
	const month = await sql`
      select
        coalesce(sum(case when status = 'SUCCESS' then amount else 0 end), 0)::int as revenue,
        count(*)::int as tx
      from payments where created_at >= date_trunc('month', now())
    `;
	const best = await sql`
      select pkg.name, count(*)::int as sold,
             coalesce(sum(p.amount), 0)::int as revenue
      from payments p join packages pkg on pkg.id = p.package_id
      where p.status = 'SUCCESS' and p.created_at >= date_trunc('week', now())
      group by pkg.name
      order by sold desc
    `;
	const monthPerf = await sql`
      select pkg.name, count(*)::int as sold,
             coalesce(sum(p.amount), 0)::int as revenue
      from payments p join packages pkg on pkg.id = p.package_id
      where p.status = 'SUCCESS' and p.created_at >= date_trunc('month', now())
      group by pkg.name
      order by revenue desc
    `;
	const daily = await sql`
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
			tx: asNumber(d.tx)
		}))
	};
});
var getNetwork_createServerFn_handler = createServerRpc({
	id: "bfc7f3d612551c6299b5b46c06a50a69c754f42219484c0d3d49889383350cfe",
	name: "getNetwork",
	filename: "src/lib/fn/admin.ts"
}, (opts) => getNetwork.__executeServer(opts));
var getNetwork = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getNetwork_createServerFn_handler, async () => {
	expireDuePackages().catch(() => {});
	const sql = await getSql();
	const [settings, router, ispsRaw, eventsRaw, mikrotiksRaw, online] = await Promise.all([
		getSettings(),
		pingRouter().catch(() => ({
			reachable: false,
			mode: "unconfigured"
		})),
		sql`select * from isps order by sort_order`,
		sql`select * from network_events order by created_at desc limit 20`,
		sql`select * from mikrotiks order by is_primary desc, created_at`,
		sql`select count(*)::int as n from sessions where status = 'ACTIVE'`
	]);
	return {
		settings,
		router,
		isps: ispsRaw.map(mapIsp),
		mikrotiks: mikrotiksRaw.map(mapMikroTik),
		events: eventsRaw.map(mapEvent),
		onlineUsers: asNumber(online[0]?.n)
	};
});
var setIspStatus_createServerFn_handler = createServerRpc({
	id: "1b1a40f81e9ba1ba2acfa7ba26e0306cf366710bce8d4e726edd01803fbf7092",
	name: "setIspStatus",
	filename: "src/lib/fn/admin.ts"
}, (opts) => setIspStatus.__executeServer(opts));
var setIspStatus = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string(),
	status: _enum([
		"ONLINE",
		"OFFLINE",
		"DEGRADED"
	])
}).parse(data)).handler(setIspStatus_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const before = await sql`
      select name, status from isps where id = ${data.id} limit 1
    `;
	await sql`
      update isps set status = ${data.status}, updated_at = now() where id = ${data.id}
    `;
	if (before[0] && before[0].status !== data.status) await logEvent(data.status === "OFFLINE" ? "ISP_DOWN" : "ISP_RECOVER", `${before[0].name} is now ${data.status}. Active packages are unchanged — MikroTik handles WAN failover.`);
	return { ok: true };
});
var getSettingsAdmin_createServerFn_handler = createServerRpc({
	id: "68c4bd0e128a2fc5ab0e6621d92988b9be7100f7e93aec88d18745222d60e0d3",
	name: "getSettingsAdmin",
	filename: "src/lib/fn/admin.ts"
}, (opts) => getSettingsAdmin.__executeServer(opts));
var getSettingsAdmin = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getSettingsAdmin_createServerFn_handler, async () => getSettings());
var saveSettingsAdmin_createServerFn_handler = createServerRpc({
	id: "84e12f121949828ed66a6b94905b4b97abf7f17b4c07f05d337405ab0ba17536",
	name: "saveSettingsAdmin",
	filename: "src/lib/fn/admin.ts"
}, (opts) => saveSettingsAdmin.__executeServer(opts));
var saveSettingsAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	hotspotName: string().min(2).max(60),
	currency: string().min(1).max(8),
	welcomeMessage: string().min(1).max(80),
	mpesaShortcode: string().optional(),
	mpesaConsumerKey: string().optional(),
	mpesaConsumerSecret: string().optional(),
	mpesaPasskey: string().optional(),
	mpesaEnv: _enum(["sandbox", "production"]),
	mpesaCallbackUrl: string().optional(),
	defaultUploadKbps: number().int().min(64),
	ispTotalKbps: number().int().min(1024).max(1e6),
	perUserMaxKbps: number().int().min(256).max(1e5),
	maxUsers: number().int().min(1).max(500),
	oneDevicePerPackage: boolean(),
	operatorPassword: string().optional(),
	radiusEnabled: boolean().optional(),
	radiusSecret: string().optional(),
	radiusAuthPort: number().optional(),
	radiusAcctPort: number().optional()
}).parse(data)).handler(saveSettingsAdmin_createServerFn_handler, async ({ data }) => {
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
	if (data.operatorPassword && data.operatorPassword.length >= 4) await sql`
        update settings
        set operator_password = ${data.operatorPassword}, updated_at = now()
        where id = 'default'
      `;
	if (typeof data.radiusEnabled === "boolean") await sql`update settings set radius_enabled = ${data.radiusEnabled}, updated_at = now() where id = 'default'`;
	if (data.radiusSecret && !data.radiusSecret.includes("•")) await sql`update settings set radius_secret = ${data.radiusSecret}, updated_at = now() where id = 'default'`;
	if (data.radiusAuthPort) await sql`update settings set radius_auth_port = ${data.radiusAuthPort}, updated_at = now() where id = 'default'`;
	if (data.radiusAcctPort) await sql`update settings set radius_acct_port = ${data.radiusAcctPort}, updated_at = now() where id = 'default'`;
	if (data.mpesaConsumerKey) await sql`update settings set mpesa_consumer_key = ${data.mpesaConsumerKey} where id = 'default'`;
	if (data.mpesaConsumerSecret) await sql`update settings set mpesa_consumer_secret = ${data.mpesaConsumerSecret} where id = 'default'`;
	if (data.mpesaPasskey) await sql`update settings set mpesa_passkey = ${data.mpesaPasskey} where id = 'default'`;
	return { ok: true };
});
var mikrotikInput = object({
	id: string().optional(),
	name: string().min(2).max(60),
	host: string().min(3).max(200),
	port: number().int().min(1).max(65535).optional(),
	apiUser: string().min(1).max(80),
	apiPassword: string().max(120).optional(),
	hotspotName: string().min(1).max(60).default("hotspot1"),
	ssl: boolean().default(false),
	insecureTls: boolean().default(false),
	makePrimary: boolean().optional(),
	/** rest = RouterOS 7 REST; api6 = RouterOS 6 binary API */
	apiMode: _enum(["rest", "api6"]).default("rest"),
	apiPort: number().int().min(1).max(65535).optional()
});
async function syncPrimaryToSettings() {
	const sql = await getSql();
	const row = (await sql`
      select host, api_user, api_password, hotspot_name
      from mikrotiks
      where is_primary = true
      limit 1
    `)[0];
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
async function persistProbe(id, probe) {
	await (await getSql())`
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
var saveMikroTik_createServerFn_handler = createServerRpc({
	id: "c01656b83d01987d607737a7921e4b66a4279e1051f4ec2445b7d7635e873168",
	name: "saveMikroTik",
	filename: "src/lib/fn/admin.ts"
}, (opts) => saveMikroTik.__executeServer(opts));
var saveMikroTik = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => mikrotikInput.parse(data)).handler(saveMikroTik_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const host = normalizeRouterHost(data.host, data.ssl, data.port);
	const id = data.id ?? nid("mt");
	const existing = data.id ? (await sql`
            select api_password, is_primary from mikrotiks where id = ${data.id} limit 1
          `)[0] : null;
	if (data.id && !existing) return {
		ok: false,
		error: "Router not found."
	};
	const password = data.apiPassword || existing?.api_password;
	if (!password) return {
		ok: false,
		error: "Enter the RouterOS password."
	};
	const count = await sql`select count(*)::int as n from mikrotiks`;
	const onlyRouter = asNumber(count[0]?.n) === 0 || Boolean(existing) && asNumber(count[0]?.n) === 1;
	const makePrimary = data.makePrimary || onlyRouter || !existing && asNumber(count[0]?.n) === 0;
	if (makePrimary) await sql`update mikrotiks set is_primary = false, updated_at = now()`;
	await sql`
      insert into mikrotiks (
        id, name, host, api_user, api_password, hotspot_name, ssl, insecure_tls, is_primary, status, api_mode, api_port
      ) values (
        ${id}, ${data.name}, ${host}, ${data.apiUser}, ${password},
        ${data.hotspotName || "hotspot1"}, ${data.ssl}, ${data.insecureTls}, ${makePrimary}, 'UNKNOWN',
        ${data.apiMode}, ${data.apiMode === "api6" ? data.apiPort || data.port || 8728 : data.port || null}
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
		apiPort: data.apiMode === "api6" ? data.apiPort || data.port || 8728 : void 0
	});
	await persistProbe(id, probe);
	await syncPrimaryToSettings();
	let live = false;
	if (makePrimary && probe.ok) {
		await sql`update settings set demo_mode = false, updated_at = now() where id = 'default'`;
		live = true;
	}
	await logEvent(probe.ok ? "ROUTER_ONLINE" : "ROUTER_OFFLINE", probe.ok ? `MikroTik ${data.name} reached${probe.identity ? ` (${probe.identity})` : ""}. REST is live.` : `MikroTik ${data.name} saved but unreachable. ${probe.error ?? ""}`.trim());
	return {
		ok: true,
		id,
		probe,
		live
	};
});
var testMikroTik_createServerFn_handler = createServerRpc({
	id: "50dd5ab7f8968ad275666c1d98bab06fb3eda700cb3b09bf35b205971ef186bb",
	name: "testMikroTik",
	filename: "src/lib/fn/admin.ts"
}, (opts) => testMikroTik.__executeServer(opts));
var testMikroTik = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string().optional(),
	host: string().optional(),
	port: number().int().min(1).max(65535).optional(),
	apiUser: string().optional(),
	apiPassword: string().optional(),
	hotspotName: string().optional(),
	ssl: boolean().optional(),
	insecureTls: boolean().optional()
}).parse(data)).handler(testMikroTik_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	let host = data.host ? normalizeRouterHost(data.host, data.ssl ?? false, data.port) : "";
	let user = data.apiUser ?? "";
	let password = data.apiPassword ?? "";
	let hotspot = data.hotspotName || "hotspot1";
	let insecureTls = data.insecureTls ?? false;
	if (data.id) {
		const row = (await sql`
          select host, api_user, api_password, hotspot_name, ssl, insecure_tls
          from mikrotiks where id = ${data.id} limit 1
        `)[0];
		if (!row) return {
			ok: false,
			error: "Router not found."
		};
		host = data.host ? normalizeRouterHost(data.host, data.ssl ?? Boolean(row.ssl), data.port) : String(row.host);
		user = data.apiUser || String(row.api_user);
		password = data.apiPassword || String(row.api_password);
		hotspot = data.hotspotName || String(row.hotspot_name || "hotspot1");
		insecureTls = data.insecureTls ?? Boolean(row.insecure_tls);
	}
	if (!host || !user || !password) return {
		ok: false,
		error: "Host, user and password are required."
	};
	const probe = await probeRouter({
		host,
		user,
		password,
		hotspot,
		insecureTls,
		apiMode: "rest"
	});
	if (data.id) await persistProbe(data.id, probe);
	return probe.ok ? {
		ok: true,
		probe
	} : {
		ok: false,
		error: probe.error ?? "Unreachable.",
		probe
	};
});
var refreshMikroTiks_createServerFn_handler = createServerRpc({
	id: "2cb326059439cd5f8563e5982fe7e033b61fb6dea396cc8609259e87cd2be6b7",
	name: "refreshMikroTiks",
	filename: "src/lib/fn/admin.ts"
}, (opts) => refreshMikroTiks.__executeServer(opts));
var refreshMikroTiks = createServerFn({ method: "POST" }).middleware([authMiddleware]).handler(refreshMikroTiks_createServerFn_handler, async () => {
	const rows = await (await getSql())`
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
			apiMode: "rest"
		});
		await persistProbe(row.id, probe);
		if (probe.ok) online += 1;
	}
	return {
		ok: true,
		total: rows.length,
		online
	};
});
var setPrimaryMikroTik_createServerFn_handler = createServerRpc({
	id: "6ab8ca9a1374897bdf14ededa3501fe9028733feeb796563750de2449b927443",
	name: "setPrimaryMikroTik",
	filename: "src/lib/fn/admin.ts"
}, (opts) => setPrimaryMikroTik.__executeServer(opts));
var setPrimaryMikroTik = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ id: string() }).parse(data)).handler(setPrimaryMikroTik_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const row = (await sql`select name from mikrotiks where id = ${data.id} limit 1`)[0];
	if (!row) return {
		ok: false,
		error: "Router not found."
	};
	await sql`update mikrotiks set is_primary = false, updated_at = now()`;
	await sql`
      update mikrotiks set is_primary = true, updated_at = now() where id = ${data.id}
    `;
	await sql`update settings set demo_mode = false, updated_at = now() where id = 'default'`;
	await syncPrimaryToSettings();
	await logEvent("ROUTER_PRIMARY", `${row.name} is now the primary MikroTik. Live activations will use RouterOS REST.`);
	return { ok: true };
});
var deleteMikroTik_createServerFn_handler = createServerRpc({
	id: "dc01274b892b81d8a0b7a37344a29da18507dc556042a42ca0758f90678761f3",
	name: "deleteMikroTik",
	filename: "src/lib/fn/admin.ts"
}, (opts) => deleteMikroTik.__executeServer(opts));
var deleteMikroTik = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ id: string() }).parse(data)).handler(deleteMikroTik_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const row = (await sql`
        select name, is_primary from mikrotiks where id = ${data.id} limit 1
      `)[0];
	if (!row) return {
		ok: false,
		error: "Router not found."
	};
	await sql`delete from mikrotiks where id = ${data.id}`;
	if (row.is_primary) {
		const next = (await sql`
          select id from mikrotiks order by created_at limit 1
        `)[0];
		if (next) {
			await sql`
          update mikrotiks set is_primary = true, updated_at = now() where id = ${next.id}
        `;
			await syncPrimaryToSettings();
		} else await sql`
          update settings set
            mikrotik_host = null,
            mikrotik_user = null,
            mikrotik_password = null,
            demo_mode = false,
            updated_at = now()
          where id = 'default'
        `;
	}
	await logEvent("ROUTER_REMOVED", `${row.name} was removed from TelNet.`);
	return { ok: true };
});
var saveIsp_createServerFn_handler = createServerRpc({
	id: "d0e104f45636b19a235c0deb2bf9791f9f077f2bef101591bf290442349ed6b9",
	name: "saveIsp",
	filename: "src/lib/fn/admin.ts"
}, (opts) => saveIsp.__executeServer(opts));
var saveIsp = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string().optional(),
	name: string().min(2).max(40),
	type: _enum([
		"STARLINK",
		"AIRTEL",
		"SAFARICOM",
		"FIBRE",
		"LTE",
		"OTHER"
	]),
	interfaceName: string().max(40).optional(),
	mikrotikId: string().optional(),
	status: _enum([
		"ONLINE",
		"OFFLINE",
		"DEGRADED"
	]).optional(),
	totalKbps: number().int().min(1024).max(1e6).optional(),
	perUserMaxKbps: number().int().min(256).max(1e5).optional(),
	maxUsers: number().int().min(1).max(500).optional()
}).parse(data)).handler(saveIsp_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const id = data.id ?? nid("isp");
	const maxSort = await sql`
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
	return {
		ok: true,
		id
	};
});
var deleteIsp_createServerFn_handler = createServerRpc({
	id: "ed47b6b148ba58f88aec397663fce6e1e9c42c7b80b2b072d74cc5d7ffd0d08c",
	name: "deleteIsp",
	filename: "src/lib/fn/admin.ts"
}, (opts) => deleteIsp.__executeServer(opts));
var deleteIsp = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ id: string() }).parse(data)).handler(deleteIsp_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const row = (await sql`select name from isps where id = ${data.id} limit 1`)[0];
	if (!row) return {
		ok: false,
		error: "Path not found."
	};
	await sql`delete from isps where id = ${data.id}`;
	await logEvent("ISP_PATH", `${row.name} was removed from ISP monitoring.`);
	return { ok: true };
});
var applyCamouflage_createServerFn_handler = createServerRpc({
	id: "d1bb05de66fb9a02c3c99e116b23ba73b97b5bd1ea47d197eaf31b52f8155753",
	name: "applyCamouflage",
	filename: "src/lib/fn/admin.ts"
}, (opts) => applyCamouflage.__executeServer(opts));
var applyCamouflage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	routerId: string(),
	kind: _enum([
		"IPHONE",
		"ANDROID",
		"PC"
	]),
	interfaceName: string().max(40).optional()
}).parse(data)).handler(applyCamouflage_createServerFn_handler, async ({ data }) => {
	const row = (await (await getSql())`
        select name from mikrotiks where id = ${data.routerId} limit 1
      `)[0];
	if (!row) return {
		ok: false,
		error: "Router not found."
	};
	const result = await applyCamouflage$1({
		routerId: data.routerId,
		kind: data.kind,
		interfaceName: data.interfaceName
	});
	await logEvent("CAMOUFLAGE", `${row.name} WAN identity set to ${data.kind}${result.live ? " via REST" : " (script ready)"}. MAC ${result.mac} on ${result.interfaceName}.`);
	return {
		...result,
		ok: true
	};
});
var listSites_createServerFn_handler = createServerRpc({
	id: "1368a8e49d0a00a23854511d76cd446f6977ce5669b600a59be0dade0bb3730a",
	name: "listSites",
	filename: "src/lib/fn/admin.ts"
}, (opts) => listSites.__executeServer(opts));
var listSites = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listSites_createServerFn_handler, async () => {
	return (await getSql())`
      select id, name, slug, status from sites order by name
    `;
});
var saveSite_createServerFn_handler = createServerRpc({
	id: "5fbf5d167a36e408e6bb975091d22bfe13c5c888f3f5f361307a241340ebf7fb",
	name: "saveSite",
	filename: "src/lib/fn/admin.ts"
}, (opts) => saveSite.__executeServer(opts));
var saveSite = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	id: string().optional(),
	name: string().min(2).max(80),
	slug: string().min(2).max(40).regex(/^[a-z0-9-]+$/)
}).parse(data)).handler(saveSite_createServerFn_handler, async ({ data }) => {
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
	return {
		ok: true,
		id
	};
});
var listVouchersAdmin_createServerFn_handler = createServerRpc({
	id: "e19f37623aa53560750af1d0aabed251851be09e9c044eb6ef3a30f0f1c89a48",
	name: "listVouchersAdmin",
	filename: "src/lib/fn/admin.ts"
}, (opts) => listVouchersAdmin.__executeServer(opts));
var listVouchersAdmin = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listVouchersAdmin_createServerFn_handler, async () => {
	return (await listVouchers({ limit: 200 })).map((r) => ({
		id: String(r.id),
		code: String(r.code),
		packageName: String(r.package_name ?? ""),
		status: String(r.status),
		batchLabel: r.batch_label ? String(r.batch_label) : null,
		redeemedAt: r.redeemed_at ? String(r.redeemed_at) : null,
		createdAt: String(r.created_at)
	}));
});
var generateVouchersAdmin_createServerFn_handler = createServerRpc({
	id: "e4833d72042a0d0e5f832bfabf2f0f36dd0a50277d99ea104f961ccca9364a6c",
	name: "generateVouchersAdmin",
	filename: "src/lib/fn/admin.ts"
}, (opts) => generateVouchersAdmin.__executeServer(opts));
var generateVouchersAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({
	packageId: string(),
	count: number().int().min(1).max(200),
	batchLabel: string().max(60).optional(),
	siteId: string().optional()
}).parse(data)).handler(generateVouchersAdmin_createServerFn_handler, async ({ data }) => {
	return {
		ok: true,
		codes: await generateVouchers({
			packageId: data.packageId,
			count: data.count,
			batchLabel: data.batchLabel,
			siteId: data.siteId
		})
	};
});
var listActivationQueue_createServerFn_handler = createServerRpc({
	id: "00a9eec92f408b9e49b1e44cb4be477598bf23541ad89d34521c834c1eee9781",
	name: "listActivationQueue",
	filename: "src/lib/fn/admin.ts"
}, (opts) => listActivationQueue.__executeServer(opts));
var listActivationQueue = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listActivationQueue_createServerFn_handler, async () => {
	await processActivationRetries(5);
	return (await getSql())`
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
var retryActivationAdmin_createServerFn_handler = createServerRpc({
	id: "edbbd45ea9c1a537cda67df9248a3a2b0894d78ba052679524350d9d918fdfbf",
	name: "retryActivationAdmin",
	filename: "src/lib/fn/admin.ts"
}, (opts) => retryActivationAdmin.__executeServer(opts));
var retryActivationAdmin = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((data) => object({ paymentId: string() }).parse(data)).handler(retryActivationAdmin_createServerFn_handler, async ({ data }) => {
	const result = await activateFromPayment(data.paymentId);
	return result.ok ? { ok: true } : {
		ok: false,
		error: String(result.reason || "Activation failed")
	};
});
//#endregion
export { applyCamouflage_createServerFn_handler, customerAction_createServerFn_handler, deleteIsp_createServerFn_handler, deleteMikroTik_createServerFn_handler, deletePackage_createServerFn_handler, generateVouchersAdmin_createServerFn_handler, getDashboard_createServerFn_handler, getNetwork_createServerFn_handler, getReports_createServerFn_handler, getSettingsAdmin_createServerFn_handler, kickLiveUser_createServerFn_handler, listActivationQueue_createServerFn_handler, listCustomersAdmin_createServerFn_handler, listLiveUsers_createServerFn_handler, listPackagesAdmin_createServerFn_handler, listPaymentsAdmin_createServerFn_handler, listSites_createServerFn_handler, listVouchersAdmin_createServerFn_handler, refreshMikroTiks_createServerFn_handler, retryActivationAdmin_createServerFn_handler, retryPaymentActivation_createServerFn_handler, saveIsp_createServerFn_handler, saveMikroTik_createServerFn_handler, savePackage_createServerFn_handler, saveSettingsAdmin_createServerFn_handler, saveSite_createServerFn_handler, setIspStatus_createServerFn_handler, setPrimaryMikroTik_createServerFn_handler, testMikroTik_createServerFn_handler };
