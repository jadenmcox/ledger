import { getDate, startOfMonth, addMonths } from "date-fns";

// Rent/Mortgage is matched by name so it stays in sync with the existing
// overspend special-casing on the dashboard.
const RENT_RE = /\b(rent|mortgage)\b/i;

export function isRentCategory(categoryName?: string | null): boolean {
  return !!categoryName && RENT_RE.test(categoryName);
}

// The date a transaction should be bucketed under for the monthly views.
//
// Rent is usually paid right around the month boundary "for" the month that's
// about to start: a payment in the last stretch of a month covers the next
// month. So a Rent/Mortgage charge dated on or after the 20th rolls forward to
// the following month. Everything else (and rent paid earlier in the month)
// stays on its own date.
export function effectiveDate(
  date: Date,
  categoryName?: string | null,
): Date {
  if (isRentCategory(categoryName) && getDate(date) >= 20) {
    return startOfMonth(addMonths(date, 1));
  }
  return date;
}
