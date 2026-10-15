/**
 * Operator console accounts (phone + password, SMS-code reset).
 * Mirrors the customer account code but is a separate table and separate OTP purpose,
 * so a customer code can never reset an operator and the other way round.
 */
import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { normalizeKenyanPhone } from "@/lib/phone";
import { hashSecret, verifySecret, maskPhone } from "@/lib/services/customer-auth.server";
import { getSettings, logEvent } from "@/lib/services/settings.server";
import { getSmsConfig, sendSms, smsReady } from "@/lib/services/sms.server";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const OTP_TTL_MIN = 10;
const OTP_MAX_TRIES = 5;
const OTP_RESEND_SECONDS = 60;
const OTP_MAX_PER_HOUR = 5;

export type OperatorRow = {
  id: string;
  name: string;
  phone: string;
  role: "OWNER" | "OPERATOR";
  /** the one site an operator is limited to; null for owners (all sites) */
  siteId: string | null;
  siteName: string | null;
  status: "ACTIVE" | "DISABLED";
  lastLoginAt: string | null;
  createdAt: string;
};

export function validateOperatorPassword(pw: string): string | null {
  if (pw.length < 6) return "Use at least 6 characters.";
  if (pw.length > 64) return "That password is too long.";
  return null;
}

export async function countOperators(): Promise<number> {
  const sql = await getSql();
  return Number((await sql<{ n: number }>`select count(*)::int as n from operators`)[0]?.n ?? 0);
}

export async function getOperatorLoginInfo(): Promise<{ legacy: boolean; otp: boolean }> {
  const n = await countOperators();
  const sms = smsReady(await getSmsConfig());
  return { legacy: n === 0, otp: n > 0 && sms };
}

type Row = Record<string, unknown>;
function map(r: Row): OperatorRow {
  return {
    id: String(r.id),
    name: String(r.name),
    phone: String(r.phone),
    role: r.role === "OWNER" ? "OWNER" : "OPERATOR",
    siteId: r.role === "OWNER" || !r.site_id ? null : String(r.site_id),
    siteName: r.site_name ? String(r.site_name) : null,
    status: r.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    lastLoginAt: r.last_login_at ? new Date(String(r.last_login_at)).toISOString() : null,
    createdAt: new Date(String(r.created_at)).toISOString(),
  };
}

export async function listOperators(): Promise<OperatorRow[]> {
  const sql = await getSql();
  return (await sql<Row>`select o.*, s.name as site_name from operators o left join sites s on s.id = o.site_id order by (o.role = 'OWNER') desc, o.created_at`).map(map);
}

export async function getOperatorById(id: string): Promise<OperatorRow | null> {
  const sql = await getSql();
  const r = (await sql<Row>`select o.*, s.name as site_name from operators o left join sites s on s.id = o.site_id where o.id = ${id} limit 1`)[0];
  return r ? map(r) : null;
}

export type LoginResult =
  | { ok: true; operator: OperatorRow }
  | { ok: false; error: string };

export async function loginWithPhone(input: { phone: string; password: string }): Promise<LoginResult> {
  const generic = "Wrong phone number or password.";
  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid Kenyan phone number." };
  const sql = await getSql();
  const r = (await sql<Row>`select * from operators where phone = ${phone} limit 1`)[0];
  if (!r) return { ok: false, error: generic };
  if (r.status === "DISABLED") return { ok: false, error: "This account is disabled. Ask the owner." };
  if (r.locked_until && new Date(String(r.locked_until)).getTime() > Date.now()) {
    return { ok: false, error: "Too many wrong attempts. Try again in a few minutes, or reset your password." };
  }
  if (!verifySecret(input.password, String(r.pw_hash), String(r.pw_salt))) {
    const attempts = Number(r.failed_attempts) + 1;
    if (attempts >= MAX_FAILED) {
      await sql`update operators set failed_attempts = 0, locked_until = now() + (${LOCK_MINUTES} || ' minutes')::interval where id = ${r.id}`;
      await logEvent("OPERATOR", `Operator ${maskPhone(phone)} locked for ${LOCK_MINUTES} minutes after wrong passwords.`);
    } else {
      await sql`update operators set failed_attempts = ${attempts} where id = ${r.id}`;
    }
    return { ok: false, error: generic };
  }
  await sql`update operators set failed_attempts = 0, locked_until = null, last_login_at = now() where id = ${r.id}`;
  return { ok: true, operator: map(r) };
}

