import { db } from "@/db";
import {
  recurringSchedules,
  transactions,
  type RecurringSchedule,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import { dedupeHash } from "@/lib/csv-import";

/**
 * Compute every occurrence date for a schedule between `from` (exclusive)
 * and `to` (inclusive).
 */
export function computeOccurrences(
  s: RecurringSchedule,
  from: Date,
  to: Date,
): Date[] {
  const start = parseISO(s.startDate);
  const end = s.endDate ? parseISO(s.endDate) : null;
  const lowerBound = isAfter(from, start) ? from : start;
  const out: Date[] = [];

  if (s.cadence === "weekly" || s.cadence === "biweekly") {
    const step = s.cadence === "weekly" ? 7 : 14;
    let cur = new Date(start);
    // Fast-forward to first date > lowerBound
    while (!isAfter(cur, lowerBound)) cur = addDays(cur, step);
    while (!isAfter(cur, to)) {
      if (!end || !isAfter(cur, end)) out.push(new Date(cur));
      cur = addDays(cur, step);
    }
    return out;
  }

  // monthly / semi_monthly use daysOfMonth
  const days: number[] = s.daysOfMonth ? JSON.parse(s.daysOfMonth) : [];
  if (days.length === 0) return [];

  // Iterate month by month from lowerBound to to
  let cursor = new Date(lowerBound.getFullYear(), lowerBound.getMonth(), 1);
  const lastMonth = new Date(to.getFullYear(), to.getMonth(), 1);
  while (!isAfter(cursor, lastMonth)) {
    const eom = endOfMonth(cursor).getDate();
    for (const d of days) {
      const day = Math.min(d, eom); // clamp e.g. 31 to Feb 28
      const occ = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      if (isBefore(occ, lowerBound)) continue;
      if (isAfter(occ, to)) continue;
      if (end && isAfter(occ, end)) continue;
      out.push(occ);
    }
    cursor = addMonths(cursor, 1);
  }
  // semi_monthly with daysOfMonth=[1, 16] is just monthly with two days — same code path
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Expected income for a given month: the sum of every recurring *income*
 * schedule's occurrences across the whole month. Day-independent, so being
 * paid on the 15th/30th never reads as "no income yet" earlier in the month,
 * and one-off income (a bonus) is excluded because it isn't a schedule.
 */
export function expectedMonthlyIncome(
  schedules: RecurringSchedule[],
  monthStart: Date,
  monthEnd: Date,
): { cents: number; paycheckCount: number } {
  let cents = 0;
  let paycheckCount = 0;
  for (const s of schedules) {
    if (s.amountCents <= 0) continue;
    const n = computeOccurrences(s, monthStart, monthEnd).length;
    cents += n * s.amountCents;
    paycheckCount += n;
  }
  return { cents, paycheckCount };
}

/**
 * For each active schedule, create any missing transactions between
 * `lastCreatedDate` (or startDate) and today. Idempotent — relies on
 * the strict dedupe hash (account|date|amount) to skip dupes.
 */
// Tolerates a database that hasn't run the is_forecast_only migration yet
// (drizzle/0006) — a plain select() lists every schema column, so it 500s
// until the column exists. This runs on the dashboard and budget page on
// every request, so callers get an empty list instead of a crash.
export async function getActiveSchedules(): Promise<RecurringSchedule[]> {
  try {
    return await db
      .select()
      .from(recurringSchedules)
      .where(eq(recurringSchedules.isActive, true));
  } catch {
    return [];
  }
}

export async function backfillRecurring(now: Date = new Date()): Promise<{
  created: number;
  scheduled: number;
}> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const active = await getActiveSchedules();

  let created = 0;
  let scheduled = 0;

  for (const s of active) {
    // Forecast-only schedules shape expected income and upcoming bills but
    // never materialize transactions (the real ones arrive via Plaid/CSV).
    if (s.isForecastOnly) continue;
    const since = s.lastCreatedDate
      ? addDays(parseISO(s.lastCreatedDate), 1)
      : parseISO(s.startDate);
    const dates = computeOccurrences(s, since, today);
    scheduled += dates.length;
    if (dates.length === 0) continue;

    for (const d of dates) {
      // Use noon UTC for timestamp consistency
      const ts = new Date(
        Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0),
      );
      try {
        await db.insert(transactions).values({
          accountId: s.accountId,
          date: ts,
          amountCents: s.amountCents,
          merchantRaw: s.merchantRaw,
          merchantClean: s.merchantRaw,
          categoryId: s.categoryId,
          notes: s.notes,
          source: "manual",
          dedupeHash: dedupeHash(s.accountId, ts, s.amountCents, s.merchantRaw),
        });
        created++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes("UNIQUE") && !msg.includes("unique")) throw e;
        // Duplicate — already imported via CSV or manually. Skip.
      }
    }

    // Bump lastCreatedDate to the last date we tried (whether dupe or new),
    // so we don't re-evaluate the same dates next tick.
    const lastDate = dates[dates.length - 1];
    await db
      .update(recurringSchedules)
      .set({ lastCreatedDate: format(lastDate, "yyyy-MM-dd") })
      .where(eq(recurringSchedules.id, s.id));
  }

  return { created, scheduled };
}
