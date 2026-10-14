import { NextResponse } from "next/server";
import { loadLedgerData } from "@/lib/ledger-data";
import { formatCentsCompact } from "@/lib/utils";

// Read-only summary for the Dashboard app's tile. Protected by a shared
// static API key (this is a single-user personal app, not multi-tenant) —
// see DASHBOARD_API_KEY in .env.example. Reads the same shared ledger as the
// real dashboard (src/lib/ledger.ts) so the number shown here never drifts
// from what /dashboard shows.
export async function GET(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.DASHBOARD_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { allCategories, ledger } = await loadLedgerData();
  const month = ledger.summarize(now);

  // Spending against planned spending (needs + wants), same numbers as Home.
  const actualCents = month.spent;
  const plannedCents = allCategories
    .filter((c) => (c.classification === "need" || c.classification === "want") && !c.isArchived)
    .reduce((sum, c) => sum + (c.monthlyLimitCents ?? 0), 0);

  const ratio = plannedCents > 0 ? actualCents / plannedCents : null;
  const direction = ratio == null ? "flat" : ratio > 1 ? "up" : ratio > 0.9 ? "flat" : "down";

  // Categories currently over their monthly limit, worst first — same
  // bucketing as the headline number, so the two can never disagree.
  const byCategory = month.spendByCategory;
  const overspent = allCategories
    .filter(
      (c) =>
        c.classification !== "income" &&
        c.classification !== "savings" &&
        !c.isArchived &&
        (c.monthlyLimitCents ?? 0) > 0,
    )
    .map((c) => ({
      c,
      actual: Math.max(byCategory.get(c.id) ?? 0, 0),
      limit: c.monthlyLimitCents ?? 0,
    }))
    .filter((x) => x.actual > x.limit)
    .sort((a, b) => b.actual - b.limit - (a.actual - a.limit))
    .slice(0, 2);

  return NextResponse.json({
    label: "Spend vs. budget",
    value: formatCentsCompact(actualCents),
    hint:
      plannedCents > 0
        ? `of ${formatCentsCompact(plannedCents)} planned this month`
        : "no monthly budget set",
    trend:
      ratio != null
        ? { value: `${Math.round(ratio * 100)}%`, direction }
        : undefined,
    details: overspent.map(({ c, actual, limit }) => ({
      id: String(c.id),
      label: c.name,
      sublabel: `${formatCentsCompact(actual - limit)} over budget`,
    })),
  });
}
