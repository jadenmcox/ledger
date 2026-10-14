import { addDays, addMonths, addYears, differenceInCalendarDays } from "date-fns";

// Bills and subscriptions, found in your history instead of typed in by hand.
// A merchant counts as recurring when it charged you at least twice at a steady
// rhythm (weekly, every two weeks, monthly or yearly) for a similar amount,
// and it's still active (the next charge isn't long overdue).

export type RecurringTxLike = {
  id: number;
  date: Date;
  amountCents: number;
  merchantRaw: string;
  merchantClean: string | null;
  categoryId: number | null;
  isTransfer: boolean;
  reimbursable: boolean;
};

export type Cadence = "weekly" | "biweekly" | "monthly" | "yearly";

export type RecurringCharge = {
  key: string;
  name: string;
  categoryId: number | null;
  amountCents: number; // typical charge, positive
  cadence: Cadence;
  lastDate: Date;
  nextDate: Date;
  occurrences: number;
  // Rough monthly cost, for a "what your subscriptions cost" total.
  monthlyCents: number;
};

function keyOf(t: RecurringTxLike): string {
  return (t.merchantClean || t.merchantRaw)
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .join(" ");
}

const CADENCES: { cadence: Cadence; min: number; max: number; perMonth: number }[] = [
  { cadence: "weekly", min: 6, max: 8, perMonth: 52 / 12 },
  { cadence: "biweekly", min: 13, max: 16, perMonth: 26 / 12 },
  { cadence: "monthly", min: 26, max: 35, perMonth: 1 },
  { cadence: "yearly", min: 350, max: 380, perMonth: 1 / 12 },
];

function step(d: Date, c: Cadence): Date {
  if (c === "weekly") return addDays(d, 7);
  if (c === "biweekly") return addDays(d, 14);
  if (c === "monthly") return addMonths(d, 1);
  return addYears(d, 1);
}

export function findRecurring(
  txns: readonly RecurringTxLike[],
  opts: { now?: Date; skipCategoryIds?: ReadonlySet<number> } = {},
): RecurringCharge[] {
  const now = opts.now ?? new Date();
  const since = addMonths(now, -13);
  const buckets = new Map<string, RecurringTxLike[]>();
  for (const t of txns) {
    if (t.isTransfer || t.reimbursable || t.amountCents >= 0) continue;
    if (t.date < since) continue;
    if (t.categoryId != null && opts.skipCategoryIds?.has(t.categoryId)) continue;
    const k = keyOf(t);
    if (!k) continue;
    const arr = buckets.get(k);
    if (arr) arr.push(t);
    else buckets.set(k, [t]);
  }

  const out: RecurringCharge[] = [];
  for (const [key, list] of buckets) {
    if (list.length < 2) continue;
    const asc = [...list].sort((a, b) => a.date.getTime() - b.date.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < asc.length; i++) {
      gaps.push(differenceInCalendarDays(asc[i].date, asc[i - 1].date));
    }
    const median = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    const match = CADENCES.find((c) => median >= c.min && median <= c.max);
    if (!match) continue;
    if (match.cadence === "weekly" && asc.length < 3) continue;

    // Steady amount: the last few charges sit within 15% (or $2) of each
    // other. Only recent ones count, so an old plan price doesn't hide it.
    const recent = asc.slice(-3).map((t) => Math.abs(t.amountCents));
    const typical = recent[recent.length - 1];
    const tol = Math.max(200, typical * 0.15);
    if (!recent.every((a) => Math.abs(a - typical) <= tol)) continue;

    const last = asc[asc.length - 1];
    const nextDate = step(last.date, match.cadence);
    // Gone quiet: the next charge is overdue by more than half a cycle.
    if (differenceInCalendarDays(now, nextDate) > match.max / 2 + 3) continue;

    out.push({
      key,
      name: last.merchantClean || last.merchantRaw,
      categoryId: last.categoryId,
      amountCents: typical,
      cadence: match.cadence,
      lastDate: last.date,
      nextDate,
      occurrences: asc.length,
      monthlyCents: Math.round(typical * match.perMonth),
    });
  }
  return out.sort((a, b) => b.monthlyCents - a.monthlyCents);
}
