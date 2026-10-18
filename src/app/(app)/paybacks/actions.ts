"use server";

import { db } from "@/db";
import { paybackLinks, transactions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { loadPaybackLinks } from "@/lib/ledger-data";
import { paybackState } from "@/lib/paybacks";

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
  if (charge.reimbursable)
    return { ok: false, error: "Work expenses pair with their deposit automatically." };

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



