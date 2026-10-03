import { getSql } from "@/lib/db";
import { TZ } from "@/lib/services/hours.server";
import { iso } from "@/lib/utils";

/**
 * Start of today / this week (Monday) / this month — and the previous
 * day / week / month — in the business time zone (default Africa/Nairobi,
 * APP_TIMEZONE overrides), returned as UTC instants.
 *
 * `date_trunc('day', now())` alone uses the database clock (UTC), which puts
 * "today" three hours late for Kenya: sales made after midnight would still
 * show under yesterday until 03:00.
 */
export type PeriodStarts = {
  dayStart: string;
  prevDayStart: string;
  weekStart: string;
  prevWeekStart: string;
  monthStart: string;
  prevMonthStart: string;
};

export async function getPeriodStarts(): Promise<PeriodStarts> {
  const sql = await getSql();
  const r = (
    await sql<Record<string, unknown>>`
      select
        (date_trunc('day', now() at time zone ${TZ}::text) at time zone ${TZ}::text) as day_start,
        ((date_trunc('day', now() at time zone ${TZ}::text) - interval '1 day') at time zone ${TZ}::text) as prev_day_start,
        (date_trunc('week', now() at time zone ${TZ}::text) at time zone ${TZ}::text) as week_start,
        ((date_trunc('week', now() at time zone ${TZ}::text) - interval '1 week') at time zone ${TZ}::text) as prev_week_start,
        (date_trunc('month', now() at time zone ${TZ}::text) at time zone ${TZ}::text) as month_start,
        ((date_trunc('month', now() at time zone ${TZ}::text) - interval '1 month') at time zone ${TZ}::text) as prev_month_start
    `
  )[0];
  return {
    dayStart: iso(r.day_start),
    prevDayStart: iso(r.prev_day_start),
    weekStart: iso(r.week_start),
    prevWeekStart: iso(r.prev_week_start),
    monthStart: iso(r.month_start),
    prevMonthStart: iso(r.prev_month_start),
  };
}
