import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { logEvent } from "@/lib/services/settings.server";
import type { SqlRow } from "@/lib/services/rows.server";

function randomCodeSuffix() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/** Generates a unique referral code, retrying on the rare collision. */
export async function generateReferralCode(): Promise<string> {
  const sql = await getSql();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = "R" + randomCodeSuffix();
    const existing = await sql<{ id: string }>`
      select id from customers where referral_code = ${code} limit 1
    `;
    if (existing.length === 0) return code;
  }
  // Astronomically unlikely to reach here, but never block signup on it.
  return "R" + Date.now().toString(36).toUpperCase();
}

/**
 * Looks up the customer a referral code belongs to. Returns null for an
 * unknown code so callers can silently ignore a mistyped one rather than
 * failing the purchase over it.
 */
export async function findCustomerByReferralCode(
  code: string,
): Promise<{ id: string } | null> {
  const sql = await getSql();
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const rows = await sql<{ id: string }>`
    select id from customers where referral_code = ${trimmed} limit 1
  `;
  return rows[0] ?? null;
}

/**
 * Awards loyalty points for a completed payment, and — on that customer's
 * first-ever award — the referrer's bonus. Called from
 * activateFromPayment(), which runs on every real purchase AND every
 * resume/reconnect of an existing one, so this must be idempotent per
 * payment: the loyalty_awarded_at claim below only ever succeeds once for
 * a given payment id, however many times activateFromPayment() re-runs.
 */
export async function awardLoyaltyForPayment(paymentId: string): Promise<void> {
  const sql = await getSql();
  const settingsRow = (
    await sql<{ loyalty_enabled: boolean; loyalty_points_per_kes: number }>`
      select loyalty_enabled, loyalty_points_per_kes from settings limit 1
    `
  )[0];
  if (!settingsRow?.loyalty_enabled) return;

  const claimed = await sql<{
    id: string;
    customer_id: string;
    amount: number;
  }>`
    update payments set loyalty_awarded_at = now()
    where id = ${paymentId} and loyalty_awarded_at is null
    returning id, customer_id, amount
  `;
  const payment = claimed[0];
  if (!payment) return; // already awarded, or payment not found

  const points = Math.max(
    0,
    Math.floor(Number(payment.amount) * Number(settingsRow.loyalty_points_per_kes)),
  );
  if (points > 0) {
    await sql`
      insert into loyalty_ledger (id, customer_id, delta, reason, payment_id)
      values (${nid("lyl")}, ${payment.customer_id}, ${points}, 'EARNED_PURCHASE', ${paymentId})
    `;
    await sql`
      update customers set loyalty_points = loyalty_points + ${points}, updated_at = now()
      where id = ${payment.customer_id}
    `;
  }

  // Referral bonus is paid in minutes, not points — see
  // applyReferralMinutesForPayment() below, called separately from
  // activateFromPayment() so the minutes can be folded into the duration
  // of the package being activated right now.
}

/**
 * Credits `minutes` to a customer: extends their currently active package's
 * expiry immediately (and pushes the new timeout to the router), or — if
 * they have no active package right now — banks the minutes on their
 * account so the next package they activate starts with the extra time
 * already included.
 */
export async function addCustomerNotice(
  customerId: string,
  kind: string,
  message: string,
  minutes = 0,
): Promise<void> {
  try {
    const sql = await getSql();
    await sql`
      insert into customer_notices (id, customer_id, kind, message, minutes)
      values (${nid("ntc")}, ${customerId}, ${kind}, ${message}, ${minutes})
    `;
  } catch (err) {
    console.error("[notice] failed to record notice for", customerId, err);
  }
}

