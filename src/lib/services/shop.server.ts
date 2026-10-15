/**
 * Airtime / data / minutes / SMS shop.
 *
 * Money:  M-Pesa STK push (the Wi-Fi till/paybill, or a separate one when shop payment mode is CUSTOM).
 * Delivery (operator chooses in Admin -> Shop):
 *   ANDROID  an Android phone with a USSD-automation app polls /api/shop/device/next, dials the USSD,
 *            and reports back to /api/shop/device/result.
 *   API      TelNet calls a reseller's HTTP API from a template the operator fills in.
 * Safety rule: an order is NEVER re-sent automatically when the outcome is unknown (timeout, phone silent),
 * because that could deliver twice. Those go to FAILED "check first" and the operator retries by hand.
 */
import { createHash, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { normalizeKenyanPhone } from "@/lib/phone";
import { initiateStkPush, queryStkStatus, type MpesaOverride } from "./mpesa.server";
import { getSettings, logEvent } from "./settings.server";

export type ShopKind = "DATA" | "MINUTES" | "SMS" | "AIRTIME";
export const SHOP_KINDS: ShopKind[] = ["DATA", "MINUTES", "SMS", "AIRTIME"];
type Row = Record<string, unknown>;

// ---------------------------------------------------------------- settings

export type ShopSettings = {
  enabled: boolean;
  title: string | null;
  notice: string | null;
  fulfilment: "ANDROID" | "API";
  maxAttempts: number;
  paymentMode: "CURRENT" | "CUSTOM";
  payAccountType: "paybill" | "till";
  payShortcode: string | null;
  payTill: string | null;
  hasPayPasskey: boolean;
  hasPayKey: boolean;
  hasPaySecret: boolean;
  apiUrl: string | null;
  apiMethod: "POST" | "GET";
  apiContentType: "json" | "form";
  /** header values are secrets: only the names are returned to the browser */
  apiHeaderNames: string[];
  apiBody: string | null;
  apiSuccessPath: string | null;
  apiSuccessValue: string | null;
};

async function rawSettings(): Promise<Row> {
  const sql = await getSql();
  await sql`insert into shop_settings (id) values ('default') on conflict (id) do nothing`;
  return (await sql<Row>`select * from shop_settings where id = 'default' limit 1`)[0] ?? {};
}

function headerNames(raw: unknown): string[] {
  try {
    return Object.keys(JSON.parse(String(raw ?? "{}")) as Record<string, string>);
  } catch {
    return [];
  }
}

export async function getShopSettings(): Promise<ShopSettings> {
  const r = await rawSettings();
  return {
    enabled: Boolean(r.enabled),
    title: r.title ? String(r.title) : null,
    notice: r.notice ? String(r.notice) : null,
    fulfilment: r.fulfilment === "API" ? "API" : "ANDROID",
    maxAttempts: Number(r.max_attempts ?? 5),
    paymentMode: r.payment_mode === "CUSTOM" ? "CUSTOM" : "CURRENT",
    payAccountType: r.pay_account_type === "till" ? "till" : "paybill",
    payShortcode: r.pay_shortcode ? String(r.pay_shortcode) : null,
    payTill: r.pay_till ? String(r.pay_till) : null,
    hasPayPasskey: Boolean(r.pay_passkey),
    hasPayKey: Boolean(r.pay_key),
    hasPaySecret: Boolean(r.pay_secret),
    apiUrl: r.api_url ? String(r.api_url) : null,
    apiMethod: r.api_method === "GET" ? "GET" : "POST",
    apiContentType: r.api_content_type === "form" ? "form" : "json",
    apiHeaderNames: headerNames(r.api_headers),
    apiBody: r.api_body ? String(r.api_body) : null,
    apiSuccessPath: r.api_success_path ? String(r.api_success_path) : null,
    apiSuccessValue: r.api_success_value ? String(r.api_success_value) : null,
  };
}

export type ShopSettingsPatch = Partial<{
  enabled: boolean;
  title: string | null;
  notice: string | null;
  fulfilment: "ANDROID" | "API";
  maxAttempts: number;
  paymentMode: "CURRENT" | "CUSTOM";
  payAccountType: "paybill" | "till";
  payShortcode: string | null;
  payTill: string | null;
  payPasskey: string;
  payKey: string;
  paySecret: string;
  apiUrl: string | null;
  apiMethod: "POST" | "GET";
  apiContentType: "json" | "form";
  /** JSON object text, e.g. {"Authorization":"Bearer xxx"}; blank = keep what is saved */
  apiHeaders: string;
  apiBody: string | null;
  apiSuccessPath: string | null;
  apiSuccessValue: string | null;
}>;

export async function saveShopSettings(p: ShopSettingsPatch): Promise<{ ok: true } | { ok: false; error: string }> {
  const sql = await getSql();
  await rawSettings();
  if (p.apiHeaders && p.apiHeaders.trim()) {
    try {
      const h = JSON.parse(p.apiHeaders);
      if (!h || typeof h !== "object" || Array.isArray(h)) throw new Error("x");
    } catch {
      return { ok: false, error: 'Headers must be a JSON object, like {"Authorization":"Bearer abc"}.' };
    }
  }
  if (p.apiUrl && !/^https:\/\//i.test(p.apiUrl.trim())) return { ok: false, error: "The provider URL must start with https://" };
  const set = async (col: string, v: unknown) => {
    switch (col) {
      case "enabled":
        await sql`update shop_settings set enabled = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "title":
        await sql`update shop_settings set title = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "notice":
        await sql`update shop_settings set notice = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "fulfilment":
        await sql`update shop_settings set fulfilment = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "max_attempts":
        await sql`update shop_settings set max_attempts = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "payment_mode":
        await sql`update shop_settings set payment_mode = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "pay_account_type":
        await sql`update shop_settings set pay_account_type = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "pay_shortcode":
        await sql`update shop_settings set pay_shortcode = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "pay_till":
        await sql`update shop_settings set pay_till = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "api_url":
        await sql`update shop_settings set api_url = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "api_method":
        await sql`update shop_settings set api_method = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "api_content_type":
        await sql`update shop_settings set api_content_type = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "api_body":
        await sql`update shop_settings set api_body = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "api_success_path":
        await sql`update shop_settings set api_success_path = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "api_success_value":
        await sql`update shop_settings set api_success_value = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "pay_passkey":
        await sql`update shop_settings set pay_passkey = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "pay_key":
        await sql`update shop_settings set pay_key = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "pay_secret":
        await sql`update shop_settings set pay_secret = ${v as never}, updated_at = now() where id = 'default'`;
        break;
      case "api_headers":
        await sql`update shop_settings set api_headers = ${v as never}, updated_at = now() where id = 'default'`;
        break;
    }
  };
  const map: Array<[keyof ShopSettingsPatch, string, (v: never) => unknown]> = [
    ["enabled", "enabled", (v) => Boolean(v)],
    ["title", "title", (v) => (String(v ?? "").trim() || null)],
    ["notice", "notice", (v) => (String(v ?? "").trim() || null)],
    ["fulfilment", "fulfilment", (v) => (v === "API" ? "API" : "ANDROID")],
    ["maxAttempts", "max_attempts", (v) => Math.min(10, Math.max(1, Number(v) || 5))],
    ["paymentMode", "payment_mode", (v) => (v === "CUSTOM" ? "CUSTOM" : "CURRENT")],
    ["payAccountType", "pay_account_type", (v) => (v === "till" ? "till" : "paybill")],
    ["payShortcode", "pay_shortcode", (v) => (String(v ?? "").replace(/\D/g, "") || null)],
    ["payTill", "pay_till", (v) => (String(v ?? "").replace(/\D/g, "") || null)],
    ["apiUrl", "api_url", (v) => (String(v ?? "").trim() || null)],
    ["apiMethod", "api_method", (v) => (v === "GET" ? "GET" : "POST")],
    ["apiContentType", "api_content_type", (v) => (v === "form" ? "form" : "json")],
    ["apiBody", "api_body", (v) => (String(v ?? "").trim() || null)],
    ["apiSuccessPath", "api_success_path", (v) => (String(v ?? "").trim() || null)],
    ["apiSuccessValue", "api_success_value", (v) => (String(v ?? "").trim() || null)],
  ];
  for (const [key, col, f] of map) if (p[key] !== undefined) await set(col, f(p[key] as never));
  // secrets: only written when provided
  if (p.payPasskey?.trim()) await set("pay_passkey", p.payPasskey.trim());
  if (p.payKey?.trim()) await set("pay_key", p.payKey.trim());
  if (p.paySecret?.trim()) await set("pay_secret", p.paySecret.trim());
  if (p.apiHeaders?.trim()) await set("api_headers", p.apiHeaders.trim());
  return { ok: true };
}

function payOverride(r: Row): MpesaOverride | undefined {
  if (r.payment_mode !== "CUSTOM") return undefined;
  const o: MpesaOverride = {
    mpesaShortcode: r.pay_shortcode ? String(r.pay_shortcode) : null,
    mpesaAccountType: r.pay_account_type === "till" ? "till" : "paybill",
    mpesaTillNumber: r.pay_till ? String(r.pay_till) : null,
  };
  if (r.pay_passkey) o.mpesaPasskey = String(r.pay_passkey);
  if (r.pay_key) o.mpesaConsumerKey = String(r.pay_key);
  if (r.pay_secret) o.mpesaConsumerSecret = String(r.pay_secret);
  return o;
}

// ---------------------------------------------------------------- products

export type ShopProduct = {
  id: string;
  kind: ShopKind;
  name: string;
  price: number | null;
  minAmount: number | null;
  maxAmount: number | null;
  ussdCode: string | null;
  providerCode: string | null;
  okoaOk: boolean;
  notes: string | null;
  siteId: string | null;
  sortOrder: number;
  status: "ACTIVE" | "INACTIVE";
};

function mapProduct(r: Row): ShopProduct {
  return {
    id: String(r.id),
    kind: SHOP_KINDS.includes(r.kind as ShopKind) ? (r.kind as ShopKind) : "DATA",
    name: String(r.name),
    price: r.price == null ? null : Number(r.price),
    minAmount: r.min_amount == null ? null : Number(r.min_amount),
    maxAmount: r.max_amount == null ? null : Number(r.max_amount),
    ussdCode: r.ussd_code ? String(r.ussd_code) : null,
    providerCode: r.provider_code ? String(r.provider_code) : null,
    okoaOk: Boolean(r.okoa_ok),
    notes: r.notes ? String(r.notes) : null,
    siteId: r.site_id ? String(r.site_id) : null,
    sortOrder: Number(r.sort_order ?? 0),
    status: r.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

export async function listProducts(opts: { siteId?: string | null; activeOnly?: boolean } = {}): Promise<ShopProduct[]> {
  const sql = await getSql();
  const site = opts.siteId ?? null;
  const rows = await sql<Row>`
    select * from shop_products
    where (${opts.activeOnly ?? false}::boolean = false or status = 'ACTIVE')
      and (${site}::text is null or site_id is null or site_id = ${site})
    order by sort_order, price nulls last, name`;
  return rows.map(mapProduct);
}

export async function saveProduct(p: {
  id?: string;
  kind: ShopKind;
  name: string;
  price?: number | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  ussdCode?: string | null;
  providerCode?: string | null;
  okoaOk?: boolean;
  notes?: string | null;
  siteId?: string | null;
  sortOrder?: number;
  status?: "ACTIVE" | "INACTIVE";
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const name = p.name.trim();
  if (name.length < 2) return { ok: false, error: "Enter a name." };
  const airtime = p.kind === "AIRTIME";
  if (!airtime && !(Number(p.price) >= 1)) return { ok: false, error: "Enter a price (KES 1 or more)." };
  const min = airtime ? Math.max(1, Number(p.minAmount) || 5) : null;
  const max = airtime ? Math.max(min!, Number(p.maxAmount) || 5000) : null;
  const sql = await getSql();
  const id = p.id ?? nid("shp");
  await sql`
    insert into shop_products (id, kind, name, price, min_amount, max_amount, ussd_code, provider_code, okoa_ok, notes, site_id, sort_order, status)
    values (${id}, ${p.kind}, ${name}, ${airtime ? null : Math.round(Number(p.price))}, ${min}, ${max},
            ${p.ussdCode?.trim() || null}, ${p.providerCode?.trim() || null}, ${Boolean(p.okoaOk)},
            ${p.notes?.trim() || null}, ${p.siteId || null}, ${p.sortOrder ?? 0}, ${p.status ?? "ACTIVE"})
    on conflict (id) do update set
      kind = excluded.kind, name = excluded.name, price = excluded.price, min_amount = excluded.min_amount,
      max_amount = excluded.max_amount, ussd_code = excluded.ussd_code, provider_code = excluded.provider_code,
      okoa_ok = excluded.okoa_ok, notes = excluded.notes, site_id = excluded.site_id,
      sort_order = excluded.sort_order, status = excluded.status`;
  return { ok: true, id };
}

export async function deleteProduct(id: string) {
  const sql = await getSql();
  await sql`delete from shop_products where id = ${id}`;
}

// ---------------------------------------------------------------- orders

export type ShopOrder = {
  id: string;
  productName: string;
  kind: ShopKind;
  amount: number;
  payerPhone: string;
  targetPhone: string;
  siteId: string | null;
  siteName: string | null;
  status: "PENDING" | "PAID" | "CANCELLED" | "FAILED";
  fulfilStatus: "NONE" | "QUEUED" | "SENT" | "DONE" | "FAILED";
  fulfilMethod: string | null;
  attempts: number;
  error: string | null;
  receipt: string | null;
  refunded: boolean;
  createdAt: string;
  deliveredAt: string | null;
};

function mapOrder(r: Row): ShopOrder {
  return {
    id: String(r.id),
    productName: String(r.product_name),
    kind: (SHOP_KINDS.includes(r.kind as ShopKind) ? r.kind : "DATA") as ShopKind,
    amount: Number(r.amount),
    payerPhone: String(r.payer_phone),
    targetPhone: String(r.target_phone),
    siteId: r.site_id ? String(r.site_id) : null,
    siteName: r.site_name ? String(r.site_name) : null,
    status: (["PENDING", "PAID", "CANCELLED", "FAILED"].includes(String(r.status)) ? r.status : "PENDING") as ShopOrder["status"],
    fulfilStatus: (["NONE", "QUEUED", "SENT", "DONE", "FAILED"].includes(String(r.fulfil_status)) ? r.fulfil_status : "NONE") as ShopOrder["fulfilStatus"],
    fulfilMethod: r.fulfil_method ? String(r.fulfil_method) : null,
    attempts: Number(r.fulfil_attempts ?? 0),
    error: r.fulfil_error ? String(r.fulfil_error) : null,
    receipt: r.mpesa_receipt ? String(r.mpesa_receipt) : null,
    refunded: Boolean(r.refunded),
    createdAt: new Date(String(r.created_at)).toISOString(),
    deliveredAt: r.delivered_at ? new Date(String(r.delivered_at)).toISOString() : null,
  };
}

export async function createOrder(input: {
  productId: string;
  amount?: number;
  payerPhone: string;
  targetPhone?: string;
  siteId?: string | null;
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  const cfg = await rawSettings();
  if (!cfg.enabled) return { ok: false, error: "The shop is closed right now." };
  const payer = normalizeKenyanPhone(input.payerPhone);
  if (!payer) return { ok: false, error: "Enter the M-Pesa number that will pay." };
  const target = input.targetPhone?.trim() ? normalizeKenyanPhone(input.targetPhone) : payer;
  if (!target) return { ok: false, error: "Enter a valid Kenyan number to receive it." };
  const sql = await getSql();
  const site = input.siteId ?? null;
  const prod = (await sql<Row>`select * from shop_products where id = ${input.productId} and status = 'ACTIVE' limit 1`)[0];
  if (!prod || (prod.site_id && site && String(prod.site_id) !== site)) return { ok: false, error: "That item is not available." };
  const p = mapProduct(prod);
  let amount = p.price ?? 0;
  if (p.kind === "AIRTIME") {
    amount = Math.round(Number(input.amount));
    if (!(amount >= (p.minAmount ?? 5)) || amount > (p.maxAmount ?? 5000)) {
      return { ok: false, error: `Airtime must be between KES ${p.minAmount ?? 5} and KES ${p.maxAmount ?? 5000}.` };
    }
  }
  if (!(amount >= 1)) return { ok: false, error: "That item has no price." };
  const recent = Number(
    (await sql<{ n: number }>`
      select count(*)::int as n from shop_orders where payer_phone = ${payer} and created_at > now() - interval '10 minutes'`)[0]?.n ?? 0,
  );
  if (recent >= 5) return { ok: false, error: "Too many orders from this number. Please wait a few minutes." };

  const id = nid("so");
  await sql`
    insert into shop_orders (id, product_id, product_name, kind, amount, payer_phone, target_phone, site_id)
    values (${id}, ${p.id}, ${p.name}, ${p.kind}, ${amount}, ${payer}, ${target}, ${site})`;
  try {
    const stk = await initiateStkPush(
      { phone: payer, amount, accountRef: "SHOP", description: p.name },
      payOverride(cfg),
    );
    await sql`update shop_orders set checkout_request_id = ${stk.checkoutRequestId}, merchant_request_id = ${stk.merchantRequestId}, updated_at = now() where id = ${id}`;
  } catch (err) {
    await sql`update shop_orders set status = 'FAILED', result_desc = ${err instanceof Error ? err.message : "Could not send the M-Pesa prompt."}, updated_at = now() where id = ${id}`;
    return { ok: false, error: err instanceof Error ? err.message : "Could not send the M-Pesa prompt." };
  }
  return { ok: true, orderId: id };
}

export async function findOrderByCheckout(checkoutRequestId: string): Promise<{ id: string; status: string; amount: number } | null> {
  const sql = await getSql();
  const r = (await sql<Row>`select id, status, amount from shop_orders where checkout_request_id = ${checkoutRequestId} limit 1`)[0];
  return r ? { id: String(r.id), status: String(r.status), amount: Number(r.amount) } : null;
}

export async function shopPayOverride() {
  return payOverride(await rawSettings());
}

/** Idempotent: PENDING -> PAID (queue delivery) or CANCELLED/FAILED, exactly once. */
export async function settleOrderByCheckout(input: {
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  receipt: string | null;
}): Promise<boolean> {
  const sql = await getSql();
  const o = (await sql<Row>`select id, status from shop_orders where checkout_request_id = ${input.checkoutRequestId} limit 1`)[0];
  if (!o) return false;
  if (o.status === "PAID") {
    if (input.receipt) await sql`update shop_orders set mpesa_receipt = ${input.receipt} where id = ${o.id} and mpesa_receipt is null`;
    return true;
  }
  if (o.status !== "PENDING") return false;
  if (input.resultCode === 0) {
    const upd = await sql<{ id: string }>`
      update shop_orders set status = 'PAID', mpesa_receipt = coalesce(${input.receipt}, mpesa_receipt),
        result_desc = ${input.resultDesc}, paid_at = now(), updated_at = now()
      where id = ${o.id} and status = 'PENDING' returning id`;
    if (upd.length === 0) return true;
    await enqueueFulfilment(String(o.id));
    await logEvent("SHOP", `Shop order ${input.receipt ?? o.id} paid.`);
    return true;
  }
  const cancelled = input.resultCode === 1032;
  await sql`
    update shop_orders set status = ${cancelled ? "CANCELLED" : "FAILED"}, result_desc = ${input.resultDesc}, updated_at = now()
    where id = ${o.id} and status = 'PENDING'`;
  return true;
}

/** Customer-facing status. While waiting, asks Safaricom directly so a missed callback never strands a customer. */
export async function getOrderStatus(orderId: string): Promise<ShopOrder | null> {
  const sql = await getSql();
  const load = async () =>
    (await sql<Row>`select o.*, s.name as site_name from shop_orders o left join sites s on s.id = o.site_id where o.id = ${orderId} limit 1`)[0];
  let r = await load();
  if (!r) return null;
  if (r.status === "PENDING" && r.checkout_request_id) {
    try {
      const q = await queryStkStatus(String(r.checkout_request_id), await shopPayOverride());
      const still = q.resultCode < 0 || q.resultCode === 4999 || /progress|processing|not found|under process/i.test(q.resultDesc);
      if (q.resultCode === 0 || q.resultCode === 1032 || (q.resultCode > 0 && !still)) {
        await settleOrderByCheckout({ checkoutRequestId: String(r.checkout_request_id), resultCode: q.resultCode, resultDesc: q.resultDesc, receipt: null });
        r = await load();
      }
    } catch {
      /* keep waiting for the callback or the next poll */
    }
  }
  return r ? mapOrder(r) : null;
}

export async function listOrders(opts: { siteId?: string | null; status?: string; limit?: number } = {}) {
  const sql = await getSql();
  const site = opts.siteId ?? null;
  const rows = await sql<Row>`
    select o.*, s.name as site_name from shop_orders o left join sites s on s.id = coalesce(o.site_id, 'site_default')
    where (${site}::text is null or coalesce(o.site_id, 'site_default') = ${site})
      and (${opts.status ?? null}::text is null
           or (${opts.status ?? null} = 'NEEDS_ATTENTION' and (o.fulfil_status = 'FAILED' and not o.refunded))
           or (${opts.status ?? null} = 'PAID' and o.status = 'PAID')
           or (${opts.status ?? null} = 'DONE' and o.fulfil_status = 'DONE'))
    order by o.created_at desc limit ${Math.min(500, opts.limit ?? 100)}`;
  return rows.map(mapOrder);
}

export async function shopSummary(siteId?: string | null) {
  const sql = await getSql();
  const site = siteId ?? null;
  const r = (
    await sql<Row>`
      select
        coalesce(sum(amount) filter (where status = 'PAID' and created_at >= date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'), 0)::int as today,
        coalesce(sum(amount) filter (where status = 'PAID' and created_at >= now() - interval '7 days'), 0)::int as week,
        coalesce(sum(amount) filter (where status = 'PAID' and created_at >= now() - interval '30 days'), 0)::int as month,
        count(*) filter (where fulfil_status = 'DONE')::int as delivered,
        count(*) filter (where fulfil_status = 'FAILED' and not refunded)::int as attention,
        count(*) filter (where fulfil_status in ('QUEUED','SENT'))::int as in_progress
      from shop_orders where (${site}::text is null or coalesce(site_id, 'site_default') = ${site})`
  )[0];
  return {
    today: Number(r?.today ?? 0),
    week: Number(r?.week ?? 0),
    month: Number(r?.month ?? 0),
    delivered: Number(r?.delivered ?? 0),
    attention: Number(r?.attention ?? 0),
    inProgress: Number(r?.in_progress ?? 0),
  };
}

export async function orderInSite(orderId: string, site: string | null): Promise<boolean> {
  if (!site) return true;
  const sql = await getSql();
  const r = (await sql<{ s: string }>`select coalesce(site_id, 'site_default') as s from shop_orders where id = ${orderId} limit 1`)[0];
  return Boolean(r) && r.s === site;
}

// ---------------------------------------------------------------- delivery

export async function enqueueFulfilment(orderId: string) {
  const sql = await getSql();
  const cfg = await rawSettings();
  await sql`
    update shop_orders set fulfil_status = 'QUEUED', fulfil_method = ${cfg.fulfilment === "API" ? "API" : "ANDROID"},
      next_attempt_at = now(), fulfil_error = null, updated_at = now()
    where id = ${orderId} and status = 'PAID' and fulfil_status in ('NONE', 'FAILED')`;
  if (cfg.fulfilment === "API") await processApiOrders(1).catch(() => {});
}

/** Operator pressed Retry (after checking the customer really did not get it). */
export async function retryOrder(orderId: string) {
  const sql = await getSql();
  await sql`update shop_orders set fulfil_attempts = 0, refunded = false where id = ${orderId}`;
  await sql`update shop_orders set fulfil_status = 'FAILED' where id = ${orderId} and fulfil_status in ('QUEUED', 'SENT')`;
  await enqueueFulfilment(orderId);
}

export async function markRefunded(orderId: string, refunded: boolean) {
  const sql = await getSql();
  await sql`update shop_orders set refunded = ${refunded}, updated_at = now() where id = ${orderId}`;
}

export async function markDelivered(orderId: string, note?: string) {
  const sql = await getSql();
  await sql`update shop_orders set fulfil_status = 'DONE', delivered_at = coalesce(delivered_at, now()), fulfil_error = ${note ?? "Marked delivered by the operator."}, updated_at = now() where id = ${orderId} and status = 'PAID'`;
}

const local = (phone: string) => (phone.startsWith("254") ? "0" + phone.slice(3) : phone);

function fill(tpl: string, o: Row, escapeJson: boolean): string {
  const vals: Record<string, string> = {
    phone: local(String(o.target_phone)),
    phone254: String(o.target_phone),
    phoneplus: "+" + String(o.target_phone),
    payer: local(String(o.payer_phone)),
    amount: String(o.amount),
    order: String(o.id),
    code: String(o.provider_code ?? ""),
    kind: String(o.kind),
    name: String(o.product_name),
  };
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => {
    if (!(k in vals)) return m;
    return escapeJson ? JSON.stringify(vals[k]).slice(1, -1) : vals[k];
  });
}

// ---- Android phone

export function ussdFor(productUssd: string | null, o: Row): string | null {
  return productUssd ? fill(productUssd, o, false) : null;
}

async function deviceFromKey(key: string): Promise<{ id: string; siteId: string | null } | null> {
  if (!key || key.length < 16) return null;
  const sql = await getSql();
  const hash = createHash("sha256").update(key).digest("hex");
  const r = (await sql<Row>`select id, site_id from shop_devices where key_hash = ${hash} and status = 'ACTIVE' limit 1`)[0];
  if (!r) return null;
  await sql`update shop_devices set last_seen_at = now() where id = ${r.id}`;
  return { id: String(r.id), siteId: r.site_id ? String(r.site_id) : null };
}

export async function createDevice(name: string, siteId: string | null) {
  const sql = await getSql();
  const key = randomBytes(24).toString("hex");
  const id = nid("dev");
  await sql`insert into shop_devices (id, name, key_hash, key_prefix, site_id) values (${id}, ${name.trim() || "Phone"}, ${createHash("sha256").update(key).digest("hex")}, ${key.slice(0, 6)}, ${siteId})`;
  return { id, key }; // the key is shown once and cannot be recovered
}

export async function listDevices() {
  const sql = await getSql();
  const rows = await sql<Row>`select d.*, s.name as site_name from shop_devices d left join sites s on s.id = d.site_id order by d.created_at`;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    keyPrefix: String(r.key_prefix),
    siteId: r.site_id ? String(r.site_id) : null,
    siteName: r.site_name ? String(r.site_name) : null,
    status: String(r.status),
    lastSeenAt: r.last_seen_at ? new Date(String(r.last_seen_at)).toISOString() : null,
  }));
}

export async function deleteDevice(id: string) {
  const sql = await getSql();
  await sql`delete from shop_devices where id = ${id}`;
}

/** The phone asks for work. Returns at most one order, marked SENT so no other call gets it. */
export async function claimNextForDevice(key: string) {
  const dev = await deviceFromKey(key);
  if (!dev) return { ok: false as const, status: 401 };
  const cfg = await rawSettings();
  if (cfg.fulfilment !== "ANDROID") return { ok: true as const, order: null };
  const sql = await getSql();
  const claimed = await sql<Row>`
    update shop_orders set fulfil_status = 'SENT', device_id = ${dev.id}, fulfil_attempts = fulfil_attempts + 1,
      next_attempt_at = now() + interval '10 minutes', updated_at = now()
    where id = (
      select o.id from shop_orders o
      where o.status = 'PAID' and o.fulfil_status = 'QUEUED' and o.fulfil_method = 'ANDROID'
        and (o.next_attempt_at is null or o.next_attempt_at <= now())
        and (${dev.siteId}::text is null or coalesce(o.site_id, 'site_default') = ${dev.siteId})
      order by o.paid_at limit 1
    ) and fulfil_status = 'QUEUED'
    returning *`;
  const o = claimed[0];
  if (!o) return { ok: true as const, order: null };
  const prod = o.product_id
    ? (await sql<Row>`select ussd_code, provider_code from shop_products where id = ${o.product_id} limit 1`)[0]
    : undefined;
  const merged = { ...o, provider_code: prod?.provider_code };
  return {
    ok: true as const,
    order: {
      orderId: String(o.id),
      kind: String(o.kind),
      phone: local(String(o.target_phone)),
      phone254: String(o.target_phone),
      amount: Number(o.amount),
      ussd: ussdFor(prod?.ussd_code ? String(prod.ussd_code) : null, merged),
    },
  };
}

export async function reportDeviceResult(key: string, orderId: string, success: boolean, message?: string) {
  const dev = await deviceFromKey(key);
  if (!dev) return { ok: false as const, status: 401 };
  const sql = await getSql();
  const o = (await sql<Row>`select id, fulfil_status, device_id from shop_orders where id = ${orderId} limit 1`)[0];
  if (!o || String(o.device_id) !== dev.id) return { ok: false as const, status: 404 };
  if (success) {
    await sql`update shop_orders set fulfil_status = 'DONE', delivered_at = now(), fulfil_error = ${message?.slice(0, 300) ?? null}, updated_at = now() where id = ${orderId} and fulfil_status in ('SENT','QUEUED')`;
    return { ok: true as const };
  }
  // The phone SAYS it failed (e.g. insufficient float, wrong USSD): safe to try again a few times.
  const cfg = await rawSettings();
  const attempts = Number(o.fulfil_status ? (await sql<Row>`select fulfil_attempts from shop_orders where id = ${orderId}`)[0]?.fulfil_attempts : 0);
  const retry = attempts < Number(cfg.max_attempts ?? 5);
  await sql`
    update shop_orders set fulfil_status = ${retry ? "QUEUED" : "FAILED"}, fulfil_error = ${message?.slice(0, 300) ?? "The phone reported a failure."},
      next_attempt_at = now() + interval '2 minutes', updated_at = now()
    where id = ${orderId} and fulfil_status in ('SENT','QUEUED')`;
  return { ok: true as const };
}

// ---- Reseller API

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}

export async function callProvider(o: Row, cfg: Row): Promise<{ outcome: "DONE" | "REJECTED" | "UNKNOWN"; message: string; ref?: string }> {
  if (!cfg.api_url) return { outcome: "REJECTED", message: "The reseller API is not set up." };
  const json = cfg.api_content_type !== "form";
  let headers: Record<string, string> = {};
  try {
    headers = cfg.api_headers ? (JSON.parse(String(cfg.api_headers)) as Record<string, string>) : {};
  } catch {
    return { outcome: "REJECTED", message: "The saved API headers are not valid JSON." };
  }
  for (const k of Object.keys(headers)) headers[k] = fill(String(headers[k]), o, false);
  const method = cfg.api_method === "GET" ? "GET" : "POST";
  let url = fill(String(cfg.api_url), o, false);
  let body: string | undefined;
  if (method === "POST") {
    body = fill(String(cfg.api_body ?? ""), o, json);
    headers["Content-Type"] ??= json ? "application/json" : "application/x-www-form-urlencoded";
  } else if (cfg.api_body) {
    url += (url.includes("?") ? "&" : "?") + fill(String(cfg.api_body), o, false);
  }
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    // We cannot know whether the provider received it: never auto-resend.
    return { outcome: "UNKNOWN", message: `No answer from the provider (${err instanceof Error ? err.message : "network error"}). Check with them before retrying.` };
  }
  const text = (await res.text().catch(() => "")).slice(0, 400);
  if (res.status >= 500) return { outcome: "UNKNOWN", message: `Provider error ${res.status}. Check with them before retrying. ${text}`.trim() };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  let success = res.ok;
  if (cfg.api_success_path) {
    const v = getPath(parsed, String(cfg.api_success_path));
    success = res.ok && String(v ?? "").toLowerCase() === String(cfg.api_success_value ?? "").toLowerCase();
  }
  const ref = parsed && typeof parsed === "object" ? String((parsed as Record<string, unknown>).reference ?? (parsed as Record<string, unknown>).id ?? "") : "";
  return success ? { outcome: "DONE", message: text, ref: ref || undefined } : { outcome: "REJECTED", message: `Provider said no (HTTP ${res.status}). ${text}`.trim() };
}

/** Send queued API orders. Called when an order is paid and every minute by the background tick. */
export async function processApiOrders(limit = 5): Promise<number> {
  const cfg = await rawSettings();
  if (cfg.fulfilment !== "API") return 0;
  const sql = await getSql();
  let done = 0;
  for (let i = 0; i < limit; i++) {
    const claimed = await sql<Row>`
      update shop_orders set fulfil_status = 'SENT', fulfil_attempts = fulfil_attempts + 1, updated_at = now()
      where id = (
        select id from shop_orders where status = 'PAID' and fulfil_status = 'QUEUED' and fulfil_method = 'API'
          and (next_attempt_at is null or next_attempt_at <= now()) order by paid_at limit 1
      ) and fulfil_status = 'QUEUED' returning *`;
    const o = claimed[0];
    if (!o) break;
    const prod = o.product_id ? (await sql<Row>`select provider_code from shop_products where id = ${o.product_id} limit 1`)[0] : undefined;
    const r = await callProvider({ ...o, provider_code: prod?.provider_code }, cfg);
    if (r.outcome === "DONE") {
      await sql`update shop_orders set fulfil_status = 'DONE', delivered_at = now(), provider_ref = ${r.ref ?? null}, fulfil_error = null, updated_at = now() where id = ${o.id}`;
      done += 1;
    } else if (r.outcome === "REJECTED" && Number(o.fulfil_attempts) < Number(cfg.max_attempts ?? 5)) {
      await sql`update shop_orders set fulfil_status = 'QUEUED', fulfil_error = ${r.message}, next_attempt_at = now() + (${Math.min(30, 2 * Number(o.fulfil_attempts))} || ' minutes')::interval, updated_at = now() where id = ${o.id}`;
    } else {
      await sql`update shop_orders set fulfil_status = 'FAILED', fulfil_error = ${r.message}, updated_at = now() where id = ${o.id}`;
      await logEvent("SHOP", `Shop order ${o.id} needs attention: ${r.message.slice(0, 120)}`);
    }
  }
  return done;
}

/** Background tick: phone silent for 10 minutes -> needs a human (never auto-resend: it may have gone through). */
export async function shopTick() {
  const sql = await getSql();
  await sql`
    update shop_orders set fulfil_status = 'FAILED',
      fulfil_error = 'The phone did not confirm. Check whether the customer received it before retrying.', updated_at = now()
    where fulfil_status = 'SENT' and fulfil_method = 'ANDROID' and next_attempt_at < now()`;
  await processApiOrders(5).catch((e) => console.error("[shop] api", e));
}

export async function shopPublicInfo(siteId?: string | null) {
  const cfg = await getShopSettings();
  const s = await getSettings();
  return {
    enabled: cfg.enabled,
    title: cfg.title,
    notice: cfg.notice,
    currency: s.currency,
    hotspotName: s.hotspotName,
    products: cfg.enabled ? await listProducts({ siteId: siteId ?? null, activeOnly: true }) : [],
  };
}
