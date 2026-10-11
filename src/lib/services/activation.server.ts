import { countOnlineAtSite, getEffectiveCapacity } from "@/lib/services/capacity.server";
import { getSql } from "@/lib/db";
import { nid, asNumber } from "@/lib/utils";
import {
  MikroTikError,
  createAndActivateUser,
  getRouterCredentialsById,
  randomPassword,
  rosList,
  usernameForPhone,
} from "./mikrotik.server";
import {
  HardwareError,
  authorizeOnHardware,
  disableUser,
  disconnectUser,
  linkAuthorization,
  resolveHardwareTarget,
} from "./hardware";
import { expireDuePackages } from "./expiry.server";
import { awardLoyaltyForPayment, applyReferralMinutesForPayment } from "./loyalty.server";
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
  device?: {
    token?: string | null;
    info?: string | null;
    /**
     * The site the person is at RIGHT NOW (from the portal link). Decides Omada/Ruijie vs MikroTik for
     * reconnects, "Already paid?", vouchers and points, whose payment/voucher may belong to another site.
     */
    siteId?: string | null;
  },
  /**
   * promote: set only by the expiry job when it is this queued package's
   * turn. Every other caller (retry buttons, "Already paid?", reconnects)
   * re-running a payment whose package is still QUEUED must NOT start it
   * early — that used to skip the queue and overlap the running package.
   */
  opts?: { promote?: boolean },
): Promise<
  | { ok: true; pack: CustomerPackage; queued?: boolean }
  | { ok: false; reason: string }
