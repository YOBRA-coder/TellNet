import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { nid, iso } from "@/lib/utils";
import { normalizeKenyanPhone } from "@/lib/phone";
import { initiateStkPush, queryStkStatus } from "@/lib/services/mpesa.server";
import { redeemVoucher } from "@/lib/services/vouchers.server";
import { activateFromPayment, reconnectCustomer } from "@/lib/services/activation.server";
import { expireDuePackages } from "@/lib/services/expiry.server";
import {
  findCustomerByReferralCode,
  generateReferralCode,
  redeemPointsForPackage,
} from "@/lib/services/loyalty.server";
import { getSettings, logEvent } from "@/lib/services/settings.server";
import {
  mapCustomer,
  mapCustomerPackage,
  mapIsp,
  mapPackage,
  mapPayment,
  type SqlRow,
} from "@/lib/services/rows.server";
import type { ActiveAccess, Package } from "@/lib/types";
import { PACKAGE_IN_USE_MESSAGE } from "@/lib/device";

const identitySchema = z.object({
  token: z.string().min(8).max(80),
  phone: z.string().optional(),
  customerId: z.string().optional(),
});

async function loadCatalog() {
  await expireDuePackages();
  const sql = await getSql();
  const settings = await getSettings();
  const packages = (
    await sql<SqlRow>`
      select * from packages where status = 'ACTIVE' order by sort_order, price
    `
  ).map(mapPackage);
  const isps = (await sql<SqlRow>`select * from isps order by sort_order`).map(mapIsp);
  const internetUp = isps.some((i) => i.status !== "OFFLINE");
  return {
    settings: {
      hotspotName: settings.hotspotName,
      welcomeMessage: settings.welcomeMessage,
      currency: settings.currency,
      demoMode: false,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      supportPhone: settings.supportPhone,
      supportWhatsapp: settings.supportWhatsapp,
      supportMessage: settings.supportMessage,
      loyaltyEnabled: settings.loyaltyEnabled,
      referralEnabled: settings.referralEnabled,
      referralMinPackagePrice: settings.referralMinPackagePrice,
      maxDevicesPerPackage: settings.maxDevicesPerPackage,
    },
    packages,
    internetUp,
  };
}

export const getPortalCatalog = createServerFn({ method: "GET" }).handler(
  async () => loadCatalog(),
);

