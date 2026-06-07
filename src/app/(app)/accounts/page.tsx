import { db } from "@/db";
import { accounts, balanceSnapshots } from "@/db/schema";
import { Container, PageHeader, EmptyState } from "@/components/ui";
import { AccountsClient } from "./client";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const rows = await db.select().from(accounts).orderBy(accounts.id);

  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTS"
        title="Every account,"
        italic="one place."
        subtitle="Checking, savings, credit cards, retirement, investments. Add what's yours and Ledger will weave them into one picture."
      />
      <Container>
        <AccountsClient
          initial={rows}
          today={format(new Date(), "yyyy-MM-dd")}
        />
        {rows.length === 0 && null}
      </Container>
    </>
  );
}
