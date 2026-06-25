import { db } from "@/db";
import {
  budgetSettings,
  categories,
  recurringSchedules,
  transactions,
} from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Container, PageHeader } from "@/components/ui";
import {
  endOfMonth,
  getDate,
  getDaysInMonth,
  startOfMonth,
} from "date-fns";
import { computeOccurrences } from "@/lib/recurring-schedules";
import { BudgetClient } from "./client";
import type { CategoryTx } from "../categories/client";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = getDate(now);

  const [allCategories, txThisMonth, schedules, settingsRows] = await Promise.all([
    db.select().from(categories),
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
      .from(recurringSchedules)
      .where(eq(recurringSchedules.isActive, true)),
    db.select().from(budgetSettings).limit(1),
  ]);

  const framework = settingsRows[0]?.framework ?? "custom";

  const catById = new Map(allCategories.map((c) => [c.id, c]));

  // Income + spend aggregates
  let income = 0;
  let spend = 0;
  const spendByClassification = { need: 0, want: 0, savings: 0 };
  const spendByCategory = new Map<number, number>();
  // Per-category drill-down: the actual transactions behind each row's spend.
  const txByCategory: Record<number, CategoryTx[]> = {};
  for (const t of txThisMonth) {
    const cat = t.categoryId ? catById.get(t.categoryId) : null;
    if (cat) {
      (txByCategory[cat.id] ??= []).push({
        id: t.id,
        date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
        merchant: t.merchantClean || t.merchantRaw,
        amountCents: t.amountCents,
      });
    }
    if (cat?.classification === "income") {
      if (t.amountCents > 0) income += t.amountCents;
      continue;
    }
    if (t.amountCents > 0) continue;
    const abs = Math.abs(t.amountCents);
    spend += abs;
    if (cat) {
      spendByCategory.set(cat.id, (spendByCategory.get(cat.id) ?? 0) + abs);
      if (cat.classification === "need") spendByClassification.need += abs;
      if (cat.classification === "want") spendByClassification.want += abs;
      if (cat.classification === "savings") spendByClassification.savings += abs;
    }
  }
  // Newest first within each category, matching the /categories drill-down.
  for (const id in txByCategory) {
    txByCategory[id].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }

  // Forecast: still-expected recurring outflows between today and end-of-month.
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );
  const upcomingByCategory = new Map<number, number>();
  let upcomingTotal = 0;
  type UpcomingItem = {
    merchant: string;
    amountCents: number;
    date: string;
    categoryId: number | null;
  };
  const upcomingList: UpcomingItem[] = [];
  for (const s of schedules) {
    const occs = computeOccurrences(s, tomorrow, monthEnd);
    for (const d of occs) {
      // Negative amounts are outflows; treat as spend.
      if (s.amountCents < 0) {
        const abs = Math.abs(s.amountCents);
        upcomingTotal += abs;
        if (s.categoryId) {
          upcomingByCategory.set(
            s.categoryId,
            (upcomingByCategory.get(s.categoryId) ?? 0) + abs,
          );
        }
        upcomingList.push({
          merchant: s.merchantRaw,
          amountCents: s.amountCents,
          date: d.toISOString(),
          categoryId: s.categoryId,
        });
      }
    }
  }
  upcomingList.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  // Paycheck fallback for "expected income" if user hasn't been paid yet this month.
  const paycheckCat = allCategories.find((c) => c.name === "Paycheck");
  const expectedIncome = paycheckCat?.monthlyLimitCents ?? 0;
  const incomeBasis = Math.max(income, expectedIncome);

  // Expected month-end spend: what's hit so far plus known upcoming recurring bills.
  // Pace extrapolation was noisy and conflicted with the per-class "what's left" math below.
  const projectedSpend = spend + upcomingTotal;

  const totalLimit = allCategories.reduce(
    (s, c) =>
      c.classification !== "income" && c.monthlyLimitCents
        ? s + c.monthlyLimitCents
        : s,
    0,
  );

  const calendarPct = (dayOfMonth / daysInMonth) * 100;

  // Plain-data shape for the client component.
  const cats = allCategories
    .filter((c) => !c.isArchived)
    .map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      classification: c.classification,
      monthlyLimitCents: c.monthlyLimitCents,
      spent: spendByCategory.get(c.id) ?? 0,
      upcoming: upcomingByCategory.get(c.id) ?? 0,
    }));

  return (
    <>
      <PageHeader
        eyebrow="BUDGET"
        title="What's left to "
        italic="spend."
        subtitle="Pick a framework, set limits across every category, and see what's actually projected to land before month-end."
      />
      <Container className="pb-32 md:pb-16">
        <BudgetClient
          framework={framework}
          income={income}
          incomeBasis={incomeBasis}
          spend={spend}
          spendByClassification={spendByClassification}
          projectedSpend={projectedSpend}
          totalLimit={totalLimit}
          upcomingTotal={upcomingTotal}
          upcomingList={upcomingList}
          dayOfMonth={dayOfMonth}
          daysInMonth={daysInMonth}
          calendarPct={calendarPct}
          categories={cats}
          txByCategory={txByCategory}
        />
      </Container>
    </>
  );
}
