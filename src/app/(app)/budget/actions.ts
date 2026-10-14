"use server";

import { db } from "@/db";
import { budgetSettings, categories, budgetFrameworks, classifications } from "@/db/schema";
import type { BudgetFramework, Classification } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Limits and categories feed every monthly view, so refresh them all.
function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function setBudgetFramework(framework: BudgetFramework) {
  if (!budgetFrameworks.includes(framework)) {
    throw new Error("Invalid framework");
  }
  const existing = await db.select().from(budgetSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(budgetSettings).values({ framework });
  } else {
    await db
      .update(budgetSettings)
      .set({ framework, updatedAt: sql`(unixepoch())` })
      .where(eq(budgetSettings.id, existing[0].id));
  }
  revalidateAll();
}

// Set (or clear, with null) the expected monthly income the plan is measured
// against. Null falls back to recurring paycheck schedules.
export async function setExpectedIncomeOverride(cents: number | null) {
  const value =
    cents == null || !Number.isFinite(cents) || cents < 0 ? null : Math.round(cents);
  const existing = await db.select().from(budgetSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(budgetSettings).values({ expectedIncomeOverrideCents: value });
  } else {
    await db
      .update(budgetSettings)
      .set({ expectedIncomeOverrideCents: value, updatedAt: sql`(unixepoch())` })
      .where(eq(budgetSettings.id, existing[0].id));
  }
  revalidateAll();
}

export async function bulkSetMonthlyLimits(updates: { id: number; limitCents: number | null }[]) {
  for (const u of updates) {
    if (!Number.isFinite(u.id)) continue;
    await db
      .update(categories)
      .set({ monthlyLimitCents: u.limitCents })
      .where(eq(categories.id, u.id));
  }
  revalidateAll();
}

export async function setMonthlyLimit(id: number, limitCents: number | null) {
  await db
    .update(categories)
    .set({ monthlyLimitCents: limitCents && limitCents > 0 ? Math.round(limitCents) : null })
    .where(eq(categories.id, id));
  revalidateAll();
}

export type CategoryInput = {
  name: string;
  classification: Classification;
  color: string;
  icon: string;
  limitCents: number | null;
};

function clean(input: CategoryInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Give it a name.");
  if (!classifications.includes(input.classification)) throw new Error("Pick a type.");
  return {
    name,
    classification: input.classification,
    color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#d4a574",
    icon: input.icon || "tag",
    monthlyLimitCents: input.limitCents && input.limitCents > 0 ? Math.round(input.limitCents) : null,
  };
}

export async function createCategory(
  input: CategoryInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.insert(categories).values(clean(input));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: /unique/i.test(msg) ? "A category with that name already exists." : msg };
  }
  revalidateAll();
  return { ok: true };
}

export async function updateCategory(
  id: number,
  input: CategoryInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.update(categories).set(clean(input)).where(eq(categories.id, id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: /unique/i.test(msg) ? "A category with that name already exists." : msg };
  }
  revalidateAll();
  return { ok: true };
}

// Transactions keep their merchant but become uncategorized.
export async function deleteCategory(id: number) {
  await db.delete(categories).where(eq(categories.id, id));
  revalidateAll();
}
