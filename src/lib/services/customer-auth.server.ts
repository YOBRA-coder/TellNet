import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { normalizeKenyanPhone } from "@/lib/phone";
import {
  addCustomerNotice,
  findCustomerByReferralCode,
  generateReferralCode,
} from "@/lib/services/loyalty.server";
import { getSettings, logEvent } from "@/lib/services/settings.server";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export function validateSecret(secret: string): string | null {
  if (secret.length < 4) return "Use at least 4 characters for your PIN or password.";
  if (secret.length > 64) return "That PIN or password is too long.";
  if (/^(\d)\1+$/.test(secret)) return "Pick a PIN that isn't the same digit repeated.";
  return null;
}

export function hashSecret(secret: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(secret, salt, 32).toString("hex");
  return { hash, salt };
}

function verifySecret(secret: string, hash: string, salt: string): boolean {
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(secret, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function maskPhone(phone: string): string {
  const p = phone.replace(/\D/g, "");
  return p.length >= 9 ? `${p.slice(0, 4)}•••${p.slice(-3)}` : "a friend";
}

export type SessionCustomer = {
  id: string;
  phone: string;
  registered: boolean;
};

/**
 * Who is signed in on this device? Only a row in customer_sessions counts —
 * a customerId sent from the browser is never trusted on its own.
 */
export async function getSessionCustomer(
  token: string | undefined | null,
): Promise<SessionCustomer | null> {
  if (!token || token.length < 8) return null;
  const sql = await getSql();
  const rows = await sql<{ id: string; phone: string; registered_at: string | null; status: string }>`
    select c.id, c.phone, c.registered_at, c.status
    from customer_sessions s
    join customers c on c.id = s.customer_id
    where s.device_token = ${token} and c.deleted_at is null
    limit 1
  `;
  const row = rows[0];
  if (!row || row.status === "BLOCKED") return null;
  return { id: row.id, phone: row.phone, registered: Boolean(row.registered_at) };
}

async function startSession(token: string, customerId: string) {
  const sql = await getSql();
  await sql`
    insert into customer_sessions (device_token, customer_id)
    values (${token}, ${customerId})
    on conflict (device_token) do update
      set customer_id = excluded.customer_id, last_seen = now()
  `;
}

export async function signOutDevice(token: string) {
  const sql = await getSql();
  await sql`delete from customer_sessions where device_token = ${token}`;
}

/**
 * Referral link created (someone joined or paid with a code): tell the
 * referrer right away, and tell the new person what they're getting.
 */
async function announceReferral(referrerId: string, friendPhone: string, friendId: string | null) {
  const s = await getSettings();
  await addCustomerNotice(
    referrerId,
    "REFERRAL_JOINED",
    `${maskPhone(friendPhone)} just joined using your referral code. You'll get ${s.referralBonusMinutes} bonus minutes as soon as they pay for their first package with M-Pesa.`,
    0,
  );
  if (friendId) {
    await addCustomerNotice(
      friendId,
      "REFERRAL_APPLIED",
      `Referral code applied. ${s.welcomeBonusMinutes + s.referralBonusMinutes} bonus minutes will be added to your first M-Pesa package.`,
      0,
    );
  }
}

export { announceReferral };

export type SignUpResult =
  | { ok: true; customerId: string; phone: string; referralCode: string | null; referralApplied: boolean }
  | { ok: false; error: string; code?: "claim_required" | "exists" };

export async function signUpCustomer(input: {
  phone: string;
  secret: string;
  token: string;
  referralCode?: string;
  claimTransactionId?: string;
}): Promise<SignUpResult> {
  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid Kenyan phone number." };
  const bad = validateSecret(input.secret);
  if (bad) return { ok: false, error: bad };

  const sql = await getSql();
  const settings = await getSettings();
  const existing = await sql<{
    id: string;
    status: string;
    registered_at: string | null;
    referred_by_customer_id: string | null;
    referral_bonus_paid: boolean;
  }>`
    select id, status, registered_at, referred_by_customer_id, referral_bonus_paid
    from customers where phone = ${phone} and deleted_at is null limit 1
  `;
  const row = existing[0];
  if (row?.status === "BLOCKED") {
    return { ok: false, error: "This number is blocked. Please contact the hotspot operator." };
  }
  if (row?.registered_at) {
    return {
      ok: false,
      code: "exists",
      error: "This number already has an account. Sign in instead.",
    };
  }

  // Someone who already bought as a guest owns paid history on this number.
  // With no SMS verification available, prove ownership with an M-Pesa
  // receipt from one of their payments so nobody can claim another
  // person's number just by typing it.
  if (row) {
    const paid = await sql<{ mpesa_transaction_id: string }>`
      select mpesa_transaction_id from payments
      where customer_id = ${row.id} and status = 'SUCCESS' and mpesa_transaction_id is not null
        and mpesa_transaction_id not like 'PTS-%' and mpesa_transaction_id not like 'VCH-%'
    `;
    if (paid.length > 0) {
      const claim = (input.claimTransactionId ?? "").trim().toUpperCase();
      if (!claim) {
        return {
          ok: false,
          code: "claim_required",
          error:
            "This number already bought internet here. Enter an M-Pesa transaction code from one of your payments (e.g. QGH7XXXXXX) to claim it.",
        };
      }
      if (!paid.some((p) => String(p.mpesa_transaction_id).toUpperCase() === claim)) {
        return { ok: false, code: "claim_required", error: "That M-Pesa code doesn't match this number." };
      }
    }
  }

  let referrerId: string | null = null;
  if (settings.referralEnabled && input.referralCode?.trim()) {
    const referrer = await findCustomerByReferralCode(input.referralCode);
    if (!referrer) {
      return { ok: false, error: "That referral code doesn't exist. Check it or leave it blank." };
    }
    if (row && referrer.id === row.id) {
      return { ok: false, error: "You can't use your own referral code." };
    }
    referrerId = referrer.id;
  }

  const { hash, salt } = hashSecret(input.secret);
  const referralCode = await generateReferralCode();
  let customerId = row?.id;
  let referralApplied = false;

  if (!customerId) {
    customerId = nid("cus");
    await sql`
      insert into customers (
        id, phone, device_token, status, referral_code, referred_by_customer_id,
        pin_hash, pin_salt, registered_at
      ) values (
        ${customerId}, ${phone}, ${input.token}, 'ACTIVE', ${referralCode}, ${referrerId},
        ${hash}, ${salt}, now()
      )
    `;
    referralApplied = Boolean(referrerId);
  } else {
    // A guest who never used a code (and hasn't been paid a referral bonus)
    // may still attach one while registering.
    const attach = Boolean(referrerId && !row!.referred_by_customer_id && !row!.referral_bonus_paid);
    await sql`
      update customers set
        pin_hash = ${hash}, pin_salt = ${salt}, registered_at = now(),
        referral_code = coalesce(referral_code, ${referralCode}),
        referred_by_customer_id = ${attach ? referrerId : row!.referred_by_customer_id},
        failed_pin_attempts = 0, pin_locked_until = null, updated_at = now()
      where id = ${customerId}
    `;
    referralApplied = attach;
  }

  await startSession(input.token, customerId);
  if (referralApplied && referrerId) await announceReferral(referrerId, phone, customerId);
  await logEvent("CUSTOMER", `Customer account created for ${phone}.`);

  const code = (
    await sql<{ referral_code: string | null }>`select referral_code from customers where id = ${customerId}`
  )[0]?.referral_code;
  return { ok: true, customerId, phone, referralCode: code ?? null, referralApplied };
}

export type SignInResult =
  | { ok: true; customerId: string; phone: string }
  | { ok: false; error: string };

export async function signInCustomer(input: {
  phone: string;
  secret: string;
  token: string;
}): Promise<SignInResult> {
  const phone = normalizeKenyanPhone(input.phone);
  const generic = "Wrong phone number or PIN/password.";
  if (!phone) return { ok: false, error: "Enter a valid Kenyan phone number." };
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    status: string;
    pin_hash: string | null;
    pin_salt: string | null;
    failed_pin_attempts: number;
    pin_locked_until: string | null;
  }>`
    select id, status, pin_hash, pin_salt, failed_pin_attempts, pin_locked_until
    from customers where phone = ${phone} and deleted_at is null limit 1
  `;
  const row = rows[0];
  if (!row || !row.pin_hash || !row.pin_salt) {
    return {
      ok: false,
      error: row
        ? "This number has no account yet. Create one with Sign up."
        : generic,
    };
  }
  if (row.status === "BLOCKED") {
    return { ok: false, error: "This number is blocked. Please contact the hotspot operator." };
  }
  if (row.pin_locked_until && new Date(row.pin_locked_until).getTime() > Date.now()) {
    return {
      ok: false,
      error: `Too many wrong attempts. Try again in a few minutes, or ask the operator to reset your PIN.`,
    };
  }
  if (!verifySecret(input.secret, row.pin_hash, row.pin_salt)) {
    const attempts = Number(row.failed_pin_attempts) + 1;
    if (attempts >= MAX_FAILED) {
      await sql`
        update customers set failed_pin_attempts = 0,
          pin_locked_until = now() + (${LOCK_MINUTES} || ' minutes')::interval
        where id = ${row.id}
      `;
    } else {
      await sql`update customers set failed_pin_attempts = ${attempts} where id = ${row.id}`;
    }
    return { ok: false, error: generic };
  }
  await sql`
    update customers set failed_pin_attempts = 0, pin_locked_until = null,
      device_token = ${input.token}, updated_at = now()
    where id = ${row.id}
  `;
  await startSession(input.token, row.id);
  return { ok: true, customerId: row.id, phone };
}

const RESET_MAX_FAILED = 5;
const RESET_LOCK_MINUTES = 30;

/**
 * Customer-side "I forgot my PIN/password". There is no SMS gateway, so the
 * customer proves the number is theirs with the code from an M-Pesa message
 * for a payment made from it (the same proof sign-up uses to claim a number
 * that already bought as a guest). Wrong guesses are counted separately from
 * normal sign-in so someone guessing receipts can't lock the real owner out
 * of signing in. A customer with no paid M-Pesa history can't be verified
 * this way and is sent to the operator.
 */
export async function resetCustomerSecretWithReceipt(input: {
  phone: string;
  transactionId: string;
  next: string;
  token: string;
}): Promise<SignInResult> {
  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid Kenyan phone number." };
  const bad = validateSecret(input.next);
  if (bad) return { ok: false, error: bad };
  const code = input.transactionId.trim().toUpperCase();
  if (!/^[A-Z0-9]{8,14}$/.test(code)) {
    return { ok: false, error: "Enter the M-Pesa transaction code from your payment message (e.g. QGH7XXXXXX)." };
  }
  const generic =
    "We couldn't verify that. Check the phone number and M-Pesa code, or ask the hotspot operator to reset your PIN.";

  const sql = await getSql();
  const row = (
    await sql<{
      id: string;
      status: string;
      registered_at: string | null;
      reset_failed_attempts: number;
      reset_locked_until: string | null;
    }>`
      select id, status, registered_at, reset_failed_attempts, reset_locked_until
      from customers where phone = ${phone} and deleted_at is null limit 1
    `
  )[0];
  if (!row) return { ok: false, error: generic };
  if (row.status === "BLOCKED") {
    return { ok: false, error: "This number is blocked. Please contact the hotspot operator." };
  }
  if (!row.registered_at) {
    return { ok: false, error: "This number has no account yet. Create one with Sign up." };
  }
  if (row.reset_locked_until && new Date(row.reset_locked_until).getTime() > Date.now()) {
    return {
      ok: false,
      error: "Too many wrong attempts. Try again later, or ask the hotspot operator to reset your PIN.",
    };
  }

  const paid = await sql<{ mpesa_transaction_id: string }>`
    select mpesa_transaction_id from payments
    where customer_id = ${row.id} and status = 'SUCCESS' and mpesa_transaction_id is not null
      and mpesa_transaction_id not like 'PTS-%' and mpesa_transaction_id not like 'VCH-%'
  `;
  const match = paid.some((p) => String(p.mpesa_transaction_id).toUpperCase() === code);
  if (!match) {
    const attempts = Number(row.reset_failed_attempts) + 1;
    if (attempts >= RESET_MAX_FAILED) {
      await sql`
        update customers set reset_failed_attempts = 0,
          reset_locked_until = now() + (${RESET_LOCK_MINUTES} || ' minutes')::interval
        where id = ${row.id}
      `;
    } else {
      await sql`update customers set reset_failed_attempts = ${attempts} where id = ${row.id}`;
    }
    return { ok: false, error: generic };
  }

  const { hash, salt } = hashSecret(input.next);
  await sql`
    update customers set pin_hash = ${hash}, pin_salt = ${salt},
      failed_pin_attempts = 0, pin_locked_until = null,
      reset_failed_attempts = 0, reset_locked_until = null,
      device_token = ${input.token}, updated_at = now()
    where id = ${row.id}
  `;
  // Everyone else signed in as this number is signed out; this device is signed in.
  await sql`delete from customer_sessions where customer_id = ${row.id}`;
  await startSession(input.token, row.id);
  await logEvent("CUSTOMER", `Customer ${phone} reset their own PIN/password with an M-Pesa receipt.`);
  return { ok: true, customerId: row.id, phone };
}

/**
 * Operator-side reset. With `chosen` the operator sets exactly the PIN or
 * password the customer asked for (easier to remember); without it a random
 * 6-digit PIN is generated. Returns the secret that was set.
 */
export async function resetCustomerPin(customerId: string, chosen?: string): Promise<string> {
  if (chosen != null && chosen !== "") {
    const bad = validateSecret(chosen);
    if (bad) throw new Error(bad);
  }
  const pin = chosen ? chosen : String(100000 + Math.floor(Math.random() * 900000));
  const { hash, salt } = hashSecret(pin);
  const sql = await getSql();
  const referralCode = await generateReferralCode();
  await sql`
    update customers set
      pin_hash = ${hash}, pin_salt = ${salt},
      registered_at = coalesce(registered_at, now()),
      referral_code = coalesce(referral_code, ${referralCode}),
      failed_pin_attempts = 0, pin_locked_until = null, updated_at = now()
    where id = ${customerId}
  `;
  await sql`delete from customer_sessions where customer_id = ${customerId}`;
  return pin;
}

/** Customer-side: change your own PIN/password (must know the current one). */
export async function changeCustomerSecret(input: {
  token: string;
  current: string;
  next: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const member = await getSessionCustomer(input.token);
  if (!member?.registered) return { ok: false, error: "Sign in first." };
  const bad = validateSecret(input.next);
  if (bad) return { ok: false, error: bad };
  const sql = await getSql();
  const row = (
    await sql<{ pin_hash: string | null; pin_salt: string | null }>`
      select pin_hash, pin_salt from customers where id = ${member.id} limit 1
    `
  )[0];
  if (!row?.pin_hash || !row.pin_salt || !verifySecret(input.current, row.pin_hash, row.pin_salt)) {
    return { ok: false, error: "Your current PIN/password is wrong." };
  }
  const { hash, salt } = hashSecret(input.next);
  await sql`
    update customers set pin_hash = ${hash}, pin_salt = ${salt}, failed_pin_attempts = 0,
      pin_locked_until = null, updated_at = now()
    where id = ${member.id}
  `;
  // Keep this device signed in; sign every other device out.
  await sql`delete from customer_sessions where customer_id = ${member.id} and device_token <> ${input.token}`;
  return { ok: true };
}
