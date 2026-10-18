import { cache } from "react";
import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  paybackLinks,
  transactions,
  type PaybackLink,
  type Transaction,
} from "@/db/schema";
import { loadSplitsByTx } from "./splits";
import { createLedger } from "./ledger";
import { autoMatches, paybackState } from "./paybacks";

// Payback links, tolerant of a database that hasn't run drizzle/0008 yet: a
// missing table reads as "no links" instead of 500ing every page.
export async function loadPaybackLinks(): Promise<PaybackLink[]> {
  try {
    return await db.select().from(paybackLinks).orderBy(asc(paybackLinks.id));
  } catch {
    return [];
  }
}

const isWorkCharge = (t: Transaction) => t.reimbursable && t.amountCents < 0;

// Work expenses pair with their reimbursements on their own: there's no
// button to press. Each load works out the pairing from what the bank sent
// and saves it only when it changed (a new deposit or lunch arrived, or the
// matching got smarter). Paybacks you tied to ordinary charges by hand, like a
// friend's share of parking, are never touched.
async function settleWorkExpenses(
  allTx: Transaction[],
  links: PaybackLink[],
): Promise<PaybackLink[]> {
  const work = new Set(allTx.filter(isWorkCharge).map((t) => t.id));
  const byHand = links.filter((l) => !work.has(l.chargeId));
  const want = autoMatches(allTx, paybackState(byHand));
  const key = (l: { paybackId: number; chargeId: number; amountCents: number }) =>
    `${l.paybackId}:${l.chargeId}:${l.amountCents}`;
  const current = links.filter((l) => work.has(l.chargeId)).map(key).sort().join(",");
  if (current === want.map(key).sort().join(",")) return links;

  // Clear every work expense pairing and write the new set in one batch. The
  // delete targets work charges by rule rather than by id, so two page loads
  // racing each other can't leave doubled pairings behind.
  const clear = db
    .delete(paybackLinks)
    .where(
      inArray(
        paybackLinks.chargeId,
        db
          .select({ id: transactions.id })
          .from(transactions)
          .where(and(eq(transactions.reimbursable, true), lt(transactions.amountCents, 0))),
      ),
    );
  try {
    if (want.length) await db.batch([clear, db.insert(paybackLinks).values(want)]);
    else await db.batch([clear]);
  } catch {
    return links;
  }
  return loadPaybackLinks();
}

// Everything the monthly views need, fetched in one parallel round trip and
// memoized per request so a layout and page asking twice only pay once.
export const loadLedgerData = cache(async () => {
  const [allTx, allCategories, splitsByTx, savedLinks] = await Promise.all([
    db.select().from(transactions),
    db.select().from(categories),
    loadSplitsByTx(),
    loadPaybackLinks(),
  ]);
  const links = await settleWorkExpenses(allTx, savedLinks);
  const ledger = createLedger(allTx, allCategories, splitsByTx, links);
  return { allTx, allCategories, splitsByTx, links, ledger };
});
