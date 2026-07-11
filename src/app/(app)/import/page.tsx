import { db } from "@/db";
import { accounts, categories, imports, transactions } from "@/db/schema";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { ImportClient } from "./client";
import { desc, eq, count } from "drizzle-orm";
import Link from "next/link";
import { ImportHero } from "./import-hero";
import { RecentImports } from "./recent-imports";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [active, [{ txCount }], [{ catCount }], recentImports] =
    await Promise.all([
      db.select().from(accounts).where(eq(accounts.isActive, true)),
      db.select({ txCount: count() }).from(transactions),
      db.select({ catCount: count() }).from(categories),
      db
        .select()
        .from(imports)
        .orderBy(desc(imports.importedAt))
        .limit(10),
    ]);

  const acctNameById = new Map(active.map((a) => [a.id, a.name]));

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
          <>
            <ImportClient accounts={active} />
            <RecentImports
              batches={recentImports.map((b) => ({
                id: b.id,
                filename: b.filename,
                accountName: b.accountId
                  ? acctNameById.get(b.accountId) ?? null
                  : null,
                rowCount: b.rowCount,
                importedAt: b.importedAt.toISOString(),
              }))}
            />
          </>
        )}
      </Container>
    </>
  );
}
