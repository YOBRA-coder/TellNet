import { getSql } from "@/lib/db";
import { nid, asNumber } from "@/lib/utils";
import {
  MikroTikError,
  createAndActivateUser,
  disableUser,
  disconnectUser,
  randomPassword,
  usernameForPhone,
} from "./mikrotik.server";
import { expireDuePackages } from "./expiry.server";
import { getSettings, logEvent } from "./settings.server";
import { mapCustomerPackage, type SqlRow } from "./rows.server";
import type { CustomerPackage } from "@/lib/types";

function nextIp() {
  const host = 2 + Math.floor(Math.random() * 250);
  return `10.10.0.${host}`;
}

function randomMac() {
  const b = () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0");
  return `02:${b()}:${b()}:${b()}:${b()}:${b()}`.toUpperCase();
}

export async function activateFromPayment(
  paymentId: string,
  device?: { token?: string | null; info?: string | null },
): Promise<{ ok: true; pack: CustomerPackage } | { ok: false; reason: string }> {
  await expireDuePackages();
  const sql = await getSql();

  const pays = await sql<SqlRow>`
    select p.*, pkg.name as package_name, pkg.duration_minutes, pkg.download_kbps,
           pkg.upload_kbps, pkg.data_limit_mb, c.phone as customer_phone, c.status as customer_status
    from payments p
    join packages pkg on pkg.id = p.package_id
    join customers c on c.id = p.customer_id
    where p.id = ${paymentId}
    limit 1
  `;
  const pay = pays[0];
  if (!pay) return { ok: false, reason: "not_found" };
  if (String(pay.status) !== "SUCCESS") return { ok: false, reason: "unpaid" };
  if (String(pay.customer_status) === "BLOCKED") {
    return { ok: false, reason: "blocked" };
  }

  const existing = await sql<SqlRow>`
    select cp.*, pkg.name as package_name
    from customer_packages cp
    join packages pkg on pkg.id = cp.package_id
    where cp.payment_id = ${paymentId}
    limit 1
  `;

  let packRow = existing[0];
  const settings = await getSettings();
  const durationMin = Number(pay.duration_minutes);
  const start = packRow ? new Date(String(packRow.start_time)) : new Date();
  const expiry = packRow
    ? new Date(String(packRow.expiry_time))
    : new Date(start.getTime() + durationMin * 60_000);

  if (expiry.getTime() <= Date.now()) {
    if (packRow) {
      await sql`
        update customer_packages
        set status = 'EXPIRED', activation_status = 'EXPIRED', updated_at = now()
        where id = ${packRow.id}
      `;
    }
    return { ok: false, reason: "expired" };
  }

  const boundToken = packRow?.bound_device_token
    ? String(packRow.bound_device_token)
    : null;
  if (
    settings.oneDevicePerPackage &&
    boundToken &&
    device?.token &&
    device.token !== boundToken
  ) {
    await logEvent(
      "DEVICE_BLOCK",
      `Package for ${String(pay.phone)} refused — already bound to another device.`,
    );
    return { ok: false, reason: "in_use" };
  }

  const username =
    (packRow?.mikrotik_username as string | null) ||
    usernameForPhone(String(pay.phone));
  const password = randomPassword();
  const remaining = Math.max(
    60,
    Math.floor((expiry.getTime() - Date.now()) / 1000),
  );

  const online = (
    await sql<{ n: number }>`
      select count(*)::int as n from sessions where status = 'ACTIVE'
    `
  )[0];
  if (settings.maxUsers > 0 && asNumber(online?.n) >= settings.maxUsers) {
    if (!packRow) {
      const id = nid("cp");
      await sql`
        insert into customer_packages (
          id, customer_id, package_id, payment_id, start_time, expiry_time,
          speed_limit_kbps, data_limit_mb, status, activation_status, mikrotik_username
        ) values (
          ${id}, ${pay.customer_id}, ${pay.package_id}, ${paymentId},
          ${start.toISOString()}, ${expiry.toISOString()},
          ${pay.download_kbps}, ${pay.data_limit_mb},
          'ACTIVE', 'ACTIVATION_FAILED', ${username}
        )
      `;
    }
    await sql`
      update payments
      set activation_status = 'ACTIVATION_FAILED', updated_at = now()
      where id = ${paymentId}
    `;
    await logEvent(
      "CAPACITY",
      `Hotspot at ${settings.maxUsers} users. Payment ${String(pay.mpesa_transaction_id ?? paymentId)} held for retry.`,
    );
    return { ok: false, reason: "capacity" };
  }

  const downloadKbps = Math.min(
    Number(pay.download_kbps),
    settings.perUserMaxKbps || Number(pay.download_kbps),
  );
  const uploadKbps = Math.min(
    Number(pay.upload_kbps),
    settings.perUserMaxKbps || Number(pay.upload_kbps),
  );

  try {
    await createAndActivateUser({
      username,
      password,
      downloadKbps,
      uploadKbps,
      sessionTimeoutSeconds: remaining,
      customerId: String(pay.customer_id),
    });
  } catch (err) {
    const failed = err instanceof MikroTikError;
    if (!packRow) {
      const id = nid("cp");
      await sql`
        insert into customer_packages (
          id, customer_id, package_id, payment_id, start_time, expiry_time,
          speed_limit_kbps, data_limit_mb, status, activation_status, mikrotik_username
        ) values (
          ${id}, ${pay.customer_id}, ${pay.package_id}, ${paymentId},
          ${start.toISOString()}, ${expiry.toISOString()},
          ${pay.download_kbps}, ${pay.data_limit_mb},
          'ACTIVE', 'ACTIVATION_FAILED', ${username}
        )
      `;
    } else {
      await sql`
        update customer_packages
        set activation_status = 'ACTIVATION_FAILED', mikrotik_username = ${username}, updated_at = now()
        where id = ${packRow.id}
      `;
    }
    await sql`
      update payments
      set activation_status = 'ACTIVATION_FAILED', updated_at = now()
      where id = ${paymentId}
    `;
    await logEvent(
      "ACTIVATION_FAILED",
      `Payment ${String(pay.mpesa_transaction_id ?? paymentId)} confirmed but the router could not activate the user.`,
    );
    return {
      ok: false,
      reason: failed ? "router" : "router",
    };
  }

  if (!packRow) {
    const id = nid("cp");
    await sql`
      insert into customer_packages (
        id, customer_id, package_id, payment_id, start_time, expiry_time,
        speed_limit_kbps, data_limit_mb, status, activation_status, mikrotik_username
      ) values (
        ${id}, ${pay.customer_id}, ${pay.package_id}, ${paymentId},
        ${start.toISOString()}, ${expiry.toISOString()},
        ${pay.download_kbps}, ${pay.data_limit_mb},
        'ACTIVE', 'ACTIVATED', ${username}
      )
    `;
    packRow = (await sql<SqlRow>`
      select cp.*, pkg.name as package_name
      from customer_packages cp join packages pkg on pkg.id = cp.package_id
      where cp.id = ${id}
    `)[0];
  } else {
    await sql`
      update customer_packages
      set activation_status = 'ACTIVATED', status = 'ACTIVE',
          mikrotik_username = ${username}, updated_at = now()
      where id = ${packRow.id}
    `;
    packRow = (await sql<SqlRow>`
      select cp.*, pkg.name as package_name
      from customer_packages cp join packages pkg on pkg.id = cp.package_id
      where cp.id = ${packRow.id}
    `)[0];
  }

  if (settings.oneDevicePerPackage && device?.token && packRow) {
    await sql`
      update customer_packages
      set bound_device_token = coalesce(bound_device_token, ${device.token}),
          bound_at = coalesce(bound_at, now()),
          updated_at = now()
      where id = ${packRow.id}
    `;
    packRow = (await sql<SqlRow>`
      select cp.*, pkg.name as package_name
      from customer_packages cp join packages pkg on pkg.id = cp.package_id
      where cp.id = ${packRow.id}
    `)[0];
  }

  await sql`
    update payments
    set activation_status = 'ACTIVATED', updated_at = now()
    where id = ${paymentId}
  `;

  if (device?.token) {
    await sql`
      update customers set device_token = ${device.token}, updated_at = now()
      where id = ${pay.customer_id}
    `;
  }

  await sql`
    update sessions set status = 'DISCONNECTED', session_end = now()
    where customer_id = ${pay.customer_id} and status = 'ACTIVE'
  `;

  const sessionId = nid("ses");
  await sql`
    insert into sessions (
      id, customer_id, package_id, customer_package_id, mikrotik_username,
      ip_address, mac_address, device_information, session_start, last_seen, status
    ) values (
      ${sessionId}, ${pay.customer_id}, ${pay.package_id}, ${packRow.id},
      ${username}, ${nextIp()}, ${randomMac()}, ${device?.info ?? "Captive portal"},
      now(), now(), 'ACTIVE'
    )
  `;

  await logEvent(
    "ACTIVATED",
    `Hotspot user ${username} activated for ${String(pay.phone)}. Package ${String(pay.package_name)} until ${expiry.toISOString()}.`,
  );

  return { ok: true, pack: mapCustomerPackage(packRow) };
}

