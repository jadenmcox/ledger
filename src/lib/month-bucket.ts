import { refundMatches, type RefundTxLike } from "./refunds";
import { effectiveDate } from "./effective-month";

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
