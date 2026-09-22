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

function timestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
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
      TransactionType: "CustomerPayBillOnline",
      Amount: input.amount,
      PartyA: input.phone,
      PartyB: settings.mpesaShortcode,
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