async function creditMinutesToCustomer(customerId: string, minutes: number): Promise<void> {
  if (minutes <= 0) return;
  const sql = await getSql();
  const active = await sql<{ id: string }>`
    select id from customer_packages
    where customer_id = ${customerId} and status = 'ACTIVE' and expiry_time > now()
    order by expiry_time desc
    limit 1
  `;
  if (active[0]) {
    await sql`
      update customer_packages
      set expiry_time = expiry_time + (${minutes} || ' minutes')::interval,
          updated_at = now()
      where id = ${active[0].id}
    `;
    // Anything already queued behind the running package was scheduled to
    // start at its OLD expiry — slide the whole queue back by the same
    // minutes so the bonus doesn't overlap (and silently eat) queued time.
    await sql`
      update customer_packages
      set start_time = start_time + (${minutes} || ' minutes')::interval,
          expiry_time = expiry_time + (${minutes} || ' minutes')::interval,
          updated_at = now()
      where customer_id = ${customerId} and status = 'QUEUED'
    `;
    // Best-effort: push the new session timeout to the router right away.
    // If this fails the extension is still correct in the ledger/DB and
    // will be picked up next time the package is (re)activated.
    try {
      const { reconnectCustomer } = await import("@/lib/services/activation.server");
      await reconnectCustomer(customerId);
    } catch (err) {
      console.error("[referral] live extend failed for", customerId, err);
    }
  } else {
    await sql`
      update customers
      set bonus_minutes_balance = bonus_minutes_balance + ${minutes}, updated_at = now()
      where id = ${customerId}
    `;
  }
}

/**
 * Applies the referral program for a completed payment, in minutes:
 *  - Any minutes this customer is owed from banked referrer credit are
 *    folded into the package being activated right now.
 *  - If this is the referred customer's first-ever qualifying payment
 *    (package price above settings.referralMinPackagePrice), they get a
 *    one-time welcome bonus + referral bonus added to that same package,
 *    and their referrer is credited the referral bonus separately.
 *
 * Returns the number of extra minutes to add to the duration of the
 * package being activated for paymentId right now. Idempotent per payment
 * via payments.referral_minutes_awarded_at, so calling this more than once
 * for the same payment (reconnects, auto-resume) only ever pays out once.
 */
export async function applyReferralMinutesForPayment(paymentId: string): Promise<number> {
  const sql = await getSql();

  const claimed = await sql<{ id: string; customer_id: string }>`
    update payments set referral_minutes_awarded_at = now()
    where id = ${paymentId} and referral_minutes_awarded_at is null
    returning id, customer_id
  `;
  const payment = claimed[0];
  if (!payment) return 0; // already processed for this payment

  let ownExtra = 0;

  // Banked minutes (from being a referrer earlier with no active package
  // at the time) always get applied to the next package a customer buys.
  const banked = await sql<{ bonus_minutes_balance: number }>`
    update customers set bonus_minutes_balance = 0, updated_at = now()
    where id = ${payment.customer_id} and bonus_minutes_balance > 0
    returning bonus_minutes_balance
  `;
  if (banked[0]) {
    ownExtra += Math.max(0, Math.floor(Number(banked[0].bonus_minutes_balance)));
  }

  const settingsRow = (
    await sql<{
      referral_enabled: boolean;
      referral_bonus_minutes: number;
      welcome_bonus_minutes: number;
      referral_min_package_price: number;
    }>`
      select referral_enabled, referral_bonus_minutes, welcome_bonus_minutes,
             referral_min_package_price
      from settings limit 1
    `
  )[0];
  if (!settingsRow?.referral_enabled) return ownExtra;

  const pkgPriceRow = (
    await sql<{ price: number }>`
      select pkg.price from payments p
      join packages pkg on pkg.id = p.package_id
      where p.id = ${paymentId} limit 1
    `
  )[0];
  const qualifies =
    pkgPriceRow != null &&
    Number(pkgPriceRow.price) > Number(settingsRow.referral_min_package_price);

  if (!qualifies) return ownExtra;

  // One-time claim on the referred customer, same pattern as before.
  const referral = await sql<{ referred_by_customer_id: string | null }>`
    update customers set referral_bonus_paid = true, updated_at = now()
    where id = ${payment.customer_id}
      and referred_by_customer_id is not null
      and referral_bonus_paid = false
    returning referred_by_customer_id
  `;
  const referrerId = referral[0]?.referred_by_customer_id;
  if (!referrerId) return ownExtra;

  const welcomeMinutes = Math.max(0, Math.floor(Number(settingsRow.welcome_bonus_minutes)));
  const referralMinutes = Math.max(0, Math.floor(Number(settingsRow.referral_bonus_minutes)));
  ownExtra += welcomeMinutes + referralMinutes;

  await logEvent(
    "REFERRAL",
    `Welcome bonus of ${welcomeMinutes + referralMinutes} min applied to ${payment.customer_id}'s first package (referred).`,
  );

  await creditMinutesToCustomer(referrerId, referralMinutes);
  await addCustomerNotice(
    referrerId,
    "REFERRAL_BONUS",
    `A friend you referred just bought their first package — ${referralMinutes} bonus minutes were added to your account.`,
    referralMinutes,
  );
  if (welcomeMinutes + referralMinutes > 0) {
    await addCustomerNotice(
      payment.customer_id,
      "WELCOME_BONUS",
      `Welcome! ${welcomeMinutes + referralMinutes} bonus minutes were added to your first package.`,
      welcomeMinutes + referralMinutes,
    );
  }
  await logEvent(
    "REFERRAL",
    `Referral bonus of ${referralMinutes} min credited to ${referrerId} for a referred customer's first qualifying purchase.`,
  );

  return ownExtra;
}

