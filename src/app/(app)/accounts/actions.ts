"use server";

import { db } from "@/db";
import { accounts, balanceSnapshots, accountTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { parseDollarsToCents } from "@/lib/utils";
import { recoverAllMergedTransactions } from "@/lib/plaid-sync";

export async function createAccount(form: FormData) {
  const name = String(form.get("name") || "").trim();
  const type = String(form.get("type") || "checking");
  const institution = String(form.get("institution") || "").trim() || null;
  const balanceStr = String(form.get("balance") || "0");
  if (!name) throw new Error("Name required");
  if (!accountTypes.includes(type as never))
    throw new Error("Invalid account type");
  const balanceCents = parseDollarsToCents(balanceStr);

  const [row] = await db
    .insert(accounts)
    .values({
      name,
      type: type as never,
      institution,
      currentBalanceCents: balanceCents,
    })
    .returning();

  await db
    .insert(balanceSnapshots)
    .values({
      accountId: row.id,
      date: format(new Date(), "yyyy-MM-dd"),
      balanceCents,
    })
    .onConflictDoUpdate({
      target: [balanceSnapshots.accountId, balanceSnapshots.date],
      set: { balanceCents },
    });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function updateAccount(form: FormData) {
  const id = Number(form.get("id"));
  const name = String(form.get("name") || "").trim();
  const type = String(form.get("type") || "checking");
  const institution = String(form.get("institution") || "").trim() || null;
  const balanceCents = parseDollarsToCents(String(form.get("balance") || "0"));
  if (!id) throw new Error("id required");
  await db
    .update(accounts)
    .set({
      name,
      type: type as never,
      institution,
      currentBalanceCents: balanceCents,
    })
    .where(eq(accounts.id, id));
  await db
    .insert(balanceSnapshots)
    .values({
      accountId: id,
      date: format(new Date(), "yyyy-MM-dd"),
      balanceCents,
    })
    .onConflictDoUpdate({
      target: [balanceSnapshots.accountId, balanceSnapshots.date],
      set: { balanceCents },
    });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function archiveAccount(id: number) {
  await db
    .update(accounts)
    .set({ isActive: false })
    .where(eq(accounts.id, id));
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

export async function unarchiveAccount(id: number) {
  await db
    .update(accounts)
    .set({ isActive: true })
    .where(eq(accounts.id, id));
  revalidatePath("/accounts");
}

export async function deleteAccount(id: number) {
  await db.delete(accounts).where(eq(accounts.id, id));
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

// Quick balance update for manually-tracked accounts (no bank feed). Lets you
// correct a stale balance ("set"), or log money moved in/out ("add"/"subtract")
// without retyping the whole figure, the natural way to keep an investment
// account current after a transfer. Snapshots the new balance so the net-worth
// trend stays honest, same as a full edit.
export async function adjustBalance(form: FormData) {
  const id = Number(form.get("id"));
  const mode = String(form.get("mode") || "set"); // set | add | subtract
  const amountCents = parseDollarsToCents(String(form.get("amount") || "0"));
  if (!id) throw new Error("id required");

  const [acct] = await db
    .select({ balance: accounts.currentBalanceCents })
    .from(accounts)
    .where(eq(accounts.id, id));
  if (!acct) throw new Error("Account not found");

  const next =
    mode === "add"
      ? acct.balance + amountCents
      : mode === "subtract"
        ? acct.balance - amountCents
        : amountCents;

  await db
    .update(accounts)
    .set({ currentBalanceCents: next })
    .where(eq(accounts.id, id));
  await db
    .insert(balanceSnapshots)
    .values({
      accountId: id,
      date: format(new Date(), "yyyy-MM-dd"),
      balanceCents: next,
    })
    .onConflictDoUpdate({
      target: [balanceSnapshots.accountId, balanceSnapshots.date],
      set: { balanceCents: next },
    });
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
}

// Bring back transactions the old bank sync merged into a same-day,
// same-amount twin (see recoverMergedTransactions).
export async function recoverMissingTransactions() {
  const result = await recoverAllMergedTransactions();
  revalidatePath("/", "layout");
  return result;
}
