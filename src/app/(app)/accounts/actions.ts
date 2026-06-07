"use server";

import { db } from "@/db";
import { accounts, balanceSnapshots, accountTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { parseDollarsToCents } from "@/lib/utils";

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
