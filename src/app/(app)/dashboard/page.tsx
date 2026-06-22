import { db } from "@/db";
import {
  accounts,
  budgetSettings,
  categories,
  recurringSchedules,
  savingsGoals,
  transactions,
  type Category,
} from "@/db/schema";
import { CompositionBar } from "./composition-bar";
import { computeOccurrences } from "@/lib/recurring-schedules";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import {
  Container,
  PageHeader,
  Card,
  EmptyState,
  Pill,
  ProgressBar,
  SectionHeader,
  Button,
} from "@/components/ui";
import { formatCents, formatCentsCompact, cn } from "@/lib/utils";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  getDaysInMonth,
  getDate,
} from "date-fns";
import Link from "next/link";
import { ArrowRight, Repeat, TrendingUp } from "lucide-react";
import { SavingsGoalsSection } from "./savings-goals";
import { CategoryDonut, MonthlyTrendBars } from "./charts";
import type { DonutDatum } from "@/components/charts/DonutChart";

export const dynamic = "force-dynamic";

type Classification = "need" | "want" | "savings";

export default async function DashboardPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = getDate(now);
  const daysLeft = daysInMonth - dayOfMonth;
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  // 6-month window for the spending-trend bars (current month + 5 prior).
  const trendStart = startOfMonth(subMonths(now, 5));

  const [
    txThisMonth,
    trendTx,
    allCategories,
    allAccounts,
    schedules,
    goals,
    settingsRows,
  ] = await Promise.all([
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
      .select({
        date: transactions.date,
        amountCents: transactions.amountCents,
        categoryId: transactions.categoryId,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, trendStart),
          lte(transactions.date, monthEnd),
          eq(transactions.isTransfer, false),
        ),
      ),
    db.select().from(categories),
    db.select().from(accounts),
    db.select().from(recurringSchedules).where(eq(recurringSchedules.isActive, true)),
    db.select().from(savingsGoals).where(eq(savingsGoals.isArchived, false)).orderBy(asc(savingsGoals.sortOrder), asc(savingsGoals.id)),
    db.select().from(budgetSettings).limit(1),
  ]);
  const framework = settingsRows[0]?.framework ?? "custom";

  const catById = new Map(allCategories.map((c) => [c.id, c]));
  const acctById = new Map(allAccounts.map((a) => [a.id, a]));

  let income = 0;
  let spend = 0;
  const spendByCategory = new Map<number, number>();
  const spendByClassification = { need: 0, want: 0, savings: 0 };
  for (const t of txThisMonth) {
    const cat = t.categoryId ? catById.get(t.categoryId) : null;
    if (cat?.classification === "income") {
      income += t.amountCents;
      continue;
    }
    if (t.amountCents > 0) continue;
    const abs = Math.abs(t.amountCents);
    spend += abs;
    if (cat) {
      spendByCategory.set(cat.id, (spendByCategory.get(cat.id) || 0) + abs);
      if (cat.classification === "need") spendByClassification.need += abs;
      else if (cat.classification === "want") spendByClassification.want += abs;
      else if (cat.classification === "savings") spendByClassification.savings += abs;
    }
  }

  // Spending by category this month, biggest first. spendByCategory already
  // excludes income (skipped above) and transfers (filtered in the query) and
  // only counts money going out. Uncategorized spend isn't in the map, so we
  // add it as its own neutral slice to keep the donut total honest.
  const categorySpend = [...spendByCategory.entries()]
    .map(([id, value]) => ({ category: catById.get(id)!, value }))
    .filter((x) => x.category)
    .sort((a, b) => b.value - a.value);
  const categorizedSpend = categorySpend.reduce((s, x) => s + x.value, 0);
  const uncategorizedSpend = Math.max(0, spend - categorizedSpend);
  const donutData: DonutDatum[] = categorySpend.map((x) => ({
    name: x.category.name,
    value: x.value,
    color: x.category.color,
  }));
  if (uncategorizedSpend > 0) {
    donutData.push({
      name: "Uncategorized",
      value: uncategorizedSpend,
      color: "var(--surface-2)",
    });
  }
  const biggestCategory = categorySpend[0] ?? null;

  // Monthly spending trend: current month + 5 prior. Bucket by the stored
  // Date (noon-UTC anchored, so the local calendar month is always correct —
  // never parse a bare yyyy-MM-dd string here, per the date convention).
  const trendMonths = Array.from({ length: 6 }, (_, i) => {
    const d = startOfMonth(subMonths(now, 5 - i));
    return { key: format(d, "yyyy-MM"), label: format(d, "MMM"), spend: 0 };
  });
  const trendIdx = new Map(trendMonths.map((m, i) => [m.key, i]));
  for (const t of trendTx) {
    if (t.amountCents > 0) continue;
    const cat = t.categoryId ? catById.get(t.categoryId) : null;
    if (cat?.classification === "income") continue;
    const i = trendIdx.get(format(t.date, "yyyy-MM"));
    if (i !== undefined) trendMonths[i].spend += Math.abs(t.amountCents);
  }
  const trendData = trendMonths.map((m) => ({ label: m.label, spend: m.spend }));
  const trendColors = trendMonths.map((_, i) =>
    i === trendMonths.length - 1 ? "var(--blush-deep)" : "var(--blush)",
  );

  // Overspending flag. Rule: exclude Rent/Mortgage (a big fixed cost that
  // would always dominate), then flag any category whose spend this month is
  // more than 1.5x the MEDIAN non-rent category spend. We also note when a
  // flagged category is over its set monthlyLimitCents. Needs at least 3
  // non-rent categories for a median to mean anything.
  const isRent = (name: string) => /\b(rent|mortgage)\b/i.test(name);
  const nonRent = categorySpend.filter((x) => !isRent(x.category.name));
  const sortedSpends = nonRent.map((x) => x.value).sort((a, b) => a - b);
  const medianSpend =
    sortedSpends.length === 0
      ? 0
      : sortedSpends.length % 2 === 1
        ? sortedSpends[(sortedSpends.length - 1) / 2]
        : (sortedSpends[sortedSpends.length / 2 - 1] +
            sortedSpends[sortedSpends.length / 2]) /
          2;
  const overspendThreshold = medianSpend * 1.5;
  const overspending =
    nonRent.length >= 3 && medianSpend > 0
      ? nonRent
          .filter((x) => x.value > overspendThreshold)
          .map((x) => ({
            category: x.category,
            value: x.value,
            multiple: x.value / medianSpend,
            overLimit:
              x.category.monthlyLimitCents != null &&
              x.value > x.category.monthlyLimitCents,
            limit: x.category.monthlyLimitCents,
          }))
          .sort((a, b) => b.value - a.value)
      : [];

  // Forecast: spend so far + upcoming recurring bills between tomorrow and EoM
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  let upcomingTotal = 0;
  for (const s of schedules) {
    if (s.amountCents >= 0) continue;
    const occs = computeOccurrences(s, tomorrow, monthEnd);
    upcomingTotal += occs.length * Math.abs(s.amountCents);
  }
  const forecastSpend = spend + upcomingTotal;

  // Planned vs Actual rows. Include every non-income, non-archived category
  // that has a limit OR has spend this month. That mirrors the user's sheet:
  // the rows in their Expenses/Spend block are the named categories they care
  // about, plus anything that actually saw money move.
  type Row = { category: Category; planned: number; actual: number; difference: number };
  const rows: Row[] = allCategories
    .filter(
      (c) =>
        c.classification !== "income" &&
        !c.isArchived &&
        ((c.monthlyLimitCents ?? 0) > 0 || (spendByCategory.get(c.id) ?? 0) > 0),
    )
    .map((c) => {
      const planned = c.monthlyLimitCents ?? 0;
      const actual = spendByCategory.get(c.id) ?? 0;
      return { category: c, planned, actual, difference: planned - actual };
    });

  const groups: { key: Classification; label: string; rows: Row[] }[] = (
    ["need", "want", "savings"] as Classification[]
  ).map((k) => ({
    key: k,
    label: k === "need" ? "Needs" : k === "want" ? "Wants" : "Savings",
    rows: rows
      .filter((r) => r.category.classification === k)
      .sort((a, b) => b.actual - a.actual || b.planned - a.planned),
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      planned: acc.planned + r.planned,
      actual: acc.actual + r.actual,
      difference: acc.difference + r.difference,
    }),
    { planned: 0, actual: 0, difference: 0 },
  );

  const upcomingBills = schedules
    .filter((s) => s.amountCents < 0)
    .flatMap((s) =>
      computeOccurrences(s, tomorrow, monthEnd).map((d) => ({
        merchant: s.merchantRaw,
        amountCents: Math.abs(s.amountCents),
        date: d,
      })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);

  // Savings goals: derive "current balance" from linked account if present,
  // otherwise from manual entry. Year-end projection assumes user keeps
  // contributing at their stated monthly target through December.
  const monthsRemaining = Math.max(0, 12 - now.getMonth() - 1) + 1; // includes current month
  const goalView = goals.map((g) => {
    const linked = g.accountId ? acctById.get(g.accountId) : null;
    const current = linked ? linked.currentBalanceCents : g.manualBalanceCents;
    const projectedYearEnd =
      current + Math.max(0, monthsRemaining - 1) * g.monthlyTargetCents;
    return { goal: g, accountName: linked?.name ?? null, current, projectedYearEnd };
  });
  const goalTotals = goalView.reduce(
    (acc, v) => ({
      target: acc.target + v.goal.yearEndTargetCents,
      current: acc.current + v.current,
      monthly: acc.monthly + v.goal.monthlyTargetCents,
      projected: acc.projected + v.projectedYearEnd,
    }),
    { target: 0, current: 0, monthly: 0, projected: 0 },
  );

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
            {/* SUMMARY LINE */}
            <Card className="p-6 md:p-7">
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-4 justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint mb-2">
                    Spent this month
                  </div>
                  <div className="text-3xl md:text-4xl font-semibold tracking-tight">
                    {formatCents(spend)}
                  </div>
                  <div className="text-[11px] text-foreground-faint mt-2 mono tabular">
                    of {formatCents(totals.planned)} planned · {txThisMonth.length} transactions
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint mb-2">
                    Income
                  </div>
                  <div className="text-2xl md:text-3xl font-medium tracking-tight mono tabular">
                    {formatCents(income)}
                  </div>
                  <div className="text-[11px] text-foreground-faint mt-2">
                    {income - spend >= 0 ? "+" : ""}
                    {formatCents(income - spend)} net so far
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint mb-2">
                    Projected
                  </div>
                  <div
                    className={cn(
                      "text-2xl md:text-3xl font-medium tracking-tight mono tabular",
                      totals.planned > 0 && forecastSpend > totals.planned && "text-blush-deep",
                    )}
                  >
                    {formatCents(forecastSpend)}
                  </div>
                  <div className="text-[11px] text-foreground-faint mt-2">
                    {upcomingTotal > 0
                      ? `spent + ${formatCentsCompact(upcomingTotal)} bills due`
                      : "spent so far"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.25em] uppercase text-foreground-faint mb-2">
                    Biggest category
                  </div>
                  {biggestCategory ? (
                    <>
                      <div className="text-2xl md:text-3xl font-medium tracking-tight flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ background: biggestCategory.category.color }}
                        />
                        <span className="truncate">
                          {biggestCategory.category.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-foreground-faint mt-2 mono tabular">
                        {formatCents(biggestCategory.value)}
                        {spend > 0
                          ? ` · ${((biggestCategory.value / spend) * 100).toFixed(0)}% of spend`
                          : ""}
                      </div>
                    </>
                  ) : (
                    <div className="text-2xl md:text-3xl font-medium tracking-tight text-foreground-faint">
                      —
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* COMPOSITION BAR */}
            <CompositionBar
              income={income}
              segments={spendByClassification}
              framework={framework}
              plannedTotal={totals.planned}
            />

            {/* SPENDING BREAKDOWN + TREND */}
            <div className="grid gap-6 md:gap-8 lg:grid-cols-2">
              <Card className="p-6 md:p-7">
                <SectionHeader
                  title="Where it's going"
                  hint="spending by category this month"
                />
                {categorySpend.length === 0 && uncategorizedSpend === 0 ? (
                  <div className="py-10 text-center text-foreground-faint text-sm">
                    No spending yet this month.
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="shrink-0">
                      <CategoryDonut data={donutData} total={spend} />
                    </div>
                    <div className="flex-1 min-w-0 w-full space-y-2.5">
                      {donutData.slice(0, 6).map((d) => (
                        <div
                          key={d.name}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ background: d.color }}
                          />
                          <span className="truncate flex-1 tracking-tight">
                            {d.name}
                          </span>
                          <span className="mono tabular text-foreground-muted shrink-0">
                            {formatCents(d.value)}
                          </span>
                          <span className="mono tabular text-foreground-faint text-[11px] shrink-0 w-9 text-right">
                            {spend > 0 ? `${((d.value / spend) * 100).toFixed(0)}%` : ""}
                          </span>
                        </div>
                      ))}
                      {donutData.length > 6 && (
                        <div className="text-[11px] text-foreground-faint pt-1">
                          +{donutData.length - 6} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-6 md:p-7">
                <SectionHeader
                  title="Monthly trend"
                  hint="total spent, last 6 months"
                />
                <MonthlyTrendBars data={trendData} colors={trendColors} />
              </Card>
            </div>

            {/* OVERSPENDING FLAGS */}
            {overspending.length > 0 && (
              <div>
                <SectionHeader
                  title="Watch these"
                  hint="more than 1.5× your typical category (excludes rent/mortgage)"
                />
                <Card className="divide-y divide-border">
                  {overspending.map((o) => (
                    <div
                      key={o.category.id}
                      className="px-5 py-4 flex items-center gap-4"
                    >
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ background: o.category.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm tracking-tight truncate flex items-center gap-2">
                          {o.category.name}
                          {o.overLimit && (
                            <Pill tone="need">over limit</Pill>
                          )}
                        </div>
                        <div className="text-[11px] text-foreground-faint mt-0.5">
                          {o.multiple.toFixed(1)}× your typical category
                          {o.overLimit && o.limit != null
                            ? ` · limit ${formatCentsCompact(o.limit)}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-blush-deep">
                        <TrendingUp className="size-3.5" strokeWidth={1.5} />
                        <span className="mono tabular text-sm">
                          {formatCents(o.value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* PLANNED vs ACTUAL TABLE */}
            <div>
              <SectionHeader
                title="Planned vs actual"
                hint="categories with a limit or any activity this month"
                right={
                  <Link
                    href="/budget"
                    className="text-xs text-foreground-muted hover:text-foreground transition-colors tracking-tight inline-flex items-center gap-1"
                  >
                    edit limits <ArrowRight className="size-3" strokeWidth={1.5} />
                  </Link>
                }
              />
              {rows.length === 0 ? (
                <Card className="p-8 text-center text-foreground-faint text-sm">
                  No category limits set and no spending yet. Head to{" "}
                  <Link href="/budget" className="text-blush-deep hover:underline">
                    Budget
                  </Link>{" "}
                  to plan the month.
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] tracking-[0.18em] uppercase text-foreground-faint border-b border-border">
                        <th className="text-left px-5 py-3 font-medium">Category</th>
                        <th className="text-right px-3 py-3 font-medium hidden sm:table-cell">
                          Planned
                        </th>
                        <th className="text-right px-3 py-3 font-medium">Actual</th>
                        <th className="text-right px-5 py-3 font-medium">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) =>
                        g.rows.length === 0 ? null : (
                          <RowGroup key={g.key} label={g.label} rows={g.rows} />
                        ),
                      )}
                      <tr className="border-t-2 border-border bg-surface-2/40">
                        <td className="px-5 py-3 text-sm font-medium tracking-tight">
                          Total
                        </td>
                        <td className="px-3 py-3 text-right mono tabular hidden sm:table-cell">
                          {formatCents(totals.planned)}
                        </td>
                        <td className="px-3 py-3 text-right mono tabular">
                          {formatCents(totals.actual)}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3 text-right mono tabular",
                            totals.difference < 0 && "text-blush-deep",
                          )}
                        >
                          {totals.difference >= 0 ? "+" : ""}
                          {formatCents(totals.difference)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Card>
              )}
            </div>

            {/* SAVINGS GOALS */}
            <SavingsGoalsSection
              goals={goalView}
              totals={goalTotals}
              accounts={allAccounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
            />

            {/* COMING UP */}
            {upcomingBills.length > 0 && (
              <div>
                <SectionHeader title="Coming up" hint="recurring bills due this month" />
                <Card className="divide-y divide-border">
                  {upcomingBills.map((b, i) => (
                    <div
                      key={`${b.merchant}-${i}`}
                      className="px-5 py-4 flex items-center gap-4"
                    >
                      <Repeat
                        className="size-3.5 text-foreground-faint shrink-0"
                        strokeWidth={1.5}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm tracking-tight truncate">
                          {b.merchant}
                        </div>
                        <div className="text-[11px] text-foreground-faint mt-0.5 mono tabular">
                          {format(b.date, "EEE, MMM d")}
                        </div>
                      </div>
                      <div className="mono tabular text-sm shrink-0">
                        {formatCents(b.amountCents)}
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

function RowGroup({
  label,
  rows,
}: {
  label: string;
  rows: { category: Category; planned: number; actual: number; difference: number }[];
}) {
  const subtotal = rows.reduce(
    (acc, r) => ({
      planned: acc.planned + r.planned,
      actual: acc.actual + r.actual,
      difference: acc.difference + r.difference,
    }),
    { planned: 0, actual: 0, difference: 0 },
  );
  return (
    <>
      <tr className="bg-surface-2/30 border-t border-border">
        <td
          colSpan={4}
          className="px-5 py-2 text-[10px] tracking-[0.2em] uppercase text-foreground-faint"
        >
          {label}
        </td>
      </tr>
      {rows.map(({ category, planned, actual, difference }) => {
        const over = planned > 0 && actual > planned;
        return (
          <tr
            key={category.id}
            className="border-t border-border hover:bg-surface-2/30 transition-colors"
          >
            <td className="px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ background: category.color }}
                />
                <span className="truncate">{category.name}</span>
              </div>
              {planned > 0 && (
                <div className="ml-5 mt-2 max-w-[160px]">
                  <ProgressBar
                    value={actual}
                    max={planned}
                    color={category.color}
                    height={4}
                  />
                </div>
              )}
            </td>
            <td className="px-3 py-3 text-right mono tabular text-foreground-muted hidden sm:table-cell">
              {planned > 0 ? formatCents(planned) : "—"}
            </td>
            <td
              className={cn(
                "px-3 py-3 text-right mono tabular",
                over && "text-blush-deep",
              )}
            >
              {formatCents(actual)}
            </td>
            <td
              className={cn(
                "px-5 py-3 text-right mono tabular",
                difference < 0 && "text-blush-deep",
              )}
            >
              {planned === 0 ? (
                <span className="text-foreground-faint">no limit</span>
              ) : (
                <>
                  {difference >= 0 ? "+" : ""}
                  {formatCents(difference)}
                </>
              )}
            </td>
          </tr>
        );
      })}
      <tr className="border-t border-border bg-surface-2/10">
        <td className="px-5 py-2 text-[11px] text-foreground-faint tracking-tight">
          {label} subtotal
        </td>
        <td className="px-3 py-2 text-right mono tabular text-foreground-faint text-[11px] hidden sm:table-cell">
          {formatCents(subtotal.planned)}
        </td>
        <td className="px-3 py-2 text-right mono tabular text-foreground-faint text-[11px]">
          {formatCents(subtotal.actual)}
        </td>
        <td
          className={cn(
            "px-5 py-2 text-right mono tabular text-[11px]",
            subtotal.difference < 0 ? "text-blush-deep" : "text-foreground-faint",
          )}
        >
          {subtotal.difference >= 0 ? "+" : ""}
          {formatCents(subtotal.difference)}
        </td>
      </tr>
    </>
  );
}
