import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { Container, PageHeader, EmptyState, Button } from "@/components/ui";
import { TransactionsClient, TransactionsHeaderActions } from "./client";
import Link from "next/link";
import { TransactionsHero } from "./transactions-hero";
import { format, isSameDay } from "date-fns";
import { createMonthBucketer, monthConsumption } from "@/lib/month-bucket";
import { loadSplitsByTx } from "@/lib/splits";

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

  const [txPlusOne, heroTx, allCats, allAccts, splitsByTx] = await Promise.all([
    // One extra row tells us whether a "Load more" is worth showing.
    db
      .select()
      .from(transactions)
      .orderBy(desc(transactions.date))
      .limit(limit + 1),
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
    loadSplitsByTx(),
  ]);

  const hasMore = txPlusOne.length > limit;
  const allTx = hasMore ? txPlusOne.slice(0, limit) : txPlusOne;
  const hasAccounts = allAccts.length > 0;

  const now = new Date();
  const thisMonthSpend = monthConsumption(heroTx, allCats, now, splitsByTx);

  // Refund provenance for the visible rows: a matched refund gets a small
  // "credits <merchant> · <date>" note so the netting isn't invisible magic.
  const { refundMatch } = createMonthBucketer(heroTx, allCats);
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
            refundNotes={refundNotes}
            splits={splits}
            hasMore={hasMore}
            nextN={limit + PAGE}
          />
        )}
      </Container>
    </>
  );
}
