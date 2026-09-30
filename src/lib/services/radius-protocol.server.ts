/**
 * Minimal RADIUS (RFC 2865/2866) packet handling for the hotspot:
 * PAP + CHAP Access-Request against the TellNet ledger, Accounting ack.
 */
import { createHash } from "node:crypto";
import { radiusLookupUser } from "./radius.server";

export const CODE = {
  ACCESS_REQUEST: 1,
  ACCESS_ACCEPT: 2,
  ACCESS_REJECT: 3,
  ACCOUNTING_REQUEST: 4,
  ACCOUNTING_RESPONSE: 5,
} as const;

const ATTR = {
  UserName: 1,
  UserPassword: 2,
  CHAPPassword: 3,
  ReplyMessage: 18,
  Class: 25,
  SessionTimeout: 27,
  CHAPChallenge: 60,
  PortLimit: 62,
} as const;

const MIKROTIK_VENDOR = 14988;
const MIKROTIK_RATE_LIMIT = 8;

type Attr = { type: number; value: Buffer };

function md5(...parts: Buffer[]) {
  const h = createHash("md5");
  for (const p of parts) h.update(p);
  return h.digest();
}

function decodeAttrs(buf: Buffer, offset: number, end: number): Attr[] {
  const attrs: Attr[] = [];
  let i = offset;
  while (i + 2 <= end) {
    const type = buf[i];
    const len = buf[i + 1];
    if (len < 2 || i + len > end) break;
    attrs.push({ type, value: buf.subarray(i + 2, i + len) });
    i += len;
  }
  return attrs;
}

function encodeAttr(type: number, value: Buffer | string | number): Buffer {
  let v: Buffer;
  if (typeof value === "number") {
    v = Buffer.alloc(4);
    v.writeUInt32BE(value, 0);
  } else {
    v = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  }
  if (v.length > 253) v = v.subarray(0, 253);
  return Buffer.concat([Buffer.from([type, v.length + 2]), v]);
}

function encodeMikrotikRateLimit(value: string): Buffer {
  const v = Buffer.from(value, "utf8");
  const vendor = Buffer.alloc(6);
  vendor.writeUInt32BE(MIKROTIK_VENDOR, 0);
  vendor[4] = MIKROTIK_RATE_LIMIT;
  vendor[5] = v.length + 2;
  return encodeAttr(26, Buffer.concat([vendor, v]));
}

function decryptPap(encrypted: Buffer, secret: string, requestAuth: Buffer): string | null {
  if (!encrypted.length || encrypted.length % 16 !== 0) return null;
  const secretBuf = Buffer.from(secret, "utf8");
  let prev = requestAuth;
  const out = Buffer.alloc(encrypted.length);
  for (let i = 0; i < encrypted.length; i += 16) {
    const b = md5(secretBuf, prev);
    for (let j = 0; j < 16; j++) out[i + j] = encrypted[i + j] ^ b[j];
    prev = encrypted.subarray(i, i + 16);
  }
  let end = out.length;
  while (end > 0 && out[end - 1] === 0) end--;
  return out.subarray(0, end).toString("utf8");
}

function verifyChap(password: string, chapPassword: Buffer, challenge: Buffer): boolean {
  if (chapPassword.length < 17) return false;
  const expected = md5(chapPassword.subarray(0, 1), Buffer.from(password, "utf8"), challenge);
  return expected.equals(chapPassword.subarray(1, 17));
}

function rateLimit(uploadKbps: number, downloadKbps: number) {
  const fmt = (k: number) => (k >= 1024 && k % 1024 === 0 ? `${k / 1024}M` : `${k}k`);
  return `${fmt(Math.max(64, uploadKbps))}/${fmt(Math.max(64, downloadKbps))}`;
}

function build(code: number, id: number, requestAuth: Buffer, secret: string, attrs: Buffer[]) {
  const body = Buffer.concat(attrs);
  const header = Buffer.alloc(4);
  header[0] = code;
  header[1] = id;
  header.writeUInt16BE(20 + body.length, 2);
  const auth = md5(header, requestAuth, body, Buffer.from(secret, "utf8"));
  return Buffer.concat([header, auth, body]);
}

export async function handleAccessRequest(msg: Buffer, secret: string): Promise<Buffer> {
  const id = msg[1];
  const length = msg.readUInt16BE(2);
  const requestAuth = msg.subarray(4, 20);
  const attrs = decodeAttrs(msg, 20, Math.min(length, msg.length));
  const get = (t: number) => attrs.find((a) => a.type === t)?.value;

  const username = get(ATTR.UserName)?.toString("utf8") ?? "";
  const reject = (why: string) =>
    build(CODE.ACCESS_REJECT, id, requestAuth, secret, [encodeAttr(ATTR.ReplyMessage, why)]);

  const user = await radiusLookupUser(username);
  if (!user) return reject("No active TelNet package");

  const chap = get(ATTR.CHAPPassword);
  const pap = get(ATTR.UserPassword);
  let ok = false;
  if (chap) {
    const challenge = get(ATTR.CHAPChallenge);
    ok = verifyChap(user.password, chap, challenge && challenge.length ? challenge : requestAuth);
  } else if (pap) {
    ok = decryptPap(pap, secret, requestAuth) === user.password;
  }
  if (!ok) return reject("Invalid credentials");

  return build(CODE.ACCESS_ACCEPT, id, requestAuth, secret, [
    encodeAttr(ATTR.SessionTimeout, user.sessionTimeout),
    encodeAttr(ATTR.PortLimit, user.portLimit),
    encodeMikrotikRateLimit(rateLimit(user.uploadKbps, user.downloadKbps)),
    encodeAttr(ATTR.ReplyMessage, `TelNet OK ${user.packageName} ${user.sessionTimeout}s left`),
    encodeAttr(ATTR.Class, user.classId),
  ]);
}

export function handleAccounting(msg: Buffer, secret: string): Buffer {
  // Ack only — the billing clock stays on the package's expiry_time.
  return build(CODE.ACCOUNTING_RESPONSE, msg[1], msg.subarray(4, 20), secret, []);
}
