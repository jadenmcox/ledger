import { db } from "@/db";
import { accounts, categories, transactions, type Account } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { Container, PageHeader, Card, Stat, Label } from "@/components/ui";
import { formatCents, formatCentsCompact } from "@/lib/utils";
import { startOfYear, endOfYear } from "date-fns";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default async function YearPage() {
  const now = new Date();
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);

  const [allTx, allCats, allAccts] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.date, yearStart),
          lte(transactions.date, yearEnd),
          eq(transactions.isTransfer, false),
        ),
      ),
    db.select().from(categories),
    db.select().from(accounts),
  ]);

  // Aggregate cents per [categoryId, month]
  const grid = new Map<number, number[]>(); // categoryId -> [12]
  let totalIncome = 0;
  let totalSpend = 0;
  const monthTotals = Array(12).fill(0);
  for (const t of allTx) {
    if (!t.categoryId) continue;
    const cat = allCats.find((c) => c.id === t.categoryId);
    if (!cat) continue;
    const month = new Date(t.date).getMonth();
    const arr = grid.get(t.categoryId) ?? Array(12).fill(0);
    if (cat.classification === "income") {
      arr[month] += t.amountCents;
      totalIncome += t.amountCents;
    } else {
      const abs = Math.abs(t.amountCents);
      arr[month] += abs;
      totalSpend += abs;
      monthTotals[month] += abs;
    }
    grid.set(t.categoryId, arr);
  }

  // Active categories with at least one nonzero month
  const rows = allCats
    .filter((c) => grid.has(c.id))
    .sort((a, b) => {
      const order = { income: 0, need: 1, want: 2, savings: 3 } as const;
      return order[a.classification] - order[b.classification];
    });

  const net = totalIncome - totalSpend;
  const avgMonthlySpend = totalSpend / Math.max(1, new Date().getMonth() + 1);

  return (
    <>
      <PageHeader
        eyebrow={String(now.getFullYear())}
        title="The year,"
        italic="at a glance."
        subtitle="One row per category, twelve columns. The picture your spreadsheet wanted to show."
      />
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          <Stat
            label="YTD income"
            value={formatCents(totalIncome)}
            tone="sage"
          />
          <Stat label="YTD spend" value={formatCents(totalSpend)} tone="gold" />
          <Stat
            label="YTD net"
            value={formatCents(net, { signed: true })}
            tone={net >= 0 ? "sage" : "clay"}
          />
          <Stat
            label="Avg monthly spend"
            value={formatCents(Math.round(avgMonthlySpend))}
          />
        </div>

        {rows.length === 0 ? (
          <div className="text-foreground-faint text-sm">
            No transactions this year yet.
          </div>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-xs mono tabular border-collapse">
              <thead>
                <tr className="border-b border-border-strong">
                  <th className="text-left font-normal p-3 sticky left-0 bg-surface min-w-[10rem]">
                    <Label>Category</Label>
                  </th>
                  {MONTHS.map((m, i) => (
                    <th
                      key={m}
                      className={`text-right font-normal p-3 ${i === now.getMonth() ? "text-gold" : "text-foreground-faint"}`}
                    >
                      {m}
                    </th>
                  ))}
                  <th className="text-right font-normal p-3 border-l border-border">
                    <Label>Total</Label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const arr = grid.get(c.id)!;
                  const total = arr.reduce((s, v) => s + v, 0);
                  return (
                    <tr key={c.id} className="border-b border-border/40">
                      <td className="p-3 sticky left-0 bg-surface">
                        <div className="flex items-center gap-2 font-sans">
                          <span
                            className="size-2 rounded-full"
                            style={{ background: c.color }}
                          />
                          <span className="text-sm tracking-tight">
                            {c.name}
                          </span>
                        </div>
                      </td>
                      {arr.map((v, i) => (
                        <td
                          key={i}
                          className={`text-right p-3 ${
                            v === 0
                              ? "text-foreground-faint"
                              : i === now.getMonth()
                                ? "text-gold"
                                : "text-foreground-muted"
                          }`}
                        >
                          {v === 0 ? "—" : formatCentsCompact(v)}
                        </td>
                      ))}
                      <td className="text-right p-3 border-l border-border text-foreground">
                        {total === 0 ? "—" : formatCentsCompact(total)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border-strong">
                  <td className="p-3 sticky left-0 bg-surface">
                    <div className="text-sm tracking-tight font-sans text-foreground-muted">
                      Monthly spend
                    </div>
                  </td>
                  {monthTotals.map((v, i) => (
                    <td
                      key={i}
                      className={`text-right p-3 ${i === now.getMonth() ? "text-gold" : "text-foreground"}`}
                    >
                      {v === 0 ? "—" : formatCentsCompact(v)}
                    </td>
                  ))}
                  <td className="text-right p-3 border-l border-border text-foreground">
                    {formatCentsCompact(totalSpend)}
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        )}

        <NetWorth accounts={allAccts} />
      </Container>
    </>
  );
}

function NetWorth({ accounts }: { accounts: Account[] }) {
  const cash = accounts.filter(
    (a) =>
      a.isActive &&
      ["checking", "savings", "hys", "cash"].includes(a.type),
  );
  const investments = accounts.filter(
    (a) => a.isActive && ["brokerage"].includes(a.type),
  );
  const taxAdv = accounts.filter(
    (a) =>
      a.isActive &&
      ["roth_ira", "traditional_401k", "hsa"].includes(a.type),
  );
  const debt = accounts.filter(
    (a) => a.isActive && ["credit", "loan"].includes(a.type),
  );

  const sumOf = (l: Account[]) =>
    l.reduce((s, a) => s + a.currentBalanceCents, 0);

  const assets = sumOf(cash) + sumOf(investments) + sumOf(taxAdv);
  const debts = Math.abs(sumOf(debt));
  const netWorth = assets - debts;

  return (
    <div className="mt-16">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="serif text-2xl">
          Net <span className="serif-italic text-gold">worth</span>
        </h2>
        <div className="text-xs text-foreground-faint">assets − debts</div>
      </div>
      <div className="grid md:grid-cols-4 gap-8 md:gap-12 mb-8">
        <Stat label="Cash" value={formatCents(sumOf(cash))} tone="sage" />
        <Stat
          label="Investments"
          value={formatCents(sumOf(investments) + sumOf(taxAdv))}
          tone="gold"
        />
        <Stat label="Debt" value={formatCents(debts)} tone="clay" />
        <Stat
          label="Net worth"
          value={formatCents(netWorth, { signed: true })}
          tone={netWorth >= 0 ? "sage" : "clay"}
        />
      </div>
    </div>
  );
}
