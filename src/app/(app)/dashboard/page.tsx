import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Container, PageHeader, Card, Stat, Label, EmptyState, Pill } from "@/components/ui";
import { formatCents } from "@/lib/utils";
import { startOfMonth, endOfMonth, format, getDaysInMonth, getDate } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui";
import { detectRecurring } from "@/lib/recurring";
import { Repeat } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = getDate(now);
  const daysLeft = daysInMonth - dayOfMonth;

  const txThisMonth = await db
    .select()
    .from(transactions)
    .where(
      and(
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
        eq(transactions.isTransfer, false),
      ),
    );

  const [allCategories, allAccounts, recurring] = await Promise.all([
    db.select().from(categories),
    db.select().from(accounts),
    detectRecurring().catch(() => []),
  ]);

  const catById = new Map(allCategories.map((c) => [c.id, c]));

  let income = 0;
  let spend = 0;
  const spendByClassification = { need: 0, want: 0, savings: 0 };
  const spendByCategory = new Map<number, number>();

  for (const t of txThisMonth) {
    const cat = t.categoryId ? catById.get(t.categoryId) : null;
    if (cat?.classification === "income" || t.amountCents > 0) {
      if (cat?.classification === "income") income += t.amountCents;
      continue;
    }
    const abs = Math.abs(t.amountCents);
    spend += abs;
    if (cat) {
      spendByCategory.set(
        cat.id,
        (spendByCategory.get(cat.id) || 0) + abs,
      );
      if (cat.classification === "need") spendByClassification.need += abs;
      if (cat.classification === "want") spendByClassification.want += abs;
      if (cat.classification === "savings")
        spendByClassification.savings += abs;
    }
  }

  const totalClassified =
    spendByClassification.need +
    spendByClassification.want +
    spendByClassification.savings || 1;
  const pct = {
    need: (spendByClassification.need / totalClassified) * 100,
    want: (spendByClassification.want / totalClassified) * 100,
    savings: (spendByClassification.savings / totalClassified) * 100,
  };

  // Per-category spend vs limit
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

  const net = income - spend;

  return (
    <>
      <PageHeader
        eyebrow={format(now, "EEEE · MMMM d, yyyy").toUpperCase()}
        title="A quiet month"
        italic="so far."
        subtitle={`${daysLeft} days remain in ${format(now, "MMMM")}. Here's where the money has gone.`}
      />
      <Container>
        {allAccounts.length === 0 ? (
          <EmptyState
            title="No accounts yet"
            body="Add a checking account or credit card to start tracking. You can also import a CSV right away — Ledger will create transactions for you to categorize."
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
          <div className="space-y-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              <Stat
                label="Spent this month"
                value={formatCents(spend)}
                hint={`${txThisMonth.length} transactions`}
                tone="gold"
              />
              <Stat
                label="Income this month"
                value={formatCents(income)}
                tone="sage"
              />
              <Stat
                label="Net"
                value={formatCents(net, { signed: true })}
                tone={net >= 0 ? "sage" : "clay"}
              />
              <Stat
                label="Days remaining"
                value={String(daysLeft)}
                hint={`of ${daysInMonth}`}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="serif text-2xl">
                  Need <span className="text-foreground-faint">·</span>{" "}
                  <span className="serif-italic text-gold">want</span>{" "}
                  <span className="text-foreground-faint">·</span> save
                </h2>
                <div className="text-xs text-foreground-faint tracking-tight">
                  share of monthly spend
                </div>
              </div>
              <div className="h-3 w-full flex rounded-full overflow-hidden bg-surface border border-border">
                <div
                  className="bg-clay h-full"
                  style={{ width: `${pct.need}%` }}
                />
                <div
                  className="bg-gold h-full"
                  style={{ width: `${pct.want}%` }}
                />
                <div
                  className="bg-sage h-full"
                  style={{ width: `${pct.savings}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-6 text-sm">
                <Legend
                  swatch="bg-clay"
                  label="Need"
                  value={formatCents(spendByClassification.need)}
                  pct={pct.need}
                />
                <Legend
                  swatch="bg-gold"
                  label="Want"
                  value={formatCents(spendByClassification.want)}
                  pct={pct.want}
                />
                <Legend
                  swatch="bg-sage"
                  label="Savings"
                  value={formatCents(spendByClassification.savings)}
                  pct={pct.savings}
                />
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-6">
                <h2 className="serif text-2xl">
                  By <span className="serif-italic text-gold">category</span>
                </h2>
                <Link
                  href="/categories"
                  className="text-xs text-foreground-muted hover:text-gold transition-colors tracking-tight"
                >
                  manage →
                </Link>
              </div>
              {categoriesWithSpend.length === 0 ? (
                <div className="text-foreground-faint text-sm py-8">
                  No spending tracked yet this month.
                </div>
              ) : (
                <Card className="divide-y divide-border">
                  {categoriesWithSpend.slice(0, 12).map(({ category, spent }) => {
                    const limit = category.monthlyLimitCents;
                    const ratio = limit ? spent / limit : 0;
                    const overspent = limit && spent > limit;
                    const warning = limit && ratio >= 0.8;
                    return (
                      <div
                        key={category.id}
                        className="px-5 py-4 flex items-center gap-4"
                      >
                        <div
                          className="size-2 rounded-full shrink-0"
                          style={{ background: category.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1.5">
                            <span className="text-sm tracking-tight">
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
                            <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${Math.min(ratio * 100, 100)}%`,
                                  background: overspent
                                    ? "var(--clay)"
                                    : warning
                                      ? "var(--gold)"
                                      : category.color,
                                }}
                              />
                            </div>
                          ) : (
                            <div className="h-1" />
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`mono text-sm tabular ${overspent ? "text-clay" : ""}`}
                          >
                            {formatCents(spent)}
                          </div>
                          {limit ? (
                            <div className="text-[10px] text-foreground-faint tracking-tight mono tabular">
                              of {formatCents(limit)}
                            </div>
                          ) : (
                            <div className="text-[10px] text-foreground-faint tracking-tight">
                              no limit
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </Card>
              )}
            </div>

            {recurring.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between mb-6">
                  <h2 className="serif text-2xl">
                    <span className="serif-italic text-gold">Recurring</span>
                  </h2>
                  <div className="text-xs text-foreground-faint tracking-tight">
                    detected fixed expenses
                  </div>
                </div>
                <Card className="divide-y divide-border">
                  {recurring.slice(0, 8).map((r) => (
                    <div
                      key={r.merchantKey}
                      className="px-5 py-4 flex items-center gap-4"
                    >
                      <Repeat
                        className="size-3.5 text-gold-dim shrink-0"
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

function Legend({
  swatch,
  label,
  value,
  pct,
}: {
  swatch: string;
  label: string;
  value: string;
  pct: number;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`size-2 rounded-full mt-2 ${swatch}`} />
      <div>
        <Label>{label}</Label>
        <div className="mono tabular text-base mt-1">{value}</div>
        <div className="text-[10px] text-foreground-faint mono tabular mt-0.5">
          {pct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