> {
  await expireDuePackages();
  const sql = await getSql();

  const pays = await sql<SqlRow>`
    select p.*, pkg.name as package_name, pkg.duration_minutes, pkg.download_kbps,
           pkg.upload_kbps, pkg.data_limit_mb, pkg.category as package_category,
           pkg.max_devices as package_max_devices,
           c.phone as customer_phone, c.status as customer_status
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

  // Points are earned for the payment itself, independent of whether the
  // router activation below succeeds (that can fail and retry later —
  // the customer still paid). awardLoyaltyForPayment() is idempotent per
  // payment id, so this is safe however many times activation is retried
  // or a package is later auto-resumed.
  try {
    await awardLoyaltyForPayment(paymentId);
  } catch (err) {
    console.error("[loyalty] award failed for payment", paymentId, err);
  }

  // Referral/welcome minutes (idempotent per payment — see
  // applyReferralMinutesForPayment). Only ever non-zero the first time
  // this payment is activated, so it's safe to fold into a fresh
  // customer_packages row below without double-counting on reconnects.
  let referralExtraMinutes = 0;
  try {
    referralExtraMinutes = await applyReferralMinutesForPayment(paymentId);
  } catch (err) {
    console.error("[referral] minutes award failed for payment", paymentId, err);
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
  const isQueuedRow = Boolean(packRow && String(packRow.status) === "QUEUED");
  if (packRow && isQueuedRow && !opts?.promote) {
    return { ok: true, pack: mapCustomerPackage(packRow), queued: true };
  }

  // A row that already exists (resume, retry, promotion, or an operator's
  // "change package") is governed by ITS package, not the package the
  // payment was originally for — otherwise a reconnect would silently undo
  // a speed change.
  let effDownload = Number(pay.download_kbps);
  let effUpload = Number(pay.upload_kbps);
  let effCategory = String(pay.package_category ?? "STANDARD");
  let effMaxDevices = Number(pay.package_max_devices);
  if (packRow && String(packRow.package_id) !== String(pay.package_id)) {
    const cur = (
      await sql<SqlRow>`
        select download_kbps, upload_kbps, category, max_devices
        from packages where id = ${packRow.package_id} limit 1
      `
    )[0];
    if (cur) {
      effDownload = Number(cur.download_kbps);
      effUpload = Number(cur.upload_kbps);
      effCategory = String(cur.category ?? "STANDARD");
      effMaxDevices = Number(cur.max_devices);
    }
  }
  const packageMaxDevices = effMaxDevices >= 2 ? 2 : 1;
  const durationMin = Number(pay.duration_minutes) + referralExtraMinutes;

  // Stacking: this is a brand-new payment (no customer_package row for it
  // yet) — if the customer already has paid-for time running (an ACTIVE or
  // already-QUEUED package that hasn't expired), don't cut that short.
  // Queue this one to start the moment the last bit of coverage runs out,
  // instead of disconnecting the live session and replacing it. A resume,
  // retry or router-recovery re-run of this SAME payment (packRow present)
  // always falls through below — that's what promotes a queued package to
  // ACTIVE once expireDuePackages() decides it's its turn.
  if (!packRow) {
    const coverage = await sql<{ latest: string | null }>`
      select max(expiry_time) as latest from customer_packages
      where customer_id = ${pay.customer_id}
        and status in ('ACTIVE', 'QUEUED')
        and expiry_time > now()
    `;
    const latestCovered = coverage[0]?.latest ? new Date(String(coverage[0].latest)) : null;
    if (latestCovered && latestCovered.getTime() > Date.now()) {
      const qStart = latestCovered;
      const qExpiry = new Date(qStart.getTime() + durationMin * 60_000);
      const id = nid("cp");
      const username = usernameForPhone(String(pay.phone));
      await sql`
        insert into customer_packages (
          id, customer_id, package_id, payment_id, start_time, expiry_time,
          speed_limit_kbps, data_limit_mb, status, activation_status, mikrotik_username
        ) values (
          ${id}, ${pay.customer_id}, ${pay.package_id}, ${paymentId},
          ${qStart.toISOString()}, ${qExpiry.toISOString()},
          ${pay.download_kbps}, ${pay.data_limit_mb},
          'QUEUED', 'QUEUED', ${username}
        )
      `;
      await sql`
        update payments set activation_status = 'QUEUED', updated_at = now()
        where id = ${paymentId}
      `;
      await logEvent(
        "QUEUED",
        `Package ${String(pay.package_name)} queued for ${String(pay.phone)} — will start automatically at ${qStart.toISOString()} when the current package ends.`,
      );
      const queuedRow = (
        await sql<SqlRow>`
          select cp.*, pkg.name as package_name
          from customer_packages cp join packages pkg on pkg.id = cp.package_id
          where cp.id = ${id}
        `
      )[0];
      return { ok: true, pack: mapCustomerPackage(queuedRow), queued: true };
    }
  }

  // Promotion: the queued package's clock starts NOW (not at the moment it
  // was scheduled to), so any gap — router down, late job — never eats the
  // time the customer paid for.
  const start = !packRow || isQueuedRow ? new Date() : new Date(String(packRow.start_time));
  const expiry = packRow
    ? isQueuedRow
      ? new Date(
          start.getTime() +
            (new Date(String(packRow.expiry_time)).getTime() -
              new Date(String(packRow.start_time)).getTime()),
        )
      : new Date(String(packRow.expiry_time))
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

  const boundTokens = packRow
    ? (
        await sql<{ device_token: string }>`
          select device_token from customer_package_devices where customer_package_id = ${packRow.id}
        `
      ).map((r) => r.device_token)
    : [];
  const deviceAlreadyBound = Boolean(device?.token && boundTokens.includes(device.token));

  if (
    settings.oneDevicePerPackage &&
    device?.token &&
    !deviceAlreadyBound &&
    boundTokens.length >= packageMaxDevices
  ) {
    await logEvent(
      "DEVICE_BLOCK",
      `Package for ${String(pay.phone)} refused — already in use on ${boundTokens.length} device(s) (limit ${packageMaxDevices}).`,
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

  // Limits follow the ISP path(s) currently connected (see capacity.server.ts).
  // ...of THIS site only: seats and speed caps come from the ISP paths in the site the person is at.
  const capSite = String(device?.siteId ?? pay.site_id ?? "site_default");
  const capacity = await getEffectiveCapacity(capSite);
  const onlineHere = await countOnlineAtSite(capSite);
  if (capacity.maxUsers > 0 && onlineHere >= capacity.maxUsers) {
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
      `Hotspot at ${capacity.maxUsers} users. Payment ${String(pay.mpesa_transaction_id ?? paymentId)} held for retry.`,
    );
    return { ok: false, reason: "capacity" };
  }

  const downloadKbps = Math.min(effDownload, capacity.perUserMaxKbps || effDownload);
  const uploadKbps = Math.min(effUpload, capacity.perUserMaxKbps || effUpload);

  // Omada / Ruijie customers are switched on by their vendor driver (keyed by the
  // client MAC the portal redirect gave us). Everyone else takes the original
  // MikroTik path below, unchanged.
  let hwAuth: Awaited<ReturnType<typeof authorizeOnHardware>> | null = null;
  let activationError = "";
  try {
    const hwTarget = await resolveHardwareTarget({
      deviceToken: device?.token,
      customerId: String(pay.customer_id),
      siteId: device?.siteId ?? (pay.site_id ? String(pay.site_id) : null),
    });
    if (hwTarget) {
      // Bought while the site is closed (an allowed package type): the package is paid and
      // running, but the device is only switched on once the site opens (portal "Reconnect").
      const { isRouterClosedNow } = await import("./hours.server");
      if (!(await isRouterClosedNow(hwTarget.router.id))) {
        hwAuth = await authorizeOnHardware(hwTarget, { username, seconds: remaining });
      }
    } else {
      await createAndActivateUser({
        username,
        password,
        downloadKbps,
        uploadKbps,
        sessionTimeoutSeconds: remaining,
        customerId: String(pay.customer_id),
        maxDevices: settings.oneDevicePerPackage ? packageMaxDevices : 1,
        category: effCategory === "STUDENT" ? "STUDENT" : "STANDARD",
        blockedDomains:
          effCategory === "STUDENT"
            ? settings.studentBlockedDomains
                .split(",")
                .map((d) => d.trim())
                .filter(Boolean)
            : undefined,
      });
      // Bought (or re-pushed) while the router is closed for the night: the
      // login exists but stays switched off until the router opens.
      const { isPrimaryClosed } = await import("./hours.server");
      if (await isPrimaryClosed()) await disableUser(username).catch(() => {});
    }
  } catch (err) {
    const failed = err instanceof MikroTikError || err instanceof HardwareError;
    if (err instanceof HardwareError) activationError = ` ${err.message}`;
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
      // A promoted queued package that failed to reach the router becomes
      // ACTIVE + ACTIVATION_FAILED, exactly like a fresh purchase that
      // failed, so the normal retry path (which never re-queues) finishes it.
      await sql`
        update customer_packages
        set activation_status = 'ACTIVATION_FAILED', mikrotik_username = ${username},
            status = 'ACTIVE',
            start_time = ${start.toISOString()}, expiry_time = ${expiry.toISOString()},
            updated_at = now()
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
      `Payment ${String(pay.mpesa_transaction_id ?? paymentId)} confirmed but the router could not activate the user.${activationError}`,
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
          start_time = ${start.toISOString()}, expiry_time = ${expiry.toISOString()},
          speed_limit_kbps = ${effDownload},
          mikrotik_username = ${username}, updated_at = now()
      where id = ${packRow.id}
    `;
    packRow = (await sql<SqlRow>`
      select cp.*, pkg.name as package_name
      from customer_packages cp join packages pkg on pkg.id = cp.package_id
      where cp.id = ${packRow.id}
    `)[0];
  }

  // Same secret the router user was just given, so RADIUS (multi-AP) can
  // authenticate this login too.
  await sql`
    update customer_packages set radius_password = ${password} where id = ${packRow.id}
  `;
  if (hwAuth) await linkAuthorization(username, String(packRow.id));

  if (
    settings.oneDevicePerPackage &&
    device?.token &&
    packRow &&
    !deviceAlreadyBound &&
    boundTokens.length < packageMaxDevices
  ) {
    await sql`
      insert into customer_package_devices (customer_package_id, device_token, device_info)
      values (${packRow.id}, ${device.token}, ${device?.info ?? null})
      on conflict do nothing
    `;
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

  // A second device joining a multi-device package must not end the first
  // device's live session — only a re-activation of the same device (or a
  // promotion with no device) replaces the previous session record.
  const joiningSharedDevice = Boolean(
    device?.token && !deviceAlreadyBound && boundTokens.length > 0 && packageMaxDevices >= 2,
  );
  if (!joiningSharedDevice) {
    await sql`
      update sessions set status = 'DISCONNECTED', session_end = now()
      where customer_id = ${pay.customer_id} and status = 'ACTIVE'
    `;
  }

  const sessionId = nid("ses");
  await sql`
    insert into sessions (
      id, customer_id, package_id, customer_package_id, mikrotik_username,
      ip_address, mac_address, device_information, session_start, last_seen, status
    ) values (
      ${sessionId}, ${pay.customer_id}, ${pay.package_id}, ${packRow.id},
      ${username}, ${hwAuth?.clientIp ?? nextIp()}, ${hwAuth?.clientMac ?? randomMac()}, ${device?.info ?? "Captive portal"},
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
  device?: { token?: string | null; info?: string | null; siteId?: string | null },
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
  // Omada/Ruijie site that is closed: nothing to switch on yet. Say so instead of failing the payment.
  const hwTarget = await resolveHardwareTarget({
    deviceToken: device?.token,
    customerId,
    siteId: device?.siteId ?? null,
  });
  if (hwTarget) {
    const { isRouterClosedNow } = await import("./hours.server");
    if (await isRouterClosedNow(hwTarget.router.id)) return { ok: false as const, reason: "closed" };
  }
  return activateFromPayment(String(row.payment_id), device);
}

export async function releaseDeviceBind(customerId: string) {
  const sql = await getSql();
  await sql`
    delete from customer_package_devices
    where customer_package_id in (
      select id from customer_packages where customer_id = ${customerId} and status = 'ACTIVE'
    )
  `;
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

let lastUsageSync = 0;

/**
 * Bring each live session's traffic and IP up to date from the router itself.
 *  - MikroTik: the hotspot "active" list (bytes-out = to the customer = Down, bytes-in = Up).
 *    A customer with two devices on one login has the counters added up.
 *  - Omada / Ruijie: the controller/gateway does not give us per-client traffic, so nothing
 *    is invented: the counters stay at 0 and the Live users page shows "n/a" for those rows.
 * Never throws; an unreachable router just keeps its last known numbers. At most once per 10 s,
 * however many admin screens are open.
 */
export async function tickLiveUsage() {
  if (Date.now() - lastUsageSync < 10_000) return;
  lastUsageSync = Date.now();
  const sql = await getSql();
  const routers = await sql<{ id: string }>`select id from mikrotiks where hardware_type = 'mikrotik'`;
  const wanted = new Set(
    (
      await sql<{ u: string }>`
        select distinct mikrotik_username as u from sessions
        where status = 'ACTIVE' and mikrotik_username is not null
          and mikrotik_username not in (select username from hw_authorizations)
      `
    ).map((r) => r.u),
  );
  if (wanted.size === 0) return;
  await Promise.all(
    routers.map(async (r) => {
      try {
        const creds = await getRouterCredentialsById(r.id);
        if (!creds) return;
        const active = await rosList(creds, "/ip/hotspot/active");
        const totals = new Map<string, { down: number; up: number; ip: string | null }>();
        for (const a of active) {
          const user = String(a.user ?? "");
          if (!wanted.has(user)) continue;
          const cur = totals.get(user) ?? { down: 0, up: 0, ip: null };
          cur.down += Number.parseInt(String(a["bytes-out"] ?? "0"), 10) || 0;
          cur.up += Number.parseInt(String(a["bytes-in"] ?? "0"), 10) || 0;
          cur.ip = cur.ip ?? (a.address ? String(a.address) : null);
          totals.set(user, cur);
        }
        for (const [user, t] of totals) {
          await sql`
            update sessions set
              bytes_down = greatest(bytes_down, ${t.down}),
              bytes_up = greatest(bytes_up, ${t.up}),
              ip_address = coalesce(${t.ip}, ip_address),
              last_seen = now()
            where status = 'ACTIVE' and mikrotik_username = ${user}
          `;
        }
      } catch (err) {
        console.error("[usage]", r.id, err instanceof Error ? err.message : err);
      }
    }),
  );
}
