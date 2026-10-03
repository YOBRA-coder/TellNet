import { getSql } from "@/lib/db";
import { nid } from "@/lib/utils";
import { activateFromPayment } from "./activation.server";
import { logEvent } from "./settings.server";
import type { SqlRow } from "./rows.server";

function randomCode(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

export async function generateVouchers(input: {
  packageId: string;
  count: number;
  siteId?: string | null;
  batchLabel?: string | null;
  expiresAt?: string | null;
}) {
  const sql = await getSql();
  const pkg = (
    await sql<SqlRow>`select * from packages where id = ${input.packageId} and status = 'ACTIVE' limit 1`
  )[0];
  if (!pkg) throw new Error("Package not found.");
  const count = Math.min(500, Math.max(1, input.count));
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let code = randomCode(10);
    for (let t = 0; t < 5; t++) {
      const exists = await sql`select 1 from vouchers where code = ${code} limit 1`;
      if (!exists.length) break;
      code = randomCode(10);
    }
    const id = nid("vch");
    await sql`
      insert into vouchers (
        id, code, package_id, site_id, status, batch_label, expires_at
      ) values (
        ${id}, ${code}, ${input.packageId},
        ${input.siteId ?? pkg.site_id ?? "site_default"},
        'AVAILABLE', ${input.batchLabel ?? null},
        ${input.expiresAt ?? null}
      )
    `;
    codes.push(code);
  }
  await logEvent("VOUCHER", `Generated ${codes.length} vouchers for ${pkg.name}.`);
  return codes;
}

export async function redeemVoucher(input: {
  code: string;
  phone: string;
  deviceToken?: string | null;
}) {
  const sql = await getSql();
  const code = input.code.trim().toUpperCase();
  const phone = input.phone.replace(/\D/g, "");
  const normalized =
    phone.startsWith("254") && phone.length === 12
      ? phone
      : phone.startsWith("0") && phone.length === 10
        ? `254${phone.slice(1)}`
        : phone.length === 9 && phone.startsWith("7")
          ? `254${phone}`
          : null;
  if (!normalized) throw new Error("Enter a valid M-Pesa phone number.");

  const v = (
    await sql<SqlRow>`
      select * from vouchers where code = ${code} limit 1
    `
  )[0];
  if (!v) throw new Error("Invalid voucher code.");
  if (String(v.status) !== "AVAILABLE") throw new Error("This voucher was already used.");
  if (v.expires_at && new Date(String(v.expires_at)).getTime() < Date.now()) {
    await sql`update vouchers set status = 'EXPIRED', updated_at = now() where id = ${v.id}`;
    throw new Error("This voucher has expired.");
  }

  const pkg = (
    await sql<SqlRow>`select * from packages where id = ${v.package_id} limit 1`
  )[0];
  if (!pkg || String(pkg.status) !== "ACTIVE") {
    throw new Error("Package for this voucher is unavailable.");
  }

  {
    const { getHoursForSite, purchaseBlockedReason } = await import("./hours.server");
    const closedMsg = purchaseBlockedReason(
      await getHoursForSite(v.site_id ? String(v.site_id) : null),
      String(pkg.duration_kind ?? ""),
      true,
    );
    if (closedMsg) throw new Error(closedMsg);
  }

  const gate = (
    await sql<{ require_account_multi_device: boolean | null }>`
      select require_account_multi_device from settings where id = 'default' limit 1
    `
  )[0];
  if ((gate?.require_account_multi_device ?? true) && Number(pkg.max_devices) >= 2) {
    const { getSessionCustomer } = await import("./customer-auth.server");
    const member = await getSessionCustomer(input.deviceToken);
    if (!member?.registered) {
      throw new Error("This voucher is for a 2-device package. Create a free account (Sign up) and try again.");
    }
  }

  let customer = (
    await sql<SqlRow>`select * from customers where phone = ${normalized} limit 1`
  )[0];
  if (!customer) {
    const cid = nid("cus");
    // Referral codes are issued at sign up only, never to voucher guests.
    await sql`
      insert into customers (id, phone, device_token, status, site_id)
      values (${cid}, ${normalized}, ${input.deviceToken ?? null}, 'ACTIVE', ${v.site_id ?? "site_default"})
    `;
    customer = (await sql<SqlRow>`select * from customers where id = ${cid}`)[0];
  }
  if (String(customer.status) === "BLOCKED") {
    throw new Error("This phone is blocked. Contact the operator.");
  }

  const paymentId = nid("pay");
  await sql`
    insert into payments (
      id, customer_id, package_id, mpesa_transaction_id, phone, amount,
      status, activation_status, result_code, result_desc, transaction_date,
      site_id, created_at, updated_at
    ) values (
      ${paymentId}, ${customer.id}, ${pkg.id}, ${"VCH-" + code}, ${normalized},
      ${pkg.price}, 'SUCCESS', 'NOT_ACTIVATED', 0, 'Voucher redeemed',
      now(), ${v.site_id ?? "site_default"}, now(), now()
    )
  `;

  await sql`
    update vouchers
    set status = 'REDEEMED',
        redeemed_by_customer_id = ${customer.id},
        redeemed_payment_id = ${paymentId},
        redeemed_at = now(),
        updated_at = now()
    where id = ${v.id} and status = 'AVAILABLE'
  `;

  const act = await activateFromPayment(paymentId, {
    token: input.deviceToken ?? undefined,
  } as { token?: string });

  return {
    paymentId,
    packageName: String(pkg.name),
    activationOk: act.ok,
    queued: act.ok && Boolean(act.queued),
  };
}