export type RedeemPointsResult =
  | { ok: true; paymentId: string; activationOk: boolean; queued: boolean }
  | { ok: false; error: string };

/**
 * Redeems a points-eligible package for a customer with enough balance.
 * Mirrors redeemVoucher()'s payment bookkeeping (a SUCCESS payment row
 * carrying the package's normal price for reporting, tagged distinctly in
 * mpesa_transaction_id) so it shows up consistently everywhere payments
 * already do, then activates it the same way every other payment does.
 */
export async function redeemPointsForPackage(input: {
  customerId: string;
  packageId: string;
  deviceToken?: string;
}): Promise<RedeemPointsResult> {
  const sql = await getSql();
  const { activateFromPayment } = await import("@/lib/services/activation.server");

  const pkgRows = await sql<SqlRow>`
    select * from packages where id = ${input.packageId} and status = 'ACTIVE' limit 1
  `;
  const pkg = pkgRows[0];
  if (!pkg || pkg.points_cost == null) {
    return { ok: false, error: "This package isn't redeemable with points." };
  }
  const cost = Number(pkg.points_cost);

  const custRows = await sql<{ id: string; phone: string; loyalty_points: number; status: string }>`
    select id, phone, loyalty_points, status from customers where id = ${input.customerId} limit 1
  `;
  const customer = custRows[0];
  if (!customer) return { ok: false, error: "Customer not found." };
  if (customer.status === "BLOCKED") {
    return { ok: false, error: "This account is blocked. Contact the operator." };
  }
  if (Number(customer.loyalty_points) < cost) {
    return { ok: false, error: `You need ${cost} points — you have ${customer.loyalty_points}.` };
  }

  // Atomic claim: only deduct if the balance is still sufficient at this
  // exact moment, so two simultaneous redemptions can't both succeed.
  const deducted = await sql<{ id: string }>`
    update customers set loyalty_points = loyalty_points - ${cost}, updated_at = now()
    where id = ${input.customerId} and loyalty_points >= ${cost}
    returning id
  `;
  if (deducted.length === 0) {
    return { ok: false, error: `You need ${cost} points — you have ${customer.loyalty_points}.` };
  }

  const paymentId = nid("pay");
  await sql`
    insert into payments (
      id, customer_id, package_id, mpesa_transaction_id, phone, amount,
      status, activation_status, result_code, result_desc, transaction_date,
      created_at, updated_at
    ) values (
      ${paymentId}, ${input.customerId}, ${input.packageId}, ${"PTS-" + paymentId}, ${customer.phone},
      ${pkg.price}, 'SUCCESS', 'NOT_ACTIVATED', 0, 'Redeemed with loyalty points',
      now(), now(), now()
    )
  `;
  await sql`
    insert into loyalty_ledger (id, customer_id, delta, reason, payment_id, package_id)
    values (${nid("lyl")}, ${input.customerId}, ${-cost}, 'REDEEMED', ${paymentId}, ${input.packageId})
  `;

  const act = await activateFromPayment(paymentId, {
    token: input.deviceToken ?? undefined,
  } as { token?: string });

  return {
    ok: true,
    paymentId,
    activationOk: act.ok,
    queued: act.ok && Boolean(act.queued),
  };
}
