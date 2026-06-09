import { db } from "@/db";
import { categories, transactions, accounts } from "@/db/schema";
import { and, eq, gte, desc } from "drizzle-orm";
import {
  Container,
  PageHeader,
  Card,
  Stat,
  SectionHeader,
  Pill,
  ProgressBar,
  Button,
} from "@/components/ui";
import { formatCents, formatCentsCompact } from "@/lib/utils";
import {
  startOfMonth,
  subMonths,
  format,
  endOfMonth,
} from "date-fns";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AreaChart } from "@/components/charts/AreaChart";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) notFound();

  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  if (!cat) notFound();

  const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));

  const [tx, allAccts] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.categoryId, categoryId),
          gte(transactions.date, sixMonthsAgo),
          eq(transactions.isTransfer, false),
        ),
      )
      .orderBy(desc(transactions.date)),
    db.select().from(accounts),
  ]);

  const acctById = new Map(allAccts.map((a) => [a.id, a]));

  // Monthly aggregation for 6 months
  const months: { x: string; spend: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = subMonths(new Date(), i);
    months.push({ x: format(m, "MMM"), spend: 0 });
  }
  const now = new Date();
  for (const t of tx) {
    const txDate = new Date(t.date);
    const idx =
      5 -
      (now.getFullYear() * 12 + now.getMonth() -
        (txDate.getFullYear() * 12 + txDate.getMonth()));
    if (idx >= 0 && idx < 6) {
      months[idx].spend +=
        cat.classification === "income"
          ? t.amountCents
          : Math.abs(t.amountCents);
    }
  }

  // This month
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const thisMonthTx = tx.filter(
    (t) => new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd,
  );
  const thisMonthSpend = thisMonthTx.reduce(
    (s, t) =>
      s +
      (cat.classification === "income"
        ? t.amountCents
        : Math.abs(t.amountCents)),
    0,
  );

  // Top merchants
  const merchantTotals = new Map<string, number>();
  for (const t of tx) {
    const k = (t.merchantClean || t.merchantRaw).trim();
    const amount =
      cat.classification === "income"
        ? t.amountCents
        : Math.abs(t.amountCents);
    merchantTotals.set(k, (merchantTotals.get(k) || 0) + amount);
  }
  const topMerchants = Array.from(merchantTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const sixMonthTotal = months.reduce((s, m) => s + m.spend, 0);
  const avg = sixMonthTotal / 6;

  return (
    <>
      <PageHeader
        eyebrow={
          <Link
            href="/categories"
            className="inline-flex items-center gap-1 hover:text-blush-deep transition-colors"
          >
            <ArrowLeft className="size-3" strokeWidth={1.5} /> Categories
          </Link>
        }
        title={cat.name}
        subtitle={`A ${cat.classification} category. Six months of context, top merchants, and recent activity.`}
        right={
          <div className="flex items-center gap-3">
            <span
              className="size-3 rounded-full"
              style={{ background: cat.color }}
            />
            <Pill tone={cat.classification as "need" | "want" | "savings" | "income"}>
              {cat.classification}
            </Pill>
          </div>
        }
      />
      <Container className="pb-32 md:pb-16">
        <div className="space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
            <Stat
              label="This month"
              value={formatCents(thisMonthSpend)}
              tone="blush"
              hint={`${thisMonthTx.length} tx`}
            />
            <Stat
              label="Monthly limit"
              value={
                cat.monthlyLimitCents ? formatCents(cat.monthlyLimitCents) : "—"
              }
            />
            <Stat
              label="6-month avg"
              value={formatCents(Math.round(avg))}
            />
            <Stat label="6-month total" value={formatCents(sixMonthTotal)} />
          </div>

          {cat.monthlyLimitCents && (
            <Card className="p-6">
              <div className="flex items-baseline justify-between mb-3">
                <div className="text-sm tracking-tight">
                  {formatCents(thisMonthSpend)} of{" "}
                  {formatCents(cat.monthlyLimitCents)}
                </div>
                <div className="text-xs text-foreground-faint tracking-tight">
                  {((thisMonthSpend / cat.monthlyLimitCents) * 100).toFixed(0)}%
                </div>
              </div>
              <ProgressBar
                value={thisMonthSpend}
                max={cat.monthlyLimitCents}
                color={cat.color}
                height={8}
              />
            </Card>
          )}

          <Card className="p-6 md:p-8">
            <SectionHeader title="Last " italic="six months" />
            <AreaChart
              data={months}
              series={[
                {
                  key: "spend",
                  name: cat.classification === "income" ? "Income" : "Spend",
                  color: cat.color,
                },
              ]}
              height={220}
              formatValue={(v) => formatCentsCompact(v)}
            />
          </Card>

          {topMerchants.length > 0 && (
            <div>
              <SectionHeader title="Top " italic="merchants" hint="last 6 months" />
              <Card className="divide-y divide-border">
                {topMerchants.map(([name, amount]) => {
                  const ratio = amount / topMerchants[0][1];
                  return (
                    <div
                      key={name}
                      className="px-5 py-4 flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm tracking-tight truncate mb-1.5">
                          {name}
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div
                            className="h-full rounded-full opacity-70"
                            style={{
                              width: `${ratio * 100}%`,
                              background: cat.color,
                            }}
                          />
                        </div>
                      </div>
                      <div className="mono tabular text-sm shrink-0">
                        {formatCentsCompact(amount)}
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          )}

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
                {tx.slice(0, 20).map((t) => {
                  const acct = acctById.get(t.accountId);
                  return (
                    <div
                      key={t.id}
                      className="px-5 py-3.5 flex items-center gap-4 relative"
                    >
                      <span
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                        style={{ background: cat.color }}
                      />
                      <div className="flex-1 min-w-0 pl-1">
                        <div className="text-sm tracking-tight truncate">
                          {t.merchantClean || t.merchantRaw}
                        </div>
                        <div className="text-[11px] text-foreground-faint mt-0.5">
                          {format(new Date(t.date), "EEE, MMM d")}
                          {acct && ` · ${acct.name}`}
                        </div>
                      </div>
                      <div className="mono tabular text-sm shrink-0">
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
