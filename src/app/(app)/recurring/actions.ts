"use server";

import { db } from "@/db";
import { recurringSchedules, recurringCadences } from "@/db/schema";
import type { RecurringCadence } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseDollarsToCents } from "@/lib/utils";

function revalidateAll() {
  revalidatePath("/recurring");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
}

// Parse "1, 16" into a JSON day-of-month array, or null for week cadences.
function parseDaysOfMonth(
  raw: string,
  cadence: RecurringCadence,
): string | null {
  if (cadence === "weekly" || cadence === "biweekly") return null;
  const days = raw
    .split(/[,\s]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31);
  if (days.length === 0) {
    throw new Error("Give at least one day of the month (1–31), e.g. “1” or “1, 16”.");
  }
  return JSON.stringify([...new Set(days)].sort((a, b) => a - b));
}

function scheduleFromForm(form: FormData) {
  const accountId = Number(form.get("accountId"));
  const merchantRaw = String(form.get("merchant") || "").trim();
  const amountStr = String(form.get("amount") || "");
  const direction = String(form.get("direction") || "out"); // "in" | "out"
  const cadence = String(form.get("cadence")) as RecurringCadence;
  const daysRaw = String(form.get("daysOfMonth") || "");
  const startDate = String(form.get("startDate") || "");
  const endDate = String(form.get("endDate") || "").trim() || null;
  const categoryRaw = form.get("categoryId");
  const categoryId =
    categoryRaw === null || categoryRaw === "" ? null : Number(categoryRaw);
  const isForecastOnly = form.get("forecastOnly") === "1";
  const notes = String(form.get("notes") || "").trim() || null;

  if (!accountId) throw new Error("Account required");
  if (!merchantRaw) throw new Error("Name required");
  if (!recurringCadences.includes(cadence)) throw new Error("Invalid cadence");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new Error("Start date required");
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new Error("Invalid end date");

  const cents = parseDollarsToCents(amountStr);
  if (cents <= 0) throw new Error("Amount required");
  const amountCents = direction === "in" ? cents : -cents;

  return {
    accountId,
    merchantRaw,
    amountCents,
    cadence,
    daysOfMonth: parseDaysOfMonth(daysRaw, cadence),
    startDate,
    endDate,
    categoryId,
    isForecastOnly,
    notes,
  };
}

export async function createSchedule(form: FormData) {
  const values = scheduleFromForm(form);
  await db.insert(recurringSchedules).values({
    ...values,
    // A new schedule must never retro-create months of history: backfill
    // starts from today, not from startDate (which may be in the past to
    // anchor a biweekly rhythm).
    lastCreatedDate: new Date().toISOString().slice(0, 10),
  });
  revalidateAll();
}

export async function updateSchedule(form: FormData) {
  const id = Number(form.get("id"));
  if (!id) throw new Error("id required");
  const values = scheduleFromForm(form);
  await db
    .update(recurringSchedules)
    .set(values)
    .where(eq(recurringSchedules.id, id));
  revalidateAll();
}

export async function setScheduleActive(id: number, isActive: boolean) {
  await db
    .update(recurringSchedules)
    .set({ isActive })
    .where(eq(recurringSchedules.id, id));
  revalidateAll();
}

export async function deleteSchedule(id: number) {
  // Transactions the schedule already created stay — deleting a schedule
  // only stops future forecasting/creation.
  await db.delete(recurringSchedules).where(eq(recurringSchedules.id, id));
  revalidateAll();
}
