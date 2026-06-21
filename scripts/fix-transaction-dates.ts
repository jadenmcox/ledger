import "dotenv/config";
import { db } from "../src/db";
import { transactions } from "../src/db/schema";
import { eq } from "drizzle-orm";

// One-time backfill for the import date off-by-one bug.
//
// Plaid and the CSV ISO path used to parse "YYYY-MM-DD" with bare `new Date()`,
// which lands on MIDNIGHT UTC. Rendered in a US (UTC-negative) browser that
// shows up as the *previous* calendar day.
//
// Fix: re-anchor every transaction to NOON UTC of its stored UTC calendar day.
// - The UTC calendar day is unchanged (midnight-UTC and noon-UTC share a date),
//   so dedupeHash (which derives the date via toISOString().slice(0,10)) is
//   untouched — no hash recompute, no future-sync duplicates.
// - It's idempotent: a row already at noon UTC re-anchors to exactly itself.
//
// Run with DRY_RUN=1 to preview without writing.
async function main() {
  const dryRun = process.env.DRY_RUN === "1";
  const rows = await db
    .select({ id: transactions.id, date: transactions.date })
    .from(transactions);

  let changed = 0;
  let unchanged = 0;
  const samples: string[] = [];

  for (const r of rows) {
    const stored = r.date as Date;
    const dateStr = stored.toISOString().slice(0, 10); // intended calendar day
    const target = new Date(dateStr + "T12:00:00Z");

    if (stored.getTime() === target.getTime()) {
      unchanged++;
      continue;
    }

    if (samples.length < 8) {
      samples.push(
        `  #${r.id}: ${stored.toISOString()} -> ${target.toISOString()} (day ${dateStr})`,
      );
    }

    if (!dryRun) {
      await db
        .update(transactions)
        .set({ date: target })
        .where(eq(transactions.id, r.id));
    }
    changed++;
  }

  console.log(`${dryRun ? "[DRY RUN] " : ""}Transactions scanned: ${rows.length}`);
  console.log(`  re-anchored: ${changed}`);
  console.log(`  already correct: ${unchanged}`);
  if (samples.length) {
    console.log("Sample changes:");
    console.log(samples.join("\n"));
  }
}

main().then(() => process.exit(0));
