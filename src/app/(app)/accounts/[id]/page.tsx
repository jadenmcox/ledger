import { db } from "@/db";
import { accounts, transactions, categories, balanceSnapshots } from "@/db/schema";
import { and, eq, gte, desc } from "drizzle-orm";
import {
  Container,
  PageHeader,
  Card,
  Stat,
  SectionHeader,
  Pill,
  Button,
} from "@/components/ui";
import { formatCents } from "@/lib/utils";
import { format, subDays, startOfDay } from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BalanceArea } from "./charts";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  hys: "High-yield savings",
  credit: "Credit card",
  cash: "Cash",
  brokerage: "Brokerage",
  roth_ira: "Roth IRA",
  traditional_401k: "401(k)",
  hsa: "HSA",
  loan: "Loan",
  other: "Other",
};

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isFinite(accountId)) notFound();

  const [acct] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!acct) notFound();

  const since = startOfDay(subDays(new Date(), 89));
  const [tx, snaps, allCats] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          gte(transactions.date, since),
        ),
      )
      .orderBy(desc(transactions.date)),
    db
      .select()
      .from(balanceSnapshots)
      .where(eq(balanceSnapshots.accountId, accountId)),
    db.select().from(categories),
  ]);

  const catById = new Map(allCats.map((c) => [c.id, c]));

  // Build balance series for 90 days
  const days: string[] = [];
  for (let i = 89; i >= 0; i--) {
    days.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
  }
  const sortedSnaps = [...snaps].sort((x, y) => x.date.localeCompare(y.date));
  let series: { x: string; balance: number }[];
  if (sortedSnaps.length >= 2) {
    series = [];
    let i = 0;
    let last = sortedSnaps[0].balanceCents;
    for (const d of days) {
      while (i < sortedSnaps.length && sortedSnaps[i].date <= d) {
        last = sortedSnaps[i].balanceCents;
        i++;
      }
      series.push({ x: d, balance: last / 100 });
    }
  } else {
    const txDesc = [...tx].sort(
      (x, y) => new Date(y.date).getTime() - new Date(x.date).getTime(),
    );
    const today = format(new Date(), "yyyy-MM-dd");
    const balByDay: Record<string, number> = { [today]: acct.currentBalanceCents };
    let running = acct.currentBalanceCents;
    for (const t of txDesc) {
      running -= t.amountCents;
      const k = format(new Date(t.date), "yyyy-MM-dd");
      balByDay[k] = running;
    }
    series = [];
    let last = acct.currentBalanceCents;
    for (const d of [...days].reverse()) {
      if (balByDay[d] !== undefined) last = balByDay[d];
      series.unshift({ x: d, balance: last / 100 });
    }
  }

  const isDebt = acct.type === "credit" || acct.type === "loan";
  const lineColor = isDebt ? "var(--blush)" : "var(--blue)";

  const inflow = tx
    .filter((t) => t.amountCents > 0 && !t.isTransfer)
    .reduce((s, t) => s + t.amountCents, 0);
  const outflow = tx
    .filter((t) => t.amountCents < 0 && !t.isTransfer)
    .reduce((s, t) => s + Math.abs(t.amountCents), 0);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1 hover:text-blush-deep transition-colors"
          >
            <ArrowLeft className="size-3" strokeWidth={1.5} /> Accounts
          </Link>
        }
        title={acct.name}
        subtitle={`${typeLabel[acct.type] || acct.type}${acct.institution ? ` at ${acct.institution}` : ""}. The last 90 days, every dollar moved.`}
        right={<Pill>{typeLabel[acct.type] || acct.type}</Pill>}
      />
      <Container className="pb-32 md:pb-16">
        <div className="space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
            <Stat
              label="Current balance"
              value={formatCents(acct.currentBalanceCents)}
              tone={isDebt ? "blush" : "blue"}
            />
            <Stat
              label="90-day inflow"
              value={formatCents(inflow)}
              tone="blue"
            />
            <Stat
              label="90-day outflow"
              value={formatCents(outflow)}
              tone="blush"
            />
            <Stat
              label="Transactions"
              value={String(tx.length)}
              hint="last 90 days"
            />
          </div>

          <Card className="p-6 md:p-8">
            <SectionHeader title="Balance " italic="trend" hint="last 90 days" />
            <BalanceArea data={series} color={lineColor} />
          </Card>

          <div>
            <SectionHeader
              title="Recent "
              italic="transactions"
              right={
                <Link href="/transactions">
                  <Button variant="ghost" size="sm">
                    All transactions
                  </Button>
                </Link>
              }
            />
            {tx.length === 0 ? (
              <div className="text-foreground-faint text-sm py-8 text-center">
                No transactions yet.
              </div>
            ) : (
              <Card className="divide-y divide-border">
                {tx.slice(0, 30).map((t) => {
                  const cat = t.categoryId ? catById.get(t.categoryId) : null;
                  return (
                    <div
                      key={t.id}
                      className="px-5 py-3.5 flex items-center gap-4 relative"
                    >
                      <span
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                        style={{ background: cat?.color ?? "var(--border-strong)" }}
                      />
                      <div className="flex-1 min-w-0 pl-1">
                        <div className="text-sm tracking-tight truncate">
                          {t.merchantClean || t.merchantRaw}
                        </div>
                        <div className="text-[11px] text-foreground-faint mt-0.5">
                          {format(new Date(t.date), "EEE, MMM d")}
                          {cat && ` · ${cat.name}`}
                        </div>
                      </div>
                      <div
                        className={`mono tabular text-sm shrink-0 ${t.amountCents > 0 ? "text-blue-deep" : ""}`}
                      >
                        {formatCents(t.amountCents, {
                          signed: t.amountCents > 0,
                        })}
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        </div>
      </Container>
    </>
  );
}
