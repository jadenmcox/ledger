import { asc } from "drizzle-orm";
import { db } from "@/db";
import { transactionSplits, type TransactionSplit } from "@/db/schema";

// One category's slice of a transaction's amount. `amountCents` follows the
// parent's sign convention (negative = outflow) and the parts of a transaction
// sum to the parent's amountCents.
export type SplitPart = { categoryId: number | null; amountCents: number };

// The (category, amount) parts a transaction contributes to category spend
// rollups. A split transaction fans out into its parts; an unsplit one yields a
// single part carrying its own categoryId + full amount. Every category
// aggregation site maps over this instead of reading `t.categoryId` directly,
// so a mixed-basket purchase lands in each bucket. A transaction with no entry
// in `splitsByTx` degrades to its whole amount under its own category — the
// same result the app produced before splits existed.
export function categoryParts(
  tx: { categoryId: number | null; amountCents: number; id?: number },
  splitsByTx: ReadonlyMap<number, readonly SplitPart[]>,
): SplitPart[] {
  const rows = tx.id != null ? splitsByTx.get(tx.id) : undefined;
  if (rows && rows.length > 0) {
    return rows.map((r) => ({
      categoryId: r.categoryId,
      amountCents: r.amountCents,
    }));
  }
  return [{ categoryId: tx.categoryId, amountCents: tx.amountCents }];
}

// Loads every split, grouped by transaction id and ordered for stable display.
// The table is small (only manually-split transactions have rows), so pages
// load all splits once and look up by id in memory, matching how they already
// load full transaction history and bucket it in JS.
//
// Tolerates a database that hasn't run the transaction_splits migration yet
// (drizzle/0007): this runs in the Promise.all of every monthly page, so a
// missing table returns an empty map (all transactions read as unsplit) instead
// of 500ing the page. Mirrors getActiveSchedules' pre-migration guard.
export async function loadSplitsByTx(): Promise<Map<number, TransactionSplit[]>> {
  const byTx = new Map<number, TransactionSplit[]>();
  let rows: TransactionSplit[];
  try {
    rows = await db
      .select()
      .from(transactionSplits)
      .orderBy(asc(transactionSplits.sortOrder), asc(transactionSplits.id));
  } catch {
    return byTx;
  }
  for (const r of rows) {
    const arr = byTx.get(r.transactionId);
    if (arr) arr.push(r);
    else byTx.set(r.transactionId, [r]);
  }
  return byTx;
}
