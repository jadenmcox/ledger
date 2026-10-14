import { cache } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories, paybackLinks, transactions, type PaybackLink } from "@/db/schema";
import { loadSplitsByTx } from "./splits";
import { createLedger } from "./ledger";

// Payback links, tolerant of a database that hasn't run drizzle/0008 yet: a
// missing table reads as "no links" instead of 500ing every page.
export async function loadPaybackLinks(): Promise<PaybackLink[]> {
  try {
    return await db.select().from(paybackLinks).orderBy(asc(paybackLinks.id));
  } catch {
    return [];
  }
}

// Everything the monthly views need, fetched in one parallel round trip and
// memoized per request so a layout and page asking twice only pay once.
export const loadLedgerData = cache(async () => {
  const [allTx, allCategories, splitsByTx, links] = await Promise.all([
    db.select().from(transactions),
    db.select().from(categories),
    loadSplitsByTx(),
    loadPaybackLinks(),
  ]);
  const ledger = createLedger(allTx, allCategories, splitsByTx, links);
  return { allTx, allCategories, splitsByTx, links, ledger };
});
