"use server";

import { db } from "@/db";
import { budgetSettings, categories, budgetFrameworks } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { BudgetFramework } from "@/db/schema";

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
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

// Set (or clear, with null) the manual expected-income override the zero-based
// planner allocates against. Null falls back to the recurring-paycheck derived
// value.
export async function setExpectedIncomeOverride(cents: number | null) {
  const value =
    cents == null || !Number.isFinite(cents) || cents < 0
      ? null
      : Math.round(cents);
  const existing = await db.select().from(budgetSettings).limit(1);
  if (existing.length === 0) {
    await db
      .insert(budgetSettings)
      .values({ expectedIncomeOverrideCents: value });
  } else {
    await db
      .update(budgetSettings)
      .set({ expectedIncomeOverrideCents: value, updatedAt: sql`(unixepoch())` })
      .where(eq(budgetSettings.id, existing[0].id));
  }
  revalidatePath("/budget");
}

export async function bulkSetMonthlyLimits(
  updates: { id: number; limitCents: number | null }[],
) {
  for (const u of updates) {
    if (!Number.isFinite(u.id)) continue;
    await db
      .update(categories)
      .set({ monthlyLimitCents: u.limitCents })
      .where(eq(categories.id, u.id));
  }
  revalidatePath("/budget");
  revalidatePath("/dashboard");
  revalidatePath("/categories");
}
