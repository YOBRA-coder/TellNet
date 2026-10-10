import { getSql } from "@/lib/db";
import { disableUser, disconnectUser } from "./hardware";
import { logEvent } from "./settings.server";

/**
 * Database is the source of truth. Run on every portal/admin read that
 * depends on live access — no browser timer.
 */
let sweeping = false;

export async function expireDuePackages(): Promise<number> {
  // Promoting a queued package calls activateFromPayment(), which itself
  // starts with expireDuePackages(). Without this guard that nesting would
  // re-enter the sweep (and its stranded-package pass) forever. A second
  // concurrent caller skipping is harmless — the first is already doing it.
  if (sweeping) return 0;
  sweeping = true;
  try {
    const n = await sweepExpired();
    await tidyVouchers().catch((err) => console.error("[expiry] voucher tidy failed", err));
    return n;
  } finally {
    sweeping = false;
  }
}

async function sweepExpired(): Promise<number> {
  const sql = await getSql();
  const due = await sql<{
    id: string;
    customer_id: string;
    payment_id: string;
    mikrotik_username: string | null;
    phone: string;
  }>`
    select cp.id, cp.customer_id, cp.payment_id, cp.mikrotik_username, c.phone
    from customer_packages cp
    join customers c on c.id = cp.customer_id
    join packages pkg on pkg.id = cp.package_id
    join payments pay on pay.id = cp.payment_id
    where cp.status = 'ACTIVE' and cp.expiry_time <= now()
      -- Time is paused while a router with "pause time during outages" is down
      -- (up to 72h): the package is credited when the router answers again.
      -- Only Daily / Weekly / Monthly and voucher packages are covered;
      -- hourly packages keep running through a blackout.
      and not (
        (coalesce(pkg.duration_kind, '') in ('DAILY', 'WEEKLY', 'MONTHLY')
          or coalesce(pay.mpesa_transaction_id, '') like 'VCH-%')
        and exists (
          select 1 from mikrotiks m
          where ((m.pause_on_outage and m.down_since is not null
                  and m.down_since > now() - interval '72 hours')
              or (m.hours_enabled and m.hours_pause and m.hours_state = 'CLOSED'
                  and m.closed_since is not null and m.closed_since > now() - interval '72 hours'))
            and (m.is_primary or coalesce(m.site_id, 'site_default') = coalesce(c.site_id, 'site_default'))
        )
      )
  `;

  for (const row of due) {
    await sql`
      update customer_packages
      set status = 'EXPIRED', activation_status = 'EXPIRED', updated_at = now()
      where id = ${row.id}
    `;
    await sql`
      update payments
      set activation_status = 'EXPIRED', updated_at = now()
      where id = ${row.payment_id}
    `;
    await sql`
      update sessions
      set status = 'EXPIRED', session_end = now()
      where customer_package_id = ${row.id} and status = 'ACTIVE'
    `;
    if (row.mikrotik_username) {
      try {
        await disconnectUser(row.mikrotik_username);
        await disableUser(row.mikrotik_username);
      } catch {
        /* router down — package is still expired in the ledger */
      }
    }
    await logEvent(
      "EXPIRE",
      `Package for ${row.phone} reached expiry. Session ended, hotspot user disabled.`,
    );

    // A package bought while this one was still running was queued instead
    // of overwriting it (see activateFromPayment). Now that this one is
    // actually done, promote the oldest queued package for the same
    // customer — same activation path as everything else, so router setup,
    // device binding and sessions all get created exactly the way a fresh
    // purchase would.
    const nextQueued = await sql<{ payment_id: string }>`
      select payment_id from customer_packages
      where customer_id = ${row.customer_id} and status = 'QUEUED'
      order by start_time asc
      limit 1
    `;
    if (nextQueued[0]) {
      try {
        const { activateFromPayment } = await import("./activation.server");
        await activateFromPayment(String(nextQueued[0].payment_id), undefined, {
          promote: true,
        });
      } catch (err) {
        console.error(
          "[expiry] failed to promote queued package for",
          row.customer_id,
          err,
        );
      }
    }
  }

  // Safety net: a queued package whose turn has come but that was never
  // promoted (the package ahead of it was revoked or removed, an earlier
  // promotion threw, the server restarted mid-loop) must not sit QUEUED
  // forever while the customer has nothing running.
  const stranded = await sql<{ payment_id: string }>`
    select distinct on (q.customer_id) q.payment_id
    from customer_packages q
    where q.status = 'QUEUED'
      and q.start_time <= now()
      and not exists (
        select 1 from customer_packages a
        where a.customer_id = q.customer_id and a.status = 'ACTIVE' and a.expiry_time > now()
      )
    order by q.customer_id, q.start_time asc
  `;
  for (const row of stranded) {
    try {
      const { activateFromPayment } = await import("./activation.server");
      await activateFromPayment(String(row.payment_id), undefined, { promote: true });
    } catch (err) {
      console.error("[expiry] failed to promote stranded queued package", err);
    }
  }
  return due.length;
}

let lastVoucherTidy = 0;
/** At most once a minute: mark lapsed vouchers EXPIRED and apply the auto-delete setting. */
async function tidyVouchers() {
  if (Date.now() - lastVoucherTidy < 60_000) return;
  lastVoucherTidy = Date.now();
  const sql = await getSql();
  await sql`
    update vouchers set status = 'EXPIRED', updated_at = now()
    where status = 'AVAILABLE' and expires_at is not null and expires_at < now()
  `;
  const { autoCleanVouchers } = await import("./vouchers.server");
  await autoCleanVouchers();
}
