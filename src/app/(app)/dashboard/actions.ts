"use server";

import { db } from "@/db";
import { savingsGoals } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function dollarsToCents(input: FormDataEntryValue | null): number {
  const n = Number(input);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export async function createSavingsGoal(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const accountIdRaw = String(formData.get("accountId") || "");
  const accountId = accountIdRaw ? Number(accountIdRaw) : null;
  const yearEndTargetCents = dollarsToCents(formData.get("yearEndTarget"));
  const monthlyTargetCents = dollarsToCents(formData.get("monthlyTarget"));
  const manualBalanceCents = dollarsToCents(formData.get("manualBalance"));
  await db.insert(savingsGoals).values({
    name,
    accountId: accountId && Number.isFinite(accountId) ? accountId : null,
    yearEndTargetCents,
    monthlyTargetCents,
    manualBalanceCents,
  });
  revalidatePath("/dashboard");
}

export async function updateSavingsGoal(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  const name = String(formData.get("name") || "").trim();
  const accountIdRaw = String(formData.get("accountId") || "");
  const accountId = accountIdRaw ? Number(accountIdRaw) : null;
  await db
    .update(savingsGoals)
    .set({
      name,
      accountId: accountId && Number.isFinite(accountId) ? accountId : null,
      yearEndTargetCents: dollarsToCents(formData.get("yearEndTarget")),
      monthlyTargetCents: dollarsToCents(formData.get("monthlyTarget")),
      manualBalanceCents: dollarsToCents(formData.get("manualBalance")),
    })
    .where(eq(savingsGoals.id, id));
  revalidatePath("/dashboard");
}

export async function deleteSavingsGoal(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await db.delete(savingsGoals).where(eq(savingsGoals.id, id));
  revalidatePath("/dashboard");
}
