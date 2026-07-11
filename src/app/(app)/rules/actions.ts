"use server";

import { db } from "@/db";
import { categoryRules, merchantRules, reimbursableRules } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  applyRulesToHistory,
  applyReimbursableRulesToHistory,
} from "@/lib/categorize";
import { applyMerchantRulesToHistory } from "@/lib/merchant-rename";
import { parseDollarsToCents } from "@/lib/utils";

const matchTypes = ["merchant_contains", "merchant_exact", "regex"] as const;
type MatchType = (typeof matchTypes)[number];

function revalidateAll() {
  revalidatePath("/rules");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

function parseCommon(form: FormData) {
  const id = Number(form.get("id"));
  if (!id) throw new Error("id required");
  const pattern = String(form.get("pattern") || "").trim();
  if (!pattern) throw new Error("Pattern required");
  const matchType = String(form.get("matchType")) as MatchType;
  if (!matchTypes.includes(matchType)) throw new Error("Invalid match type");
  if (matchType === "regex") {
    try {
      new RegExp(pattern, "i");
    } catch {
      throw new Error("Invalid regular expression");
    }
  }
  return { id, pattern, matchType };
}

// Optional dollar field: "" => null.
function centsOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const cents = parseDollarsToCents(s);
  return cents > 0 ? cents : null;
}

export async function updateCategoryRule(form: FormData) {
  const { id, pattern, matchType } = parseCommon(form);
  const categoryId = Number(form.get("categoryId"));
  if (!categoryId) throw new Error("Category required");
  await db
    .update(categoryRules)
    .set({
      pattern,
      matchType,
      categoryId,
      minAmountCents: centsOrNull(form.get("minAmount")),
      maxAmountCents: centsOrNull(form.get("maxAmount")),
      priority: Number(form.get("priority")) || 0,
    })
    .where(eq(categoryRules.id, id));
  revalidateAll();
}

export async function deleteCategoryRule(id: number) {
  await db.delete(categoryRules).where(eq(categoryRules.id, id));
  revalidateAll();
}

export async function updateMerchantRule(form: FormData) {
  const { id, pattern, matchType } = parseCommon(form);
  const cleanName = String(form.get("cleanName") || "").trim();
  if (!cleanName) throw new Error("Display name required");
  await db
    .update(merchantRules)
    .set({ pattern, matchType, cleanName })
    .where(eq(merchantRules.id, id));
  revalidateAll();
}

export async function deleteMerchantRule(id: number) {
  await db.delete(merchantRules).where(eq(merchantRules.id, id));
  revalidateAll();
}

export async function updateReimbursableRule(form: FormData) {
  const { id, pattern, matchType } = parseCommon(form);
  await db
    .update(reimbursableRules)
    .set({
      pattern,
      matchType,
      maxAmountCents: centsOrNull(form.get("maxAmount")),
    })
    .where(eq(reimbursableRules.id, id));
  revalidateAll();
}

export async function deleteReimbursableRule(id: number) {
  await db.delete(reimbursableRules).where(eq(reimbursableRules.id, id));
  revalidateAll();
}

// Re-run every rule across history. Manual category picks stay put
// (category_locked); renames and reimbursable flags follow current rules.
export async function runAllRules(): Promise<{
  categorized: number;
  renamed: number;
  reimbursable: number;
}> {
  const categorized = await applyRulesToHistory({ onlyUncategorized: false });
  const renamed = await applyMerchantRulesToHistory();
  const reimbursable = await applyReimbursableRulesToHistory();
  revalidateAll();
  return { categorized, renamed, reimbursable };
}
