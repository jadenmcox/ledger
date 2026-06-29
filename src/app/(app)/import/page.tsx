import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { ImportClient } from "./client";
import { eq, count } from "drizzle-orm";
import Link from "next/link";
import { ImportHero } from "./import-hero";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [active, [{ txCount }], [{ catCount }]] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.isActive, true)),
    db.select({ txCount: count() }).from(transactions),
    db.select({ catCount: count() }).from(categories),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="IMPORT"
        title="A statement,"
        italic="translated."
        subtitle="Drop in a CSV export from your bank. Budgetly will map the columns, drop duplicates, and apply any rules you've already created."
      />
      <Container>
        <div className="mb-10">
          <ImportHero
            txCount={txCount}
            accountCount={active.length}
            categoryCount={catCount}
          />
        </div>
        {active.length === 0 ? (
          <EmptyState
            title="Add an account first"
            body="Imports land in an account. Add one — even just the name — and come back."
            action={
              <Link href="/accounts">
                <Button variant="primary">Add an account</Button>
              </Link>
            }
          />
        ) : (
          <ImportClient accounts={active} />
        )}
      </Container>
    </>
  );
}
