import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { asc, and, gte, lte, eq, desc } from "drizzle-orm";
import { Container, PageHeader } from "@/components/ui";
import { CategoriesClient, type CategoryTx } from "./client";
import { startOfMonth, endOfMonth } from "date-fns";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const now = new Date();
  const [rows, txThisMonth] = await Promise.all([
    db
      .select()
      .from(categories)
      .orderBy(asc(categories.classification), asc(categories.sortOrder)),
    db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.date, startOfMonth(now)),
          lte(transactions.date, endOfMonth(now)),
          eq(transactions.isTransfer, false),
        ),
      )
      .orderBy(desc(transactions.date)),
  ]);

  const spendByCategory: Record<number, number> = {};
  const txByCategory: Record<number, CategoryTx[]> = {};
  const catById = new Map(rows.map((c) => [c.id, c]));
  for (const t of txThisMonth) {
    if (!t.categoryId) continue;
    const c = catById.get(t.categoryId);
    if (!c) continue;
    (txByCategory[t.categoryId] ??= []).push({
      id: t.id,
      date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
      merchant: t.merchantClean || t.merchantRaw,
      amountCents: t.amountCents,
    });
    if (c.classification === "income") continue;
    if (t.amountCents > 0) continue;
    spendByCategory[t.categoryId] =
      (spendByCategory[t.categoryId] ?? 0) + Math.abs(t.amountCents);
  }

  return (
    <>
      <PageHeader
        eyebrow="CATEGORIES"
        title="Categories"
        subtitle="Where every transaction lands. Set a monthly amount on the ones that matter."
      />
      <Container>
        <CategoriesClient
          initial={rows}
          spendByCategory={spendByCategory}
          txByCategory={txByCategory}
        />
      </Container>
    </>
  );
}
