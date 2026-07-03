import { getDate, startOfMonth, addMonths } from "date-fns";

// Recurring bills that are paid around the month boundary "for" the month
// that's about to start, so a late payment covers the next month. Matched by
// category name. Rent/Mortgage and Utilities qualify; Internet/Phone does not
// (bucketed on its raw date). The rent term also keeps this in sync with the
// dashboard's overspend special-casing.
const BOUNDARY_BILL_RE = /\b(rent|mortgage|utilit(?:y|ies))\b/i;

export function isBoundaryBillCategory(categoryName?: string | null): boolean {
  return !!categoryName && BOUNDARY_BILL_RE.test(categoryName);
}

// The date a transaction should be bucketed under for the monthly views.
//
// A month-boundary bill (rent, utilities) dated on or after the 20th rolls
// forward to the following month, since a payment in the last stretch of a
// month covers the month that's starting. Everything else, and those bills
// paid earlier in the month, stays on its own date.
export function effectiveDate(
  date: Date,
  categoryName?: string | null,
): Date {
  if (isBoundaryBillCategory(categoryName) && getDate(date) >= 20) {
    return startOfMonth(addMonths(date, 1));
  }
  return date;
}
