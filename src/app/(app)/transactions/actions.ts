"use server";

import { db } from "@/db";
import { transactions, transactionSplits, categories } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { scanReceiptImage, type ScannedReceipt } from "@/lib/receipt";
import { revalidatePath } from "next/cache";
import {
  applyRulesToHistory,
  applyReimbursableRulesToHistory,
  createRuleFromTransaction,
} from "@/lib/categorize";
import {
  applyMerchantRulesToHistory,
  createMerchantRule,
} from "@/lib/merchant-rename";
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
  const date = new Date(dateStr + "T12:00:00Z");

  await db.insert(transactions).values({
    accountId,
    date,
    amountCents: signed,
    merchantRaw,
    merchantClean: merchantRaw,
    categoryId,
    categoryLocked: categoryId !== null,
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
    // Picking a category by hand locks it so rule re-runs / Plaid re-sync
    // won't overwrite it. Clearing it (null) unlocks so rules can fill it in.
    .set({ categoryId, categoryLocked: categoryId !== null })
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
    .set({ categoryId, categoryLocked: categoryId !== null })
    .where(inArray(transactions.id, ids));
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function makeRule(
  merchant: string,
  categoryId: number,
  applyToHistory: boolean,
  bounds: { minAmountCents?: number | null; maxAmountCents?: number | null } = {},
) {
  const hasBounds =
    bounds.minAmountCents != null || bounds.maxAmountCents != null;
  // Amount-narrowed rules ("Costco under $50 -> Transportation") get a higher
  // priority so they win over a broad merchant rule ("Costco -> Groceries").
  await createRuleFromTransaction(
    merchant,
    categoryId,
    "merchant_contains",
    hasBounds ? 2 : 0,
    bounds,
  );
  let touched = 0;
  if (applyToHistory) {
    touched = await applyRulesToHistory({ onlyUncategorized: false });
  }
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return touched;
}

export async function setReimbursable(txId: number, reimbursable: boolean) {
  await db
    .update(transactions)
    .set({ reimbursable })
    .where(eq(transactions.id, txId));
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

// Splitting a purchase changes category attribution on every monthly view, so
// refresh them all (unlike a plain edit, which only touches list + dashboard).
function revalidateSplitViews() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/categories");
  revalidatePath("/year");
}

type SplitInput = {
  categoryId: number | null;
  amountCents: number; // positive magnitude in cents; parent's sign is applied
  note?: string | null;
};

// Replace the category splits on a transaction so one purchase (a Target run)
// counts partly toward groceries and partly toward household. Parts are given
// as positive magnitudes; the parent's sign is applied so they keep the
// outflow/inflow convention and must sum to the parent's amount. Fewer than two
// non-zero parts clears the split (a single category is just a normal
// categorization). The transaction row itself stays whole.
export async function saveSplits(txId: number, parts: SplitInput[]) {
  const [tx] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, txId));
  if (!tx) throw new Error("Transaction not found");

  const clean = parts.filter((p) => Math.round(p.amountCents) !== 0);
  if (clean.length < 2) {
    await clearSplits(txId);
    return;
  }

  const sign = tx.amountCents < 0 ? -1 : 1;
  const rows = clean.map((p, i) => ({
    transactionId: txId,
    categoryId: p.categoryId,
    amountCents: sign * Math.abs(Math.round(p.amountCents)),
    note: p.note?.trim() || null,
    sortOrder: i,
  }));
  const sum = rows.reduce((s, p) => s + p.amountCents, 0);
  if (sum !== tx.amountCents) {
    throw new Error(
      `Splits must sum to the transaction total (${tx.amountCents}¢); got ${sum}¢.`,
    );
  }

  // The largest part becomes the parent's headline category so the list and any
  // split-unaware read still show something sensible; splitting locks the row so
  // rule re-runs / Plaid re-sync won't overwrite it (mirrors manual categorize).
  const largest = rows.reduce((a, b) =>
    Math.abs(b.amountCents) > Math.abs(a.amountCents) ? b : a,
  );

  await db
    .delete(transactionSplits)
    .where(eq(transactionSplits.transactionId, txId));
  await db.insert(transactionSplits).values(rows);
  await db
    .update(transactions)
    .set({ categoryId: largest.categoryId, categoryLocked: true })
    .where(eq(transactions.id, txId));

  revalidateSplitViews();
}

export async function clearSplits(txId: number) {
  await db
    .delete(transactionSplits)
    .where(eq(transactionSplits.transactionId, txId));
  revalidateSplitViews();
}

// Parses a photographed receipt (a downscaled data: URL from the client) into
// per-category split slices to seed the split editor. Read-only: it never
// writes splits itself, so the user always reviews and saves via saveSplits.
// Degrades to a clear error when GROQ_API_KEY isn't configured.
export async function scanReceipt(dataUrl: string): Promise<ScannedReceipt> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "Receipt scanning isn't set up yet (GROQ_API_KEY is missing).",
    );
  }
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("That doesn't look like an image.");
  }
  const cats = await db
    .select()
    .from(categories)
    .where(eq(categories.isArchived, false));
  return scanReceiptImage(
    dataUrl,
    cats.map((c) => ({
      id: c.id,
      name: c.name,
      classification: c.classification,
    })),
  );
}

/**
 * Re-runs categorization across everything: forces a full Plaid re-sync
 * (which backfills categoryId via rules → Plaid PFC on existing rows that
 * are still uncategorized), then applies rules to any non-Plaid rows.
 */
export async function recategorizeAll(): Promise<{
  touched: number;
  errors: string[];
}> {
  const results = await recategorizeAllFromPlaid();
  const backfilled = results.reduce((s, r) => s + (r.backfilled ?? 0), 0);
  const errors = results.map((r) => r.error).filter((e): e is string => !!e);
  const ruleTouched = await applyRulesToHistory({ onlyUncategorized: true });
  await applyReimbursableRulesToHistory();
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { touched: backfilled + ruleTouched, errors };
}

export async function makeMerchantRule(
  pattern: string,
  cleanName: string,
  applyToHistory: boolean,
) {
  await createMerchantRule(pattern, cleanName, "merchant_contains");
  let touched = 0;
  if (applyToHistory) {
    touched = await applyMerchantRulesToHistory();
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
  const parsedDate = new Date(date + "T12:00:00Z");
  if (Number.isNaN(parsedDate.getTime())) throw new Error("Invalid date");
  await db
    .update(transactions)
    .set({
      merchantClean: merchant,
      amountCents,
      date: parsedDate,
      notes,
      categoryId,
      // An explicit edit of the category locks it against later rule re-runs.
      categoryLocked: categoryId !== null,
    })
    .where(eq(transactions.id, id));

  const rulePattern = String(form.get("rulePattern") || "").trim();
  const saveAsRule = form.get("saveAsRule") === "1";
  if (saveAsRule && rulePattern) {
    await createMerchantRule(rulePattern, merchant, "merchant_contains");
    await applyMerchantRulesToHistory();
  }

  const saveCategoryRule = form.get("saveCategoryRule") === "1";
  if (saveCategoryRule && categoryId && rulePattern) {
    // priority=1 so an explicit edit beats older priority-0 rules whose
    // patterns also match this merchant (e.g. an older rule on the full
    // raw "10120D CAVA PARK LANE" alongside the new shorter "CAVA").
    await createRuleFromTransaction(
      rulePattern,
      categoryId,
      "merchant_contains",
      1,
    );
    await applyRulesToHistory({ onlyUncategorized: false });
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
