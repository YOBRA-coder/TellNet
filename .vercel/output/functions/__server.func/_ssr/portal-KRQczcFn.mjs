import { r as normalizeKenyanPhone } from "./phone-DB_r9zkq.mjs";
import { t as PACKAGE_IN_USE_MESSAGE } from "./device-CVNggkwc.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { F as object, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { r as getSql } from "./db-8ZrWNzfw.mjs";
import { a as nid } from "./utils-DITYiIRO.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { a as mapCustomerPackage, d as mapPayment, i as mapCustomer, s as mapIsp, t as getSettings, u as mapPackage } from "./settings.server-DGdR6vBM.mjs";
import { a as expireDuePackages, d as reconnectCustomer, o as initiateStkPush, t as activateFromPayment, u as queryStkStatus } from "./mpesa.server-BgRtZTCv.mjs";
import { r as redeemVoucher } from "./vouchers.server-RDMNoJ5u.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/portal-KRQczcFn.js
var identitySchema = object({
	token: string().min(8).max(80),
	phone: string().optional(),
	customerId: string().optional()
});
async function loadCatalog() {
	await expireDuePackages();
	const sql = await getSql();
	const settings = await getSettings();
	const packages = (await sql`
      select * from packages where status = 'ACTIVE' order by sort_order, price
    `).map(mapPackage);
	const internetUp = (await sql`select * from isps order by sort_order`).map(mapIsp).some((i) => i.status !== "OFFLINE");
	return {
		settings: {
			hotspotName: settings.hotspotName,
			welcomeMessage: settings.welcomeMessage,
			currency: settings.currency,
			demoMode: false
		},
		packages,
		internetUp
	};
}
var getPortalCatalog_createServerFn_handler = createServerRpc({
	id: "0bb0202c5534237aea04a3f6d2db2f3ffbcbefd32851485b5de39ba4261cce44",
	name: "getPortalCatalog",
	filename: "src/lib/fn/portal.ts"
}, (opts) => getPortalCatalog.__executeServer(opts));
var getPortalCatalog = createServerFn({ method: "GET" }).handler(getPortalCatalog_createServerFn_handler, async () => loadCatalog());
async function findActiveForCustomer(customerId, deviceToken) {
	const sql = await getSql();
	const settings = await getSettings();
	const row = (await sql`
    select cp.*, pkg.name as package_name, c.phone, c.status as customer_status, c.created_at
    from customer_packages cp
    join packages pkg on pkg.id = cp.package_id
    join customers c on c.id = cp.customer_id
    where cp.customer_id = ${customerId}
      and cp.status = 'ACTIVE'
      and cp.expiry_time > now()
    order by cp.expiry_time desc
    limit 1
  `)[0];
	if (!row) return null;
	const sessions = await sql`
    select id from sessions
    where customer_id = ${customerId} and status = 'ACTIVE'
    limit 1
  `;
	const pack = mapCustomerPackage(row);
	const otherDevice = Boolean(settings.oneDevicePerPackage && pack.boundDeviceToken && deviceToken && pack.boundDeviceToken !== deviceToken);
	return {
		customer: mapCustomer({
			id: row.customer_id,
			phone: row.phone,
			status: row.customer_status,
			created_at: row.created_at
		}),
		pack,
		connected: !otherDevice && sessions.length > 0 && String(row.activation_status) === "ACTIVATED",
		otherDevice
	};
}
var getPortalBootstrap_createServerFn_handler = createServerRpc({
	id: "4b6437690822ecd493eecf8d15fb82646dc99b8bd5ad8f9c9d1f393916644573",
	name: "getPortalBootstrap",
	filename: "src/lib/fn/portal.ts"
}, (opts) => getPortalBootstrap.__executeServer(opts));
var getPortalBootstrap = createServerFn({ method: "POST" }).validator((data) => identitySchema.parse(data)).handler(getPortalBootstrap_createServerFn_handler, async ({ data }) => {
	const catalog = await loadCatalog();
	const sql = await getSql();
	let access = null;
	const phone = data.phone ? normalizeKenyanPhone(data.phone) : null;
	if (data.customerId) access = await findActiveForCustomer(data.customerId, data.token);
	if (!access && data.token) {
		const byToken = await sql`
        select id from customers where device_token = ${data.token} limit 1
      `;
		if (byToken[0]) access = await findActiveForCustomer(byToken[0].id, data.token);
	}
	if (!access && phone) {
		const byPhone = await sql`
        select id from customers where phone = ${phone} limit 1
      `;
		if (byPhone[0]) access = await findActiveForCustomer(byPhone[0].id, data.token);
	}
	return {
		...catalog,
		access
	};
});
var listPortalPackages_createServerFn_handler = createServerRpc({
	id: "dda9308387491e55fc8be35fa51b6b16df4ea4085efecd93f5bb945d7e6b278a",
	name: "listPortalPackages",
	filename: "src/lib/fn/portal.ts"
}, (opts) => listPortalPackages.__executeServer(opts));
var listPortalPackages = createServerFn({ method: "GET" }).handler(listPortalPackages_createServerFn_handler, async () => {
	return (await (await getSql())`
      select * from packages where status = 'ACTIVE' order by sort_order, price
    `).map(mapPackage);
});
function activationFailure(activation, payment) {
	if (activation.reason === "in_use") return {
		ok: false,
		code: "in_use",
		error: PACKAGE_IN_USE_MESSAGE
	};
	if (activation.reason === "expired") return {
		ok: false,
		code: "expired",
		error: "Your package has expired. Please purchase a new package."
	};
	if (activation.reason === "blocked") return {
		ok: false,
		error: "This number is blocked. Please contact the hotspot operator."
	};
	return {
		ok: false,
		code: "router",
		error: "Payment received. Your package could not be activated yet. Please use 'Already Paid?' to reconnect.",
		payment
	};
}
var startPayment_createServerFn_handler = createServerRpc({
	id: "0d6c66c88ad6b73119dd7012d9d21072ba39ee82c3c9dd6450618b370dbe5de7",
	name: "startPayment",
	filename: "src/lib/fn/portal.ts"
}, (opts) => startPayment.__executeServer(opts));
var startPayment = createServerFn({ method: "POST" }).validator((data) => object({
	packageId: string(),
	phone: string(),
	token: string().min(8)
}).parse(data)).handler(startPayment_createServerFn_handler, async ({ data }) => {
	const phone = normalizeKenyanPhone(data.phone);
	if (!phone) return {
		ok: false,
		error: "Enter a valid Kenyan M-Pesa number."
	};
	const sql = await getSql();
	const pkg = (await sql`
      select * from packages where id = ${data.packageId} and status = 'ACTIVE' limit 1
    `)[0];
	if (!pkg) return {
		ok: false,
		error: "That package is no longer available."
	};
	const existing = await sql`
      select id, status from customers where phone = ${phone} limit 1
    `;
	let customerId = existing[0]?.id;
	if (existing[0]?.status === "BLOCKED") return {
		ok: false,
		error: "This number is blocked. Please contact the hotspot operator."
	};
	if (!customerId) {
		customerId = nid("cus");
		await sql`
        insert into customers (id, phone, device_token, status)
        values (${customerId}, ${phone}, ${data.token}, 'ACTIVE')
      `;
	} else await sql`
        update customers set device_token = ${data.token}, updated_at = now()
        where id = ${customerId}
      `;
	const paymentId = nid("pay");
	let stk;
	try {
		stk = await initiateStkPush({
			phone,
			amount: Number(pkg.price),
			accountRef: String(pkg.name).replace(/\s+/g, "").slice(0, 12),
			description: `TelNet ${pkg.name}`
		});
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Could not send the M-Pesa prompt. Please try again."
		};
	}
	await sql`
      insert into payments (
        id, customer_id, package_id, checkout_request_id, merchant_request_id,
        phone, amount, status, activation_status
      ) values (
        ${paymentId}, ${customerId}, ${pkg.id}, ${stk.checkoutRequestId},
        ${stk.merchantRequestId}, ${phone}, ${pkg.price}, 'PENDING', 'NOT_ACTIVATED'
      )
    `;
	return {
		ok: true,
		paymentId,
		customerId,
		checkoutRequestId: stk.checkoutRequestId,
		amount: Number(pkg.price),
		packageName: String(pkg.name),
		phone
	};
});
var getPaymentStatus_createServerFn_handler = createServerRpc({
	id: "deb9f18db71599990d6c96a2d7334ebff8d01e0f2a0514952961cbee51a3399f",
	name: "getPaymentStatus",
	filename: "src/lib/fn/portal.ts"
}, (opts) => getPaymentStatus.__executeServer(opts));
var getPaymentStatus = createServerFn({ method: "POST" }).validator((data) => object({ paymentId: string() }).parse(data)).handler(getPaymentStatus_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const rows = await sql`
      select p.*, pkg.name as package_name
      from payments p join packages pkg on pkg.id = p.package_id
      where p.id = ${data.paymentId}
      limit 1
    `;
	if (!rows[0]) return {
		ok: false,
		error: "Payment not found."
	};
	let payment = mapPayment(rows[0]);
	if (payment.status === "PENDING" && payment.checkoutRequestId) try {
		const q = await queryStkStatus(payment.checkoutRequestId);
		const still = q.resultCode < 0 || q.resultCode === 4999 || /progress|processing|not found|under process/i.test(q.resultDesc);
		if (q.resultCode === 0 || q.resultCode === 1032 || q.resultCode > 0 && !still) {
			const { settlePendingByCheckout } = await import("./callback.server-D3i_WM1b.mjs");
			await settlePendingByCheckout({
				checkoutRequestId: payment.checkoutRequestId,
				resultCode: q.resultCode,
				resultDesc: q.resultDesc,
				receipt: null
			});
			const again = await sql`
            select p.*, pkg.name as package_name
            from payments p join packages pkg on pkg.id = p.package_id
            where p.id = ${data.paymentId}
            limit 1
          `;
			if (again[0]) payment = mapPayment(again[0]);
		}
	} catch {}
	let access = null;
	if (payment.status === "SUCCESS") access = await findActiveForCustomer(payment.customerId);
	return {
		ok: true,
		payment,
		access
	};
});
var recoverPackage_createServerFn_handler = createServerRpc({
	id: "da3c52133f84d72af6d108a241cb879a8af4ae9ff8d225df302be1c3e3830fe4",
	name: "recoverPackage",
	filename: "src/lib/fn/portal.ts"
}, (opts) => recoverPackage.__executeServer(opts));
var recoverPackage = createServerFn({ method: "POST" }).validator((data) => object({
	transactionId: string().min(6).max(20),
	token: string().min(8),
	phone: string().optional(),
	deviceInfo: string().optional()
}).parse(data)).handler(recoverPackage_createServerFn_handler, async ({ data }) => {
	const sql = await getSql();
	const tx = data.transactionId.trim().toUpperCase();
	const phone = data.phone ? normalizeKenyanPhone(data.phone) : null;
	const recent = await sql`
      select count(*)::int as n from recovery_attempts
      where created_at > now() - interval '10 minutes'
        and (transaction_id = ${tx} or ${phone}::text is not null and phone = ${phone})
    `;
	if (Number(recent[0]?.n ?? 0) >= 8) return {
		ok: false,
		error: "Too many recovery attempts. Please wait a few minutes and try again."
	};
	const row = (await sql`
      select p.*, pkg.name as package_name, pkg.price
      from payments p
      join packages pkg on pkg.id = p.package_id
      where upper(p.mpesa_transaction_id) = ${tx}
      limit 1
    `)[0];
	await sql`
      insert into recovery_attempts (id, phone, transaction_id, success)
      values (${nid("rec")}, ${phone}, ${tx}, ${Boolean(row) && String(row.status) === "SUCCESS"})
    `;
	if (!row) return {
		ok: false,
		error: "Transaction not found. Please check your M-Pesa transaction ID and try again."
	};
	if (String(row.status) !== "SUCCESS") return {
		ok: false,
		error: "This M-Pesa transaction was not successful."
	};
	if (!(Number(row.amount) === Number(row.price))) return {
		ok: false,
		error: "Transaction not found. Please check your M-Pesa transaction ID and try again."
	};
	const pack = (await sql`
      select cp.*, pkg.name as package_name
      from customer_packages cp
      join packages pkg on pkg.id = cp.package_id
      where cp.payment_id = ${row.id}
      limit 1
    `)[0];
	if (pack && (String(pack.status) === "EXPIRED" || new Date(String(pack.expiry_time)).getTime() <= Date.now())) return {
		ok: false,
		code: "expired",
		error: "Your package has expired. Please purchase a new package."
	};
	const activation = await activateFromPayment(String(row.id), {
		token: data.token,
		info: data.deviceInfo
	});
	if (!activation.ok) return activationFailure(activation, mapPayment(row));
	return {
		ok: true,
		message: "Payment confirmed. Reconnecting your package...",
		alreadyActive: Boolean(String(row.activation_status) === "ACTIVATED" && pack && String(pack.status) === "ACTIVE"),
		activation,
		payment: mapPayment(row)
	};
});
var connectActive_createServerFn_handler = createServerRpc({
	id: "8d20a2a9ffe5954af479b246157120d1cfec7beb1e10512ef7ae10146f85c784",
	name: "connectActive",
	filename: "src/lib/fn/portal.ts"
}, (opts) => connectActive.__executeServer(opts));
var connectActive = createServerFn({ method: "POST" }).validator((data) => object({
	token: string().min(8),
	phone: string().optional(),
	customerId: string().optional(),
	deviceInfo: string().optional()
}).parse(data)).handler(connectActive_createServerFn_handler, async ({ data }) => {
	await expireDuePackages();
	const sql = await getSql();
	const settings = await getSettings();
	if (!(await sql`select * from isps`).map(mapIsp).some((i) => i.status !== "OFFLINE")) return {
		ok: false,
		code: "offline",
		error: "Internet connection is currently unavailable. Please try again later."
	};
	let customerId = data.customerId ?? null;
	if (!customerId && data.token) customerId = (await sql`
        select id from customers where device_token = ${data.token} limit 1
      `)[0]?.id ?? null;
	if (!customerId && data.phone) {
		const p = normalizeKenyanPhone(data.phone);
		if (p) customerId = (await sql`
          select id from customers where phone = ${p} limit 1
        `)[0]?.id ?? null;
	}
	if (!customerId) return {
		ok: false,
		error: "No active package found on this device."
	};
	const result = await reconnectCustomer(customerId, {
		token: data.token,
		info: data.deviceInfo
	});
	if (!result.ok) {
		if (result.reason === "in_use") return {
			ok: false,
			code: "in_use",
			error: PACKAGE_IN_USE_MESSAGE
		};
		if (result.reason === "expired" || result.reason === "none") return {
			ok: false,
			code: "expired",
			error: "Your package has expired. Please purchase a new package."
		};
		if (result.reason === "blocked") return {
			ok: false,
			error: "This number is blocked. Please contact the hotspot operator."
		};
		return {
			ok: false,
			code: "router",
			error: "Payment received. Your package could not be activated yet. Please use 'Already Paid?' to reconnect."
		};
	}
	return {
		ok: true,
		pack: result.pack,
		hotspotName: settings.hotspotName
	};
});
var getAccount_createServerFn_handler = createServerRpc({
	id: "9058042af9e4ae73e9b4352eea04d5cdb22276c242cfbcd58fca3899b3e1f4a1",
	name: "getAccount",
	filename: "src/lib/fn/portal.ts"
}, (opts) => getAccount.__executeServer(opts));
var getAccount = createServerFn({ method: "POST" }).validator((data) => identitySchema.parse(data)).handler(getAccount_createServerFn_handler, async ({ data }) => {
	await expireDuePackages();
	let access = null;
	if (data.customerId) access = await findActiveForCustomer(data.customerId, data.token);
	if (!access && data.token) {
		const t = await (await getSql())`
        select id from customers where device_token = ${data.token} limit 1
      `;
		if (t[0]) access = await findActiveForCustomer(t[0].id, data.token);
	}
	if (!access && data.phone) {
		const p = normalizeKenyanPhone(data.phone);
		if (p) {
			const t = await (await getSql())`
          select id from customers where phone = ${p} limit 1
        `;
			if (t[0]) access = await findActiveForCustomer(t[0].id, data.token);
		}
	}
	const settings = await getSettings();
	return {
		access,
		hotspotName: settings.hotspotName,
		currency: settings.currency
	};
});
var redeemVoucherPortal_createServerFn_handler = createServerRpc({
	id: "f287903b5351366a758ac94a7e9c86d2345286f74634a6788428e82edd89d389",
	name: "redeemVoucherPortal",
	filename: "src/lib/fn/portal.ts"
}, (opts) => redeemVoucherPortal.__executeServer(opts));
var redeemVoucherPortal = createServerFn({ method: "POST" }).validator((data) => object({
	code: string().min(4).max(32),
	phone: string().min(9).max(15),
	deviceToken: string().optional()
}).parse(data)).handler(redeemVoucherPortal_createServerFn_handler, async ({ data }) => {
	try {
		return {
			ok: true,
			...await redeemVoucher({
				code: data.code,
				phone: data.phone,
				deviceToken: data.deviceToken
			})
		};
	} catch (e) {
		return {
			ok: false,
			error: e instanceof Error ? e.message : "Redeem failed"
		};
	}
});
//#endregion
export { connectActive_createServerFn_handler, getAccount_createServerFn_handler, getPaymentStatus_createServerFn_handler, getPortalBootstrap_createServerFn_handler, getPortalCatalog_createServerFn_handler, listPortalPackages_createServerFn_handler, recoverPackage_createServerFn_handler, redeemVoucherPortal_createServerFn_handler, startPayment_createServerFn_handler };