async function findActiveForCustomer(
  customerId: string,
  deviceToken?: string,
): Promise<ActiveAccess> {
  const sql = await getSql();
  const settings = await getSettings();
  const rows = await sql<SqlRow>`
    select cp.*, pkg.name as package_name, pkg.max_devices, c.phone, c.status as customer_status, c.created_at,
      (select array_agg(device_token) from customer_package_devices where customer_package_id = cp.id) as bound_tokens
    from customer_packages cp
    join packages pkg on pkg.id = cp.package_id
    join customers c on c.id = cp.customer_id
    where cp.customer_id = ${customerId}
      and cp.status = 'ACTIVE'
      and cp.expiry_time > now()
    order by cp.expiry_time desc
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const sessions = await sql<{ id: string }>`
    select id from sessions
    where customer_id = ${customerId} and status = 'ACTIVE'
    limit 1
  `;
  const pack = mapCustomerPackage(row);
  const packageMaxDevices = Number(row.max_devices) >= 2 ? 2 : 1;
  const boundTokens: string[] = Array.isArray(row.bound_tokens)
    ? (row.bound_tokens as string[])
    : [];
  const otherDevice = Boolean(
    settings.oneDevicePerPackage &&
      deviceToken &&
      !boundTokens.includes(deviceToken) &&
      boundTokens.length >= packageMaxDevices,
  );
  return {
    customer: mapCustomer({
      id: row.customer_id,
      phone: row.phone,
      status: row.customer_status,
      created_at: row.created_at,
    }),
    pack,
    connected:
      !otherDevice &&
      sessions.length > 0 &&
      String(row.activation_status) === "ACTIVATED",
    otherDevice,
  };
}

/** How many devices the customer's current ACTIVE package allows (per-package, not global). */
async function activePackageMaxDevices(customerId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ max_devices: number }>`
    select pkg.max_devices
    from customer_packages cp
    join packages pkg on pkg.id = cp.package_id
    where cp.customer_id = ${customerId}
      and cp.status = 'ACTIVE'
      and cp.expiry_time > now()
    order by cp.expiry_time desc
    limit 1
  `;
  return rows[0] && Number(rows[0].max_devices) >= 2 ? 2 : 1;
}

/** Every package queued behind the customer's current one, in start order. */
async function queuedPackages(
  customerId: string,
): Promise<{ packageName: string; startTime: string; expiryTime: string }[]> {
  const sql = await getSql();
  const rows = await sql<{ package_name: string; start_time: string; expiry_time: string }>`
    select pkg.name as package_name, cp.start_time, cp.expiry_time
    from customer_packages cp
    join packages pkg on pkg.id = cp.package_id
    where cp.customer_id = ${customerId} and cp.status = 'QUEUED'
    order by cp.start_time asc
  `;
  return rows.map((r) => ({
    packageName: String(r.package_name),
    startTime: iso(r.start_time),
    expiryTime: iso(r.expiry_time),
  }));
}

export const getPortalBootstrap = createServerFn({ method: "POST" })
  .validator((data: unknown) => identitySchema.parse(data))
  .handler(async ({ data }) => {
    const catalog = await loadCatalog();
    const sql = await getSql();

    let access: ActiveAccess = null;
    let resolvedCustomerId: string | null = data.customerId ?? null;
    const phone = data.phone ? normalizeKenyanPhone(data.phone) : null;

    if (data.customerId) {
      access = await findActiveForCustomer(data.customerId, data.token);
    }
    if (!access && data.token) {
      const byToken = await sql<{ id: string }>`
        select id from customers where device_token = ${data.token} limit 1
      `;
      if (byToken[0]) {
        resolvedCustomerId = byToken[0].id;
        access = await findActiveForCustomer(byToken[0].id, data.token);
      }
    }
    if (!access && phone) {
      const byPhone = await sql<{ id: string }>`
        select id from customers where phone = ${phone} limit 1
      `;
      if (byPhone[0]) {
        resolvedCustomerId = byPhone[0].id;
        access = await findActiveForCustomer(byPhone[0].id, data.token);
      }
    }

    let loyalty: { points: number; referralCode: string } | null = null;
    if (
      (catalog.settings.loyaltyEnabled || catalog.settings.referralEnabled) &&
      resolvedCustomerId
    ) {
      const rows = await sql<{ loyalty_points: number; referral_code: string }>`
        select loyalty_points, referral_code from customers where id = ${resolvedCustomerId} limit 1
      `;
      if (rows[0]) {
        loyalty = {
          points: Number(rows[0].loyalty_points ?? 0),
          referralCode: String(rows[0].referral_code ?? ""),
        };
      }
    }

    return {
      ...catalog,
      access,
      loyalty,
    };
  });

export const listPortalPackages = createServerFn({ method: "GET" }).handler(
  async () => {
    const sql = await getSql();
    const rows = await sql<SqlRow>`
      select * from packages where status = 'ACTIVE' order by sort_order, price
    `;
    return rows.map(mapPackage) as Package[];
  },
);

function activationFailure(
  activation: { ok: false; reason: string },
  payment?: ReturnType<typeof mapPayment>,
) {
  if (activation.reason === "in_use") {
    return {
      ok: false as const,
      code: "in_use" as const,
      error: PACKAGE_IN_USE_MESSAGE,
    };
  }
  if (activation.reason === "expired") {
    return {
      ok: false as const,
      code: "expired" as const,
      error: "Your package has expired. Please purchase a new package.",
    };
  }
  if (activation.reason === "blocked") {
    return {
      ok: false as const,
      error: "This number is blocked. Please contact the hotspot operator.",
    };
  }
  return {
    ok: false as const,
    code: "router" as const,
    error:
      "Payment received. Your package could not be activated yet. Please use 'Already Paid?' to reconnect.",
    payment,
  };
}

export const startPayment = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        packageId: z.string(),
        phone: z.string(),
        token: z.string().min(8),
        referralCode: z.string().max(20).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const phone = normalizeKenyanPhone(data.phone);
    if (!phone) {
      return { ok: false as const, error: "Enter a valid Kenyan M-Pesa number." };
    }
    const settings = await getSettings();
    if (settings.maintenanceMode) {
      return {
        ok: false as const,
        error:
          settings.maintenanceMessage ||
          "We're doing scheduled maintenance right now. Please try again shortly.",
      };
    }
    const sql = await getSql();
    const pkgs = await sql<SqlRow>`
      select * from packages where id = ${data.packageId} and status = 'ACTIVE' limit 1
    `;
    const pkg = pkgs[0];
    if (!pkg) return { ok: false as const, error: "That package is no longer available." };

    const existing = await sql<{ id: string; status: string }>`
      select id, status from customers where phone = ${phone} limit 1
    `;
    let customerId = existing[0]?.id;
    if (existing[0]?.status === "BLOCKED") {
      return {
        ok: false as const,
        error: "This number is blocked. Please contact the hotspot operator.",
      };
    }
    if (!customerId) {
      customerId = nid("cus");
      const referralCode = await generateReferralCode();
      let referredBy: string | null = null;
      // A referral code only counts on a qualifying package (priced above
      // the configured minimum) — mirrors the portal UI, which hides the
      // code field entirely below that price, but this is the guard that
      // actually matters since the UI can't be trusted.
      const packagePrice = Number(pkg.price);
      const referralQualifies =
        settings.referralEnabled && packagePrice > Number(settings.referralMinPackagePrice);
      if (data.referralCode && referralQualifies) {
        const referrer = await findCustomerByReferralCode(data.referralCode);
        if (referrer && referrer.id !== customerId) referredBy = referrer.id;
      }
      await sql`
        insert into customers (id, phone, device_token, status, referral_code, referred_by_customer_id)
        values (${customerId}, ${phone}, ${data.token}, 'ACTIVE', ${referralCode}, ${referredBy})
      `;
    } else {
      await sql`
        update customers set device_token = ${data.token}, updated_at = now()
        where id = ${customerId}
      `;
    }

    const paymentId = nid("pay");
    let stk;
    try {
      stk = await initiateStkPush({
        phone,
        amount: Number(pkg.price),
        accountRef: String(pkg.name).replace(/\s+/g, "").slice(0, 12),
        description: `TelNet ${pkg.name}`,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown M-Pesa error";
      // The real reason (missing Daraja keys, bad callback URL, etc.) is an
      // operator problem, not something a paying customer can act on — log
      // it for the operator and show the customer a plain, generic message.
      await logEvent("PAYMENT", `M-Pesa STK push failed: ${detail}`).catch(() => {});
      return {
        ok: false as const,
        error:
          "We couldn't start your M-Pesa payment right now. Please try again in a moment, or contact the hotspot operator if it keeps happening.",
      };
    }

    await sql`
      insert into payments (
        id, customer_id, package_id, checkout_request_id, merchant_request_id,
        phone, amount, status, activation_status
      ) values (
        ${paymentId}, ${customerId}, ${pkg.id}, ${stk.checkoutRequestId},
        ${stk.merchantRequestId}, ${phone}, ${pkg.price}, 'PENDING', 'NOT_ACTIVATED'
      )
    `;

    return {
      ok: true as const,
      paymentId,
      customerId,
      checkoutRequestId: stk.checkoutRequestId,
      amount: Number(pkg.price),
      packageName: String(pkg.name),
      phone,
    };
  });

export const getPaymentStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ paymentId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql<SqlRow>`
      select p.*, pkg.name as package_name
      from payments p join packages pkg on pkg.id = p.package_id
      where p.id = ${data.paymentId}
      limit 1
    `;
    if (!rows[0]) return { ok: false as const, error: "Payment not found." };
    let payment = mapPayment(rows[0]);

    if (payment.status === "PENDING" && payment.checkoutRequestId) {
      try {
        const q = await queryStkStatus(payment.checkoutRequestId);
        const still =
          q.resultCode < 0 ||
          q.resultCode === 4999 ||
          /progress|processing|not found|under process/i.test(q.resultDesc);
        if (q.resultCode === 0 || q.resultCode === 1032 || (q.resultCode > 0 && !still)) {
          const { settlePendingByCheckout } = await import(
            "@/lib/services/callback.server"
          );
          await settlePendingByCheckout({
            checkoutRequestId: payment.checkoutRequestId,
            resultCode: q.resultCode,
            resultDesc: q.resultDesc,
            receipt: null,
          });
          const again = await sql<SqlRow>`
            select p.*, pkg.name as package_name
            from payments p join packages pkg on pkg.id = p.package_id
            where p.id = ${data.paymentId}
            limit 1
          `;
          if (again[0]) payment = mapPayment(again[0]);
        }
      } catch {
        // Keep PENDING until callback or next poll.
      }
    }

    let access: ActiveAccess = null;
    if (payment.status === "SUCCESS") {
      access = await findActiveForCustomer(payment.customerId);
    }
    return { ok: true as const, payment, access };
  });

export const recoverPackage = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        transactionId: z.string().min(6).max(20),
        token: z.string().min(8),
        phone: z.string().optional(),
        deviceInfo: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    const tx = data.transactionId.trim().toUpperCase();
    const phone = data.phone ? normalizeKenyanPhone(data.phone) : null;

    const recent = await sql<{ n: number }>`
      select count(*)::int as n from recovery_attempts
      where created_at > now() - interval '10 minutes'
        and (transaction_id = ${tx} or ${phone}::text is not null and phone = ${phone})
    `;
    if (Number(recent[0]?.n ?? 0) >= 8) {
      return {
        ok: false as const,
        error: "Too many recovery attempts. Please wait a few minutes and try again.",
      };
    }

    const rows = await sql<SqlRow>`
      select p.*, pkg.name as package_name, pkg.price
      from payments p
      join packages pkg on pkg.id = p.package_id
      where upper(p.mpesa_transaction_id) = ${tx}
      limit 1
    `;
    const row = rows[0];
    await sql`
      insert into recovery_attempts (id, phone, transaction_id, success)
      values (${nid("rec")}, ${phone}, ${tx}, ${Boolean(row) && String(row.status) === "SUCCESS"})
    `;

    if (!row) {
      return {
        ok: false as const,
        error: "Transaction not found. Please check your M-Pesa transaction ID and try again.",
      };
    }
    if (String(row.status) !== "SUCCESS") {
      return {
        ok: false as const,
        error: "This M-Pesa transaction was not successful.",
      };
    }

    const amountOk = Number(row.amount) === Number(row.price);
    if (!amountOk) {
      return { ok: false as const, error: "Transaction not found. Please check your M-Pesa transaction ID and try again." };
    }

    const packs = await sql<SqlRow>`
      select cp.*, pkg.name as package_name
      from customer_packages cp
      join packages pkg on pkg.id = cp.package_id
      where cp.payment_id = ${row.id}
      limit 1
    `;
    const pack = packs[0];
    if (pack && (String(pack.status) === "EXPIRED" || new Date(String(pack.expiry_time)).getTime() <= Date.now())) {
      return {
        ok: false as const,
        code: "expired" as const,
        error: "Your package has expired. Please purchase a new package.",
      };
    }

    const activation = await activateFromPayment(String(row.id), {
      token: data.token,
      info: data.deviceInfo,
    });
    if (!activation.ok) {
      return activationFailure(activation, mapPayment(row));
    }
    return {
      ok: true as const,
      message: activation.queued
        ? "Payment confirmed. Your package is queued and will activate automatically when your current one ends."
        : "Payment confirmed. Reconnecting your package...",
      alreadyActive: Boolean(
        String(row.activation_status) === "ACTIVATED" &&
          pack &&
          String(pack.status) === "ACTIVE",
      ),
      activation,
      payment: mapPayment(row),
    };
  });

export const connectActive = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        token: z.string().min(8),
        phone: z.string().optional(),
        customerId: z.string().optional(),
        deviceInfo: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await expireDuePackages();
    const sql = await getSql();
    const settings = await getSettings();
    const isps = (await sql<SqlRow>`select * from isps`).map(mapIsp);
    const internetUp = isps.some((i) => i.status !== "OFFLINE");
    if (!internetUp) {
      return {
        ok: false as const,
        code: "offline" as const,
        error: "Internet connection is currently unavailable. Please try again later.",
      };
    }

    let customerId = data.customerId ?? null;
    if (!customerId && data.token) {
      const t = await sql<{ id: string }>`
        select id from customers where device_token = ${data.token} limit 1
      `;
      customerId = t[0]?.id ?? null;
    }
    if (!customerId && data.phone) {
      const p = normalizeKenyanPhone(data.phone);
      if (p) {
        const t = await sql<{ id: string }>`
          select id from customers where phone = ${p} limit 1
        `;
        customerId = t[0]?.id ?? null;
      }
    }
    if (!customerId) {
      return { ok: false as const, error: "No active package found on this device." };
    }

    const result = await reconnectCustomer(customerId, {
      token: data.token,
      info: data.deviceInfo,
    });
    if (!result.ok) {
      if (result.reason === "in_use") {
        return {
          ok: false as const,
          code: "in_use" as const,
          error: PACKAGE_IN_USE_MESSAGE,
        };
      }
      if (result.reason === "expired" || result.reason === "none") {
        return {
          ok: false as const,
          code: "expired" as const,
          error: "Your package has expired. Please purchase a new package.",
        };
      }
      if (result.reason === "blocked") {
        return {
          ok: false as const,
          error: "This number is blocked. Please contact the hotspot operator.",
        };
      }
      return {
        ok: false as const,
        code: "router" as const,
        error:
          "Payment received. Your package could not be activated yet. Please use 'Already Paid?' to reconnect.",
      };
    }
    return {
      ok: true as const,
      pack: result.pack,
      hotspotName: settings.hotspotName,
    };
  });

export const getAccount = createServerFn({ method: "POST" })
  .validator((data: unknown) => identitySchema.parse(data))
  .handler(async ({ data }) => {
    await expireDuePackages();
    let access: ActiveAccess = null;
    if (data.customerId) access = await findActiveForCustomer(data.customerId, data.token);
    if (!access && data.token) {
      const sql = await getSql();
      const t = await sql<{ id: string }>`
        select id from customers where device_token = ${data.token} limit 1
      `;
      if (t[0]) access = await findActiveForCustomer(t[0].id, data.token);
    }
    if (!access && data.phone) {
      const p = normalizeKenyanPhone(data.phone);
      if (p) {
        const sql = await getSql();
        const t = await sql<{ id: string }>`
          select id from customers where phone = ${p} limit 1
        `;
        if (t[0]) access = await findActiveForCustomer(t[0].id, data.token);
      }
    }
    const settings = await getSettings();
    let loyalty: { points: number; referralCode: string } | null = null;
    if ((settings.loyaltyEnabled || settings.referralEnabled) && access) {
      const sql = await getSql();
      const rows = await sql<{ loyalty_points: number; referral_code: string }>`
        select loyalty_points, referral_code from customers where id = ${access.customer.id} limit 1
      `;
      if (rows[0]) {
        loyalty = {
          points: Number(rows[0].loyalty_points ?? 0),
          referralCode: String(rows[0].referral_code ?? ""),
        };
      }
    }
    let devices: { info: string | null; boundAt: string; isThisDevice: boolean }[] = [];
    let maxDevicesPerPackage = 1;
    let queued: { packageName: string; startTime: string; expiryTime: string }[] = [];
    let notices: { id: string; message: string; minutes: number; createdAt: string }[] = [];
    let referralStats = { friends: 0, minutesEarned: 0 };
    let bankedMinutes = 0;
    if (access) {
      const sql = await getSql();
      const rows = await sql<{ device_token: string; device_info: string | null; bound_at: string }>`
        select device_token, device_info, bound_at from customer_package_devices
        where customer_package_id = ${access.pack.id}
        order by bound_at asc
      `;
      devices = rows.map((r) => ({
        info: r.device_info,
        boundAt: r.bound_at,
        isThisDevice: r.device_token === data.token,
      }));
      maxDevicesPerPackage = await activePackageMaxDevices(access.customer.id);
      queued = await queuedPackages(access.customer.id);
      const n = await sql<{ id: string; message: string; minutes: number; created_at: string }>`
        select id, message, minutes, created_at from customer_notices
        where customer_id = ${access.customer.id} and seen_at is null
        order by created_at desc limit 5
      `;
      notices = n.map((r) => ({
        id: String(r.id),
        message: String(r.message),
        minutes: Number(r.minutes),
        createdAt: iso(r.created_at),
      }));
      const refs = await sql<{ friends: number; minutes: number }>`
        select
          (select count(*)::int from customers where referred_by_customer_id = ${access.customer.id} and referral_bonus_paid = true) as friends,
          coalesce((select sum(minutes) from customer_notices where customer_id = ${access.customer.id} and kind = 'REFERRAL_BONUS'), 0)::int as minutes
      `;
      referralStats = {
        friends: Number(refs[0]?.friends ?? 0),
        minutesEarned: Number(refs[0]?.minutes ?? 0),
      };
      const bank = await sql<{ b: number }>`
        select bonus_minutes_balance as b from customers where id = ${access.customer.id}
      `;
      bankedMinutes = Number(bank[0]?.b ?? 0);
    }
    return {
      access,
      hotspotName: settings.hotspotName,
      currency: settings.currency,
      loyalty,
      loyaltyEnabled: settings.loyaltyEnabled,
      referralEnabled: settings.referralEnabled,
      devices,
      maxDevicesPerPackage,
      queued,
      notices,
      referralStats,
      bankedMinutes,
    };
  });

export const dismissNotices = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ customerId: z.string(), ids: z.array(z.string()).max(20) }).parse(data),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (data.ids.length > 0) {
      await sql`
        update customer_notices set seen_at = now()
        where customer_id = ${data.customerId} and id = any(${data.ids}) and seen_at is null
      `;
    }
    return { ok: true as const };
  });

/**
 * Phone B's side of "share my package": enter the host's phone number and,
 * if their package has a free device slot, this device joins it. Reuses
 * reconnectCustomer, which is the exact same path a host's own second
 * device takes, so activation/limits/logging all stay consistent.
 */
export const joinHostPackage = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        hostPhone: z.string().min(9).max(15),
        token: z.string().min(8),
        deviceInfo: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const p = normalizeKenyanPhone(data.hostPhone);
    if (!p) {
      return { ok: false as const, error: "Enter a valid phone number." };
    }
    const sql = await getSql();
    const host = await sql<{ id: string; status: string }>`
      select id, status from customers where phone = ${p} limit 1
    `;
    if (!host[0]) {
      return { ok: false as const, error: "No account found for that number." };
    }
    if (host[0].status === "BLOCKED") {
      return { ok: false as const, error: "That account is blocked." };
    }
    const hostId = host[0].id;

    // A device that already has its OWN package running shouldn't silently
    // swap onto someone else's — tell the user plainly instead.
    const own = await sql<{ package_name: string; expiry_time: string }>`
      select pkg.name as package_name, cp.expiry_time
      from customer_packages cp
      join packages pkg on pkg.id = cp.package_id
      where cp.status = 'ACTIVE' and cp.expiry_time > now()
        and cp.customer_id <> ${hostId}
        and (
          cp.customer_id in (select id from customers where device_token = ${data.token})
          or cp.id in (select customer_package_id from customer_package_devices where device_token = ${data.token})
        )
      order by cp.expiry_time desc
      limit 1
    `;
    if (own[0]) {
      return {
        ok: false as const,
        error: `This device already has ${String(own[0].package_name)} running. Let it finish first — or buy another package and it will queue behind it.`,
      };
    }

    const hostActive = await sql<{ id: string }>`
      select id from customer_packages
      where customer_id = ${hostId} and status = 'ACTIVE' and expiry_time > now()
      limit 1
    `;
    if (!hostActive[0]) {
      const hostQueued = await sql<{ id: string }>`
        select id from customer_packages
        where customer_id = ${hostId} and status = 'QUEUED' limit 1
      `;
      return {
        ok: false as const,
        error: hostQueued[0]
          ? "That number's package hasn't started yet, so there's nothing to join. Try again once it's running."
          : "That number has no active package to share.",
      };
    }

    const res = await reconnectCustomer(hostId, {
      token: data.token,
      info: data.deviceInfo ?? "Captive portal (joined)",
    });
    if (!res.ok) {
      const message =
        res.reason === "in_use"
          ? PACKAGE_IN_USE_MESSAGE
          : res.reason === "blocked"
            ? "That account is blocked."
            : res.reason === "expired"
              ? "That package has expired."
              : res.reason === "none"
                ? "That number has no active package to share."
                : "The package is active, but we couldn't connect this device right now. Please try again in a moment.";
      return { ok: false as const, error: message };
    }
    return { ok: true as const, pack: res.pack };
  });


export const redeemVoucherPortal = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        code: z.string().min(4).max(32),
        phone: z.string().min(9).max(15),
        deviceToken: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const res = await redeemVoucher({
        code: data.code,
        phone: data.phone,
        deviceToken: data.deviceToken,
      });
      return { ok: true as const, ...res };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Redeem failed",
      };
    }
  });

export const redeemPoints = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        customerId: z.string(),
        packageId: z.string(),
        deviceToken: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const settings = await getSettings();
    if (!settings.loyaltyEnabled) {
      return { ok: false as const, error: "Loyalty points aren't enabled right now." };
    }
    return redeemPointsForPackage({
      customerId: data.customerId,
      packageId: data.packageId,
      deviceToken: data.deviceToken,
    });
  });
