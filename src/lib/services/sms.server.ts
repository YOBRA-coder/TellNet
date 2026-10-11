/**
 * TextBee SMS (https://textbee.dev). An Android phone with the TextBee app is the gateway.
 * POST https://api.textbee.dev/api/v1/gateway/devices/{deviceId}/send-sms   header x-api-key   body {recipients, message}
 * A 2xx answer means TextBee ACCEPTED the message, not that the phone delivered it.
 */
import { getSql } from "@/lib/db";

const BASE = "https://api.textbee.dev/api/v1/gateway";

export type SmsConfig = { enabled: boolean; apiKey: string | null; deviceId: string | null };

export async function getSmsConfig(): Promise<SmsConfig> {
  const sql = await getSql();
  const r = (await sql<Record<string, unknown>>`
    select sms_enabled, sms_api_key, sms_device_id from settings where id = 'default' limit 1`)[0];
  return {
    enabled: Boolean(r?.sms_enabled),
    apiKey: r?.sms_api_key ? String(r.sms_api_key) : null,
    deviceId: r?.sms_device_id ? String(r.sms_device_id) : null,
  };
}

export function smsReady(c: SmsConfig): boolean {
  return c.enabled && Boolean(c.apiKey) && Boolean(c.deviceId);
}

/** phone: 2547XXXXXXXX (no plus) -> +2547XXXXXXXX */
export async function sendSms(
  phone: string,
  message: string,
  opts: { ignoreEnabled?: boolean } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = await getSmsConfig();
  if (opts.ignoreEnabled) cfg.enabled = true;
  if (!smsReady(cfg)) return { ok: false, error: "SMS is not set up." };
  const to = phone.startsWith("+") ? phone : `+${phone.replace(/\D/g, "")}`;
  try {
    const res = await fetch(`${BASE}/devices/${encodeURIComponent(cfg.deviceId!)}/send-sms`, {
      method: "POST",
      headers: { "x-api-key": cfg.apiKey!, "content-type": "application/json" },
      body: JSON.stringify({ recipients: [to], message }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true };
    const body = (await res.text().catch(() => "")).slice(0, 200);
    if (res.status === 401 || res.status === 403) return { ok: false, error: "TextBee rejected the API key." };
    if (res.status === 404) return { ok: false, error: "TextBee could not find that device ID." };
    if (res.status === 429) return { ok: false, error: "TextBee limit reached for your plan." };
    return { ok: false, error: `TextBee error ${res.status}. ${body}`.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach TextBee." };
  }
}
