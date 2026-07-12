import { db } from "@/db";
import {
  accounts,
  balanceSnapshots,
  categories,
  transactions,
  type Account,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { format, subDays } from "date-fns";
import Link from "next/link";
import {
  Container,
  PageHeader,
  Card,
  Stat,
  Label,
  SectionHeader,
} from "@/components/ui";
import { formatCents, formatCentsCompact } from "@/lib/utils";
import { createMonthBucketer } from "@/lib/month-bucket";
import { categoryParts, loadSplitsByTx } from "@/lib/splits";
import { Heatmap } from "@/components/charts/Heatmap";
import { NetWorthArea, YearStackedArea } from "./charts";
import { YearHero } from "./year-hero";

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

  const [allTx, allCats, allAccts, allSnaps, splitsByTx] = await Promise.all([
    // Full non-transfer history: rent rolls in from the prior December and a
    // refund can credit back to a purchase in any earlier month. Rows whose
    // effective month falls outside this year are dropped below.
    db
      .select()
      .from(transactions)
      .where(eq(transactions.isTransfer, false)),
    db.select().from(categories),
    db.select().from(accounts),
    db.select().from(balanceSnapshots),
    loadSplitsByTx(),
  ]);

  // Shared refund-aware, rent-aware month bucketing (same on every page).
  const catById = new Map(allCats.map((c) => [c.id, c]));
  const { monthKeyOf } = createMonthBucketer(allTx, allCats);

  // Net grid: purchases add, refunds subtract, per category × month.
  const grid = new Map<number, number[]>();
  let totalIncome = 0;
  for (const t of allTx) {
    // Reimbursable charges/paybacks wash out — keep them off spend + income.
    if (t.reimbursable) continue;
    const eff = monthKeyOf(t);
    if (eff.getFullYear() !== now.getFullYear()) continue;
    const month = eff.getMonth();
    const parentCat = t.categoryId ? catById.get(t.categoryId) : null;
    // Income stays whole (splits are spending-only); its own category drives it.
    if (parentCat?.classification === "income") {
      const arr = grid.get(parentCat.id) ?? Array(12).fill(0);
      arr[month] += t.amountCents;
      totalIncome += t.amountCents;
      grid.set(parentCat.id, arr);
      continue;
    }
    // Split transactions add each part to its category's cell for this month.
    for (const part of categoryParts(t, splitsByTx)) {
      if (part.categoryId == null) continue;
      const cat = catById.get(part.categoryId);
      if (!cat || cat.classification === "income") continue;
      const arr = grid.get(part.categoryId) ?? Array(12).fill(0);
      arr[month] +=
        part.amountCents < 0 ? Math.abs(part.amountCents) : -part.amountCents;
      grid.set(part.categoryId, arr);
    }
  }

  // Clamp each spending cell at zero (a month can't net negative), then derive
  // the per-month and per-classification totals from the netted grid.
  let totalSpend = 0;
  const monthTotals = Array(12).fill(0);
  const monthByClassification = Array.from({ length: 12 }, () => ({
    need: 0,
    want: 0,
    savings: 0,
  }));
  for (const [catId, arr] of grid) {
    const cat = catById.get(catId);
    if (!cat || cat.classification === "income") continue;
    for (let m = 0; m < 12; m++) {
      if (arr[m] < 0) arr[m] = 0;
      const v = arr[m];
      if (v <= 0) continue;
      totalSpend += v;
      monthTotals[m] += v;
      if (cat.classification === "need") monthByClassification[m].need += v;
      else if (cat.classification === "want") monthByClassification[m].want += v;
      else if (cat.classification === "savings")
        monthByClassification[m].savings += v;
    }
  }

  const rows = allCats
    .filter((c) => grid.has(c.id))
    .sort((a, b) => {
      const order = { income: 0, need: 1, want: 2, savings: 3 } as const;
      return order[a.classification] - order[b.classification];
    });

  const net = totalIncome - totalSpend;
  const monthsElapsed = now.getMonth() + 1;
  const avgMonthlySpend = totalSpend / Math.max(1, monthsElapsed);

  const stackedData = MONTHS.map((m, i) => ({
    x: m,
    need: monthByClassification[i].need,
    want: monthByClassification[i].want,
    savings: monthByClassification[i].savings,
  }));

  const heatmapCells = MONTHS.map((m, i) => ({
    label: m,
    value: monthTotals[i],
    display: monthTotals[i] > 0 ? formatCentsCompact(monthTotals[i]) : undefined,
  }));

  return (
    <>
      <PageHeader
        eyebrow={String(now.getFullYear())}
        title="Year overview"
        subtitle="Every month side by side, with a category-by-category breakdown."
      />
      <Container>
        <div className="mb-10">
          <YearHero
            totalSpend={totalSpend}
            totalIncome={totalIncome}
            avgMonthlySpend={avgMonthlySpend}
            year={now.getFullYear()}
          />
        </div>

        {totalSpend > 0 && (
          <div className="space-y-12">
            <Card className="p-6 md:p-8">
              <SectionHeader
                title="Twelve "
                italic="months"
                hint="spend by classification, stacked"
              />
              <YearStackedArea data={stackedData} />
            </Card>

            <div>
              <SectionHeader
                title="Heat "
                italic="map"
                hint="brighter months were heavier"
              />
              <Heatmap cells={heatmapCells} columns={12} />
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="text-foreground-faint text-sm mt-12">
            No transactions this year yet.
          </div>
        ) : (
          <div className="mt-12">
            <SectionHeader title="By " italic="category" hint="monthly detail" />
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
                        className={`text-right font-normal p-3 ${i === now.getMonth() ? "text-blush-deep" : "text-foreground-faint"}`}
                      >
                        {i <= now.getMonth() ? (
                          <Link
                            href={`/dashboard?m=${now.getFullYear()}-${String(i + 1).padStart(2, "0")}`}
                            className="hover:text-foreground hover:underline underline-offset-4"
                            title={`Open ${m} on the dashboard`}
                          >
                            {m}
                          </Link>
                        ) : (
                          m
                        )}
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
                                  ? "text-blush-deep"
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
                        className={`text-right p-3 ${i === now.getMonth() ? "text-blush-deep" : "text-foreground"}`}
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
          </div>
        )}

        <NetWorth accounts={allAccts} />
        <NetWorthTrend accounts={allAccts} snaps={allSnaps} />
      </Container>
    </>
  );
}

