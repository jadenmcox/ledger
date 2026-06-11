"use server";

import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  applyRulesToHistory,
  createRuleFromTransaction,
} from "@/lib/categorize";
import { dedupeHash } from "@/lib/csv-import";
import { parseDollarsToCents } from "@/lib/utils";
import { recategorizeAllFromPlaid } from "@/lib/plaid-sync";

export async function createManualTransaction(form: FormData) {
  const accountId = Number(form.get("accountId"));
  const dateStr = String(form.get("date") || "");
  const merchantRaw = String(form.get("merchant") || "").trim();
  const amountStr = String(form.get("amount") || "0");
  const direction = String(form.get("direction") || "out"); // "in" | "out"
  const categoryId = form.get("categoryId")
    ? Number(form.get("categoryId"))
    : null;
  const notes = String(form.get("notes") || "").trim() || null;

  if (!accountId) throw new Error("Account required");
  if (!dateStr) throw new Error("Date required");
  if (!merchantRaw) throw new Error("Merchant required");

  const cents = parseDollarsToCents(amountStr);
  const signed = direction === "in" ? Math.abs(cents) : -Math.abs(cents);
  const date = new Date(dateStr + "T12:00:00");

  await db.insert(transactions).values({
    accountId,
    date,
    amountCents: signed,
    merchantRaw,
    merchantClean: merchantRaw,
    categoryId,
    notes,
    source: "manual",
    dedupeHash: dedupeHash(accountId, date, signed, merchantRaw),
  });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function setCategory(txId: number, categoryId: number | null) {
  await db
    .update(transactions)
    .set({ categoryId })
    .where(eq(transactions.id, txId));
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function setIsTransfer(txId: number, isTransfer: boolean) {
  await db
    .update(transactions)
    .set({ isTransfer })
    .where(eq(transactions.id, txId));
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function bulkSetCategory(ids: number[], categoryId: number | null) {
  if (ids.length === 0) return;
  await db
    .update(transactions)
    .set({ categoryId })
    .where(inArray(transactions.id, ids));
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function makeRule(
  merchant: string,
  categoryId: number,
  applyToHistory: boolean,
) {
  await createRuleFromTransaction(merchant, categoryId, "merchant_contains");
  let touched = 0;
  if (applyToHistory) {
    touched = await applyRulesToHistory({ onlyUncategorized: false });
  }
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return touched;
}

/**
 * Re-runs categorization across everything: forces a full Plaid re-sync
 * (which backfills categoryId via rules → Plaid PFC on existing rows that
 * are still uncategorized), then applies rules to any non-Plaid rows.
 */
export async function recategorizeAll() {
  await recategorizeAllFromPlaid().catch(() => undefined);
  const touched = await applyRulesToHistory({ onlyUncategorized: true });
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return touched;
}

export async function deleteTransaction(id: number) {
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function updateTransaction(form: FormData) {
  const id = Number(form.get("id"));
  if (!id) throw new Error("id required");
  const merchant = String(form.get("merchant") || "").trim();
  const amount = String(form.get("amount") || "");
  const date = String(form.get("date") || "");
  const notes = String(form.get("notes") || "").trim() || null;
  const categoryRaw = form.get("categoryId");
  const categoryId =
    categoryRaw === null || categoryRaw === "" ? null : Number(categoryRaw);
  if (!merchant) throw new Error("Merchant required");
  if (!date) throw new Error("Date required");
  const amountCents = parseDollarsToCents(amount);
  const parsedDate = new Date(date + "T12:00:00");
  if (Number.isNaN(parsedDate.getTime())) throw new Error("Invalid date");
  await db
    .update(transactions)
    .set({
      merchantClean: merchant,
      amountCents,
      date: parsedDate,
      notes,
      categoryId,
    })
    .where(eq(transactions.id, id));
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