export async function reconnectCustomer(
  customerId: string,
  device?: { token?: string | null; info?: string | null },
) {
  await expireDuePackages();
  const sql = await getSql();
  const rows = await sql<SqlRow>`
    select cp.*, pkg.name as package_name, pkg.download_kbps, pkg.upload_kbps, c.phone, c.status as customer_status
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
  if (!row) return { ok: false as const, reason: "none" };
  if (String(row.customer_status) === "BLOCKED") {
    return { ok: false as const, reason: "blocked" };
  }
  return activateFromPayment(String(row.payment_id), device);
}

export async function releaseDeviceBind(customerId: string) {
  const sql = await getSql();
  await sql`
    update customer_packages
    set bound_device_token = null,
        bound_mac = null,
        bound_at = null,
        updated_at = now()
    where customer_id = ${customerId} and status = 'ACTIVE'
  `;
  const ses = await sql<{ id: string }>`
    select id from sessions where customer_id = ${customerId} and status = 'ACTIVE'
  `;
  for (const s of ses) await disconnectSession(s.id);
  await logEvent(
    "DEVICE_RELEASE",
    `Device bind released. Another phone can claim this package.`,
  );
}

export async function disconnectSession(sessionId: string) {
  const sql = await getSql();
  const rows = await sql<{ mikrotik_username: string | null }>`
    select mikrotik_username from sessions where id = ${sessionId} limit 1
  `;
  const username = rows[0]?.mikrotik_username;
  if (username) {
    try {
      await disconnectUser(username);
    } catch {
      /* still mark disconnected locally */
    }
  }
  await sql`
    update sessions
    set status = 'DISCONNECTED', session_end = now()
    where id = ${sessionId}
  `;
}

export async function blockCustomer(customerId: string) {
  const sql = await getSql();
  await sql`update customers set status = 'BLOCKED', updated_at = now() where id = ${customerId}`;
  const users = await sql<{ mikrotik_username: string | null }>`
    select mikrotik_username from customer_packages
    where customer_id = ${customerId} and mikrotik_username is not null
  `;
  for (const u of users) {
    if (!u.mikrotik_username) continue;
    try {
      await disconnectUser(u.mikrotik_username);
      await disableUser(u.mikrotik_username);
    } catch {
      /* ledger is source of truth */
    }
  }
  await sql`
    update sessions set status = 'DISCONNECTED', session_end = now()
    where customer_id = ${customerId} and status = 'ACTIVE'
  `;
}

export async function tickLiveUsage() {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    bytes_down: number;
    bytes_up: number;
    last_seen: string;
    speed_limit_kbps: number;
  }>`
    select s.id, s.bytes_down, s.bytes_up, s.last_seen, cp.speed_limit_kbps
    from sessions s
    join customer_packages cp on cp.id = s.customer_package_id
    where s.status = 'ACTIVE'
  `;
  for (const row of rows) {
    const last = new Date(row.last_seen).getTime();
    const elapsed = Math.max(1, (Date.now() - last) / 1000);
    const cap = Number(row.speed_limit_kbps) * 128; // bytes/sec at full rate
    const downAdd = Math.floor(cap * (0.08 + Math.random() * 0.35) * elapsed);
    const upAdd = Math.floor(cap * (0.02 + Math.random() * 0.08) * elapsed);
    await sql`
      update sessions
      set bytes_down = bytes_down + ${downAdd},
          bytes_up = bytes_up + ${upAdd},
          last_seen = now()
      where id = ${row.id}
    `;
  }
}
