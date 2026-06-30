import { db } from "@/db";
import {
  categoryRules,
  reimbursableRules,
  transactions,
  type CategoryRule,
  type ReimbursableRule,
} from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function ruleMatches(
  rule: CategoryRule,
  merchant: string,
  amountCents?: number | null,
): boolean {
  // Amount condition (on the absolute value). A bounded rule can only match
  // when we know the amount; without it (some legacy callers) it's skipped.
  if (rule.minAmountCents != null || rule.maxAmountCents != null) {
    if (amountCents == null) return false;
    const abs = Math.abs(amountCents);
    if (rule.minAmountCents != null && abs < rule.minAmountCents) return false;
    if (rule.maxAmountCents != null && abs > rule.maxAmountCents) return false;
  }
  const m = normalize(merchant);
  const p = normalize(rule.pattern);
  switch (rule.matchType) {
    case "merchant_exact":
      return m === p;
    case "merchant_contains":
      return m.includes(p);
    case "regex":
      try {
        return new RegExp(rule.pattern, "i").test(merchant);
      } catch {
        return false;
      }
  }
}

export async function getRules() {
  return db
    .select()
    .from(categoryRules)
    .orderBy(desc(categoryRules.priority), categoryRules.id);
}

export function applyRules(
  merchant: string,
  rules: CategoryRule[],
  amountCents?: number | null,
): number | null {
  for (const r of rules) {
    if (ruleMatches(r, merchant, amountCents)) return r.categoryId;
  }
  return null;
}

/**
 * Apply all rules across the entire transaction history.
 * If `onlyUncategorized`, skips rows that already have a category.
 */
export async function applyRulesToHistory(
  opts: { onlyUncategorized?: boolean } = {},
) {
  const rules = await getRules();
  if (rules.length === 0) return 0;

  const txs = opts.onlyUncategorized
    ? await db
        .select()
        .from(transactions)
        .where(isNull(transactions.categoryId))
    : await db.select().from(transactions);

  let updated = 0;
  for (const t of txs) {
    // Never override a category a human set by hand — that's the whole point
    // of the lock. (onlyUncategorized rows are all unlocked, so this only
    // matters for the full-history pass.)
    if (t.categoryLocked) continue;
    const matched = applyRules(t.merchantRaw, rules, t.amountCents);
    if (matched && matched !== t.categoryId) {
      await db
        .update(transactions)
        .set({ categoryId: matched })
        .where(eq(transactions.id, t.id));
      updated++;
    }
  }
  return updated;
}

export async function createRuleFromTransaction(
  merchant: string,
  categoryId: number,
  matchType: "merchant_contains" | "merchant_exact" = "merchant_contains",
  priority = 0,
  bounds: { minAmountCents?: number | null; maxAmountCents?: number | null } = {},
) {
  const pattern = normalize(merchant);
  const minAmountCents = bounds.minAmountCents ?? null;
  const maxAmountCents = bounds.maxAmountCents ?? null;
  // Dedupe on pattern + matchType + amount bounds, so a broad "Costco" rule and
  // a narrowed "Costco under $50" rule coexist rather than clobbering each other.
  const existing = await db
    .select()
    .from(categoryRules)
    .where(
      and(
        eq(categoryRules.pattern, pattern),
        eq(categoryRules.matchType, matchType),
      ),
    );
  const sameBounds = existing.find(
    (e) => e.minAmountCents === minAmountCents && e.maxAmountCents === maxAmountCents,
  );
  if (sameBounds) {
    await db
      .update(categoryRules)
      .set({ categoryId, priority: Math.max(sameBounds.priority, priority) })
      .where(eq(categoryRules.id, sameBounds.id));
    return sameBounds.id;
  }
  const [r] = await db
    .insert(categoryRules)
    .values({ pattern, matchType, categoryId, priority, minAmountCents, maxAmountCents })
    .returning();
  return r.id;
}

// ---------------------------------------------------------------------------
// Reimbursable rules
// ---------------------------------------------------------------------------

export async function getReimbursableRules(): Promise<ReimbursableRule[]> {
  return db.select().from(reimbursableRules);
}

export function checkReimbursable(
  merchant: string,
  rules: ReimbursableRule[],
  amountCents: number,
): boolean {
  const abs = Math.abs(amountCents);
  for (const r of rules) {
    if (r.maxAmountCents != null && abs > r.maxAmountCents) continue;
    if (!ruleMatches(r as unknown as CategoryRule, merchant, amountCents)) continue;
    return true;
  }
  return false;
}

export async function applyReimbursableRulesToHistory(): Promise<number> {
  const rules = await getReimbursableRules();
  if (rules.length === 0) return 0;
  const txs = await db.select().from(transactions);
  let updated = 0;
  for (const t of txs) {
    if (t.amountCents >= 0) continue; // only outflows
    const shouldReimburse = checkReimbursable(t.merchantRaw, rules, t.amountCents);
    if (shouldReimburse && !t.reimbursable) {
      await db
        .update(transactions)
        .set({ reimbursable: true })
        .where(eq(transactions.id, t.id));
      updated++;
    }
  }
  return updated;
}
