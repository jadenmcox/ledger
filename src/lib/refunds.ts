import { differenceInDays } from "date-fns";

export type RefundTxLike = {
  id: number;
  date: Date;
  amountCents: number;
  merchantRaw: string;
  merchantClean: string | null;
  categoryId: number | null;
  isTransfer: boolean;
  reimbursable: boolean;
};

function normMerchant(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Two merchant strings refer to the same store if the names line up loosely:
// exact, one a prefix of the other ("abercrombie" vs "abercrombie & fitch
// online"), or a shared leading token of real length. Deliberately lenient
// because refund descriptors are often shorter than the original purchase.
function merchantsMatch(a: string, b: string): boolean {
  const na = normMerchant(a);
  const nb = normMerchant(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.startsWith(nb) || nb.startsWith(na)) return true;
  const ta = na.split(" ")[0];
  const tb = nb.split(" ")[0];
  return ta.length >= 4 && ta === tb;
}

export type RefundMatch = {
  // Month/date the refund should be credited to: the matched purchase's date,
  // or the refund's own date when nothing matched.
  date: Date;
  // Merchant the refund should net against in a per-vendor rollup: the matched
  // purchase's merchant (so a "Abercrombie" refund reduces the "Abercrombie &
  // Fitch" purchase line), or the refund's own merchant when unmatched.
  merchant: string;
};

// A refund (a positive amount in a spending category) is credited back to the
// purchase it offsets: we find the most recent prior purchase from the same
// merchant within `windowDays` and return that purchase's date + merchant.
// Unmatched refunds fall back to their own date + merchant. Callers bucket spend
// by these credit dates so a return reduces the month (and vendor) you actually
// bought the item, not the month the money came back.
export function refundMatches(
  txns: RefundTxLike[],
  isSpendingCategory: (categoryId: number | null) => boolean,
  windowDays = 90,
): Map<number, RefundMatch> {
  const purchases = txns
    .filter(
      (t) =>
        !t.isTransfer &&
        !t.reimbursable &&
        t.amountCents < 0 &&
        isSpendingCategory(t.categoryId),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const matches = new Map<number, RefundMatch>();
  for (const r of txns) {
    if (
      r.isTransfer ||
      r.reimbursable ||
      r.amountCents <= 0 ||
      !isSpendingCategory(r.categoryId)
    ) {
      continue;
    }
    const rMerchant = r.merchantClean || r.merchantRaw;
    let matched: RefundTxLike | null = null;
    // purchases are ascending, so the last qualifying one is the most recent.
    for (const p of purchases) {
      if (p.date.getTime() > r.date.getTime()) break;
      const days = differenceInDays(r.date, p.date);
      if (days < 0 || days > windowDays) continue;
      if (!merchantsMatch(rMerchant, p.merchantClean || p.merchantRaw)) continue;
      matched = p;
    }
    matches.set(r.id, {
      date: matched ? matched.date : r.date,
      merchant: matched
        ? matched.merchantClean || matched.merchantRaw
        : rMerchant,
    });
  }
  return matches;
}
