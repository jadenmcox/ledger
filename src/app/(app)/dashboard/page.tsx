import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  Container,
  PageHeader,
  Card,
  Stat,
  EmptyState,
  Pill,
  HeroStat,
  ProgressBar,
  SectionHeader,
  Button,
} from "@/components/ui";
import { formatCents, formatCentsCompact } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  format,
  getDaysInMonth,
  getDate,
  subMonths,
  startOfDay,
  subDays,
  addDays,
} from "date-fns";
import Link from "next/link";
import { detectRecurring } from "@/lib/recurring";
import { Repeat, ArrowRight } from "lucide-react";
import { Gauge } from "@/components/charts/Gauge";
import { ClassificationDonut, ThirtyDayArea } from "./charts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = getDate(now);
  const daysLeft = daysInMonth - dayOfMonth;

  const thirtyDayStart = startOfDay(subDays(now, 29));

  const [txThisMonth, txLastMonth, txLast30, allCategories, allAccounts, recurring] =
    await Promise.all([
      db
        .select()
        .from(transactions)
        .where(
          and(
            gte(transactions.date, monthStart),
            lte(transactions.date, monthEnd),
            eq(transactions.isTransfer, false),
          ),
        ),
      db
        .select()
        .from(transactions)
        .where(
          and(
            gte(transactions.date, lastMonthStart),
            lte(transactions.date, lastMonthEnd),
            eq(transactions.isTransfer, false),
          ),
        ),
      db
        .select()
        .from(transactions)
        .where(
          and(
            gte(transactions.date, thirtyDayStart),
            lte(transactions.date, now),
            eq(transactions.isTransfer, false),
          ),
        ),
      db.select().from(categories),
      db.select().from(accounts),
      detectRecurring().catch(() => []),
    ]);

  const catById = new Map(allCategories.map((c) => [c.id, c]));

  // This month aggregates
  let income = 0;
  let spend = 0;
  const spendByClassification = { need: 0, want: 0, savings: 0 };
  const spendByCategory = new Map<number, number>();
  const spendByMerchant = new Map<string, number>();

  for (const t of txThisMonth) {
    const cat = t.categoryId ? catById.get(t.categoryId) : null;
    if (cat?.classification === "income") {
      income += t.amountCents;
      continue;
    }
    if (t.amountCents > 0) continue;
    const abs = Math.abs(t.amountCents);
    spend += abs;
    const mk = (t.merchantClean || t.merchantRaw).trim();
    spendByMerchant.set(mk, (spendByMerchant.get(mk) || 0) + abs);
    if (cat) {
      spendByCategory.set(cat.id, (spendByCategory.get(cat.id) || 0) + abs);
      if (cat.classification === "need") spendByClassification.need += abs;
      if (cat.classification === "want") spendByClassification.want += abs;
      if (cat.classification === "savings")
        spendByClassification.savings += abs;
    }
  }

  // Last month spend (for delta)
  let lastMonthSpend = 0;
  for (const t of txLastMonth) {
    const cat = t.categoryId ? catById.get(t.categoryId) : null;
    if (cat?.classification === "income" || t.amountCents > 0) continue;
    lastMonthSpend += Math.abs(t.amountCents);
  }

  // 30-day daily aggregation
  const daily = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = addDays(thirtyDayStart, i);
    daily.set(format(d, "yyyy-MM-dd"), 0);
  }
  for (const t of txLast30) {
    const cat = t.categoryId ? catById.get(t.categoryId) : null;
    if (cat?.classification === "income" || t.amountCents > 0) continue;
    const k = format(new Date(t.date), "yyyy-MM-dd");
    daily.set(k, (daily.get(k) || 0) + Math.abs(t.amountCents));
  }
  const dailyData = Array.from(daily.entries()).map(([x, spend]) => ({ x, spend }));

  const net = income - spend;
  const savingsRate = income > 0 ? Math.max(0, net / income) * 100 : 0;

  // Pace vs. last month: if at this point in the month last month, spend was X
  const paceLastMonthSpend = (lastMonthSpend / daysInMonth) * dayOfMonth;
  const paceDelta =
    paceLastMonthSpend > 0
      ? ((spend - paceLastMonthSpend) / paceLastMonthSpend) * 100
      : 0;

  const donutData = [
    { name: "Need", value: spendByClassification.need, color: "var(--blush)" },
    { name: "Want", value: spendByClassification.want, color: "var(--peach)" },
    {
      name: "Savings",
      value: spendByClassification.savings,
      color: "var(--blue)",
    },
  ];

  const categoriesWithSpend = allCategories
    .filter(
      (c) =>
        c.classification !== "income" &&
        !c.isArchived &&
        ((spendByCategory.get(c.id) ?? 0) > 0 || c.monthlyLimitCents),
    )
    .map((c) => ({
      category: c,
      spent: spendByCategory.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.spent - a.spent);

  const topMerchants = Array.from(spendByMerchant.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow={format(now, "EEEE · MMMM d, yyyy").toUpperCase()}
        title={format(now, "MMMM")}
        italic={String(now.getFullYear())}
        subtitle={`${daysLeft} days left this month.`}
      />
      <Container className="pb-32 md:pb-16">
        {allAccounts.length === 0 ? (
          <EmptyState
            title="No accounts yet"
            body="Add a checking account or credit card to start tracking. You can also import a CSV right away — Budgetly will create transactions for you to categorize."
            action={
              <div className="flex gap-3 justify-center">
                <Link href="/accounts">
                  <Button variant="primary">Add an account</Button>
                </Link>
                <Link href="/import">
                  <Button variant="outline">Import a CSV</Button>
                </Link>
              </div>
            }
          />
        ) : (
          <div className="space-y-12 md:space-y-16">
            {/* HERO BAND */}
            <div className="relative overflow-hidden rounded-3xl border border-border bg-surface/80 backdrop-blur-sm">
              <div
                aria-hidden
                className="absolute -top-32 -right-24 size-[28rem] rounded-full blur-3xl opacity-60"
                style={{ background: "var(--blush-soft)" }}
              />
              <div
                aria-hidden
                className="absolute -bottom-32 -left-24 size-[24rem] rounded-full blur-3xl opacity-50"
                style={{ background: "var(--blue-tint)" }}
              />
              <div className="relative grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-8 md:gap-10 p-6 md:p-10">
                <HeroStat
                  label="Spent this month"
                  value={formatCents(spend)}
                  tone="blush"
                  delta={
                    lastMonthSpend > 0
                      ? {
                          value: `${paceDelta > 0 ? "+" : ""}${paceDelta.toFixed(0)}% vs. last month pace`,
                          direction:
                            paceDelta > 3
                              ? "up"
                              : paceDelta < -3
                                ? "down"
                                : "flat",
                        }
                      : undefined
                  }
                  hint={`${txThisMonth.length} transactions · ${daysLeft} days left`}
                />
                <div className="flex flex-col items-start md:items-end gap-6 md:gap-4">
                  <Gauge
                    value={savingsRate}
                    max={100}
                    label="Savings rate"
                    valueDisplay={`${savingsRate.toFixed(0)}%`}
                    hint={income > 0 ? `of ${formatCentsCompact(income)} earned` : "no income yet"}
                    color="var(--blue)"
                    size={170}
                  />
                </div>
              </div>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
              <Stat
                label="Income this month"
                value={formatCents(income)}
                tone="blue"
              />
              <Stat
                label="Net"
                value={formatCents(net, { signed: true })}
                tone={net >= 0 ? "blue" : "blush"}
              />
              <Stat
                label="Daily avg"
                value={formatCents(Math.round(spend / Math.max(1, dayOfMonth)))}
                hint="month-to-date"
              />
              <Stat
                label="Last month"
                value={formatCents(lastMonthSpend)}
                hint="full month spend"
              />
            </div>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <Card className="p-6 md:p-8">
                <SectionHeader
                  title="Need · "
                  italic="want · save"
                  hint="share of monthly spend"
                />
                <ClassificationDonut data={donutData} total={spend} />
                <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
                  {donutData.map((d) => {
                    const total =
                      donutData.reduce((s, x) => s + x.value, 0) || 1;
                    const pct = (d.value / total) * 100;
                    return (
                      <div key={d.name} className="flex items-start gap-2">
                        <span
                          className="size-2 rounded-full mt-1.5 shrink-0"
                          style={{ background: d.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-[10px] tracking-[0.2em] uppercase text-foreground-faint">
                            {d.name}
                          </div>
                          <div className="mono tabular text-sm mt-0.5 truncate">
                            {formatCentsCompact(d.value)}
                          </div>
                          <div className="text-[10px] text-foreground-faint mono tabular">
                            {pct.toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="p-6 md:p-8">
                <SectionHeader
                  title="Last "
                  italic="30 days"
                  hint="daily spend"
                />
                <ThirtyDayArea data={dailyData} />
              </Card>
            </div>

            {/* TOP CATEGORIES + MERCHANTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div>
                <SectionHeader
                  title="Top "
                  italic="categories"
                  right={
                    <Link
                      href="/categories"
                      className="text-xs text-foreground-muted hover:text-blush-deep transition-colors tracking-tight inline-flex items-center gap-1"
                    >
                      manage <ArrowRight className="size-3" strokeWidth={1.5} />
                    </Link>
                  }
                />
                {categoriesWithSpend.length === 0 ? (
                  <div className="text-foreground-faint text-sm py-8">
                    No spending tracked yet this month.
                  </div>
                ) : (
                  <Card className="divide-y divide-border">
                    {categoriesWithSpend.slice(0, 6).map(({ category, spent }) => {
                      const limit = category.monthlyLimitCents;
                      const overspent = limit && spent > limit;
                      return (
                        <Link
                          key={category.id}
                          href={`/categories/${category.id}`}
                          className="block px-5 py-4 hover:bg-surface-2 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className="size-2 rounded-full shrink-0"
                              style={{ background: category.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-1.5">
                                <span className="text-sm tracking-tight truncate">
                                  {category.name}
                                </span>
                                <Pill
                                  tone={
                                    category.classification as
                                      | "need"
                                      | "want"
                                      | "savings"
                                  }
                                >
                                  {category.classification}
                                </Pill>
                              </div>
                              {limit ? (
                                <ProgressBar
                                  value={spent}
                                  max={limit}
                                  color={category.color}
                                />
                              ) : (
                                <div className="h-1.5" />
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div
                                className={`mono text-sm tabular ${overspent ? "text-blush-deep" : ""}`}
                              >
                                {formatCentsCompact(spent)}
                              </div>
                              {limit ? (
                                <div className="text-[10px] text-foreground-faint tracking-tight mono tabular">
                                  of {formatCentsCompact(limit)}
                                </div>
                              ) : (
                                <div className="text-[10px] text-foreground-faint tracking-tight">
                                  no limit
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </Card>
                )}
              </div>

              <div>
                <SectionHeader
                  title="Top "
                  italic="merchants"
                  hint="this month"
                />
                {topMerchants.length === 0 ? (
                  <div className="text-foreground-faint text-sm py-8">
                    Nothing yet.
                  </div>
                ) : (
                  <Card className="divide-y divide-border">
                    {topMerchants.map(([name, amount]) => {
                      const max = topMerchants[0][1];
                      const ratio = amount / max;
                      return (
                        <div key={name} className="px-5 py-4 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm tracking-tight truncate mb-1.5">
                              {name}
                            </div>
                            <div
                              className="h-1.5 rounded-full bg-surface-2 overflow-hidden"
                            >
                              <div
                                className="h-full bg-blush/60 rounded-full"
                                style={{ width: `${ratio * 100}%` }}
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
                )}
              </div>
            </div>

            {recurring.length > 0 && (
              <div>
                <SectionHeader
                  title="Coming "
                  italic="up"
                  hint="detected recurring expenses"
                />
                <Card className="divide-y divide-border">
                  {recurring.slice(0, 8).map((r) => (
                    <div
                      key={r.merchantKey}
                      className="px-5 py-4 flex items-center gap-4"
                    >
                      <Repeat
                        className="size-3.5 text-blush-deep shrink-0"
                        strokeWidth={1.5}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm tracking-tight truncate">
                          {r.displayName}
                        </div>
                        <div className="text-[11px] text-foreground-faint tracking-tight mt-0.5">
                          {r.cadence} · seen {r.occurrences}× · last on{" "}
                          {format(r.lastSeen, "MMM d")}
                        </div>
                      </div>
                      <div className="mono tabular text-sm shrink-0">
                        {formatCents(r.expectedAmountCents)}
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </div>
        )}
      </Container>
    </>
  );
}
