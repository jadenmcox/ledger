import { db } from "@/db";
import { accounts, balanceSnapshots, transactions, plaidItems } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { Container, PageHeader } from "@/components/ui";
import { AccountsClient } from "./client";
import { PlaidConnectButton, PlaidItemsList } from "./PlaidConnect";
import { format, subDays, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const rows = await db.select().from(accounts).orderBy(accounts.id);

  const items = await db.select().from(plaidItems).orderBy(plaidItems.id);
  const accountCounts = await db
    .select({
      plaidItemId: accounts.plaidItemId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(accounts)
    .groupBy(accounts.plaidItemId);
  const countByItem = new Map<number, number>();
  for (const r of accountCounts) {
    if (r.plaidItemId != null) countByItem.set(r.plaidItemId, Number(r.count));
  }
  const plaidItemRows = items.map((it) => ({
    id: it.id,
    institutionName: it.institutionName,
    lastSyncedAt: it.lastSyncedAt,
    lastError: it.lastError,
    accountCount: countByItem.get(it.id) ?? 0,
  }));
  void eq;

  const since = startOfDay(subDays(new Date(), 30));
  const [snaps, recentTx] = await Promise.all([
    db.select().from(balanceSnapshots),
    db
      .select()
      .from(transactions)
      .where(and(gte(transactions.date, since))),
  ]);

  // Build per-account 30-day balance series.
  // Strategy: use snapshots where available; fall back to deriving from
  // currentBalance backwards through transactions.
  const trendByAccount: Record<number, number[]> = {};
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    days.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
  }

  for (const a of rows) {
    // Try snapshots first
    const accountSnaps = snaps
      .filter((s) => s.accountId === a.id)
      .sort((x, y) => x.date.localeCompare(y.date));
    if (accountSnaps.length >= 2) {
      const series: number[] = [];
      let i = 0;
      let last = accountSnaps[0].balanceCents;
      for (const d of days) {
        while (i < accountSnaps.length && accountSnaps[i].date <= d) {
          last = accountSnaps[i].balanceCents;
          i++;
        }
        series.push(last / 100);
      }
      trendByAccount[a.id] = series;
      continue;
    }
    // Derive from currentBalance by walking back through tx
    const txs = recentTx
      .filter((t) => t.accountId === a.id)
      .sort(
        (x, y) =>
          new Date(y.date).getTime() - new Date(x.date).getTime(),
      );
    const today = format(new Date(), "yyyy-MM-dd");
    const balByDay: Record<string, number> = { [today]: a.currentBalanceCents };
    let running = a.currentBalanceCents;
    for (const t of txs) {
      running -= t.amountCents;
      const k = format(new Date(t.date), "yyyy-MM-dd");
      balByDay[k] = running;
    }
    const series: number[] = [];
    let last = a.currentBalanceCents;
    for (const d of [...days].reverse()) {
      if (balByDay[d] !== undefined) last = balByDay[d];
      series.unshift(last / 100);
    }
    trendByAccount[a.id] = series;
  }

  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTS"
        title="Accounts"
        subtitle="Checking, savings, credit cards, retirement, investments — every balance in one place."
      />
      <Container>
        <div className="space-y-8">
          <PlaidConnectButton />
          <AccountsClient
            initial={rows}
            today={format(new Date(), "yyyy-MM-dd")}
            trends={trendByAccount}
            linkedBanksSlot={<PlaidItemsList items={plaidItemRows} />}
          />
        </div>
      </Container>
    </>
  );
}
