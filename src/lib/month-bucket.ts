import { isSameMonth } from "date-fns";
import { refundMatches, type RefundTxLike } from "./refunds";
import { effectiveDate } from "./effective-month";
import { categoryParts, type SplitPart } from "./splits";

// The category shape the bucketer needs; the full drizzle Category satisfies
// it structurally.
export type BucketCategory = {
  id: number;
  name: string;
  classification: string;
};

// Which month a transaction counts toward, shared by every monthly view so
// the same transaction can never land in different months on different pages.
// Refunds follow the month of the purchase they offset (matched by merchant);
// month-boundary bills (rent/utilities on or after the 20th) roll forward;
// everything else stays on its own date.
export function createMonthBucketer<T extends RefundTxLike>(
  txns: T[],
  categories: BucketCategory[],
) {
  const catById = new Map(categories.map((c) => [c.id, c]));

  const isSpendingCat = (categoryId: number | null): boolean => {
    if (categoryId == null) return false;
    const c = catById.get(categoryId);
    return !!c && c.classification !== "income";
  };

  const refundMatch = refundMatches(txns, isSpendingCat);

  const monthKeyOf = (t: T): Date => {
    const isRefund =
      t.amountCents > 0 && !t.reimbursable && isSpendingCat(t.categoryId);
    const base = isRefund ? refundMatch.get(t.id)?.date ?? t.date : t.date;
    return effectiveDate(
      new Date(base),
      t.categoryId ? catById.get(t.categoryId)?.name : null,
    );
  };

  return { monthKeyOf, refundMatch, isSpendingCat };
}

// Consumption for one month: needs + wants + uncategorized outflow, refunds
// netted per category (clamped at zero), savings-class contributions excluded.
// Matches the dashboard's "Spent this month" headline. Split transactions fan
// out into their category parts, so splitting a purchase into a savings-class
// slice correctly drops that slice out of consumption.
export function monthConsumption<T extends RefundTxLike>(
  txns: T[],
  categories: BucketCategory[],
  monthOf: Date,
  splitsByTx: ReadonlyMap<number, readonly SplitPart[]> = new Map(),
): number {
  const { byCategory, uncategorized } = monthConsumptionByCategory(
    txns,
    categories,
    monthOf,
    splitsByTx,
  );
  const catById = new Map(categories.map((c) => [c.id, c]));
  let total = uncategorized;
  for (const [id, v] of byCategory) {
    const c = catById.get(id);
    if (c?.classification === "savings") continue;
    if (v > 0) total += v;
  }
  return total;
}

// Per-category breakdown behind monthConsumption, exposed so other views
// (e.g. the dashboard summary's overspent-category rows) share the exact
// same refund/rollforward/split semantics instead of re-deriving them.
export function monthConsumptionByCategory<T extends RefundTxLike>(
  txns: T[],
  categories: BucketCategory[],
  monthOf: Date,
  splitsByTx: ReadonlyMap<number, readonly SplitPart[]> = new Map(),
): { byCategory: Map<number, number>; uncategorized: number } {
  const { monthKeyOf } = createMonthBucketer(txns, categories);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const byCategory = new Map<number, number>();
  let uncategorized = 0;
  for (const t of txns) {
    if (t.reimbursable || t.amountCents === 0) continue;
    if (!isSameMonth(monthKeyOf(t), monthOf)) continue;
    // Income stays whole (splits are spending-only); its own category drives it.
    const parentCat = t.categoryId ? catById.get(t.categoryId) : null;
    if (parentCat?.classification === "income") continue;
    for (const part of categoryParts(t, splitsByTx)) {
      const cat = part.categoryId ? catById.get(part.categoryId) : null;
      if (cat?.classification === "income") continue;
      const delta =
        part.amountCents < 0 ? Math.abs(part.amountCents) : -part.amountCents;
      if (cat) {
        byCategory.set(cat.id, (byCategory.get(cat.id) ?? 0) + delta);
      } else if (delta > 0) {
        uncategorized += delta;
      }
    }
  }
  return { byCategory, uncategorized };
}
