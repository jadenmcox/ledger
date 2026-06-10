"use server";

import { db } from "@/db";
import { recurringSchedules, recurringCadences } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseDollarsToCents } from "@/lib/utils";
import { backfillRecurring } from "@/lib/recurring-schedules";

export async function createSchedule(form: FormData) {
  const accountId = Number(form.get("accountId"));
  const merchantRaw = String(form.get("merchant") || "").trim();
  const amountStr = String(form.get("amount") || "0");
  const direction = String(form.get("direction") || "in");
  const cadence = String(form.get("cadence") || "monthly");
  const day1 = Number(form.get("day1") || 1);
  const day2 = form.get("day2") ? Number(form.get("day2")) : null;
  const categoryId = form.get("categoryId")
    ? Number(form.get("categoryId"))
    : null;
  const startDate = String(form.get("startDate") || "");
  const notes = String(form.get("notes") || "").trim() || null;

  if (!accountId) throw new Error("Account required");
  if (!merchantRaw) throw new Error("Merchant required");
  if (!startDate) throw new Error("Start date required");
  if (!recurringCadences.includes(cadence as never))
    throw new Error("Invalid cadence");

  const cents = parseDollarsToCents(amountStr);
  const signed = direction === "in" ? Math.abs(cents) : -Math.abs(cents);

  let daysOfMonth: string | null = null;
  if (cadence === "monthly") daysOfMonth = JSON.stringify([day1]);
  else if (cadence === "semi_monthly")
    daysOfMonth = JSON.stringify(day2 ? [day1, day2] : [day1, day1 + 15]);

  await db.insert(recurringSchedules).values({
    accountId,
    merchantRaw,
    amountCents: signed,
    categoryId,
    cadence: cadence as never,
    daysOfMonth,
    startDate,
    notes,
  });

  // Backfill immediately so the schedule's history shows up.
  await backfillRecurring();

  revalidatePath("/recurring");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function deleteSchedule(id: number) {
  await db.delete(recurringSchedules).where(eq(recurringSchedules.id, id));
  revalidatePath("/recurring");
}

export async function toggleSchedule(id: number, isActive: boolean) {
  await db
    .update(recurringSchedules)
    .set({ isActive })
    .where(eq(recurringSchedules.id, id));
  revalidatePath("/recurring");
}
