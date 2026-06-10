import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { TransactionsClient } from "./client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [allTx, allCats, allAccts] = await Promise.all([
    db.select().from(transactions).orderBy(desc(transactions.date)).limit(500),
    db.select().from(categories),
    db.select().from(accounts),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="TRANSACTIONS"
        title="Transactions"
        subtitle={`${allTx.length} most recent. Click any merchant to recategorize, or create a rule that catches it forever.`}
      />
      <Container>
        {allTx.length === 0 && allAccts.length === 0 ? (
          <EmptyState
            title="Add an account first"
            body="Imports and manual entries land in an account. Add one — even just the name — and come back."
            action={
              <Link href="/accounts">
                <Button variant="primary">Add an account</Button>
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
