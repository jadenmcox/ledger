import { db } from "@/db";
import { merchantRules, transactions, type MerchantRule } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function merchantRuleMatches(rule: MerchantRule, merchant: string): boolean {
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

export async function getMerchantRules() {
  return db
    .select()
    .from(merchantRules)
    .orderBy(desc(merchantRules.priority), merchantRules.id);
}

export function applyMerchantRules(
  merchant: string,
  rules: MerchantRule[],
): string | null {
  for (const r of rules) {
    if (merchantRuleMatches(r, merchant)) return r.cleanName;
  }
  return null;
}

export async function applyMerchantRulesToHistory() {
  const rules = await getMerchantRules();
  if (rules.length === 0) return 0;

  const txs = await db.select().from(transactions);
  let updated = 0;
  for (const t of txs) {
    const matched = applyMerchantRules(t.merchantRaw, rules);
    if (matched && matched !== t.merchantClean) {
      await db
        .update(transactions)
        .set({ merchantClean: matched })
        .where(eq(transactions.id, t.id));
      updated++;
    }
  }
  return updated;
}

export async function createMerchantRule(
  pattern: string,
  cleanName: string,
  matchType: "merchant_contains" | "merchant_exact" = "merchant_contains",
) {
  const p = normalize(pattern);
  if (!p) throw new Error("Pattern required");
  if (!cleanName.trim()) throw new Error("Clean name required");

  const existing = await db
    .select()
    .from(merchantRules)
    .where(
      and(eq(merchantRules.pattern, p), eq(merchantRules.matchType, matchType)),
    );
  if (existing.length > 0) {
    await db
      .update(merchantRules)
      .set({ cleanName })
      .where(eq(merchantRules.id, existing[0].id));
    return existing[0].id;
  }
  const [r] = await db
    .insert(merchantRules)
    .values({ pattern: p, cleanName, matchType, priority: 0 })
    .returning();
  return r.id;
}

// Heuristic: strip leading numeric/POS/DEBIT/etc tokens (mirrors cleanMerchant
// in import/actions.ts), then return the longest remaining alphabetic token,
// uppercased. For "10120D CAVA PARK LANE" → "CAVA".
export function guessPatternFromRaw(raw: string): string {
  const cleaned = raw
    .replace(/\b(POS|DEBIT|CREDIT|PURCHASE|PAYMENT)\b/gi, "")
    .replace(/\s+\d{6,}/g, "")
    .replace(/\s+#\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => /^[A-Za-z]{2,}$/.test(t));
  if (tokens.length === 0) return cleaned;
  let best = tokens[0];
  for (const t of tokens) if (t.length > best.length) best = t;
  return best.toUpperCase();
}
