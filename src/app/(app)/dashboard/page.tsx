import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { and, desc, eq, gte, lte } from "drizzle-orm";
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
  Label,
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

  // Forecast: project month-end spend from current pace
  const dailyAvg = spend / Math.max(1, dayOfMonth);
  const forecastSpend = Math.round(dailyAvg * daysInMonth);

  // Combined "need" monthly amount targets — what they should not exceed
  const needBudget = allCategories
    .filter((c) => c.classification === "need" && c.monthlyLimitCents)
    .reduce((s, c) => s + (c.monthlyLimitCents ?? 0), 0);
  const wantBudget = allCategories
    .filter((c) => c.classification === "want" && c.monthlyLimitCents)
    .reduce((s, c) => s + (c.monthlyLimitCents ?? 0), 0);
  const totalBudget = needBudget + wantBudget;

  // Paycheck cycle: semi-monthly. 1st–15th is the first half, 16th–EoM is the second.
  const isFirstHalf = dayOfMonth <= 15;
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), isFirstHalf ? 1 : 16);
  const cycleEnd = isFirstHalf
    ? new Date(now.getFullYear(), now.getMonth(), 15)
    : endOfMonth(now);
  const cycleLengthDays =
    Math.floor((cycleEnd.getTime() - cycleStart.getTime()) / 86400000) + 1;
  const daysIntoCycle = Math.floor(
    (now.getTime() - cycleStart.getTime()) / 86400000,
  );
  const daysLeftInCycle = Math.max(
    0,
    Math.ceil((cycleEnd.getTime() - now.getTime()) / 86400000),
  );

  // Paycheck income that landed inside this cycle (any income-classified tx)
  const incomeCats = new Set(
    allCategories.filter((c) => c.classification === "income").map((c) => c.id),
  );
  const cycleIncome = txThisMonth
    .filter((t) => {
      const d = new Date(t.date);
      if (d < cycleStart || d > cycleEnd) return false;
      if (!t.categoryId || !incomeCats.has(t.categoryId)) return false;
      return t.amountCents > 0;
    })
    .reduce((s, t) => s + t.amountCents, 0);

  // Spend inside the cycle (excludes income & transfers, including positives that aren't income)
  const cycleSpend = txThisMonth
    .filter((t) => {
      if (t.isTransfer) return false;
      const d = new Date(t.date);
      if (d < cycleStart || d > cycleEnd) return false;
      const cat = t.categoryId ? catById.get(t.categoryId) : null;
      if (cat?.classification === "income") return false;
      return t.amountCents < 0;
    })
    .reduce((s, t) => s + Math.abs(t.amountCents), 0);

  // Use actual cycle income if present, otherwise fall back to Paycheck category's
  // monthly amount halved (since the user's monthly amount represents 2 paychecks).
  const paycheckCat = allCategories.find((c) => c.name === "Paycheck");
  const expectedPerCycle = paycheckCat?.monthlyLimitCents
    ? Math.round(paycheckCat.monthlyLimitCents / 2)
    : 0;
  const paycheckAmt = cycleIncome || expectedPerCycle;
  const cycleSpendPct =
    paycheckAmt > 0 ? Math.min(100, (cycleSpend / paycheckAmt) * 100) : 0;

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
        eyebrow={format(now, "EEEE · MMMM d, yyyy")}
        title={format(now, "MMMM yyyy")}
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
          <div className="space-y-10 md:space-y-14">
            {/* HERO */}
            <div className="grid grid-cols-1 md:grid-cols-[1.5fr_auto] gap-8 md:gap-12 items-start">
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
              <Gauge
                value={savingsRate}
                max={100}
                label="Saved"
                valueDisplay={`${savingsRate.toFixed(0)}%`}
                hint={income > 0 ? `of ${formatCentsCompact(income)}` : "no income yet"}
                color="var(--blush-deep)"
                size={132}
              />
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border">
              <div className="bg-surface p-5 md:p-6">
                <Stat label="Income" value={formatCents(income)} />
              </div>
              <div className="bg-surface p-5 md:p-6">
                <Stat
                  label="Net"
                  value={formatCents(net, { signed: true })}
                  tone={net < 0 ? "blush" : "default"}
                />
              </div>
              <div className="bg-surface p-5 md:p-6">
                <Stat
                  label="Projected"
                  value={formatCents(forecastSpend)}
                  tone={totalBudget > 0 && forecastSpend > totalBudget ? "blush" : "default"}
                  hint={
                    totalBudget > 0
                      ? `${forecastSpend > totalBudget ? "over" : "under"} ${formatCentsCompact(totalBudget)} budget`
                      : "at current pace"
                  }
                />
              </div>
              <div className="bg-surface p-5 md:p-6">
                <Stat
                  label="Last month"
                  value={formatCents(lastMonthSpend)}
                  hint="full month"
                />
              </div>
            </div>

            {/* PAYCHECK CYCLE */}
            <Card className="p-6 md:p-7">
              <div className="flex items-baseline justify-between mb-4 gap-4">
                <div className="min-w-0">
                  <Label>Pay period</Label>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-semibold tracking-tight">
                      Day {daysIntoCycle + 1}
                    </span>
                    <span className="text-sm text-foreground-faint">
                      of {cycleLengthDays}
                    </span>
                  </div>
                  <div className="text-[11px] text-foreground-faint mt-1 mono tabular">
                    {format(cycleStart, "MMM d")} – {format(cycleEnd, "MMM d")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono tabular text-xl font-medium">
                    {formatCents(cycleSpend)}
                  </div>
                  <div className="text-[11px] text-foreground-faint tracking-tight mt-1">
                    {paycheckAmt > 0
                      ? `of ${formatCents(paycheckAmt)} ${cycleIncome > 0 ? "earned" : "expected"}`
                      : `${daysLeftInCycle} days left`}
                  </div>
                </div>
              </div>
              {paycheckAmt > 0 ? (
                <>
                  <ProgressBar
                    value={cycleSpend}
                    max={Math.max(paycheckAmt, 1)}
                    color={cycleSpendPct > 100 ? "var(--blush-deep)" : "var(--blush)"}
                  />
                  <div className="flex items-center justify-between text-[11px] text-foreground-faint mt-2 mono tabular">
                    <span>{cycleSpendPct.toFixed(0)}% spent</span>
                    <span>{daysLeftInCycle} days left</span>
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-foreground-faint mt-1">
                  Set a monthly amount on the Paycheck category to see this
                  period's burn rate.
                </div>
              )}
            </Card>

            {/* CHARTS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <Card className="p-6 md:p-7">
                <SectionHeader
                  title="Need, want, save"
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

              <Card className="p-6 md:p-7">
                <SectionHeader title="Last 30 days" hint="daily spend" />
                <ThirtyDayArea data={dailyData} />
              </Card>
            </div>

            {/* TOP CATEGORIES + MERCHANTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div>
                <SectionHeader
                  title="Top categories"
                  right={
                    <Link
                      href="/categories"
                      className="text-xs text-foreground-muted hover:text-foreground transition-colors tracking-tight inline-flex items-center gap-1"
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
                        <div
                          key={category.id}
                          className="block px-5 py-4"
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
                        </div>
                      );
                    })}
                  </Card>
                )}
              </div>

              <div>
                <SectionHeader title="Top merchants" hint="this month" />
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
                                className="h-full bg-blush rounded-full"
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
                  title="Coming up"
                  hint="detected recurring expenses"
                />
                <Card className="divide-y divide-border">
                  {recurring.slice(0, 8).map((r) => (
                    <div
                      key={r.merchantKey}
                      className="px-5 py-4 flex items-center gap-4"
                    >
                      <Repeat
                        className="size-3.5 text-foreground-faint shrink-0"
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
