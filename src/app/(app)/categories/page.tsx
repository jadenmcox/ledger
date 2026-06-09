import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { asc, and, gte, lte, eq } from "drizzle-orm";
import { Container, PageHeader } from "@/components/ui";
import { CategoriesClient } from "./client";
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
      ),
  ]);

  const spendByCategory: Record<number, number> = {};
  const catById = new Map(rows.map((c) => [c.id, c]));
  for (const t of txThisMonth) {
    if (!t.categoryId) continue;
    const c = catById.get(t.categoryId);
    if (!c || c.classification === "income") continue;
    if (t.amountCents > 0) continue;
    spendByCategory[t.categoryId] =
      (spendByCategory[t.categoryId] ?? 0) + Math.abs(t.amountCents);
  }

  return (
    <>
      <PageHeader
        eyebrow="CATEGORIES"
        title="Categories"
        subtitle="Where every transaction lands. Set a monthly limit on the ones that matter."
      />
      <Container>
        <CategoriesClient initial={rows} spendByCategory={spendByCategory} />
      </Container>
    </>
  );
}
