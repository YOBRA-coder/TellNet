import { getSql } from "@/lib/db";
import { parseCallback } from "./mpesa.server";
import { activateFromPayment } from "./activation.server";
import { logEvent } from "./settings.server";

/**
 * Idempotent settle: only PENDING → SUCCESS/FAILED once.
 * Activation failures leave SUCCESS + ACTIVATION_FAILED and schedule retry.
 */
export async function settlePendingByCheckout(input: {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  receipt: string | null;
}): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    status: string;
    activation_status: string;
    mpesa_transaction_id: string | null;
  }>`
    select id, status, activation_status, mpesa_transaction_id from payments
    where checkout_request_id = ${input.checkoutRequestId}
    limit 1
  `;
  const pay = rows[0];
  if (!pay) return false;

  // Already final money state — still try activation if paid but not activated
  if (pay.status === "SUCCESS") {
    if (
      pay.activation_status === "ACTIVATION_FAILED" ||
      pay.activation_status === "NOT_ACTIVATED"
    ) {
      await queueActivationRetry(pay.id, null);
      await activateFromPayment(pay.id);
    }
    return true;
  }
  if (pay.status !== "PENDING") return false;

  if (input.resultCode === 0) {
    const updated = await sql`
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
    `;
    if (!updated.length) return true; // lost race — another worker settled

    await logEvent("PAYMENT", `M-Pesa ${input.receipt ?? pay.id} settled.`);
    const result = await activateFromPayment(pay.id);
    if (!result.ok) {
      await queueActivationRetry(
        pay.id,
        result.reason === "router"
          ? "Router unavailable after successful payment"
          : result.reason || "Activation failed",
      );
      await logEvent(
        "ACTIVATION_FAILED",
        `Payment ${input.receipt ?? pay.id} paid but activation failed. Queued for retry.`,
      );
    }
    return true;
  }

  const cancelled = input.resultCode === 1032;
  await sql`
    update payments
    set status = ${cancelled ? "CANCELLED" : "FAILED"},
        result_code = ${input.resultCode},
        result_desc = ${input.resultDesc},
        callback_received_at = now(),
        updated_at = now()
    where id = ${pay.id} and status = 'PENDING'
  `;
  return true;
}

export async function queueActivationRetry(paymentId: string, error: string | null) {
  const sql = await getSql();
  await sql`
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
export async function processActivationRetries(limit = 20) {
  const sql = await getSql();
  const due = await sql<{ id: string; attempts: number }>`
    select id, activation_attempts as attempts from payments
    where status = 'SUCCESS'
      and activation_status in ('ACTIVATION_FAILED', 'NOT_ACTIVATED')
      and (next_activation_retry_at is null or next_activation_retry_at <= now())
      and activation_attempts < 10
    order by updated_at asc
    limit ${limit}
  `;
  const results: Array<{ id: string; ok: boolean }> = [];
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
      results.push({ id: row.id, ok: true });
    } else {
      await queueActivationRetry(
        row.id,
        result.reason === "router"
          ? "Router still unavailable"
          : result.reason || "Activation failed",
      );
      results.push({ id: row.id, ok: false });
    }
  }
  return results;
}

export async function handleMpesaCallback(request: Request): Promise<Response> {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return new Response("invalid", { status: 400 });
  }
  const parsed = parseCallback(body);
  if (!parsed.checkoutRequestId) {
    return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
  await settlePendingByCheckout({
    checkoutRequestId: parsed.checkoutRequestId,
    resultCode: parsed.resultCode,
    resultDesc: parsed.resultDesc,
    receipt: parsed.receipt,
  });
  return Response.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
