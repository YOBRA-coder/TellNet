import { r as getSql } from "./db-8ZrWNzfw.mjs";
import { a as nid } from "./utils-DITYiIRO.mjs";
import { r as logEvent } from "./settings.server-DGdR6vBM.mjs";
import { t as activateFromPayment } from "./mpesa.server-BgRtZTCv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/vouchers.server-RDMNoJ5u.js
function randomCode(len = 10) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let s = "";
	for (let i = 0; i < len; i++) s += alphabet[Math.floor(Math.random() * 32)];
	return s;
}
async function generateVouchers(input) {
	const sql = await getSql();
	const pkg = (await sql`select * from packages where id = ${input.packageId} and status = 'ACTIVE' limit 1`)[0];
	if (!pkg) throw new Error("Package not found.");
	const count = Math.min(500, Math.max(1, input.count));
	const codes = [];
	for (let i = 0; i < count; i++) {
		let code = randomCode(10);
		for (let t = 0; t < 5; t++) {
			if (!(await sql`select 1 from vouchers where code = ${code} limit 1`).length) break;
			code = randomCode(10);
		}
		await sql`
      insert into vouchers (
        id, code, package_id, site_id, status, batch_label, expires_at
      ) values (
        ${nid("vch")}, ${code}, ${input.packageId},
        ${input.siteId ?? pkg.site_id ?? "site_default"},
        'AVAILABLE', ${input.batchLabel ?? null},
        ${input.expiresAt ?? null}
      )
    `;
		codes.push(code);
	}
	await logEvent("VOUCHER", `Generated ${codes.length} vouchers for ${pkg.name}.`);
	return codes;
}
async function redeemVoucher(input) {
	const sql = await getSql();
	const code = input.code.trim().toUpperCase();
	const phone = input.phone.replace(/\D/g, "");
	const normalized = phone.startsWith("254") && phone.length === 12 ? phone : phone.startsWith("0") && phone.length === 10 ? `254${phone.slice(1)}` : phone.length === 9 && phone.startsWith("7") ? `254${phone}` : null;
	if (!normalized) throw new Error("Enter a valid M-Pesa phone number.");
	const v = (await sql`
      select * from vouchers where code = ${code} limit 1
    `)[0];
	if (!v) throw new Error("Invalid voucher code.");
	if (String(v.status) !== "AVAILABLE") throw new Error("This voucher was already used.");
	if (v.expires_at && new Date(String(v.expires_at)).getTime() < Date.now()) {
		await sql`update vouchers set status = 'EXPIRED', updated_at = now() where id = ${v.id}`;
		throw new Error("This voucher has expired.");
	}
	const pkg = (await sql`select * from packages where id = ${v.package_id} limit 1`)[0];
	if (!pkg || String(pkg.status) !== "ACTIVE") throw new Error("Package for this voucher is unavailable.");
	let customer = (await sql`select * from customers where phone = ${normalized} limit 1`)[0];
	if (!customer) {
		const cid = nid("cus");
		await sql`
      insert into customers (id, phone, device_token, status, site_id)
      values (${cid}, ${normalized}, ${input.deviceToken ?? null}, 'ACTIVE', ${v.site_id ?? "site_default"})
    `;
		customer = (await sql`select * from customers where id = ${cid}`)[0];
	}
	if (String(customer.status) === "BLOCKED") throw new Error("This phone is blocked. Contact the operator.");
	const paymentId = nid("pay");
	await sql`
    insert into payments (
      id, customer_id, package_id, mpesa_transaction_id, phone, amount,
      status, activation_status, result_code, result_desc, transaction_date,
      site_id, created_at, updated_at
    ) values (
      ${paymentId}, ${customer.id}, ${pkg.id}, ${"VCH-" + code}, ${normalized},
      ${pkg.price}, 'SUCCESS', 'NOT_ACTIVATED', 0, 'Voucher redeemed',
      now(), ${v.site_id ?? "site_default"}, now(), now()
    )
  `;
	await sql`
    update vouchers
    set status = 'REDEEMED',
        redeemed_by_customer_id = ${customer.id},
        redeemed_payment_id = ${paymentId},
        redeemed_at = now(),
        updated_at = now()
    where id = ${v.id} and status = 'AVAILABLE'
  `;
	const act = await activateFromPayment(paymentId, { token: input.deviceToken ?? void 0 });
	return {
		paymentId,
		packageName: String(pkg.name),
		activationOk: act.ok
	};
}
async function listVouchers(filter) {
	const sql = await getSql();
	const limit = filter?.limit ?? 100;
	if (filter?.status) return sql`
      select v.*, p.name as package_name
      from vouchers v join packages p on p.id = v.package_id
      where v.status = ${filter.status}
      order by v.created_at desc
      limit ${limit}
    `;
	return sql`
    select v.*, p.name as package_name
    from vouchers v join packages p on p.id = v.package_id
    order by v.created_at desc
    limit ${limit}
  `;
}
//#endregion
export { listVouchers as n, redeemVoucher as r, generateVouchers as t };
