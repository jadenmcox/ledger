import { db } from "@/db";
import {
  budgetSettings,
  categories,
  recurringSchedules,
  transactions,
} from "@/db/schema";
import type { Classification } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Container, PageHeader } from "@/components/ui";
import {
  endOfMonth,
  format,
  getDate,
  getDaysInMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { isSameMonth } from "date-fns";
import { computeOccurrences } from "@/lib/recurring-schedules";
import { effectiveDate } from "@/lib/effective-month";
import { refundMatches } from "@/lib/refunds";
import { BudgetClient } from "./client";
import type { SmartFillRow } from "./smart-fill";
import type { CategoryTx } from "../categories/client";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const now = new Date();
  const monthEnd = endOfMonth(now);
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = getDate(now);
  // Smart-fill basis: the 6 *complete* months before this one. The current
  // month is partial so it would drag every average down — exclude it.
  const histStart = startOfMonth(subMonths(now, 6));
  const histEnd = endOfMonth(subMonths(now, 1));

  const [allCategories, allTx, histTx, schedules, settingsRows] =
    await Promise.all([
      db.select().from(categories),
      // Full non-transfer history: a refund can credit back to a purchase in
      // any earlier month, so a single-month window isn't enough. Narrowed to
      // this month (refund- and rent-aware) in memory below.
      db
        .select()
        .from(transactions)
        .where(eq(transactions.isTransfer, false)),
      db
        .select({
          date: transactions.date,
          amountCents: transactions.amountCents,
          categoryId: transactions.categoryId,
        })
        .from(transactions)
        .where(
          and(
            gte(transactions.date, histStart),
            lte(transactions.date, histEnd),
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

  const isSpendingCat = (categoryId: number | null): boolean => {
    if (categoryId == null) return false;
    const c = catById.get(categoryId);
    return !!c && c.classification !== "income";
  };
  // Refunds credit back to the month of the purchase they offset (matched by
  // merchant); rent still rolls forward. Narrow full history to this month by
  // that effective/credit month, matching the dashboard + Year.
  const refundMatch = refundMatches(allTx, isSpendingCat);
  const monthKeyOf = (t: (typeof allTx)[number]): Date => {
    const isRefund =
      t.amountCents > 0 && !t.reimbursable && isSpendingCat(t.categoryId);
    const base = isRefund ? refundMatch.get(t.id)?.date ?? t.date : t.date;
    return effectiveDate(
      new Date(base),
      t.categoryId ? catById.get(t.categoryId)?.name : null,
    );
  };
  const txThisMonth = allTx.filter((t) => isSameMonth(monthKeyOf(t), now));

  // Income + spend aggregates. Refunds net back out of spend in the month of
  // the purchase they offset; a category is clamped at zero if more was
  // refunded than bought this month.
  let income = 0;
  let uncategorizedSpend = 0;
  const spendByCategory = new Map<number, number>();
  // Per-category drill-down: the actual transactions behind each row's spend.
  const txByCategory: Record<number, CategoryTx[]> = {};
  for (const t of txThisMonth) {
    // Reimbursable charges/paybacks net out — keep them off spend + income.
    if (t.reimbursable) continue;
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
    if (t.amountCents === 0) continue;
    // Purchase adds to spend; a refund (positive) nets back out.
    const delta = t.amountCents < 0 ? Math.abs(t.amountCents) : -t.amountCents;
    if (cat) {
      spendByCategory.set(cat.id, (spendByCategory.get(cat.id) ?? 0) + delta);
    } else if (delta > 0) {
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
  const spend =
    spendByClassification.need +
    spendByClassification.want +
    spendByClassification.savings +
    uncategorizedSpend;
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
      icon: c.icon,
      classification: c.classification,
      monthlyLimitCents: c.monthlyLimitCents,
      spent: spendByCategory.get(c.id) ?? 0,
      upcoming: upcomingByCategory.get(c.id) ?? 0,
    }));

  // ---- Smart-fill basis: average monthly spend per category ----
  // Bucket the trailing window by the stored noon-UTC Date (date-fns format on
  // the Date is safe — never parse a bare yyyy-MM-dd string here).
  const histByCategory = new Map<number, number>();
  const monthsSeen = new Set<string>();
  for (const t of histTx) {
    if (t.amountCents > 0) continue;
    const c = t.categoryId ? catById.get(t.categoryId) : null;
    if (!c || c.classification === "income") continue;
    monthsSeen.add(format(t.date, "yyyy-MM"));
    histByCategory.set(
      c.id,
      (histByCategory.get(c.id) ?? 0) + Math.abs(t.amountCents),
    );
  }
  // Divide each category's trailing total by how many months actually had
  // activity (capped to the 6-month window). A two-month-old account shouldn't
  // have its spend averaged over six empty months.
  const basisMonths = Math.max(1, Math.min(6, monthsSeen.size));

  const suggestRows = allCategories.filter(
    (c) => c.classification !== "income" && !c.isArchived,
  );
  const avgByCategory = new Map<number, number>();
  for (const c of suggestRows) {
    avgByCategory.set(
      c.id,
      Math.round((histByCategory.get(c.id) ?? 0) / basisMonths),
    );
  }

  // Framework scaling: keep each category's relative share of its class but
  // stretch class totals to respect the chosen framework. Custom leaves the
  // raw averages alone.
  const scaledByCategory = new Map<number, number>();
  for (const c of suggestRows)
    scaledByCategory.set(c.id, avgByCategory.get(c.id) ?? 0);
  if (framework === "50_30_20" && incomeBasis > 0) {
    const splits: Record<string, number> = { need: 0.5, want: 0.3, savings: 0.2 };
    for (const cls of ["need", "want", "savings"] as Exclude<
      Classification,
      "income"
    >[]) {
      const clsCats = suggestRows.filter((c) => c.classification === cls);
      if (clsCats.length === 0) continue;
      const target = Math.round(incomeBasis * splits[cls]);
      const rawTotal = clsCats.reduce(
        (s, c) => s + (avgByCategory.get(c.id) ?? 0),
        0,
      );
      if (rawTotal > 0) {
        for (const c of clsCats) {
          scaledByCategory.set(
            c.id,
            Math.round(((avgByCategory.get(c.id) ?? 0) * target) / rawTotal),
          );
        }
      } else {
        const per = Math.round(target / clsCats.length);
        for (const c of clsCats) scaledByCategory.set(c.id, per);
      }
    }
  } else if (framework === "zero_based" && incomeBasis > 0) {
    const rawTotal = suggestRows.reduce(
      (s, c) => s + (avgByCategory.get(c.id) ?? 0),
      0,
    );
    if (rawTotal > 0) {
      const ratio = incomeBasis / rawTotal;
      for (const c of suggestRows) {
        scaledByCategory.set(
          c.id,
          Math.round((avgByCategory.get(c.id) ?? 0) * ratio),
        );
      }
    }
  }

  const smartFillRows: SmartFillRow[] = suggestRows.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    classification: c.classification,
    currentLimitCents: c.monthlyLimitCents,
    avgCents: avgByCategory.get(c.id) ?? 0,
    scaledCents: scaledByCategory.get(c.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        eyebrow="BUDGET"
        title="What's left to "
        italic="spend."
        subtitle="Pick a framework, set a monthly limit on each category, and see what's left before month-end."
      />
      <Container className="pb-32 md:pb-16">
        <BudgetClient
          framework={framework}
          income={income}
          incomeBasis={incomeBasis}
          spend={spend}
          spendByClassification={spendByClassification}
          totalLimit={totalLimit}
          upcomingTotal={upcomingTotal}
          upcomingList={upcomingList}
          dayOfMonth={dayOfMonth}
          daysInMonth={daysInMonth}
          calendarPct={calendarPct}
          categories={cats}
          txByCategory={txByCategory}
          smartFillRows={smartFillRows}
          basisMonths={basisMonths}
        />
      </Container>
    </>
  );
}
