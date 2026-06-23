import { db } from "@/db";
import { budgetSettings, categories, transactions } from "@/db/schema";
import { asc, and, gte, lte, eq, desc } from "drizzle-orm";
import { Container, PageHeader, Card, SectionHeader } from "@/components/ui";
import { CategoriesClient, NewCategoryButton, type CategoryTx } from "./client";
import { CategoryDonut } from "../dashboard/charts";
import { SmartFillLimits, type SmartFillRow } from "./smart-fill";
import { formatCents } from "@/lib/utils";
import type { DonutDatum } from "@/components/charts/DonutChart";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import type { Classification } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  // Smart-fill basis: the 6 *complete* months before this one. The current
  // month is partial so it would drag every average down — exclude it.
  const histStart = startOfMonth(subMonths(now, 6));
  const histEnd = endOfMonth(subMonths(now, 1));

  const [rows, txThisMonth, histTx, settingsRows] = await Promise.all([
    db
      .select()
      .from(categories)
      .orderBy(asc(categories.classification), asc(categories.sortOrder)),
    db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd),
          eq(transactions.isTransfer, false),
        ),
      )
      .orderBy(desc(transactions.date)),
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
    db.select().from(budgetSettings).limit(1),
  ]);

  const framework = settingsRows[0]?.framework ?? "custom";
  const catById = new Map(rows.map((c) => [c.id, c]));

  // ---- This month: spend per category + the per-transaction drill-down ----
  const spendByCategory: Record<number, number> = {};
  const txByCategory: Record<number, CategoryTx[]> = {};
  let income = 0;
  let spend = 0;
  for (const t of txThisMonth) {
    if (!t.categoryId) continue;
    const c = catById.get(t.categoryId);
    if (!c) continue;
    (txByCategory[t.categoryId] ??= []).push({
      id: t.id,
      date: t.date instanceof Date ? t.date.toISOString() : String(t.date),
      merchant: t.merchantClean || t.merchantRaw,
      amountCents: t.amountCents,
    });
    if (c.classification === "income") {
      if (t.amountCents > 0) income += t.amountCents;
      continue;
    }
    if (t.amountCents > 0) continue;
    const abs = Math.abs(t.amountCents);
    spend += abs;
    spendByCategory[t.categoryId] = (spendByCategory[t.categoryId] ?? 0) + abs;
  }

  // Donut of where the money went this month. Mirrors the dashboard: each
  // category in its own color, biggest first, with uncategorized spend added
  // as a neutral slice so the donut total equals the headline spend.
  const categorySpend = Object.entries(spendByCategory)
    .map(([id, value]) => ({ category: catById.get(Number(id))!, value }))
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

  // Income basis for framework scaling: actual income this month, falling back
  // to the Paycheck category's planned amount before payday lands.
  const paycheckCat = rows.find((c) => c.name === "Paycheck");
  const incomeBasis = Math.max(income, paycheckCat?.monthlyLimitCents ?? 0);

  const suggestRows = rows.filter(
    (c) => c.classification !== "income" && !c.isArchived,
  );
  const avgByCategory = new Map<number, number>();
  for (const c of suggestRows) {
    avgByCategory.set(c.id, Math.round((histByCategory.get(c.id) ?? 0) / basisMonths));
  }

  // Framework scaling: keep each category's relative share of its class but
  // stretch class totals to respect the chosen framework. Custom leaves the
  // raw averages alone.
  const scaledByCategory = new Map<number, number>();
  for (const c of suggestRows) scaledByCategory.set(c.id, avgByCategory.get(c.id) ?? 0);
  if (framework === "50_30_20" && incomeBasis > 0) {
    const splits: Record<string, number> = { need: 0.5, want: 0.3, savings: 0.2 };
    for (const cls of ["need", "want", "savings"] as Exclude<
      Classification,
      "income"
    >[]) {
      const clsCats = suggestRows.filter((c) => c.classification === cls);
      if (clsCats.length === 0) continue;
      const target = Math.round(incomeBasis * splits[cls]);
      const rawTotal = clsCats.reduce((s, c) => s + (avgByCategory.get(c.id) ?? 0), 0);
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
    const rawTotal = suggestRows.reduce((s, c) => s + (avgByCategory.get(c.id) ?? 0), 0);
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
    classification: c.classification,
    currentLimitCents: c.monthlyLimitCents,
    avgCents: avgByCategory.get(c.id) ?? 0,
    scaledCents: scaledByCategory.get(c.id) ?? 0,
  }));

  return (
    <>
      <PageHeader
        eyebrow="CATEGORIES"
        title="Categories"
        subtitle="Where every transaction lands. Set a monthly amount on the ones that matter."
        right={<NewCategoryButton />}
      />
      <Container className="pb-32 md:pb-16">
        <div className="space-y-12">
          {/* WHERE THE MONEY WENT */}
          <Card className="p-6 md:p-7">
            <SectionHeader
              title="Where your money goes"
              hint="spending by category this month"
            />
            {donutData.length === 0 ? (
              <div className="py-10 text-center text-foreground-faint text-sm">
                No spending yet this month.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-6 md:gap-10">
                <div className="shrink-0">
                  <CategoryDonut data={donutData} total={spend} />
                </div>
                <div className="flex-1 min-w-0 w-full space-y-2.5">
                  {donutData.slice(0, 8).map((d) => (
                    <div key={d.name} className="flex items-center gap-3 text-sm">
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
                  {donutData.length > 8 && (
                    <div className="text-[11px] text-foreground-faint pt-1">
                      +{donutData.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* SMART-FILL LIMITS */}
          <SmartFillLimits
            rows={smartFillRows}
            framework={framework}
            incomeBasis={incomeBasis}
            basisMonths={basisMonths}
          />

          {/* THE LIST */}
          <CategoriesClient
            initial={rows}
            spendByCategory={spendByCategory}
            txByCategory={txByCategory}
          />
        </div>
      </Container>
    </>
  );
}
