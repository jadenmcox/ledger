import { DesktopNav, MobileHeader, MobileNav } from "@/components/nav";
import { CommandPalette } from "@/components/command-palette";
import { db } from "@/db";
import { accounts, categories, transactions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { backfillRecurring } from "@/lib/recurring-schedules";
import { after } from "next/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Creates any due recurring transactions since the last run. Idempotent
  // (strict dedupe hash), and it runs after the response is sent so it never
  // slows down a page load; anything it adds shows on the next load.
  after(() => backfillRecurring().catch(() => undefined));

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
