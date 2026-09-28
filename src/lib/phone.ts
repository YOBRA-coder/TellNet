/** Kenyan MSISDN helpers. Canonical form is 2547XXXXXXXX / 2541XXXXXXXX. */

const KENYA_MOBILE = /^(?:254|\+254|0)?([17]\d{8})$/;

export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "").trim();
  const match = digits.match(KENYA_MOBILE);
  if (!match) return null;
  return `254${match[1]}`;
}

export function formatPhoneDisplay(phone: string): string {
  const n = normalizeKenyanPhone(phone) ?? phone.replace(/\D/g, "");
  if (n.startsWith("254") && n.length === 12) {
    return `0${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;
  }
  return phone;
}

export function isKenyanPhone(input: string): boolean {
  return normalizeKenyanPhone(input) !== null;
}