export async function listVouchers(filter?: { status?: string; limit?: number }) {
  const sql = await getSql();
  const limit = filter?.limit ?? 100;
  if (filter?.status) {
    return sql<SqlRow>`
      select v.*, p.name as package_name
      from vouchers v join packages p on p.id = v.package_id
      where v.status = ${filter.status}
      order by v.created_at desc
      limit ${limit}
    `;
  }
  return sql<SqlRow>`
    select v.*, p.name as package_name
    from vouchers v join packages p on p.id = v.package_id
    order by v.created_at desc
    limit ${limit}
  `;
}

// ---------------------------------------------------------------------------
// Management: paging/filtering, batches, deleting, auto-clean, printing
// ---------------------------------------------------------------------------

export type VoucherStatusFilter = "AVAILABLE" | "REDEEMED" | "EXPIRED";

export async function listVouchersPage(input: {
  status?: VoucherStatusFilter;
  /** batch label; "" = vouchers with no label; undefined = every batch */
  batch?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const sql = await getSql();
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 50));
  const page = Math.max(1, input.page ?? 1);
  const status = input.status ?? null;
  const batch = input.batch ?? null;
  const search = input.search?.trim() ? `%${input.search.trim().toUpperCase()}%` : null;

  // "Expired" is either stored as EXPIRED or an AVAILABLE code past its date.
  // (The tagged-template client can't embed one query in another, so the
  // shared SELECT is spelled out in each statement.)
  const rows = await sql<SqlRow>`
    with t as (
      select v.id, v.code, v.batch_label, v.created_at, v.redeemed_at, v.expires_at,
             p.name as package_name,
             case when v.status = 'AVAILABLE' and v.expires_at is not null and v.expires_at < now()
                  then 'EXPIRED' else v.status end as eff_status
      from vouchers v join packages p on p.id = v.package_id
    )
    select * from t
    where (${status}::text is null or eff_status = ${status})
      and (${batch}::text is null or coalesce(batch_label, '') = ${batch})
      and (${search}::text is null or code ilike ${search})
    order by created_at desc, code
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `;
  const total = (
    await sql<{ n: number }>`
      with t as (
        select v.code, v.batch_label,
               case when v.status = 'AVAILABLE' and v.expires_at is not null and v.expires_at < now()
                    then 'EXPIRED' else v.status end as eff_status
        from vouchers v
      )
      select count(*)::int as n from t
      where (${status}::text is null or eff_status = ${status})
        and (${batch}::text is null or coalesce(batch_label, '') = ${batch})
        and (${search}::text is null or code ilike ${search})
    `
  )[0]?.n ?? 0;
  const countRows = await sql<{ s: string; n: number }>`
    with t as (
      select v.batch_label,
             case when v.status = 'AVAILABLE' and v.expires_at is not null and v.expires_at < now()
                  then 'EXPIRED' else v.status end as eff_status
      from vouchers v
    )
    select eff_status as s, count(*)::int as n from t
    where (${batch}::text is null or coalesce(batch_label, '') = ${batch})
    group by eff_status
  `;
  const counts = { AVAILABLE: 0, REDEEMED: 0, EXPIRED: 0 } as Record<string, number>;
  for (const c of countRows) counts[c.s] = Number(c.n);
  const batches = await sql<{ label: string; total: number; available: number; redeemed: number; expired: number; last_created: string }>`
    with t as (
      select v.batch_label, v.created_at,
             case when v.status = 'AVAILABLE' and v.expires_at is not null and v.expires_at < now()
                  then 'EXPIRED' else v.status end as eff_status
      from vouchers v
    )
    select coalesce(batch_label, '') as label,
           count(*)::int as total,
           count(*) filter (where eff_status = 'AVAILABLE')::int as available,
           count(*) filter (where eff_status = 'REDEEMED')::int as redeemed,
           count(*) filter (where eff_status = 'EXPIRED')::int as expired,
           max(created_at) as last_created
    from t group by 1 order by max(created_at) desc
  `;
  return { rows, total, page, pageSize, counts, batches };
}

