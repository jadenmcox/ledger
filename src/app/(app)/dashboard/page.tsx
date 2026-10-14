import { db } from "@/db";
import { accounts, budgetSettings, savingsGoals } from "@/db/schema";
import { SpendingHero, type SpendingSlice } from "./spending-breakdown";
import { CategoryGlyph } from "@/components/category-glyph";
import {
  computeOccurrences,
  expectedMonthlyIncome,
  getActiveSchedules,
} from "@/lib/recurring-schedules";
import { findRecurring } from "@/lib/recurring";
import { loadLedgerData } from "@/lib/ledger-data";
import { owedSummary, paybackState } from "@/lib/paybacks";
import { asc, eq } from "drizzle-orm";
import type { ReactNode } from "react";
import { Container, PageHeader, Card, EmptyState, Button } from "@/components/ui";
import { formatCents, cn } from "@/lib/utils";
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
  isAfter,
  isBefore,
} from "date-fns";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  Repeat,
  Tag,
  TriangleAlert,
} from "lucide-react";
import { SavingsGoalsSection } from "./savings-goals";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const now = new Date();
  // ?m=YYYY-MM pages back through past months; the future is never reachable.
  const sp = await searchParams;
  const parsedMonth =
    sp.m && /^\d{4}-\d{2}$/.test(sp.m)
      ? parse(`${sp.m}-01`, "yyyy-MM-dd", new Date())
      : null;
  const viewDate =
    parsedMonth && isValid(parsedMonth) && parsedMonth <= now ? parsedMonth : now;
  const isCurrentMonth = isSameMonth(viewDate, now);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const daysInMonth = getDaysInMonth(viewDate);
  const dayOfMonth = getDate(now);
  const daysLeft = daysInMonth - dayOfMonth;
  const prevMonthParam = format(subMonths(monthStart, 1), "yyyy-MM");
  const nextMonthParam = format(addMonths(monthStart, 1), "yyyy-MM");

  const [data, allAccounts, goals, settingsRows, schedules] = await Promise.all([
    loadLedgerData(),
    db.select().from(accounts),
    db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.isArchived, false))
      .orderBy(asc(savingsGoals.sortOrder), asc(savingsGoals.id)),
    db.select().from(budgetSettings).limit(1),
    getActiveSchedules(),
  ]);
  const { allTx, allCategories, ledger, links } = data;
  const catById = new Map(allCategories.map((c) => [c.id, c]));
  const acctById = new Map(allAccounts.map((a) => [a.id, a]));

  const m = ledger.summarize(viewDate);

  // Expected income: the manual figure set on Budget, else recurring paychecks.
  // The live month reconciles against it once it exceeds what has landed, so
  // being paid on the 15th and 30th never reads as "no income". Past months
  // always use what actually came in.
  const { cents: derivedExpected } = expectedMonthlyIncome(schedules, monthStart, monthEnd);
  const expectedIncome = settingsRows[0]?.expectedIncomeOverrideCents ?? derivedExpected;
  const usingExpected = isCurrentMonth && expectedIncome > m.income;
  const incomeBasis = usingExpected ? expectedIncome : m.income;

  // Donut slices: top spending categories, the rest rolled into "Other", plus
  // uncategorized, so the slices sum to the Spent headline.
  const spendingCategories = [...m.spendByCategory.entries()]
    .map(([id, value]) => ({ category: catById.get(id)!, value }))
    .filter((x) => x.category && x.category.classification !== "savings" && x.value > 0)
    .sort((a, b) => b.value - a.value);
  const TOP_N = 8;
  const top = spendingCategories.slice(0, TOP_N);
  const rest = spendingCategories.slice(TOP_N);
  const slices: SpendingSlice[] = top.map((x) => ({
    id: x.category.id,
    name: x.category.name,
    value: x.value,
    color: x.category.color,
    icon: x.category.icon,
  }));
  if (rest.length > 0) {
    slices.push({
      id: null,
      name: `Other (${rest.length})`,
      value: rest.reduce((s, x) => s + x.value, 0),
      color: "var(--lavender)",
      icon: "more-horizontal",
    });
  }
  if (m.uncategorizedSpend > 0) {
    slices.push({
      id: "uncategorized",
      name: "No category",
      value: m.uncategorizedSpend,
      color: "var(--foreground-faint)",
      icon: "alert-circle",
    });
  }

  // Budget snapshot: spending categories that have a limit, most-used first.
  const budgetRows = allCategories
    .filter(
      (c) =>
        !c.isArchived &&
        (c.classification === "need" || c.classification === "want") &&
        (c.monthlyLimitCents ?? 0) > 0,
    )
    .map((c) => {
      const spent = m.spendByCategory.get(c.id) ?? 0;
      const limit = c.monthlyLimitCents ?? 0;
      return { c, spent, limit, ratio: limit > 0 ? spent / limit : 0 };
    })
    .sort((a, b) => b.ratio - a.ratio);
  const overBudget = budgetRows.filter((r) => r.spent > r.limit);
  const plannedSpending = budgetRows.reduce((s, r) => s + r.limit, 0);
  const spentAgainstPlan = budgetRows.reduce((s, r) => s + r.spent, 0);

  // Paybacks owed to you (all-time, not just this month).
  const owed = owedSummary(allTx, paybackState(links), now);

  // Coming up: bills you scheduled by hand, plus charges found in your history.
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const scheduled = schedules
    .filter((s) => s.amountCents < 0)
    .flatMap((s) =>
      computeOccurrences(s, tomorrow, monthEnd).map((d) => ({
        name: s.merchantRaw,
        amountCents: Math.abs(s.amountCents),
        date: d,
        categoryId: s.categoryId,
      })),
    );
  const incomeCatIds = new Set(
    allCategories.filter((c) => c.classification === "income").map((c) => c.id),
  );
  const detected = findRecurring(allTx, { now, skipCategoryIds: incomeCatIds })
    .filter((r) => isAfter(r.nextDate, now) && isBefore(r.nextDate, monthEnd))
    .filter(
      (r) =>
        !scheduled.some((s) =>
          s.name.toLowerCase().includes(r.name.toLowerCase().split(" ")[0]),
        ),
    )
    .map((r) => ({
      name: r.name,
      amountCents: r.amountCents,
      date: r.nextDate,
      categoryId: r.categoryId,
    }));
  const comingUp = isCurrentMonth
    ? [...scheduled, ...detected].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6)
    : [];

  // Savings goals: current balance from a linked account, else manual entry.
  const monthsRemaining = Math.max(0, 12 - now.getMonth() - 1) + 1;
  const goalView = goals.map((g) => {
    const linked = g.accountId ? acctById.get(g.accountId) : null;
    const current = linked ? linked.currentBalanceCents : g.manualBalanceCents;
    const projectedYearEnd = current + Math.max(0, monthsRemaining - 1) * g.monthlyTargetCents;
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

  const attention: ReactNode[] = [];
  if (m.uncategorizedCount > 0) {
    attention.push(
      <AttentionRow
        key="uncat"
        href="/transactions?cat=uncategorized"
        icon={<Tag className="size-4" strokeWidth={2} />}
        tone="blush"
        title={`${m.uncategorizedCount} ${m.uncategorizedCount === 1 ? "charge needs" : "charges need"} a category`}
        body={`${formatCents(m.uncategorizedSpend)} isn't counted toward any budget yet.`}
        cta="Sort"
      />,
    );
  }
  if (owed.waiting.length > 0 || owed.readyToMatch.length > 0) {
    attention.push(
      <AttentionRow
        key="owed"
        href="/paybacks"
        icon={<HandCoins className="size-4" strokeWidth={2} />}
        tone="blue"
        title={`${formatCents(owed.owedCents)} owed to you`}
        body={
          owed.readyToMatch.length > 0
            ? `Found ${owed.readyToMatch.length} ${owed.readyToMatch.length === 1 ? "payment that pays" : "payments that pay"} it back. Tap to match.`
            : `${owed.waiting.length} work ${owed.waiting.length === 1 ? "expense is" : "expenses are"} waiting to be paid back.`
        }
        cta={owed.readyToMatch.length > 0 ? "Match" : "Review"}
      />,
    );
  }
  if (isCurrentMonth && overBudget.length > 0) {
    const worst = overBudget[0];
    attention.push(
      <AttentionRow
        key="over"
        href="/budget"
        icon={<TriangleAlert className="size-4" strokeWidth={2} />}
        tone="blush"
        title={
          overBudget.length === 1
            ? `${worst.c.name} is over its limit`
            : `${overBudget.length} categories are over their limit`
        }
        body={`${worst.c.name}: ${formatCents(worst.spent)} of ${formatCents(worst.limit)}.`}
        cta="Budget"
      />,
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          isCurrentMonth
            ? `${format(now, "EEE, MMM d")} · ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`
            : "Looking back"
        }
        title={format(viewDate, "MMMM yyyy")}
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
            body="Connect a bank or add an account to start tracking. You can also import a CSV and categorize from there."
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
            <SpendingHero
              slices={slices}
              spent={m.spent}
              saved={m.saved}
              income={incomeBasis}
              incomeReceived={m.income}
              incomeIsExpected={usingExpected}
              isCurrentMonth={isCurrentMonth}
              dayOfMonth={dayOfMonth}
              daysInMonth={daysInMonth}
              upcoming={comingUp.map((b) => ({
                merchant: b.name,
                amountCents: b.amountCents,
                date: b.date.toISOString(),
              }))}
              prevMonthHref={`/dashboard?m=${prevMonthParam}`}
            />

            {attention.length > 0 && (
              <Section title="Needs a look">
                <Card className="divide-y divide-border overflow-hidden">{attention}</Card>
              </Section>
            )}

            {budgetRows.length > 0 && (
              <Section
                title="Budget"
                hint={`${formatCents(spentAgainstPlan)} of ${formatCents(plannedSpending)} planned spending`}
                right={<SeeAll href="/budget" label="Full budget" />}
              >
                <Card className="divide-y divide-border overflow-hidden">
                  {budgetRows.slice(0, 6).map(({ c, spent, limit }) => {
                    const over = spent > limit;
                    const pct = Math.min(100, (spent / limit) * 100);
                    return (
                      <Link
                        key={c.id}
                        href={`/budget?c=${c.id}`}
                        className="flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-surface-2/50"
                      >
                        <CategoryGlyph icon={c.icon} color={c.color} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-sm tracking-tight">{c.name}</span>
                            <span className="shrink-0 text-[12px] text-foreground-faint">
                              <span
                                className={cn(
                                  "mono tabular",
                                  over ? "text-blush-deep" : "text-foreground",
                                )}
                              >
                                {formatCents(spent)}
                              </span>{" "}
                              of {formatCents(limit)}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: over ? "var(--blush-deep)" : c.color,
                              }}
                            />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </Card>
              </Section>
            )}

            <SavingsGoalsSection
              goals={goalView}
              totals={goalTotals}
              accounts={allAccounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
            />

            {comingUp.length > 0 && (
              <Section
                title="Coming up"
                hint="bills and subscriptions still due this month"
                right={<SeeAll href="/recurring" label="All bills" />}
              >
                <Card className="divide-y divide-border">
                  {comingUp.map((b, i) => {
                    const cat = b.categoryId ? catById.get(b.categoryId) : null;
                    return (
                      <div key={`${b.name}-${i}`} className="px-5 py-3.5 flex items-center gap-3.5">
                        {cat ? (
                          <CategoryGlyph icon={cat.icon} color={cat.color} size={34} />
                        ) : (
                          <span className="grid size-[34px] place-items-center rounded-xl bg-surface-2 text-foreground-faint">
                            <Repeat className="size-4" strokeWidth={1.75} />
                          </span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm tracking-tight truncate">{b.name}</div>
                          <div className="text-[11px] text-foreground-faint mt-0.5">
                            {format(b.date, "EEE, MMM d")}
                          </div>
                        </div>
                        <div className="mono tabular text-sm shrink-0">
                          {formatCents(b.amountCents)}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </Section>
            )}
          </div>
        )}
      </Container>
    </div>
  );
}

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
      <div className="flex items-end justify-between gap-4 mb-3.5 md:mb-4">
        <div className="min-w-0">
          <h2 className="display text-lg md:text-xl tracking-tight">{title}</h2>
          {hint && (
            <p className="text-[12px] text-foreground-faint tracking-tight mt-0.5">{hint}</p>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
      {children}
    </section>
  );
}

function SeeAll({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs tracking-tight text-foreground-muted transition-colors hover:text-foreground"
    >
      {label} <ArrowRight className="size-3" strokeWidth={1.75} />
    </Link>
  );
}

function AttentionRow({
  href,
  icon,
  tone,
  title,
  body,
  cta,
}: {
  href: string;
  icon: ReactNode;
  tone: "blush" | "blue";
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2/50"
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          tone === "blush" ? "bg-blush-tint text-blush-deep" : "bg-blue-tint text-blue-deep",
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium tracking-tight">{title}</div>
        <div className="mt-0.5 text-[12px] text-foreground-muted">{body}</div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium tracking-tight text-foreground-muted">
        {cta} <ChevronRight className="size-3.5" strokeWidth={2} />
      </span>
    </Link>
  );
}
