import "dotenv/config";
import { db } from "../src/db";
import { accounts, transactions } from "../src/db/schema";
import { eq, like, or } from "drizzle-orm";
import { dedupeHash } from "../src/lib/csv-import";

async function main() {
  const accts = await db
    .select()
    .from(accounts)
    .where(
      or(
        like(accounts.name, "%Capital One%Checking%"),
        like(accounts.name, "%Capital%Checking%"),
      ),
    );

  if (accts.length === 0) {
    console.error("No Capital One Checking account found. Active accounts:");
    const all = await db.select().from(accounts).where(eq(accounts.isActive, true));
    for (const a of all) console.error(`  - ${a.id}: ${a.name} (${a.type})`);
    process.exit(1);
  }
  if (accts.length > 1) {
    console.error("Multiple matches:");
    for (const a of accts) console.error(`  - ${a.id}: ${a.name}`);
    process.exit(1);
  }
  const acct = accts[0];
  console.log(`Using account ${acct.id}: ${acct.name}`);

  const rows: Array<{ date: Date; amountCents: number; merchant: string }> = [
    { date: new Date("2026-05-27T12:00:00"), amountCents: -127005, merchant: "Withdrawal from Thirty377 WEB PMTS" },
    { date: new Date("2026-05-29T12:00:00"), amountCents: 261614, merchant: "Deposit from FIELDPULSE PAYROLL" },
    { date: new Date("2026-05-29T12:00:00"), amountCents: -21957, merchant: "Withdrawal from CHASE CREDIT CRD EPAY" },
    { date: new Date("2026-05-31T12:00:00"), amountCents: 58, merchant: "Monthly Interest Paid" },
  ];

  for (const r of rows) {
    const hash = dedupeHash(acct.id, r.date, r.amountCents, r.merchant);
    const existing = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.dedupeHash, hash));
    if (existing.length > 0) {
      console.log(`  skip (dupe): ${r.merchant}`);
      continue;
    }
    await db.insert(transactions).values({
      accountId: acct.id,
      date: r.date,
      amountCents: r.amountCents,
      merchantRaw: r.merchant,
      merchantClean: r.merchant,
      source: "manual",
      dedupeHash: hash,
    });
    console.log(`  inserted: ${r.merchant} (${r.amountCents})`);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
