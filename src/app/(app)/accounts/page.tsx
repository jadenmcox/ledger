import { db } from "@/db";
import { accounts, balanceSnapshots, transactions, plaidItems } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { Container, PageHeader } from "@/components/ui";
import { AccountsClient } from "./client";
import { PlaidConnectButton, PlaidItemsList } from "./PlaidConnect";
import { AccountsHero } from "./accounts-hero";

const ACCOUNT_PALETTE = [
  "#6C7FFF", "#9B85F5", "#52C99A", "#F5A05A", "#F06E8C",
  "#5BC4E0", "#A3C65D", "#E08B5A", "#8B7EC8", "#5ABFB5",
];
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

  const debtTypes = new Set(["credit", "loan"]);
  const activeRows = rows.filter((a) => a.isActive);

  // Asset slices: positive-balance non-debt accounts, sorted largest first
  const assetAccounts = activeRows
    .filter((a) => !debtTypes.has(a.type) && a.currentBalanceCents > 0)
    .sort((a, b) => b.currentBalanceCents - a.currentBalanceCents);

  const heroSlices = assetAccounts.map((a, i) => ({
    id: a.id,
    name: a.name,
    value: a.currentBalanceCents,
    color: ACCOUNT_PALETTE[i % ACCOUNT_PALETTE.length],
  }));

  const totalAssets = assetAccounts.reduce(
    (s, a) => s + a.currentBalanceCents,
    0,
  );
  const totalDebt = activeRows
    .filter((a) => debtTypes.has(a.type))
    .reduce((s, a) => s + Math.abs(a.currentBalanceCents), 0);

  return (
    <>
      <PageHeader
        eyebrow="ACCOUNTS"
        title="Accounts"
        subtitle="Checking, savings, credit cards, retirement, investments — every balance in one place."
        right={<PlaidConnectButton />}
      />
      <Container>
        <div className="mb-10">
          <AccountsHero
            slices={heroSlices}
            totalAssets={totalAssets}
            totalDebt={totalDebt}
          />
        </div>
        <AccountsClient
          initial={rows}
          today={format(new Date(), "yyyy-MM-dd")}
          trends={trendByAccount}
          linkedBanksSlot={<PlaidItemsList items={plaidItemRows} />}
        />
      </Container>
    </>
  );
}