// Net worth over the last 180 days, summed from per-account balance
// snapshots (Plaid sync and manual balance edits both write them). Each
// account carries its last-known balance forward; an account with no
// snapshots yet contributes its current balance as a flat line.
function NetWorthTrend({
  accounts: accts,
  snaps,
}: {
  accounts: Account[];
  snaps: { accountId: number; date: string; balanceCents: number }[];
}) {
  const active = accts.filter((a) => a.isActive);
  if (active.length === 0 || snaps.length === 0) return null;

  const byAccount = new Map<number, { date: string; balanceCents: number }[]>();
  for (const s of snaps) {
    if (!byAccount.has(s.accountId)) byAccount.set(s.accountId, []);
    byAccount.get(s.accountId)!.push(s);
  }
  for (const list of byAccount.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  const days: string[] = [];
  for (let i = 179; i >= 0; i--) {
    days.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
  }

  const data = days.map((d) => {
    let total = 0;
    for (const a of active) {
      const list = byAccount.get(a.id);
      if (!list || list.length === 0) {
        total += a.currentBalanceCents;
        continue;
      }
      // Latest snapshot on or before this day; before the first snapshot,
      // use the first (better a flat lead-in than a fake zero-jump).
      let bal = list[0].balanceCents;
      for (const s of list) {
        if (s.date <= d) bal = s.balanceCents;
        else break;
      }
      total += bal;
    }
    return { x: d, networth: total / 100 };
  });

  return (
    <div className="mt-12">
      <SectionHeader
        title="Net worth "
        italic="trend"
        hint="last 180 days, from balance snapshots"
      />
      <Card className="p-6 md:p-8">
        <NetWorthArea data={data} />
      </Card>
    </div>
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
      <SectionHeader title="Net " italic="worth" hint="assets − debts" />
      <div className="grid md:grid-cols-4 gap-8 md:gap-12 mb-8">
        <Stat label="Cash" value={formatCents(sumOf(cash))} tone="blue" />
        <Stat
          label="Investments"
          value={formatCents(sumOf(investments) + sumOf(taxAdv))}
          tone="sage"
        />
        <Stat label="Debt" value={formatCents(debts)} tone="blush" />
        <Stat
          label="Net worth"
          value={formatCents(netWorth, { signed: true })}
          tone={netWorth >= 0 ? "blue" : "blush"}
        />
      </div>
    </div>
  );
}
