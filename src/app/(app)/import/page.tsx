import { db } from "@/db";
import { accounts } from "@/db/schema";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { ImportClient } from "./client";
import { eq } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const active = await db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, true));

  return (
    <>
      <PageHeader
        eyebrow="IMPORT"
        title="A statement,"
        italic="translated."
        subtitle="Drop in a CSV export from your bank. Ledger will map the columns, drop duplicates, and apply any rules you've already created."
      />
      <Container>
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
