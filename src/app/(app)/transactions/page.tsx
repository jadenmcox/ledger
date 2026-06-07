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
        title="Every dollar"
        italic="accounted for."
        subtitle={`${allTx.length} most recent. Click any merchant to recategorize, or create a rule that catches it forever.`}
      />
      <Container>
        {allTx.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            body="Import a CSV from your bank to bring transactions in. Ledger will dedupe on re-import, so you can run it weekly without worry."
            action={
              <Link href="/import">
                <Button variant="primary">Import a CSV</Button>
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
