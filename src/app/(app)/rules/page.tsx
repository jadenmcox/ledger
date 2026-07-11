import { db } from "@/db";
import {
  categories,
  categoryRules,
  merchantRules,
  reimbursableRules,
  transactions,
} from "@/db/schema";
import { desc } from "drizzle-orm";
import { Container, PageHeader } from "@/components/ui";
import { applyRules, checkReimbursable } from "@/lib/categorize";
import { applyMerchantRules } from "@/lib/merchant-rename";
import type { CategoryRule, MerchantRule, ReimbursableRule } from "@/db/schema";
import { RulesClient } from "./client";

export const dynamic = "force-dynamic";

// How many recent transactions the "wins" counters are computed against.
const SAMPLE = 500;

export default async function RulesPage() {
  const [catRules, mRules, rRules, allCategories, recentTx] =
    await Promise.all([
      db
        .select()
        .from(categoryRules)
        .orderBy(desc(categoryRules.priority), categoryRules.id),
      db
        .select()
        .from(merchantRules)
        .orderBy(desc(merchantRules.priority), merchantRules.id),
      db.select().from(reimbursableRules),
      db.select().from(categories),
      db
        .select({
          merchantRaw: transactions.merchantRaw,
          amountCents: transactions.amountCents,
        })
        .from(transactions)
        .orderBy(desc(transactions.date))
        .limit(SAMPLE),
    ]);

  // First-match-wins hit counts over the recent sample — the same precedence
  // the categorizer uses, so a shadowed rule honestly shows zero.
  const catHits = new Map<number, number>();
  const winningCatRule = (merchant: string, amountCents: number) => {
    for (const r of catRules) {
      if (applyRules(merchant, [r], amountCents) != null) return r.id;
    }
    return null;
  };
  const mHits = new Map<number, number>();
  const winningMerchantRule = (merchant: string) => {
    for (const r of mRules) {
      if (applyMerchantRules(merchant, [r]) != null) return r.id;
    }
    return null;
  };
  const rHits = new Map<number, number>();
  const winningReimbursableRule = (merchant: string, amountCents: number) => {
    if (amountCents >= 0) return null;
    for (const r of rRules) {
      if (checkReimbursable(merchant, [r], amountCents)) return r.id;
    }
    return null;
  };
  for (const t of recentTx) {
    const c = winningCatRule(t.merchantRaw, t.amountCents);
    if (c != null) catHits.set(c, (catHits.get(c) ?? 0) + 1);
    const m = winningMerchantRule(t.merchantRaw);
    if (m != null) mHits.set(m, (mHits.get(m) ?? 0) + 1);
    const r = winningReimbursableRule(t.merchantRaw, t.amountCents);
    if (r != null) rHits.set(r, (rHits.get(r) ?? 0) + 1);
  }

  const slimCat = (r: CategoryRule) => ({
    id: r.id,
    pattern: r.pattern,
    matchType: r.matchType,
    categoryId: r.categoryId,
    priority: r.priority,
    minAmountCents: r.minAmountCents,
    maxAmountCents: r.maxAmountCents,
    hits: catHits.get(r.id) ?? 0,
  });
  const slimMerchant = (r: MerchantRule) => ({
    id: r.id,
    pattern: r.pattern,
    matchType: r.matchType,
    cleanName: r.cleanName,
    hits: mHits.get(r.id) ?? 0,
  });
  const slimReimb = (r: ReimbursableRule) => ({
    id: r.id,
    pattern: r.pattern,
    matchType: r.matchType,
    maxAmountCents: r.maxAmountCents,
    hits: rHits.get(r.id) ?? 0,
  });

  return (
    <>
      <PageHeader
        eyebrow="SETUP"
        title="Rules"
        subtitle="Everything that categorizes, renames, or flags transactions automatically. Rules run on import and when you hit Run all rules; manual picks are never overwritten."
      />
      <Container className="pb-32 md:pb-16">
        <RulesClient
          categoryRules={catRules.map(slimCat)}
          merchantRules={mRules.map(slimMerchant)}
          reimbursableRules={rRules.map(slimReimb)}
          categories={allCategories.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
          }))}
          sampleSize={Math.min(SAMPLE, recentTx.length)}
        />
      </Container>
    </>
  );
}
