import { db } from "@/db";
import { accounts, transactions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { TransactionsClient, TransactionsHeaderActions } from "./client";
import Link from "next/link";
import { format, isSameDay } from "date-fns";
import { loadLedgerData } from "@/lib/ledger-data";

export const dynamic = "force-dynamic";

// Page size for the list; ?n= loads more in steps of this.
const PAGE = 500;
const MAX_N = 5000;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const sp = await searchParams;
  const requested = Number(sp.n);
  const limit =
    Number.isFinite(requested) && requested > PAGE
      ? Math.min(Math.floor(requested), MAX_N)
      : PAGE;

  const [txPlusOne, ledgerData, allAccts] = await Promise.all([
    // One extra row tells us whether a "Load more" is worth showing.
    db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.date))
      .limit(limit + 1),
    loadLedgerData(),
    db.select().from(accounts),
  ]);
  const { allCategories: allCats, splitsByTx, links, ledger } = ledgerData;

  const hasMore = txPlusOne.length > limit;
  const allTx = hasMore ? txPlusOne.slice(0, limit) : txPlusOne;
  const hasAccounts = allAccts.length > 0;

  // Refund provenance for the visible rows: a matched refund gets a small
  // "credits <merchant> · <date>" note so the netting isn't invisible magic.
  const { refundMatch } = ledger;
  const refundNotes: Record<number, string> = {};
  for (const t of allTx) {
    const m = refundMatch.get(t.id);
    if (!m) continue;
    const own = (t.merchantClean || t.merchantRaw).trim();
    const unmatched = m.merchant === own && isSameDay(new Date(m.date), new Date(t.date));
    if (unmatched) continue;
    refundNotes[t.id] = `credits ${m.merchant} · ${format(new Date(m.date), "MMM d")}`;
  }

  // Plain-object split map for the client: each split transaction's category
  // parts, so the list can badge it and the split editor can preload.
  const splits: Record<
    number,
    { categoryId: number | null; amountCents: number; note: string | null }[]
  > = {};
  for (const [txId, rows] of splitsByTx) {
    splits[txId] = rows.map((r) => ({
      categoryId: r.categoryId,
      amountCents: r.amountCents,
      note: r.note,
    }));
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle={
          hasAccounts
            ? "Tap any transaction to recategorize it, split it, or mark who paid you back."
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
            refundNotes={refundNotes}
            splits={splits}
            hasMore={hasMore}
            nextN={limit + PAGE}
            links={links.map((l) => ({
              id: l.id,
              paybackId: l.paybackId,
              chargeId: l.chargeId,
              amountCents: l.amountCents,
            }))}
          />
        )}
      </Container>
    </>
  );
}
