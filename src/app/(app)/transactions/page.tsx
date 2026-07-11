import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { TransactionsClient, TransactionsHeaderActions } from "./client";
import Link from "next/link";
import { TransactionsHero } from "./transactions-hero";
import { format } from "date-fns";
import { monthConsumption } from "@/lib/month-bucket";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [allTx, heroTx, allCats, allAccts] = await Promise.all([
    db.select().from(transactions).orderBy(desc(transactions.date)).limit(500),
    // Slim full history for the hero's "spent this month": the shared
    // month-bucketer needs every row so refunds credit the right month and
    // late-month rent rolls forward, exactly like the dashboard headline.
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        amountCents: transactions.amountCents,
        merchantRaw: transactions.merchantRaw,
        merchantClean: transactions.merchantClean,
        categoryId: transactions.categoryId,
        isTransfer: transactions.isTransfer,
        reimbursable: transactions.reimbursable,
      })
      .from(transactions)
      .where(eq(transactions.isTransfer, false)),
    db.select().from(categories),
    db.select().from(accounts),
  ]);

  const hasAccounts = allAccts.length > 0;

  const now = new Date();
  const thisMonthSpend = monthConsumption(heroTx, allCats, now);
  const uncategorized = allTx.filter(
    (t) => !t.categoryId && !t.isTransfer && t.amountCents < 0,
  ).length;

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
