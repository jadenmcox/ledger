import { db } from "@/db";
import {
  categoryRules,
  transactions,
  type CategoryRule,
} from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function ruleMatches(rule: CategoryRule, merchant: string): boolean {
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
): number | null {
  for (const r of rules) {
    if (ruleMatches(r, merchant)) return r.categoryId;
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
    const matched = applyRules(t.merchantRaw, rules);
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
) {
  const pattern = normalize(merchant);
  // Avoid duplicates
  const existing = await db
    .select()
    .from(categoryRules)
    .where(
      and(
        eq(categoryRules.pattern, pattern),
        eq(categoryRules.matchType, matchType),
      ),
    );
  if (existing.length > 0) {
    await db
      .update(categoryRules)
      .set({ categoryId, priority: Math.max(existing[0].priority, priority) })
      .where(eq(categoryRules.id, existing[0].id));
    return existing[0].id;
  }
  const [r] = await db
    .insert(categoryRules)
    .values({ pattern, matchType, categoryId, priority })
    .returning();
  return r.id;
}
