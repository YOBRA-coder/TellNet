import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { normalizeKenyanPhone } from "@/lib/phone";
import { initiateStkPush, queryStkStatus } from "@/lib/services/mpesa.server";
import { redeemVoucher } from "@/lib/services/vouchers.server";
import { activateFromPayment, reconnectCustomer } from "@/lib/services/activation.server";
import { expireDuePackages } from "@/lib/services/expiry.server";
import { getSettings } from "@/lib/services/settings.server";
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
    select cp.*, pkg.name as package_name, c.phone, c.status as customer_status, c.created_at
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
  const otherDevice = Boolean(
    settings.oneDevicePerPackage &&
      pack.boundDeviceToken &&
      deviceToken &&
      pack.boundDeviceToken !== deviceToken,
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

export const getPortalBootstrap = createServerFn({ method: "POST" })
  .validator((data: unknown) => identitySchema.parse(data))
  .handler(async ({ data }) => {
    const catalog = await loadCatalog();
    const sql = await getSql();

    let access: ActiveAccess = null;
    const phone = data.phone ? normalizeKenyanPhone(data.phone) : null;

    if (data.customerId) {
      access = await findActiveForCustomer(data.customerId, data.token);
    }
    if (!access && data.token) {
      const byToken = await sql<{ id: string }>`
        select id from customers where device_token = ${data.token} limit 1
      `;
      if (byToken[0]) access = await findActiveForCustomer(byToken[0].id, data.token);
    }
    if (!access && phone) {
      const byPhone = await sql<{ id: string }>`
        select id from customers where phone = ${phone} limit 1
      `;
      if (byPhone[0]) access = await findActiveForCustomer(byPhone[0].id, data.token);
    }

    return {
      ...catalog,
      access,
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
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const phone = normalizeKenyanPhone(data.phone);
    if (!phone) {
      return { ok: false as const, error: "Enter a valid Kenyan M-Pesa number." };
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
      await sql`
        insert into customers (id, phone, device_token, status)
        values (${customerId}, ${phone}, ${data.token}, 'ACTIVE')
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
      return {
        ok: false as const,
        error:
          err instanceof Error
            ? err.message
            : "Could not send the M-Pesa prompt. Please try again.",
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
      message: "Payment confirmed. Reconnecting your package...",
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
    return { access, hotspotName: settings.hotspotName, currency: settings.currency };
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
