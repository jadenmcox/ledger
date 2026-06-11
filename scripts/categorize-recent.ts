import "dotenv/config";
import { db } from "../src/db";
import { transactions } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  // Paycheck (cat 1)
  await db
    .update(transactions)
    .set({ categoryId: 1 })
    .where(eq(transactions.id, 12));
  console.log("Tx 12 (FIELDPULSE) → Paycheck");

  // Transfer (cat 29) + isTransfer
  await db
    .update(transactions)
    .set({ categoryId: 29, isTransfer: true })
    .where(eq(transactions.id, 13));
  console.log("Tx 13 (CHASE CRD EPAY) → Transfer, isTransfer=true");

  // Interest (cat 3)
  await db
    .update(transactions)
    .set({ categoryId: 3 })
    .where(eq(transactions.id, 14));
  console.log("Tx 14 (Monthly Interest Paid) → Interest");
}
main().then(() => process.exit(0));
