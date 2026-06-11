import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { TransactionsClient, TransactionsHeaderActions } from "./client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [allTx, allCats, allAccts] = await Promise.all([
    db.select().from(transactions).orderBy(desc(transactions.date)).limit(500),
    db.select().from(categories),
    db.select().from(accounts),
  ]);

  const hasAccounts = allAccts.length > 0;

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