async function ownerCount(excludeId?: string) {
  const sql = await getSql();
  return Number(
    (await sql<{ n: number }>`
      select count(*)::int as n from operators
      where role = 'OWNER' and status = 'ACTIVE' and (${excludeId ?? null}::text is null or id <> ${excludeId ?? null})`)[0]?.n ?? 0,
  );
}

export async function createOperator(input: {
  name: string;
  phone: string;
  password: string;
  role: "OWNER" | "OPERATOR";
  siteId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid Kenyan phone number." };
  const bad = validateOperatorPassword(input.password);
  if (bad) return { ok: false, error: bad };
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Enter a name." };
  const sql = await getSql();
  let siteId: string | null = null;
  if (input.role === "OPERATOR") {
    if (!input.siteId) return { ok: false, error: "Choose the site this operator works at." };
    if (!(await sql<{ id: string }>`select id from sites where id = ${input.siteId} limit 1`)[0]) return { ok: false, error: "That site does not exist." };
    siteId = input.siteId;
  }
  if ((await sql<{ id: string }>`select id from operators where phone = ${phone} limit 1`)[0]) {
    return { ok: false, error: "That phone number already has an account." };
  }
  const { hash, salt } = hashSecret(input.password);
  const id = nid("op");
  await sql`
    insert into operators (id, name, phone, pw_hash, pw_salt, role, site_id)
    values (${id}, ${name}, ${phone}, ${hash}, ${salt}, ${input.role}, ${siteId})`;
  await logEvent("OPERATOR", `Operator account created: ${name} (${maskPhone(phone)}, ${input.role}).`);
  return { ok: true, id };
}

export async function updateOperator(
  id: string,
  patch: { name?: string; phone?: string; role?: "OWNER" | "OPERATOR"; status?: "ACTIVE" | "DISABLED"; siteId?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await getSql();
  const cur = await getOperatorById(id);
  if (!cur) return { ok: false, error: "Account not found." };
  const role = patch.role ?? cur.role;
  const status = patch.status ?? cur.status;
  // The console must always keep at least one active owner.
  if ((role !== "OWNER" || status !== "ACTIVE") && cur.role === "OWNER" && cur.status === "ACTIVE" && (await ownerCount(id)) === 0) {
    return { ok: false, error: "Keep at least one active owner." };
  }
  let phone = cur.phone;
  if (patch.phone) {
    const p = normalizeKenyanPhone(patch.phone);
    if (!p) return { ok: false, error: "Enter a valid Kenyan phone number." };
    const clash = (await sql<{ id: string }>`select id from operators where phone = ${p} and id <> ${id} limit 1`)[0];
    if (clash) return { ok: false, error: "That phone number already has an account." };
    phone = p;
  }
  const name = (patch.name ?? cur.name).trim();
  if (name.length < 2) return { ok: false, error: "Enter a name." };
  // Owners see every site (no site); operators need exactly one.
  let siteId: string | null = role === "OWNER" ? null : patch.siteId !== undefined ? patch.siteId : cur.siteId;
  if (role === "OPERATOR") {
    if (!siteId) return { ok: false, error: "Choose the site this operator works at." };
    if (!(await sql<{ id: string }>`select id from sites where id = ${siteId} limit 1`)[0]) return { ok: false, error: "That site does not exist." };
  }
  await sql`update operators set name = ${name}, phone = ${phone}, role = ${role}, status = ${status}, site_id = ${siteId}, updated_at = now() where id = ${id}`;
  return { ok: true };
}

export async function deleteOperator(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cur = await getOperatorById(id);
  if (!cur) return { ok: true };
  if (cur.role === "OWNER" && cur.status === "ACTIVE" && (await ownerCount(id)) === 0) {
    return { ok: false, error: "Keep at least one active owner." };
  }
  const sql = await getSql();
  await sql`delete from operators where id = ${id}`;
  await logEvent("OPERATOR", `Operator account removed: ${cur.name}.`);
  return { ok: true };
}

export async function setOperatorPassword(id: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const bad = validateOperatorPassword(password);
  if (bad) return { ok: false, error: bad };
  const { hash, salt } = hashSecret(password);
  const sql = await getSql();
  await sql`update operators set pw_hash = ${hash}, pw_salt = ${salt}, failed_attempts = 0, locked_until = null, updated_at = now() where id = ${id}`;
  return { ok: true };
}

export async function changeOwnPassword(id: string, current: string, next: string) {
  const sql = await getSql();
  const r = (await sql<Row>`select pw_hash, pw_salt from operators where id = ${id} limit 1`)[0];
  if (!r || !verifySecret(current, String(r.pw_hash), String(r.pw_salt))) {
    return { ok: false as const, error: "Your current password is wrong." };
  }
  return setOperatorPassword(id, next);
}

/** Send a 6-digit reset code. Same answer for unknown numbers so accounts can't be probed. */
export async function requestOperatorOtp(input: { phone: string }): Promise<{ ok: boolean; error?: string; maskedPhone?: string }> {
  if (!smsReady(await getSmsConfig())) {
    return { ok: false, error: "SMS is not set up. Ask the owner to reset your password." };
  }
  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid Kenyan phone number." };
  const sql = await getSql();
  const masked = maskPhone(phone);
  const op = (await sql<Row>`select id, status from operators where phone = ${phone} limit 1`)[0];
  if (!op || op.status === "DISABLED") return { ok: true, maskedPhone: masked };
  const recent = await sql<{ created_at: string }>`
    select created_at from otp_codes
    where phone = ${phone} and purpose = 'OPERATOR_RESET' and created_at > now() - interval '1 hour'
    order by created_at desc`;
  if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < OTP_RESEND_SECONDS * 1000) {
    return { ok: false, error: "Please wait a minute before asking for another code." };
  }
  if (recent.length >= OTP_MAX_PER_HOUR) return { ok: false, error: "Too many codes requested. Try again in an hour." };
  const code = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  const { hash, salt } = hashSecret(code);
  const id = nid("otp");
  await sql`
    insert into otp_codes (id, customer_id, phone, code_hash, code_salt, purpose, expires_at)
    values (${id}, ${String(op.id)}, ${phone}, ${hash}, ${salt}, 'OPERATOR_RESET', now() + (${OTP_TTL_MIN} || ' minutes')::interval)`;
  const hotspot = (await getSettings()).hotspotName;
  const sent = await sendSms(phone, `${hotspot} operator: your reset code is ${code}. It expires in ${OTP_TTL_MIN} minutes. Don't share it.`);
  if (!sent.ok) {
    await sql`delete from otp_codes where id = ${id}`;
    await logEvent("SMS", `Operator reset SMS to ${maskPhone(phone)} failed: ${sent.error}`);
    return { ok: false, error: "We couldn't send the SMS right now. Ask the owner to reset your password." };
  }
  return { ok: true, maskedPhone: masked };
}

export async function resetOperatorPasswordWithOtp(input: { phone: string; code: string; next: string }): Promise<LoginResult> {
  const generic = "That code is wrong or has expired. Ask for a new code.";
  const phone = normalizeKenyanPhone(input.phone);
  if (!phone) return { ok: false, error: "Enter a valid Kenyan phone number." };
  const bad = validateOperatorPassword(input.next);
  if (bad) return { ok: false, error: bad };
  const sql = await getSql();
  const row = (
    await sql<{ id: string; code_hash: string; code_salt: string; customer_id: string; attempts: number }>`
      select id, code_hash, code_salt, customer_id, attempts from otp_codes
      where phone = ${phone} and purpose = 'OPERATOR_RESET' and used_at is null and expires_at > now()
      order by created_at desc limit 1`
  )[0];
  if (!row || row.attempts >= OTP_MAX_TRIES) return { ok: false, error: generic };
  if (!verifySecret(input.code.trim(), row.code_hash, row.code_salt)) {
    await sql`update otp_codes set attempts = attempts + 1 where id = ${row.id}`;
    return { ok: false, error: generic };
  }
  const used = await sql<{ id: string }>`update otp_codes set used_at = now() where id = ${row.id} and used_at is null returning id`;
  if (used.length === 0) return { ok: false, error: generic };
  const op = await getOperatorById(row.customer_id);
  if (!op || op.status === "DISABLED") return { ok: false, error: generic };
  await setOperatorPassword(op.id, input.next);
  await sql`update operators set last_login_at = now() where id = ${op.id}`;
  await logEvent("OPERATOR", `Operator ${op.name} reset their password with an SMS code.`);
  return { ok: true, operator: op };
}
