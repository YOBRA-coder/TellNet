import { getSql } from "@/lib/db";
import { activateFromPayment } from "@/lib/services/activation.server";
import { expireDuePackages } from "@/lib/services/expiry.server";
import { logEvent } from "@/lib/services/settings.server";
import type { SqlRow } from "@/lib/services/rows.server";

/**
 * Resume eligibility, per the client's spec: Weekly and Monthly packages
 * (by the package's own duration_kind), plus ANY package redeemed via a
 * voucher regardless of its duration — Hourly and Daily bought with M-Pesa
 * are excluded, on purpose, so a short session isn't silently re-granted
 * after the customer may have already moved on.
 *
 * Voucher origin is detected the same way the rest of the app already
 * does: redeemVoucher() stamps payments.mpesa_transaction_id as
 * "VCH-<code>" (see vouchers.server.ts) — no extra column needed.
 */

export type ResumeResult = {
  attempted: number;
  resumed: number;
  alreadyExpired: number;
  failed: number;
};

/**
 * Re-activates every still-valid, resume-eligible customer_package. Safe to
 * call repeatedly: activateFromPayment() upserts the MikroTik hotspot user
 * (PATCH if it exists, PUT if not) and recomputes remaining time from
 * expiry_time, so calling it on a package that's already fine is a no-op.
 * Expired packages are never touched (activateFromPayment marks them
 * EXPIRED and refuses) — nothing here can revive a lapsed package.
 */
export async function resumeEligiblePackages(
  trigger: "auto" | "manual",
): Promise<ResumeResult> {
  await expireDuePackages();
  const sql = await getSql();

  const rows = await sql<SqlRow>`
    select cp.id, cp.payment_id
    from customer_packages cp
    join packages pkg on pkg.id = cp.package_id
    join payments p on p.id = cp.payment_id
    join customers c on c.id = cp.customer_id
    where cp.status = 'ACTIVE'
      and cp.expiry_time > now()
      and c.status != 'BLOCKED'
      and (
        pkg.duration_kind in ('WEEKLY', 'MONTHLY')
        or p.mpesa_transaction_id like 'VCH-%'
      )
    order by cp.expiry_time desc
  `;

  const result: ResumeResult = {
    attempted: rows.length,
    resumed: 0,
    alreadyExpired: 0,
    failed: 0,
  };

  for (const row of rows) {
    try {
      const res = await activateFromPayment(String(row.payment_id));
      if (res.ok) {
        result.resumed += 1;
        await sql`
          update customer_packages set last_resumed_at = now()
          where id = ${row.id}
        `;
      } else if (res.reason === "expired") {
        result.alreadyExpired += 1;
      } else {
        result.failed += 1;
      }
    } catch {
      result.failed += 1;
    }
  }

  if (result.attempted > 0) {
    await logEvent(
      "RESUME",
      `${trigger === "auto" ? "Auto-resume after router recovery" : "Manual resume"}: ` +
        `${result.resumed}/${result.attempted} package(s) restored` +
        (result.failed ? `, ${result.failed} failed` : "") +
        ` (Weekly/Monthly/Voucher only).`,
    );
  }

  return result;
}
