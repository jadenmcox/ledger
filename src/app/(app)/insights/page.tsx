import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  Container,
  PageHeader,
  Card,
  SectionHeader,
  Pill,
  EmptyState,
  Button,
} from "@/components/ui";
import { formatCents, formatCentsCompact } from "@/lib/utils";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { detectRecurring } from "@/lib/recurring";
import { TrendingUp, TrendingDown, Repeat } from "lucide-react";
import Link from "next/link";
import { InsightsHero } from "./insights-hero";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [thisTx, lastTx, allCats, recurring] = await Promise.all([
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
      .from(transactions)
      .where(
        and(
          gte(transactions.date, lastMonthStart),
          lte(transactions.date, lastMonthEnd),
          eq(transactions.isTransfer, false),
        ),
      ),
    db.select().from(categories),
    detectRecurring().catch(() => []),
  ]);

  const catById = new Map(allCats.map((c) => [c.id, c]));

  function aggregate(txs: typeof thisTx) {
    let income = 0;
    let spend = 0;
    const byCat = new Map<number, number>();
    for (const t of txs) {
      const cat = t.categoryId ? catById.get(t.categoryId) : null;
      if (cat?.classification === "income") {
        income += t.amountCents;
        continue;
      }
      if (t.amountCents > 0) continue;
      const abs = Math.abs(t.amountCents);
      spend += abs;
      if (cat) byCat.set(cat.id, (byCat.get(cat.id) || 0) + abs);
    }
    return { income, spend, byCat };
  }

  const tm = aggregate(thisTx);
  const lm = aggregate(lastTx);

  const savingsRate = tm.income > 0 ? Math.max(0, (tm.income - tm.spend) / tm.income) * 100 : 0;
  const lastSavingsRate =
    lm.income > 0 ? Math.max(0, (lm.income - lm.spend) / lm.income) * 100 : 0;

  // Category movers — biggest absolute change
  const allCatIds = new Set([...tm.byCat.keys(), ...lm.byCat.keys()]);
  const movers: Array<{
    catId: number;
    name: string;
    color: string;
    thisAmt: number;
    lastAmt: number;
    delta: number;
    pct: number;
  }> = [];
  for (const id of allCatIds) {
    const cat = catById.get(id);
    if (!cat) continue;
    const thisAmt = tm.byCat.get(id) || 0;
    const lastAmt = lm.byCat.get(id) || 0;
    const delta = thisAmt - lastAmt;
    if (Math.abs(delta) < 500) continue;
    const pct = lastAmt > 0 ? (delta / lastAmt) * 100 : 100;
    movers.push({
      catId: id,
      name: cat.name,
      color: cat.color,
      thisAmt,
      lastAmt,
      delta,
      pct,
    });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const recurringTotal = recurring.reduce(
    (s, r) => s + r.expectedAmountCents,
    0,
  );

  const heroSlices = Array.from(tm.byCat.entries())
    .map(([id, value]) => {
      const cat = catById.get(id);
      if (!cat) return null;
      return {
        id,
        name: cat.name,
        value,
        delta: value - (lm.byCat.get(id) ?? 0),
        color: cat.color,
        icon: cat.icon,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.value - a.value);

  const hasData = thisTx.length > 0 || lastTx.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={format(now, "MMMM yyyy").toUpperCase()}
        title="Insights"
        subtitle="Where the month shifted, what's coming, and how your savings rate is holding up."
      />
      <Container className="pb-32 md:pb-16">
        {!hasData ? (
          <EmptyState
            title="Not enough data yet"
            body="Once you have a month or two of transactions, this page will show what's changing and where to pay attention."
            action={
              <Link href="/import">
                <Button variant="primary">Import a CSV</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-12">
            <InsightsHero
              slices={heroSlices}
              totalSpend={tm.spend}
              totalIncome={tm.income}
              savingsRate={savingsRate}
              lastSavingsRate={lastSavingsRate}
              monthLabel={format(now, "MMMM")}
            />

            {movers.length > 0 && (
              <div>
                <SectionHeader
                  title="Biggest "
                  italic="movers"
                  hint="categories that shifted most vs. last month"
                />
                <Card className="divide-y divide-border">
                  {movers.slice(0, 8).map((m) => {
                    const up = m.delta > 0;
                    return (
                      <div
                        key={m.catId}
                        className="block px-5 py-4"
                      >
                        <div className="flex items-center gap-4">
                          <span
                            className="size-2.5 rounded-full shrink-0"
                            style={{ background: m.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm tracking-tight truncate mb-0.5">
                              {m.name}
                            </div>
                            <div className="text-[11px] text-foreground-faint tracking-tight">
                              {formatCentsCompact(m.lastAmt)} →{" "}
                              {formatCentsCompact(m.thisAmt)}
                            </div>
                          </div>
                          <div
                            className={`inline-flex items-center gap-1.5 text-sm mono tabular shrink-0 ${up ? "text-blush-deep" : "text-blue-deep"}`}
                          >
                            {up ? (
                              <TrendingUp className="size-3.5" strokeWidth={1.75} />
                            ) : (
                              <TrendingDown className="size-3.5" strokeWidth={1.75} />
                            )}
                            {up ? "+" : ""}
                            {formatCentsCompact(m.delta)}
                            <span className="text-[10px] text-foreground-faint">
                              ({m.pct > 0 ? "+" : ""}
                              {m.pct.toFixed(0)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Card>
              </div>
            )}

            {recurring.length > 0 && (
              <div>
                <SectionHeader
                  title="The "
                  italic="fixed costs"
                  hint={`${formatCents(recurringTotal)} expected per cycle`}
                />
                <Card className="divide-y divide-border">
                  {recurring.slice(0, 12).map((r) => (
                    <div
                      key={r.merchantKey}
                      className="px-5 py-4 flex items-center gap-4"
                    >
                      <Repeat
                        className="size-3.5 text-blush-deep shrink-0"
                        strokeWidth={1.5}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm tracking-tight truncate">
                          {r.displayName}
                        </div>
                        <div className="text-[11px] text-foreground-faint tracking-tight mt-0.5">
                          <Pill>{r.cadence}</Pill> · seen {r.occurrences}×
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
