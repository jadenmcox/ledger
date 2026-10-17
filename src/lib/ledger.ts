import { isSameMonth } from "date-fns";
import { createMonthBucketer, type BucketCategory } from "./month-bucket";
import { categoryParts, type SplitPart } from "./splits";
import { expectedBack, type PaybackLinkLike } from "./paybacks";
import type { RefundTxLike } from "./refunds";

// The one place monthly money math happens. Home, Budget, Year, the
// transactions hero and the /api/summary feed all read a MonthSummary from
// here, so "spent" can never mean three different things on three pages.
//
// Definitions (cents, positive):
//   income        money in, from income-classified categories, minus anything
//                 linked as a payback
//   spent         needs + wants + uncategorized outflow, refunds and
//                 paybacks netted back into the purchase's category and month
//   saved         savings-class categories (brokerage, Roth, HYS moves)
//   reimbursable  work expenses you expect back. Kept out of spent entirely;
//                 tracked as paid out / back / owed instead.

export type LedgerCategory = BucketCategory & {
  color?: string;
  icon?: string;
};

export type LedgerEntry = {
  id: number;
  date: string; // ISO
  merchant: string;
  amountCents: number;
  note?: string;
};

export type MonthSummary = {
  income: number;
  spendByCategory: Map<number, number>;
  incomeByCategory: Map<number, number>;
  uncategorizedSpend: number;
  uncategorizedCount: number;
  byClass: { need: number; want: number; savings: number };
  spent: number;
  saved: number;
  // Per-category drill-down rows (spending and income categories).
  entriesByCategory: Record<number, LedgerEntry[]>;
  // Per-category vendor rollup, biggest first, fully-refunded vendors dropped.
  merchantsByCategory: Record<number, { merchant: string; total: number; count: number }[]>;
  reimbursements: { paidOut: number; back: number; owed: number };
};

type Tx = RefundTxLike;

