import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { asc, and, gte, lte, eq, desc } from "drizzle-orm";
import { Container, PageHeader } from "@/components/ui";
import { CategoriesClient, NewCategoryButton, type CategoryTx } from "./client";
import { categoryParts, loadSplitsByTx } from "@/lib/splits";
import { startOfMonth, endOfMonth } from "date-fns";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [rows, txThisMonth, splitsByTx] = await Promise.all([
    db
      .select()
      .from(categories)
      .orderBy(asc(categories.classification), asc(categories.sortOrder)),
    db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd),
          eq(transactions.isTransfer, false),
        ),
      )
      .orderBy(desc(transactions.date)),
    loadSplitsByTx(),
  ]);

  const catById = new Map(rows.map((c) => [c.id, c]));

  // This-month spend per category + the per-transaction drill-down. This is
  // context for each bucket (how much has landed in it), not budget planning —
  // setting amounts lives on /budget now.
  const spendByCategory: Record<number, number> = {};
  const txByCategory: Record<number, CategoryTx[]> = {};
  for (const t of txThisMonth) {
    if (t.reimbursable) continue;
    // Split transactions land a portion in each category; unsplit ones yield a
    // single whole-amount part.
    const merchant = t.merchantClean || t.merchantRaw;
    const dateStr =
      t.date instanceof Date ? t.date.toISOString() : String(t.date);
    for (const part of categoryParts(t, splitsByTx)) {
      if (part.categoryId == null) continue;
      const c = catById.get(part.categoryId);
      if (!c) continue;
      (txByCategory[part.categoryId] ??= []).push({
        id: t.id,
        date: dateStr,
        merchant,
        amountCents: part.amountCents,
      });
      if (c.classification === "income") continue;
      if (part.amountCents > 0) continue;
      spendByCategory[part.categoryId] =
        (spendByCategory[part.categoryId] ?? 0) + Math.abs(part.amountCents);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="CATEGORIES"
        title="Categories"
        subtitle="Your buckets — add, rename, recolor, and group them. Set how much to spend in each over on Budget."
        right={<NewCategoryButton />}
      />
      <Container className="pb-32 md:pb-16">
        <CategoriesClient
          initial={rows}
          spendByCategory={spendByCategory}
          txByCategory={txByCategory}
        />
      </Container>
    </>
  );
}
