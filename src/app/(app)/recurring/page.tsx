import { db } from "@/db";
import {
  accounts,
  categories,
  recurringSchedules,
  type RecurringSchedule,
} from "@/db/schema";
import { Card, Container, PageHeader } from "@/components/ui";
import { StatStrip } from "@/components/stat-strip";
import { CategoryGlyph } from "@/components/category-glyph";
import { computeOccurrences } from "@/lib/recurring-schedules";
import { findRecurring, type Cadence } from "@/lib/recurring";
import { formatCents } from "@/lib/utils";
import { addDays, differenceInCalendarDays, endOfMonth, format, isBefore } from "date-fns";
import { Repeat } from "lucide-react";
import Link from "next/link";
import { transactions } from "@/db/schema";
import { RecurringClient } from "./client";

const cadenceWord: Record<Cadence, string> = {
  weekly: "every week",
  biweekly: "every 2 weeks",
  monthly: "every month",
  yearly: "every year",
};

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

  const [allAccounts, allCategories, allTx] = await Promise.all([
    db.select().from(accounts),
    db.select().from(categories),
    db.select().from(transactions),
  ]);
  const catById = new Map(allCategories.map((c) => [c.id, c]));
  const incomeCats = new Set(
    allCategories.filter((c) => c.classification === "income").map((c) => c.id),
  );
  // Found in your history: anything that charged you on a steady rhythm.
  const detected = findRecurring(allTx, { now, skipCategoryIds: incomeCats }).sort(
    (a, b) => a.nextDate.getTime() - b.nextDate.getTime(),
  );
  const monthlyTotal = detected.reduce((s, r) => s + r.monthlyCents, 0);
  const restOfMonth = detected
    .filter((r) => isBefore(r.nextDate, endOfMonth(now)))
    .reduce((s, r) => s + r.amountCents, 0);

  if (schedules === null) {
    return (
      <>
        <PageHeader
          title="Recurring"
          subtitle="Bills and subscriptions that repeat."
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


  return (
    <>
      <PageHeader
        title="Recurring"
        subtitle="Bills and subscriptions that repeat, found automatically in your transactions. The ones due soon show up under Coming up on Home."
      />
      <Container className="pb-32 md:pb-16 space-y-8">
        <StatStrip
          items={[
            {
              label: "About this much a month",
              value: formatCents(monthlyTotal),
              accent: "var(--blush-deep)",
              dominant: true,
              hint: `${detected.length} ${detected.length === 1 ? "charge repeats" : "charges repeat"}`,
            },
            {
              label: `Still due in ${format(now, "MMMM")}`,
              value: formatCents(restOfMonth),
              accent: "var(--blue-deep)",
            },
          ]}
        />
        {detected.length === 0 ? (
          <Card className="p-6 text-sm text-foreground-muted">
            Nothing repeats yet. Once something charges you at least twice on a steady schedule (a
            subscription, rent, a phone bill), it shows up here on its own.
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden">
            {detected.map((r) => {
              const cat = r.categoryId ? catById.get(r.categoryId) : null;
              const days = differenceInCalendarDays(r.nextDate, now);
              return (
                <Link
                  key={r.key}
                  href={`/transactions?q=${encodeURIComponent(r.name)}`}
                  className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-2/50 md:px-5"
                >
                  {cat ? (
                    <CategoryGlyph icon={cat.icon} color={cat.color} size={36} />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-foreground-faint">
                      <Repeat className="size-4" strokeWidth={1.75} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm tracking-tight">{r.name}</div>
                    <div className="mt-0.5 text-[11px] text-foreground-faint">
                      {cadenceWord[r.cadence]} ·{" "}
                      {days < 0
                        ? `was due ${format(r.nextDate, "MMM d")}`
                        : days === 0
                          ? "due today"
                          : `next around ${format(r.nextDate, "MMM d")}`}
                    </div>
                  </div>
                  <span className="mono tabular shrink-0 text-sm">{formatCents(r.amountCents)}</span>
                </Link>
              );
            })}
          </Card>
        )}
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
        />
      </Container>
    </>
  );
}
