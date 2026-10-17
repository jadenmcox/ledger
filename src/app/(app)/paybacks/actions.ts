"use server";

import { db } from "@/db";
import { paybackLinks, transactions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { loadPaybackLinks } from "@/lib/ledger-data";
import { autoMatches, paybackState } from "@/lib/paybacks";
import { recoverAllMergedTransactions } from "@/lib/plaid-sync";

const NOT_MIGRATED =
  "Paybacks need a one-time database update (the payback_links table). Run drizzle/0008_payback_links.sql in the Turso console, then try again.";

function revalidateAll() {
  revalidatePath("/", "layout");
}

// Link an incoming payment to the charge it pays back. Amount defaults to as
// much as both sides have left (a $6.25 Zelle against $25 parking links $6.25).
export async function linkPayback(
  paybackId: number,
  chargeId: number,
  amountCents?: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = await db
    .select()
    .from(transactions)
    .where(inArray(transactions.id, [paybackId, chargeId]));
  const payback = rows.find((r) => r.id === paybackId);
  const charge = rows.find((r) => r.id === chargeId);
  if (!payback || !charge) return { ok: false, error: "Transaction not found." };
  if (payback.amountCents <= 0) return { ok: false, error: "A payback has to be money coming in." };
  if (charge.amountCents >= 0) return { ok: false, error: "You can only pay back a charge." };

  const state = paybackState(await loadPaybackLinks());
  const max = Math.min(state.paybackRemaining(payback), state.chargeRemaining(charge));
  const amount = Math.min(max, amountCents ?? max);
  if (amount <= 0) return { ok: false, error: "Nothing left to link on one side." };

  try {
    await db.insert(paybackLinks).values({ paybackId, chargeId, amountCents: amount });
  } catch {
    return { ok: false, error: NOT_MIGRATED };
  }
  // Money a friend sent you isn't a move between your own accounts.
  if (payback.isTransfer) {
    await db.update(transactions).set({ isTransfer: false }).where(eq(transactions.id, paybackId));
  }
  revalidateAll();
  return { ok: true };
}

export async function unlinkPayback(linkId: number) {
  await db.delete(paybackLinks).where(eq(paybackLinks.id, linkId));
  revalidateAll();
}

// Settle every work expense that has an exact-amount payment waiting for it.
export async function matchAllPaybacks(): Promise<
  { ok: true; matched: number } | { ok: false; error: string }
> {
  const [allTx, links] = await Promise.all([
    db.select().from(transactions),
    loadPaybackLinks(),
  ]);
  const matches = autoMatches(allTx, paybackState(links));
  if (matches.length === 0) return { ok: true, matched: 0 };
  try {
    await db.insert(paybackLinks).values(matches);
  } catch {
    return { ok: false, error: NOT_MIGRATED };
  }
  revalidateAll();
  return { ok: true, matched: matches.length };
}

// Clear every pairing on a work expense and match them all again with the
// current rules. Paybacks you tied to ordinary charges by hand (a friend's
// share of parking) are left alone. Runs as one batch, so it either fully
// happens or nothing changes.
export async function redoWorkMatches(): Promise<
  { ok: true; cleared: number; matched: number } | { ok: false; error: string }
> {
  const [allTx, links] = await Promise.all([db.select().from(transactions), loadPaybackLinks()]);
  const work = new Set(allTx.filter((t) => t.reimbursable && t.amountCents < 0).map((t) => t.id));
  const clear = links.filter((l) => work.has(l.chargeId));
  const keep = links.filter((l) => !work.has(l.chargeId));
  const matches = autoMatches(allTx, paybackState(keep));
  try {
    const del = db.delete(paybackLinks).where(
      inArray(
        paybackLinks.id,
        clear.length ? clear.map((l) => l.id) : [-1],
      ),
    );
    if (matches.length) {
      await db.batch([del, db.insert(paybackLinks).values(matches)]);
    } else {
      await db.batch([del]);
    }
  } catch {
    return { ok: false, error: NOT_MIGRATED };
  }
  revalidateAll();
  return { ok: true, cleared: clear.length, matched: matches.length };
}

// For lunches Ramp says are paid but Budgetly shows overdue: pull back any
// reimbursement deposits the bank sync merged away, then redo the matches.
export async function recoverDepositsAndRematch(): Promise<
  | { ok: true; restored: number; matched: number; errors: string[] }
  | { ok: false; error: string }
> {
  const { restored, errors } = await recoverAllMergedTransactions();
  const r = await redoWorkMatches();
  if (!r.ok) return r;
  return { ok: true, restored: restored.length, matched: r.matched, errors };
}