/** Delete vouchers. Payment history is untouched (it keeps its own VCH-<code> reference). */
export async function deleteVouchers(input: {
  mode: "redeemed" | "expired" | "batch" | "ids";
  batch?: string;
  ids?: string[];
}): Promise<number> {
  const sql = await getSql();
  const batch = input.batch ?? null;
  let res: { id: string }[] = [];
  if (input.mode === "ids") {
    const ids = (input.ids ?? []).slice(0, 500);
    if (ids.length === 0) return 0;
    res = await sql<{ id: string }>`delete from vouchers where id = any(${ids}) returning id`;
  } else if (input.mode === "batch") {
    if (batch == null) return 0;
    res = await sql<{ id: string }>`
      delete from vouchers where coalesce(batch_label, '') = ${batch} returning id
    `;
  } else if (input.mode === "redeemed") {
    res = await sql<{ id: string }>`
      delete from vouchers
      where status = 'REDEEMED' and (${batch}::text is null or coalesce(batch_label, '') = ${batch})
      returning id
    `;
  } else {
    res = await sql<{ id: string }>`
      delete from vouchers
      where (status = 'EXPIRED' or (status = 'AVAILABLE' and expires_at is not null and expires_at < now()))
        and (${batch}::text is null or coalesce(batch_label, '') = ${batch})
      returning id
    `;
  }
  if (res.length > 0) await logEvent("VOUCHER", `Deleted ${res.length} voucher(s) (${input.mode}).`);
  return res.length;
}

/** Auto-clean: drop REDEEMED vouchers older than the configured number of days. */
export async function autoCleanVouchers(): Promise<number> {
  const sql = await getSql();
  const cfg = (
    await sql<{ d: number | null }>`select voucher_auto_clean_days as d from settings where id = 'default' limit 1`
  )[0];
  const days = Number(cfg?.d ?? 0);
  if (!(days > 0)) return 0;
  const res = await sql<{ id: string }>`
    delete from vouchers
    where status = 'REDEEMED' and redeemed_at is not null
      and redeemed_at < now() - (${days} * interval '1 day')
    returning id
  `;
  return res.length;
}

/** Unused vouchers with everything a printed slip needs. */
export async function vouchersForPrint(input: { batch?: string; ids?: string[] }) {
  const sql = await getSql();
  const batch = input.batch ?? null;
  const ids = input.ids && input.ids.length > 0 ? input.ids.slice(0, 500) : null;
  return sql<{ code: string; package_name: string; price: number; duration_minutes: number; max_devices: number; expires_at: string | null; batch_label: string | null }>`
    select v.code, p.name as package_name, p.price, p.duration_minutes, p.max_devices, v.expires_at, v.batch_label
    from vouchers v join packages p on p.id = v.package_id
    where v.status = 'AVAILABLE' and (v.expires_at is null or v.expires_at > now())
      and (${ids}::text[] is null or v.id = any(${ids}))
      and (${batch}::text is null or coalesce(v.batch_label, '') = ${batch})
    order by v.created_at desc, v.code
    limit 500
  `;
}
