import { r as getSql } from "./db-8ZrWNzfw.mjs";
import { r as logEvent } from "./settings.server-DGdR6vBM.mjs";
import { s as parseCallback, t as activateFromPayment } from "./mpesa.server-BgRtZTCv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/callback.server-D3i_WM1b.js
/**
* Idempotent settle: only PENDING → SUCCESS/FAILED once.
* Activation failures leave SUCCESS + ACTIVATION_FAILED and schedule retry.
*/
async function settlePendingByCheckout(input) {
	const sql = await getSql();
	const pay = (await sql`
    select id, status, activation_status, mpesa_transaction_id from payments
    where checkout_request_id = ${input.checkoutRequestId}
    limit 1
  `)[0];
	if (!pay) return false;
	if (pay.status === "SUCCESS") {
		if (pay.activation_status === "ACTIVATION_FAILED" || pay.activation_status === "NOT_ACTIVATED") {
			await queueActivationRetry(pay.id, null);
			await activateFromPayment(pay.id);
		}
		return true;
	}
	if (pay.status !== "PENDING") return false;
	if (input.resultCode === 0) {
		if (!(await sql`
      update payments
      set status = 'SUCCESS',
          mpesa_transaction_id = coalesce(${input.receipt}, mpesa_transaction_id),
          result_code = ${input.resultCode},
          result_desc = ${input.resultDesc},
          transaction_date = coalesce(transaction_date, now()),
          callback_received_at = now(),
          updated_at = now()
      where id = ${pay.id} and status = 'PENDING'
      returning id
    `).length) return true;
		await logEvent("PAYMENT", `M-Pesa ${input.receipt ?? pay.id} settled.`);
		const result = await activateFromPayment(pay.id);
		if (!result.ok) {
			await queueActivationRetry(pay.id, result.reason === "router" ? "Router unavailable after successful payment" : result.reason || "Activation failed");
			await logEvent("ACTIVATION_FAILED", `Payment ${input.receipt ?? pay.id} paid but activation failed. Queued for retry.`);
		}
		return true;
	}
	await sql`
    update payments
    set status = ${input.resultCode === 1032 ? "CANCELLED" : "FAILED"},
        result_code = ${input.resultCode},
        result_desc = ${input.resultDesc},
        callback_received_at = now(),
        updated_at = now()
    where id = ${pay.id} and status = 'PENDING'
  `;
	return true;
}
async function queueActivationRetry(paymentId, error) {
	await (await getSql())`
    update payments
    set activation_status = 'ACTIVATION_FAILED',
        activation_attempts = activation_attempts + 1,
        last_activation_error = ${error},
        next_activation_retry_at = now() + interval '2 minutes',
        updated_at = now()
    where id = ${paymentId}
  `;
}
/** Process due activation retries (SUCCESS money, failed router). */
async function processActivationRetries(limit = 20) {
	const sql = await getSql();
	const due = await sql`
    select id, activation_attempts as attempts from payments
    where status = 'SUCCESS'
      and activation_status in ('ACTIVATION_FAILED', 'NOT_ACTIVATED')
      and (next_activation_retry_at is null or next_activation_retry_at <= now())
      and activation_attempts < 10
    order by updated_at asc
    limit ${limit}
  `;
	const results = [];
	for (const row of due) {
		const result = await activateFromPayment(row.id);
		if (result.ok) {
			await sql`
        update payments
        set last_activation_error = null,
            next_activation_retry_at = null,
            updated_at = now()
        where id = ${row.id}
      `;
			results.push({
				id: row.id,
				ok: true
			});
		} else {
			await queueActivationRetry(row.id, result.reason === "router" ? "Router still unavailable" : result.reason || "Activation failed");
			results.push({
				id: row.id,
				ok: false
			});
		}
	}
	return results;
}
async function handleMpesaCallback(request) {
	let body = {};
	try {
		body = await request.json();
	} catch {
		return new Response("invalid", { status: 400 });
	}
	const parsed = parseCallback(body);
	if (!parsed.checkoutRequestId) return Response.json({
		ResultCode: 0,
		ResultDesc: "Accepted"
	});
	await settlePendingByCheckout({
		checkoutRequestId: parsed.checkoutRequestId,
		resultCode: parsed.resultCode,
		resultDesc: parsed.resultDesc,
		receipt: parsed.receipt
	});
	return Response.json({
		ResultCode: 0,
		ResultDesc: "Accepted"
	});
}
//#endregion
export { handleMpesaCallback, processActivationRetries, settlePendingByCheckout };
