import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { TransactionsClient, TransactionsHeaderActions } from "./client";
import Link from "next/link";
import { TransactionsHero } from "./transactions-hero";
import { startOfMonth, endOfMonth, format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [allTx, allCats, allAccts] = await Promise.all([
    db.select().from(transactions).orderBy(desc(transactions.date)).limit(500),
    db.select().from(categories),
    db.select().from(accounts),
  ]);

  const hasAccounts = allAccts.length > 0;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const catById = new Map(allCats.map((c) => [c.id, c]));

  const spendByCat = new Map<number, number>();
  let thisMonthSpend = 0;
  let uncategorized = 0;

  for (const t of allTx) {
    const d = new Date(t.date);
    if (d < monthStart || d > monthEnd) continue;
    const cat = t.categoryId ? catById.get(t.categoryId) : null;
    if (cat?.classification === "income") continue;
    if (t.isTransfer || t.reimbursable) continue;
    if (t.amountCents >= 0) continue;
    const abs = Math.abs(t.amountCents);
    thisMonthSpend += abs;
    if (!t.categoryId) {
      uncategorized++;
    } else {
      spendByCat.set(t.categoryId, (spendByCat.get(t.categoryId) ?? 0) + abs);
    }
  }

  const heroSlices = Array.from(spendByCat.entries())
    .map(([id, value]) => {
      const cat = catById.get(id);
      if (!cat) return null;
      return { id, name: cat.name, value, color: cat.color, icon: cat.icon };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle={
          hasAccounts
            ? `${allTx.length} most recent from your connected accounts. Tap a merchant to recategorize — or make it a rule that catches every future one.`
            : "Connect a bank and the last few months of activity will land here automatically."
        }
        right={hasAccounts ? <TransactionsHeaderActions /> : undefined}
      />
      <Container>
        {hasAccounts && (
          <div className="mb-10">
            <TransactionsHero
              slices={heroSlices}
              totalSpend={thisMonthSpend}
              txCount={allTx.length}
              uncategorized={uncategorized}
              monthLabel={format(now, "MMMM")}
            />
          </div>
        )}
        {!hasAccounts ? (
          <EmptyState
            title="Connect a bank first"
            body="Budgetly pulls transactions straight from your accounts. Link one and we'll fill this in for you."
            action={
              <Link href="/accounts">
                <Button variant="primary">Connect a bank</Button>
              </Link>
            }
          />
        ) : (
          <TransactionsClient
            initial={allTx}
            categories={allCats}
            accounts={allAccts}
          />
        )}
      </Container>
    </>
  );
}
