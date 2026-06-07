"use server";

import { db } from "@/db";
import { transactions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  applyRulesToHistory,
  createRuleFromTransaction,
} from "@/lib/categorize";

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

export async function deleteTransaction(id: number) {
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
