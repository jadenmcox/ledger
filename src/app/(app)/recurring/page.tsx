import { db } from "@/db";
import {
  accounts,
  categories,
  recurringSchedules,
  type RecurringSchedule,
} from "@/db/schema";
import { Card, Container, PageHeader } from "@/components/ui";
import {
  computeOccurrences,
  expectedMonthlyIncome,
} from "@/lib/recurring-schedules";
import { addDays, endOfMonth, format, startOfMonth } from "date-fns";
import { RecurringClient } from "./client";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const now = new Date();

  // The schedules query needs is_forecast_only; on a database that hasn't
  // run the migration yet it fails, and we show the SQL instead of a 500.
  let schedules: RecurringSchedule[] | null = null;
  try {
    schedules = await db.select().from(recurringSchedules);
  } catch {
    schedules = null;
  }

  const [allAccounts, allCategories] = await Promise.all([
    db.select().from(accounts),
    db.select().from(categories),
  ]);

  if (schedules === null) {
    return (
      <>
        <PageHeader
          eyebrow="SETUP"
          title="Recurring"
          subtitle="Paychecks and bills on a rhythm — they power the budget's expected income and the upcoming-bills forecasts."
        />
        <Container>
          <Card className="p-6 md:p-8">
            <h3 className="display text-lg mb-2">One migration needed</h3>
            <p className="text-sm text-foreground-muted mb-4 max-w-xl">
              This database is missing the <span className="mono">is_forecast_only</span>{" "}
              column. Run this in the Turso console (additive and safe), then reload:
            </p>
            <pre className="mono text-xs bg-surface-2 border border-border rounded-xl p-4 overflow-x-auto">
              ALTER TABLE recurring_schedules ADD COLUMN is_forecast_only integer NOT NULL DEFAULT 0;
            </pre>
          </Card>
        </Container>
      </>
    );
  }

  // Preview of the next occurrence per schedule (within the next year).
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = addDays(today, 366);
  const nextByScheduleId: Record<number, string | null> = {};
  for (const s of schedules) {
    const next = s.isActive
      ? computeOccurrences(s, today, horizon)[0] ?? null
      : null;
    nextByScheduleId[s.id] = next ? format(next, "yyyy-MM-dd") : null;
  }

  const { cents: expectedIncome, paycheckCount } = expectedMonthlyIncome(
    schedules.filter((s) => s.isActive),
    startOfMonth(now),
    endOfMonth(now),
  );

  return (
    <>
      <PageHeader
        eyebrow="SETUP"
        title="Recurring"
        subtitle="Paychecks and bills on a rhythm. These power the budget's expected income, the upcoming-bills forecast, and the dashboard's Coming up list."
      />
      <Container className="pb-32 md:pb-16">
        <RecurringClient
          schedules={schedules.map((s) => ({
            id: s.id,
            accountId: s.accountId,
            amountCents: s.amountCents,
            merchantRaw: s.merchantRaw,
            categoryId: s.categoryId,
            cadence: s.cadence,
            daysOfMonth: s.daysOfMonth,
            startDate: s.startDate,
            endDate: s.endDate,
            isActive: s.isActive,
            isForecastOnly: s.isForecastOnly,
            notes: s.notes,
            nextDate: nextByScheduleId[s.id],
          }))}
          accounts={allAccounts.map((a) => ({ id: a.id, name: a.name }))}
          categories={allCategories.map((c) => ({
            id: c.id,
            name: c.name,
            classification: c.classification,
          }))}
          expectedIncome={expectedIncome}
          paycheckCount={paycheckCount}
        />
      </Container>
    </>
  );
}
