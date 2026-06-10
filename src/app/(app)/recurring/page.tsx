import { db } from "@/db";
import {
  accounts,
  categories,
  recurringSchedules,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { RecurringClient } from "./client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const [schedules, allAccts, allCats] = await Promise.all([
    db.select().from(recurringSchedules),
    db.select().from(accounts).where(eq(accounts.isActive, true)),
    db.select().from(categories),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="RECURRING"
        title="Things that "
        italic="repeat."
        subtitle="Set up paychecks, rent, subscriptions — anything with a steady cadence. Budgetly creates the transactions automatically so you don't have to."
      />
      <Container>
        {allAccts.length === 0 ? (
          <EmptyState
            title="Add an account first"
            body="Recurring transactions land in an account. Add one and come back."
            action={
              <Link href="/accounts">
                <Button variant="primary">Add an account</Button>
              </Link>
            }
          />
        ) : (
          <RecurringClient
            initial={schedules}
            accounts={allAccts}
            categories={allCats}
          />
        )}
      </Container>
    </>
  );
}
