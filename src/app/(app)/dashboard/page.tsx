import { db } from "@/db";
import {
  accounts,
  categories,
  recurringSchedules,
  savingsGoals,
  transactions,
  type Category,
} from "@/db/schema";
import { SpendingHero, type SpendingSlice } from "./spending-breakdown";
import { PlannedActual } from "./planned-actual";
import { CategoryGlyph } from "@/components/category-glyph";
import { computeOccurrences } from "@/lib/recurring-schedules";
import { asc, eq } from "drizzle-orm";
import type { ReactNode } from "react";
import {
  Container,
  PageHeader,
  Card,
  EmptyState,
  Pill,
  Button,
} from "@/components/ui";
import { formatCents, formatCentsCompact, cn } from "@/lib/utils";
import { effectiveDate } from "@/lib/effective-month";
import { refundMatches } from "@/lib/refunds";
import {
  startOfMonth,
  endOfMonth,
  format,
  getDaysInMonth,
  getDate,
  parse,
  isValid,
  isSameMonth,
  subMonths,
  addMonths,
} from "date-fns";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Repeat,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { SavingsGoalsSection } from "./savings-goals";

export const dynamic = "force-dynamic";

type Classification = "need" | "want" | "savings";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const now = new Date();
  // ?m=YYYY-MM lets you page back through past months. Defaults to the current
  // month; the future is never reachable (next is disabled on the live month).
  const sp = await searchParams;
  const parsedMonth =
    sp.m && /^\d{4}-\d{2}$/.test(sp.m)
      ? parse(`${sp.m}-01`, "yyyy-MM-dd", new Date())
      : null;
  const viewDate =
    parsedMonth && isValid(parsedMonth) && parsedMonth <= now
      ? parsedMonth
      : now;
  const isCurrentMonth = isSameMonth(viewDate, now);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const daysInMonth = getDaysInMonth(viewDate);
  const dayOfMonth = getDate(now);
  const daysLeft = daysInMonth - dayOfMonth;

  const prevMonthParam = format(subMonths(monthStart, 1), "yyyy-MM");
  const nextMonthParam = format(addMonths(monthStart, 1), "yyyy-MM");

  // Widen the fetch back through the previous month so late-month rent (paid on
  // or after the 20th, which counts toward *this* month) is available to pull
  // in. The window is then narrowed to this month by effective date below.
  const [
    allTx,
    allCategories,
    allAccounts,
    schedules,
    goals,
  ] = await Promise.all([
    // Full non-transfer history: rent rolls in from the prior month and a refund
    // can credit back to a purchase in any earlier month, so a single-month
    // window isn't enough. Bucketing to this month happens in memory below.
    db
      .select()
      .from(transactions)
      .where(eq(transactions.isTransfer, false)),
    db.select().from(categories),
    db.select().from(accounts),
    db.select().from(recurringSchedules).where(eq(recurringSchedules.isActive, true)),
    db.select().from(savingsGoals).where(eq(savingsGoals.isArchived, false)).orderBy(asc(savingsGoals.sortOrder), asc(savingsGoals.id)),
  ]);

  const catById = new Map(allCategories.map((c) => [c.id, c]));
  const acctById = new Map(allAccounts.map((a) => [a.id, a]));

  const isSpendingCat = (categoryId: number | null): boolean => {
    if (categoryId == null) return false;
    const c = catById.get(categoryId);
    return !!c && c.classification !== "income";
  };
  // A refund credits back to the purchase it offsets (matched by merchant), so
  // a return reduces the month — and the vendor line — you actually spent on.
  const refundMatch = refundMatches(allTx, isSpendingCat);

  // Which month a transaction counts toward. Refunds follow their matched
  // purchase's month; everything else uses its own effective month (rent roll).
  const monthKeyOf = (t: (typeof allTx)[number]): Date => {
    const isRefund =
      t.amountCents > 0 && !t.reimbursable && isSpendingCat(t.categoryId);
    const base = isRefund ? refundMatch.get(t.id)?.date ?? t.date : t.date;
    return effectiveDate(
      new Date(base),
      t.categoryId ? catById.get(t.categoryId)?.name : null,
    );
  };

  let income = 0;
  // Net spend per category: purchases add, refunds subtract. Clamped below.
  const spendByCategory = new Map<number, number>();
  let uncategorizedSpend = 0;
  // Per-category vendor rollup: categoryId -> (merchant -> {total, count}). Powers
  // the expandable Planned-vs-actual rows (totals combined by vendor).
  const merchantAgg = new Map<number, Map<string, { total: number; count: number }>>();
  // Reimbursable charges/paybacks wash out: kept off both spent and income.
  let reimbursablePaid = 0;
  let reimbursableReceived = 0;
  for (const t of allTx) {
    if (!isSameMonth(monthKeyOf(t), viewDate)) continue;
    if (t.reimbursable) {
      if (t.amountCents < 0) reimbursablePaid += Math.abs(t.amountCents);
      else reimbursableReceived += t.amountCents;
      continue;
    }
    const cat = t.categoryId ? catById.get(t.categoryId) : null;
    if (cat?.classification === "income") {
      income += t.amountCents;
      continue;
    }
    if (t.amountCents === 0) continue;
    // Purchase adds to spend; a refund (positive) nets back out of it.
    const delta = t.amountCents < 0 ? Math.abs(t.amountCents) : -t.amountCents;
    if (cat) {
      spendByCategory.set(cat.id, (spendByCategory.get(cat.id) || 0) + delta);

      // A refund nets against the vendor of the purchase it offsets (not its own
      // descriptor), so the by-vendor rollup still sums to the category total.
      const isRefund = t.amountCents > 0;
      const merchant = (
        (isRefund ? refundMatch.get(t.id)?.merchant : null) ||
        t.merchantClean ||
        t.merchantRaw ||
        "—"
      ).trim();
      if (!merchantAgg.has(cat.id)) merchantAgg.set(cat.id, new Map());
      const inner = merchantAgg.get(cat.id)!;
      const cur = inner.get(merchant) || { total: 0, count: 0 };
      cur.total += delta;
      if (!isRefund) cur.count += 1;
      inner.set(merchant, cur);
    } else if (delta > 0) {
      // Uncategorized outflow. (Refunds without a category are left alone.)
      uncategorizedSpend += delta;
    }
  }

  // A category can't net below zero for the month (more refunded than bought).
  for (const [id, v] of spendByCategory) {
    if (v < 0) spendByCategory.set(id, 0);
  }

  const spendByClassification = { need: 0, want: 0, savings: 0 };
  for (const [id, v] of spendByCategory) {
    const c = catById.get(id);
    if (c?.classification === "need") spendByClassification.need += v;
    else if (c?.classification === "want") spendByClassification.want += v;
    else if (c?.classification === "savings") spendByClassification.savings += v;
  }

  // Flatten the vendor rollup, biggest first, dropping fully-refunded vendors.
  const merchantsByCategory: Record<
    number,
    { merchant: string; total: number; count: number }[]
  > = {};
  for (const [catId, inner] of merchantAgg) {
    merchantsByCategory[catId] = [...inner.entries()]
      .map(([merchant, v]) => ({ merchant, total: v.total, count: v.count }))
      .filter((v) => v.total > 0)
      .sort((a, b) => b.total - a.total);
  }

  // Saving/investing (a "savings"-class category, e.g. a brokerage
  // contribution) is money kept, not spent. Keep it out of "spent" and surface
  // it on its own. Consumption is everything else that went out this month
  // (needs, wants, and any uncategorized outflow).
  const saved = spendByClassification.savings;
  const spend =
    spendByClassification.need +
    spendByClassification.want +
    saved +
    uncategorizedSpend;
  const consumption = spend - saved;

  // "Every dollar" reconciliation: income, top to bottom, minus what got spent
  // and saved, leaves the unallocated remainder. Positive => income still
  // waiting for a job; negative => allocations were funded from reserves.
  // `uncategorizedSpend` is the slice of spend with no bucket yet — money that
  // moved but isn't accounted for anywhere.
  const leftover = income - consumption - saved;
  const overspent = consumption > income;

  // Spending categories (needs + wants), biggest first, for the overspend
  // flags below and the donut. Savings categories are excluded so a big
  // contribution never reads as overspending; now-empty (fully refunded)
  // categories drop out too.
  const spendingCategories = [...spendByCategory.entries()]
    .map(([id, value]) => ({ category: catById.get(id)!, value }))
    .filter(
      (x) => x.category && x.category.classification !== "savings" && x.value > 0,
    )
    .sort((a, b) => b.value - a.value);

  // Slices for the "Where your money went" donut + ranked list. Show the top
  // categories individually, roll the rest into a muted "Other", and add an
  // "Uncategorized" slice for outflow that has no category so the slices sum to
  // the "Spent this month" headline (consumption).
  const TOP_N = 8;
  const top = spendingCategories.slice(0, TOP_N);
  const rest = spendingCategories.slice(TOP_N);
  const spendingSlices: SpendingSlice[] = [
    ...top.map((x) => ({
      id: x.category.id,
      name: x.category.name,
      value: x.value,
      color: x.category.color,
      icon: x.category.icon,
    })),
  ];
  if (rest.length > 0) {
    spendingSlices.push({
      id: null,
      name: `Other (${rest.length} ${rest.length === 1 ? "category" : "categories"})`,
      value: rest.reduce((s, x) => s + x.value, 0),
      color: "var(--lavender)",
      icon: "more-horizontal",
    });
  }
  if (uncategorizedSpend > 0) {
    spendingSlices.push({
      id: "uncategorized",
      name: "Uncategorized",
      value: uncategorizedSpend,
      color: "var(--foreground-faint)",
      icon: "alert-circle",
    });
  }

  // Overspending flag. Rule: exclude Rent/Mortgage (a big fixed cost that
  // would always dominate), then flag any category whose spend this month is
  // more than 1.5x the MEDIAN non-rent category spend. We also note when a
  // flagged category is over its set monthlyLimitCents. Needs at least 3
  // non-rent categories for a median to mean anything.
  const isRent = (name: string) => /\b(rent|mortgage)\b/i.test(name);
  const nonRent = spendingCategories.filter((x) => !isRent(x.category.name));
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

  // Upcoming recurring bills between tomorrow and end-of-month (for "Coming up").
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  // Planned vs Actual rows. Only categories that actually saw money move this
  // month — a planned limit with zero spend is noise on this view (the limit is
  // still editable over on /budget). Income and archived categories never show.
  type Row = { category: Category; planned: number; actual: number; difference: number };
  const rows: Row[] = allCategories
    .filter(
      (c) =>
        c.classification !== "income" &&
        !c.isArchived &&
        (spendByCategory.get(c.id) ?? 0) > 0,
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
    <div>
      <PageHeader
        eyebrow={
          isCurrentMonth
            ? `${format(now, "EEE · MMM d").toUpperCase()} · ${daysLeft} ${daysLeft === 1 ? "DAY" : "DAYS"} LEFT`
            : `${format(monthStart, "MMM d").toUpperCase()} – ${format(monthEnd, "MMM d, yyyy").toUpperCase()}`
        }
        title={format(viewDate, "MMMM yyyy")}
        subtitle={
          isCurrentMonth
            ? "Where your money went this month, what's planned, and what's coming up."
            : "A look back at where your money went this month."
        }
        right={
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard?m=${prevMonthParam}`}
              aria-label="Previous month"
              className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:text-foreground hover:border-foreground-faint"
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </Link>
            {isCurrentMonth ? (
              <span
                aria-disabled
                className="flex size-10 items-center justify-center rounded-full border border-border/60 text-foreground-faint/40"
              >
                <ChevronRight className="size-4" strokeWidth={2} />
              </span>
            ) : (
              <Link
                href={`/dashboard?m=${nextMonthParam}`}
                aria-label="Next month"
                className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:text-foreground hover:border-foreground-faint"
              >
                <ChevronRight className="size-4" strokeWidth={2} />
              </Link>
            )}
          </div>
        }
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
          <div className="space-y-7 md:space-y-9">
            {/* HERO — spent / saved / income + spending breakdown */}
            <SpendingHero
              slices={spendingSlices}
              consumption={consumption}
              saved={saved}
              income={income}
            />

            {/* EVERY DOLLAR — reconcile income into spent + saved + leftover,
                and flag any spending that hasn't landed in a bucket yet. */}
            {(income > 0 || consumption > 0) && (
              <Section
                title="Every dollar this month"
                hint="where your money landed, top to bottom"
              >
                <Card className="overflow-hidden">
                  <div className="divide-y divide-border">
                    <LedgerRow label="Income" amount={income} sign="+" />
                    <LedgerRow
                      label="Spent"
                      sub="everyday needs & wants"
                      amount={consumption}
                      sign="−"
                      color="var(--blush-deep)"
                    />
                    <LedgerRow
                      label="Saved"
                      sub="moved to savings & investments"
                      amount={saved}
                      sign="−"
                      color="var(--blue-deep)"
                    />
                    <LedgerRow
                      label={
                        leftover >= 0
                          ? "Left to allocate"
                          : overspent
                            ? "Over income"
                            : "From reserves"
                      }
                      amount={Math.abs(leftover)}
                      sign=""
                      emphasize
                      note={
                        leftover >= 0
                          ? leftover < 100
                            ? "every dollar has a home"
                            : "give this a job"
                          : overspent
                            ? "spent more than you earned"
                            : "you dipped into savings"
                      }
                      color={
                        leftover < 0
                          ? overspent
                            ? "var(--blush-deep)"
                            : "var(--blue-deep)"
                          : "var(--foreground)"
                      }
                    />
                  </div>
                  {/* Unaccounted check — is every spent dollar in a bucket? */}
                  <div className="flex items-center gap-2.5 border-t border-border bg-surface-2/40 px-5 py-3.5">
                    {uncategorizedSpend > 0 ? (
                      <>
                        <TriangleAlert
                          className="size-4 shrink-0 text-blush-deep"
                          strokeWidth={2}
                        />
                        <span className="text-sm text-foreground-muted">
                          <span className="mono tabular text-blush-deep">
                            {formatCents(uncategorizedSpend)}
                          </span>{" "}
                          spent with no category yet
                        </span>
                        <Link
                          href="/transactions?cat=uncategorized"
                          className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs tracking-tight text-blush-deep hover:underline"
                        >
                          give it a bucket
                          <ArrowRight className="size-3" strokeWidth={1.5} />
                        </Link>
                      </>
                    ) : (
                      <>
                        <Check
                          className="size-4 shrink-0 text-blue-deep"
                          strokeWidth={2.5}
                        />
                        <span className="text-sm text-foreground-muted">
                          Every dollar you spent is in a bucket.
                        </span>
                      </>
                    )}
                  </div>
                </Card>
              </Section>
            )}

            {/* OVERSPENDING FLAGS */}
            {overspending.length > 0 && (
              <Section
                title="Watch these"
                hint="more than 1.5× your typical category (excludes rent/mortgage)"
              >
                <Card className="divide-y divide-border">
                  {overspending.map((o) => (
                    <div
                      key={o.category.id}
                      className="px-5 py-4 flex items-center gap-3.5"
                    >
                      <CategoryGlyph
                        icon={o.category.icon}
                        color={o.category.color}
                        size={38}
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
              </Section>
            )}

            {/* PLANNED vs ACTUAL TABLE */}
            <Section
              title="Planned vs actual"
              hint="categories with spending this month"
              right={
                <Link
                  href="/budget"
                  className="text-xs text-foreground-muted hover:text-foreground transition-colors tracking-tight inline-flex items-center gap-1"
                >
                  edit limits <ArrowRight className="size-3" strokeWidth={1.5} />
                </Link>
              }
            >
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
                  <PlannedActual
                    groups={groups.map((g) => ({
                      key: g.key,
                      label: g.label,
                      rows: g.rows.map((r) => ({
                        id: r.category.id,
                        name: r.category.name,
                        color: r.category.color,
                        icon: r.category.icon,
                        planned: r.planned,
                        actual: r.actual,
                        difference: r.difference,
                      })),
                    }))}
                    totals={totals}
                    merchantsByCategory={merchantsByCategory}
                  />
                </Card>
              )}
            </Section>

            {/* SAVINGS GOALS */}
            <SavingsGoalsSection
              goals={goalView}
              totals={goalTotals}
              accounts={allAccounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
            />

            {/* COMING UP */}
            {upcomingBills.length > 0 && (
              <Section title="Coming up" hint="recurring bills due this month">
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
              </Section>
            )}

            {/* REIMBURSEMENTS — a side ledger kept off spent & income; shown
                last since it's not part of the month's actual flow */}
            {(reimbursablePaid > 0 || reimbursableReceived > 0) && (
              <Section
                title="Reimbursements"
                hint="not counted in spending or income"
              >
                <Card className="p-5 md:px-7 flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
                  <div className="flex items-center gap-3">
                    <CategoryGlyph icon="repeat" color="var(--blue)" size={34} />
                    <div className="text-sm text-foreground-muted tracking-tight">
                      What you&apos;ve fronted and what&apos;s owed back.
                    </div>
                  </div>
                  <div className="flex items-center gap-6 md:gap-8 mono tabular">
                    <ReconStat label="paid out" value={formatCents(reimbursablePaid)} />
                    <ReconStat label="back" value={formatCents(reimbursableReceived)} />
                    <ReconStat
                      label="still owed"
                      value={formatCents(Math.max(0, reimbursablePaid - reimbursableReceived))}
                      emphasize
                    />
                  </div>
                </Card>
              </Section>
            )}
          </div>
        )}
      </Container>
    </div>
  );
}

// Section header with a display-font title, matching the bold dashboard.
function Section({
  title,
  hint,
  right,
  children,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-4 md:mb-5">
        <div className="min-w-0">
          <h2 className="display text-lg md:text-xl tracking-tight">{title}</h2>
          {hint && (
            <p className="text-[11px] text-foreground-faint tracking-tight mt-1">
              {hint}
            </p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children}
    </section>
  );
}

// One line of the "Every dollar" reconciliation ledger.
function LedgerRow({
  label,
  sub,
  amount,
  sign,
  color,
  note,
  emphasize = false,
}: {
  label: string;
  sub?: string;
  amount: number;
  sign: string;
  color?: string;
  note?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-5 py-3.5",
        emphasize && "bg-surface-2/40",
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "tracking-tight",
            emphasize
              ? "text-sm font-medium text-foreground"
              : "text-sm text-foreground-muted",
          )}
        >
          {label}
        </div>
        {sub && (
          <div className="mt-0.5 text-[11px] text-foreground-faint">{sub}</div>
        )}
      </div>
      {note && (
        <span className="shrink-0 text-[11px] tracking-tight text-foreground-faint">
          {note}
        </span>
      )}
      <div
        className="mono tabular shrink-0 text-sm"
        style={{ color: color ?? "var(--foreground)" }}
      >
        {amount === 0 ? "" : sign}
        {formatCents(amount)}
      </div>
    </div>
  );
}

function ReconStat({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-[0.18em] text-foreground-faint">
        {label}
      </div>
      <div
        className={
          emphasize
            ? "text-base font-medium text-blue-deep"
            : "text-base text-foreground-muted"
        }
      >
        {value}
      </div>
    </div>
  );
}

