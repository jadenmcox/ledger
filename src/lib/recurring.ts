import { db } from "@/db";
import { transactions, type Transaction } from "@/db/schema";
import { desc } from "drizzle-orm";
import { differenceInDays } from "date-fns";

export type RecurringSuggestion = {
  merchantKey: string;
  displayName: string;
  expectedAmountCents: number;
  cadence: "weekly" | "monthly" | "yearly";
  occurrences: number;
  lastSeen: Date;
  txIds: number[];
};

function key(t: Transaction): string {
  // Use first 3 words of the cleaned merchant, lowercased, as a stable key
  const m = (t.merchantClean || t.merchantRaw)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ");
  return m;
}

export async function detectRecurring(
  opts: { lookbackMonths?: number } = {},
): Promise<RecurringSuggestion[]> {
  const months = opts.lookbackMonths ?? 6;
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const all = await db
    .select()
    .from(transactions)
    .orderBy(desc(transactions.date));

  const buckets = new Map<string, Transaction[]>();
  for (const t of all) {
    if (t.isTransfer) continue;
    if (new Date(t.date) < since) continue;
    if (t.amountCents > 0) continue; // recurring = outflow for now
    const k = key(t);
    if (!k) continue;
    const arr = buckets.get(k) ?? [];
    arr.push(t);
    buckets.set(k, arr);
  }

  const suggestions: RecurringSuggestion[] = [];
  for (const [k, txs] of buckets) {
    if (txs.length < 2) continue;
    // Amounts must be similar (within 10% or $1)
    const amounts = txs.map((t) => Math.abs(t.amountCents));
    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const tol = Math.max(100, avg * 0.1);
    const consistent = amounts.every((a) => Math.abs(a - avg) <= tol);
    if (!consistent) continue;

    // Detect cadence: median gap between consecutive occurrences (sorted desc -> reverse)
    const sortedAsc = [...txs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const gaps: number[] = [];
    for (let i = 1; i < sortedAsc.length; i++) {
      gaps.push(
        differenceInDays(
          new Date(sortedAsc[i].date),
          new Date(sortedAsc[i - 1].date),
        ),
      );
    }
    const median = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
    let cadence: "weekly" | "monthly" | "yearly";
    if (median <= 10) cadence = "weekly";
    else if (median <= 45) cadence = "monthly";
    else if (median >= 300 && median <= 400) cadence = "yearly";
    else continue;

    suggestions.push({
      merchantKey: k,
      displayName: txs[0].merchantClean || txs[0].merchantRaw,
      expectedAmountCents: Math.round(avg),
      cadence,
      occurrences: txs.length,
      lastSeen: new Date(sortedAsc[sortedAsc.length - 1].date),
      txIds: txs.map((t) => t.id),
    });
  }

  return suggestions.sort(
    (a, b) => b.expectedAmountCents - a.expectedAmountCents,
  );
}
