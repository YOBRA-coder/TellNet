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

/**
 * How to match what an operator typed into a phone/receipt search box.
 *  - starts with 0 / 254 / +254  -> anchored prefix on the stored 2547XXXXXXXX form
 *    (so "07" finds numbers that START with 07, and "0712" finds 0712…)
 *  - letters present             -> text (M-Pesa receipt code)
 *  - anything else (e.g. last digits) -> digits anywhere in the number
 */
export type PhoneSearch =
  | { kind: "none" }
  | { kind: "text"; text: string }
  | { kind: "prefix"; digits: string }
  | { kind: "contains"; digits: string };

export function parsePhoneSearch(input: string): PhoneSearch {
  const raw = (input ?? "").trim();
  if (!raw) return { kind: "none" };
  if (/[a-z]/i.test(raw)) return { kind: "text", text: raw.toUpperCase() };
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { kind: "none" };
  if (digits.startsWith("254")) return { kind: "prefix", digits };
  if (digits.startsWith("0")) return { kind: "prefix", digits: `254${digits.slice(1)}` };
  return { kind: "contains", digits };
}

/** Client-side version of the same rule, for filtering rows already loaded. */
export function phoneMatchesSearch(phone: string, search: PhoneSearch): boolean {
  if (search.kind === "none" || search.kind === "text") return true;
  const d = phone.replace(/\D/g, "");
  return search.kind === "prefix" ? d.startsWith(search.digits) : d.includes(search.digits);
}