export function createLedger<T extends Tx>(
  txns: readonly T[],
  categories: readonly LedgerCategory[],
  splitsByTx: ReadonlyMap<number, readonly SplitPart[]> = new Map(),
  links: readonly PaybackLinkLike[] = [],
) {
  const live = txns.filter((t) => !t.isTransfer);
  const catById = new Map(categories.map((c) => [c.id, c]));
  const txById = new Map(txns.map((t) => [t.id, t]));
  const { monthKeyOf, refundMatch } = createMonthBucketer(live, [...categories]);

  const linkedFromPayback = new Map<number, number>();
  for (const l of links) {
    linkedFromPayback.set(l.paybackId, (linkedFromPayback.get(l.paybackId) ?? 0) + l.amountCents);
  }

  const iso = (d: Date) => (d instanceof Date ? d.toISOString() : String(d));
  const nameOf = (t: Tx) => (t.merchantClean || t.merchantRaw || "Unknown").trim();

  function summarize(month: Date): MonthSummary {
    const inMonth = (t: T) => isSameMonth(monthKeyOf(t), month);
    let income = 0;
    let uncategorizedSpend = 0;
    let uncategorizedCount = 0;
    let paidOut = 0;
    let back = 0;
    const spendByCategory = new Map<number, number>();
    const incomeByCategory = new Map<number, number>();
    const entriesByCategory: Record<number, LedgerEntry[]> = {};
    const merchantAgg = new Map<number, Map<string, { total: number; count: number }>>();

    const addSpend = (catId: number | null, delta: number, merchant: string, purchase: boolean) => {
      const cat = catId != null ? catById.get(catId) : null;
      if (!cat) {
        uncategorizedSpend += delta;
        if (purchase) uncategorizedCount += 1;
        return;
      }
      spendByCategory.set(cat.id, (spendByCategory.get(cat.id) ?? 0) + delta);
      let inner = merchantAgg.get(cat.id);
      if (!inner) merchantAgg.set(cat.id, (inner = new Map()));
      const cur = inner.get(merchant) ?? { total: 0, count: 0 };
      cur.total += delta;
      if (purchase) cur.count += 1;
      inner.set(merchant, cur);
    };

    for (const t of live) {
      // The part of a payment linked as a payback is accounted for on the
      // charge it pays back (below), never as income or a refund here.
      const linked = t.amountCents > 0 ? linkedFromPayback.get(t.id) ?? 0 : 0;
      const amount = t.amountCents - Math.min(linked, Math.max(0, t.amountCents));

      if (t.reimbursable) {
        if (!inMonth(t)) continue;
        if (amount < 0) {
          // Only the capped part comes back; anything over is your spending.
          const covered = expectedBack(t);
          paidOut += covered;
          const over = -amount - covered;
          if (over > 0) addSpend(t.categoryId, over, nameOf(t), true);
        } else back += amount; // legacy: flagged payback that was never linked
        continue;
      }
      if (amount === 0 || !inMonth(t)) continue;

      const parentCat = t.categoryId != null ? catById.get(t.categoryId) : null;
      const merchant = nameOf(t);
      if (parentCat?.classification === "income") {
        (entriesByCategory[parentCat.id] ??= []).push({
          id: t.id,
          date: iso(t.date),
          merchant,
          amountCents: amount,
        });
        incomeByCategory.set(parentCat.id, (incomeByCategory.get(parentCat.id) ?? 0) + amount);
        income += amount;
        continue;
      }

      // A refund nets against the vendor of the purchase it offsets.
      const isRefund = amount > 0;
      const vendor = ((isRefund ? refundMatch.get(t.id)?.merchant : null) || merchant).trim();
      const parts =
        amount === t.amountCents
          ? categoryParts(t, splitsByTx)
          : [{ categoryId: t.categoryId, amountCents: amount }];
      for (const part of parts) {
        if (part.amountCents === 0) continue;
        if (part.categoryId != null) {
          (entriesByCategory[part.categoryId] ??= []).push({
            id: t.id,
            date: iso(t.date),
            merchant,
            amountCents: part.amountCents,
          });
        }
        // Purchases add to spend, refunds subtract.
        const delta = -part.amountCents;
        // Uncategorized refunds are left alone, matching the old behavior.
        if (part.categoryId == null && delta < 0) continue;
        addSpend(part.categoryId, delta, vendor, !isRefund);
      }
    }

    // Paybacks: settle a work expense, or net out of a shared cost.
    for (const l of links) {
      const charge = txById.get(l.chargeId);
      const payback = txById.get(l.paybackId);
      if (!charge || charge.isTransfer || !inMonth(charge)) continue;
      if (charge.reimbursable) {
        back += l.amountCents;
        continue;
      }
      const chargeParts = categoryParts(charge, splitsByTx).filter((p) => p.amountCents < 0);
      const total = chargeParts.reduce((s, p) => s - p.amountCents, 0) || 1;
      const who = payback ? nameOf(payback) : "payback";
      for (const p of chargeParts) {
        const share = Math.round((l.amountCents * -p.amountCents) / total);
        addSpend(p.categoryId, -share, nameOf(charge), false);
        if (p.categoryId != null) {
          (entriesByCategory[p.categoryId] ??= []).push({
            id: l.paybackId,
            date: iso(payback?.date ?? charge.date),
            merchant: who,
            amountCents: share,
            note: `paid back for ${nameOf(charge)}`,
          });
        }
      }
    }

    // A category can't net below zero for the month.
    for (const [id, v] of spendByCategory) if (v < 0) spendByCategory.set(id, 0);
    if (uncategorizedSpend < 0) uncategorizedSpend = 0;

    const byClass = { need: 0, want: 0, savings: 0 };
    for (const [id, v] of spendByCategory) {
      const c = catById.get(id)?.classification;
      if (c === "need" || c === "want" || c === "savings") byClass[c] += v;
    }

    const merchantsByCategory: MonthSummary["merchantsByCategory"] = {};
    for (const [catId, inner] of merchantAgg) {
      merchantsByCategory[catId] = [...inner.entries()]
        .map(([merchant, v]) => ({ merchant, total: v.total, count: v.count }))
        .filter((v) => v.total > 0)
        .sort((a, b) => b.total - a.total);
    }
    for (const id in entriesByCategory) {
      entriesByCategory[id].sort((a, b) => b.date.localeCompare(a.date));
    }

    return {
      income,
      spendByCategory,
      incomeByCategory,
      uncategorizedSpend,
      uncategorizedCount,
      byClass,
      spent: byClass.need + byClass.want + uncategorizedSpend,
      saved: byClass.savings,
      entriesByCategory,
      merchantsByCategory,
      reimbursements: { paidOut, back, owed: Math.max(0, paidOut - back) },
    };
  }

  return { summarize, monthKeyOf, refundMatch };
}
