import { db } from "@/db";
import { budgetSettings } from "@/db/schema";
import { Container, PageHeader } from "@/components/ui";
import { endOfMonth, format, getDate, getDaysInMonth, startOfMonth, subMonths } from "date-fns";
import { expectedMonthlyIncome, getActiveSchedules } from "@/lib/recurring-schedules";
import { loadLedgerData } from "@/lib/ledger-data";
import { BudgetClient, NewCategoryButton, type BudgetCategory } from "./client";

export const dynamic = "force-dynamic";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [{ allCategories, ledger }, settingsRows, schedules] = await Promise.all([
    loadLedgerData(),
    db.select().from(budgetSettings).limit(1),
    getActiveSchedules(),
  ]);
  const m = ledger.summarize(now);

  // Expected income: your manual figure, else recurring paycheck schedules.
  const { cents: derivedIncome } = expectedMonthlyIncome(schedules, monthStart, monthEnd);
  const incomeOverride = settingsRows[0]?.expectedIncomeOverrideCents ?? null;
  const expectedIncome = incomeOverride ?? derivedIncome;
  const framework = settingsRows[0]?.framework ?? "custom";

  // Typical month per category, from the last six complete months that had
  // any spending (a new account shouldn't average over empty months).
  const history = Array.from({ length: 6 }, (_, i) => ledger.summarize(subMonths(now, i + 1)));
  const active = history.filter((h) => h.spent + h.saved > 0);
  const basisMonths = Math.max(1, active.length);
  const avgByCategory = new Map<number, number>();
  for (const h of active) {
    for (const [id, v] of h.spendByCategory) {
      avgByCategory.set(id, (avgByCategory.get(id) ?? 0) + v);
    }
  }
  for (const [id, v] of avgByCategory) avgByCategory.set(id, Math.round(v / basisMonths));

  const live = allCategories.filter((c) => !c.isArchived);
  const spendable = live.filter((c) => c.classification !== "income");
  const incomeBasis = expectedIncome > 0 ? expectedIncome : m.income;

  // Suggestions: your averages as-is, the 50/30/20 split of income, or your
  // averages stretched so the plan uses exactly your income.
  const avg = (id: number) => avgByCategory.get(id) ?? 0;
  const split5030: Record<number, number> = {};
  const fitIncome: Record<number, number> = {};
  if (incomeBasis > 0) {
    const shares = { need: 0.5, want: 0.3, savings: 0.2 } as const;
    for (const cls of ["need", "want", "savings"] as const) {
      const group = spendable.filter((c) => c.classification === cls);
      const raw = group.reduce((s, c) => s + avg(c.id), 0);
      const target = Math.round(incomeBasis * shares[cls]);
      for (const c of group) {
        split5030[c.id] =
          raw > 0 ? Math.round((avg(c.id) * target) / raw) : Math.round(target / group.length);
      }
    }
    const rawAll = spendable.reduce((s, c) => s + avg(c.id), 0);
    for (const c of spendable) {
      fitIncome[c.id] = rawAll > 0 ? Math.round((avg(c.id) * incomeBasis) / rawAll) : 0;
    }
  }

  const categories: BudgetCategory[] = live.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon,
    classification: c.classification,
    isSystem: c.isSystem,
    limitCents: c.monthlyLimitCents,
    spent:
      c.classification === "income"
        ? m.incomeByCategory.get(c.id) ?? 0
        : m.spendByCategory.get(c.id) ?? 0,
    entries: m.entriesByCategory[c.id] ?? [],
    suggest: {
      average: avg(c.id),
      split5030: split5030[c.id] ?? 0,
      fitIncome: fitIncome[c.id] ?? 0,
    },
  }));

  const openId = Number(sp.c);

  return (
    <>
      <PageHeader
        eyebrow={`${format(now, "MMMM")} plan`}
        title="Budget"
        subtitle="How much you plan to spend in each category this month, and how it's going. Tap a category to see its transactions or change it."
        right={<NewCategoryButton />}
      />
      <Container className="pb-32 md:pb-16">
        <BudgetClient
          categories={categories}
          spent={m.spent}
          saved={m.saved}
          incomeReceived={m.income}
          expectedIncome={expectedIncome}
          incomeOverride={incomeOverride}
          derivedIncome={derivedIncome}
          uncategorizedSpend={m.uncategorizedSpend}
          uncategorizedCount={m.uncategorizedCount}
          dayOfMonth={getDate(now)}
          daysInMonth={getDaysInMonth(now)}
          framework={framework}
          basisMonths={basisMonths}
          hasHistory={active.length > 0}
          initialOpenId={Number.isFinite(openId) && openId > 0 ? openId : null}
        />
      </Container>
    </>
  );
}
