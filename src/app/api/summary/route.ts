import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { startOfMonth, endOfMonth } from "date-fns";
import { monthConsumption } from "@/lib/month-bucket";
import { loadSplitsByTx } from "@/lib/splits";
import { formatCentsCompact } from "@/lib/utils";

// Read-only summary for the Dashboard app's tile. Protected by a shared
// static API key (this is a single-user personal app, not multi-tenant) —
// see DASHBOARD_API_KEY in .env.example. Reuses the same refund/rent-aware
// month bucketing as the real dashboard (src/lib/month-bucket.ts) so the
// number shown here never drifts from what /dashboard shows.
export async function GET(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.DASHBOARD_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [allTx, allCategories, splitsByTx] = await Promise.all([
    db.select().from(transactions).where(eq(transactions.isTransfer, false)),
    db.select().from(categories),
    loadSplitsByTx(),
  ]);

  const actualCents = monthConsumption(allTx, allCategories, monthStart, splitsByTx);
  const plannedCents = allCategories
    .filter((c) => c.classification !== "income" && !c.isArchived)
    .reduce((sum, c) => sum + (c.monthlyLimitCents ?? 0), 0);

  const ratio = plannedCents > 0 ? actualCents / plannedCents : null;
  const direction = ratio == null ? "flat" : ratio > 1 ? "up" : ratio > 0.9 ? "flat" : "down";

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
  });
}
