import { DesktopNav, MobileHeader, MobileNav } from "@/components/nav";
import { CommandPalette } from "@/components/command-palette";
import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { backfillRecurring } from "@/lib/recurring-schedules";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Idempotent — creates any due recurring transactions since last run.
  // Strict dedupe hash protects against double-creation if CSV import lands
  // the same dates+amounts later.
  await backfillRecurring().catch(() => undefined);

  const [cats, accts, recentTx] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories),
    db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.isActive, true)),
    db
      .select({
        merchantClean: transactions.merchantClean,
        merchantRaw: transactions.merchantRaw,
      })
      .from(transactions)
      .orderBy(desc(transactions.date))
      .limit(200),
  ]);

  const recentMerchants = Array.from(
    new Set(
      recentTx
        .map((t) => (t.merchantClean || t.merchantRaw).trim())
        .filter(Boolean),
    ),
  );

  return (
    <div className="app-canvas relative flex min-h-screen">
      <DesktopNav />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 pb-24 md:pb-0">{children}</main>
      </div>
      <MobileNav />
      <CommandPalette
        categories={cats}
        accounts={accts}
        recentMerchants={recentMerchants}
      />
    </div>
  );
}
