import { getSql } from "@/lib/db";
import { disableUser, disconnectUser } from "./mikrotik.server";
import { logEvent } from "./settings.server";

/**
 * Database is the source of truth. Run on every portal/admin read that
 * depends on live access — no browser timer.
 */
export async function expireDuePackages(): Promise<number> {
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
    where cp.status = 'ACTIVE' and cp.expiry_time <= now()
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
  }
  return due.length;
}
