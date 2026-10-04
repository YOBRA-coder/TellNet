import { normalizeKenyanPhone } from "@/lib/phone";
import { nid } from "@/lib/utils";
import { getSettingsSecret } from "./settings.server";

export type StkResult = {
  merchantRequestId: string;
  checkoutRequestId: string;
};

const DARJA_BASE: Record<string, string> = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

async function darajaToken(key: string, secret: string, env: string) {
  const base = DARJA_BASE[env] ?? DARJA_BASE.sandbox;
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(
    `${base}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } },
  );
  if (!res.ok) throw new Error("Could not reach M-Pesa. Check Daraja credentials.");
  const json = (await res.json()) as { access_token?: string; errorMessage?: string };
  if (!json.access_token) {
    throw new Error(json.errorMessage || "Could not reach M-Pesa. Check Daraja credentials.");
  }
  return { token: json.access_token, base };
}

/** YYYYMMDDHHmmss in Nairobi time, whatever time zone the server runs in (Vercel is UTC). */
function timestamp() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((x) => x.type === t)?.value ?? "00";
  return `${g("year")}${g("month")}${g("day")}${g("hour")}${g("minute")}${g("second")}`;
}

function requireLiveCredentials(
  settings: Awaited<ReturnType<typeof getSettingsSecret>>,
) {
  if (
    !settings.mpesaConsumerKey ||
    !settings.mpesaConsumerSecret ||
    !settings.mpesaPasskey ||
    !settings.mpesaShortcode
  ) {
    throw new Error(
      "Live M-Pesa is not configured. Add Consumer Key, Secret, Passkey and Shortcode in Operator → Settings.",
    );
  }
  if (!settings.mpesaCallbackUrl) {
    throw new Error(
      "Set the M-Pesa callback URL in Operator → Settings (public HTTPS ending in /api/mpesa/callback).",
    );
  }
  if (settings.mpesaEnv === "production" && !/^https:\/\//i.test(settings.mpesaCallbackUrl)) {
    throw new Error("Production M-Pesa needs an HTTPS callback URL (Safaricom will not call plain http).");
  }
}

export async function initiateStkPush(input: {
  phone: string;
  amount: number;
  accountRef: string;
  description: string;
}): Promise<StkResult> {
  const settings = await getSettingsSecret();
  requireLiveCredentials(settings);

  const { token, base } = await darajaToken(
    settings.mpesaConsumerKey!,
    settings.mpesaConsumerSecret!,
    settings.mpesaEnv,
  );
  const ts = timestamp();
  const password = Buffer.from(
    `${settings.mpesaShortcode}${settings.mpesaPasskey}${ts}`,
  ).toString("base64");

  const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: settings.mpesaShortcode,
      Password: password,
      Timestamp: ts,
      // Paybill: customer pays the shortcode. Till (Buy Goods): the till number is
      // PartyB and the shortcode above is the store/head-office number the passkey belongs to.
      TransactionType: settings.mpesaAccountType === "till" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
      Amount: input.amount,
      PartyA: input.phone,
      PartyB:
        settings.mpesaAccountType === "till"
          ? settings.mpesaTillNumber || settings.mpesaShortcode
          : settings.mpesaShortcode,
      PhoneNumber: input.phone,
      CallBackURL: settings.mpesaCallbackUrl,
      AccountReference: input.accountRef.slice(0, 12),
      TransactionDesc: input.description.slice(0, 20),
    }),
  });

  const json = (await res.json()) as {
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    ResponseCode?: string;
    errorMessage?: string;
    ResponseDescription?: string;
  };

  if (!res.ok || json.ResponseCode !== "0" || !json.CheckoutRequestID) {
    throw new Error(
      json.errorMessage ||
        json.ResponseDescription ||
        "Could not send the M-Pesa prompt. Please try again.",
    );
  }

  return {
    merchantRequestId: json.MerchantRequestID ?? nid("mr"),
    checkoutRequestId: json.CheckoutRequestID,
  };
}

export async function queryStkStatus(checkoutRequestId: string): Promise<{
  resultCode: number;
  resultDesc: string;
}> {
  const settings = await getSettingsSecret();
  requireLiveCredentials(settings);
  const { token, base } = await darajaToken(
    settings.mpesaConsumerKey!,
    settings.mpesaConsumerSecret!,
    settings.mpesaEnv,
  );
  const ts = timestamp();
  const password = Buffer.from(
    `${settings.mpesaShortcode}${settings.mpesaPasskey}${ts}`,
  ).toString("base64");

  const res = await fetch(`${base}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: settings.mpesaShortcode,
      Password: password,
      Timestamp: ts,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const json = (await res.json()) as {
    ResultCode?: string | number;
    ResultDesc?: string;
    errorMessage?: string;
  };
  return {
    resultCode: json.ResultCode != null ? Number(json.ResultCode) : -1,
    resultDesc: json.ResultDesc || json.errorMessage || "",
  };
}

export function parseCallback(body: unknown): {
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
  resultCode: number;
  resultDesc: string;
  receipt: string | null;
  phone: string | null;
  amount: number | null;
} {
  const root = (body ?? {}) as Record<string, unknown>;
  const inner =
    (root.Body as Record<string, unknown> | undefined)?.stkCallback ??
    root.stkCallback ??
    root;
  const cb = inner as Record<string, unknown>;
  const metadata = cb.CallbackMetadata as
    | { Item?: Array<{ Name?: string; Value?: unknown }> }
    | undefined;
  const items = metadata?.Item ?? [];
  const pick = (name: string) =>
    items.find((i) => i.Name === name)?.Value ?? null;

  return {
    checkoutRequestId: cb.CheckoutRequestID ? String(cb.CheckoutRequestID) : null,
    merchantRequestId: cb.MerchantRequestID ? String(cb.MerchantRequestID) : null,
    resultCode: Number(cb.ResultCode ?? 1),
    resultDesc: String(cb.ResultDesc ?? ""),
    receipt: pick("MpesaReceiptNumber") ? String(pick("MpesaReceiptNumber")) : null,
    phone: pick("PhoneNumber") ? String(pick("PhoneNumber")) : null,
    amount: pick("Amount") != null ? Number(pick("Amount")) : null,
  };
}

/** Settings-page check: do the saved credentials work for the chosen environment? Charges nobody. */
export async function checkMpesaSetup(): Promise<{
  ok: boolean;
  env: string;
  accountType: string;
  host: string;
  problems: string[];
}> {
  const s = await getSettingsSecret();
  const env = s.mpesaEnv === "production" ? "production" : "sandbox";
  const problems: string[] = [];
  if (!s.mpesaConsumerKey) problems.push("Consumer key is missing.");
  if (!s.mpesaConsumerSecret) problems.push("Consumer secret is missing.");
  if (!s.mpesaPasskey) problems.push("Passkey is missing.");
  if (!s.mpesaShortcode) problems.push("Shortcode is missing.");
  if (!s.mpesaCallbackUrl) problems.push("Callback URL is missing.");
  else if (env === "production" && !/^https:\/\//i.test(s.mpesaCallbackUrl)) {
    problems.push("Callback URL must be HTTPS for production.");
  }
  if (env === "production" && s.mpesaShortcode === "174379") {
    problems.push("Shortcode 174379 is the Safaricom sandbox test shortcode — use your real Paybill/store number.");
  }
  if (s.mpesaAccountType === "till" && !s.mpesaTillNumber) {
    problems.push("Till mode is on but the Till number is empty (the shortcode will be used instead).");
  }
  const base = DARJA_BASE[env];
  if (s.mpesaConsumerKey && s.mpesaConsumerSecret) {
    try {
      await darajaToken(s.mpesaConsumerKey, s.mpesaConsumerSecret, env);
    } catch (e) {
      problems.unshift(
        `Safaricom (${env}) refused the consumer key/secret. Check they are the ${env} ones. ${e instanceof Error ? e.message : ""}`.trim(),
      );
    }
  }
  return { ok: problems.length === 0, env, accountType: s.mpesaAccountType, host: new URL(base).host, problems };
}

/** Sends a real prompt for a small amount to the operator's own phone. */
export async function sendMpesaTestPrompt(phoneInput: string, amount = 1) {
  const phone = normalizeKenyanPhone(phoneInput);
  if (!phone) throw new Error("Enter a valid Kenyan phone number.");
  return initiateStkPush({ phone, amount, accountRef: "TelNetTest", description: "TelNet test" });
}
