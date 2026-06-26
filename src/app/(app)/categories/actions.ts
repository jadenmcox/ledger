"use server";

import { db } from "@/db";
import { categories, classifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseDollarsToCents } from "@/lib/utils";

export async function createCategory(form: FormData) {
  const name = String(form.get("name") || "").trim();
  const classification = String(form.get("classification") || "want");
  const color = String(form.get("color") || "#d4a574");
  const limit = String(form.get("limit") || "");
  if (!name) throw new Error("Name required");
  if (!classifications.includes(classification as never))
    throw new Error("Invalid classification");
  await db.insert(categories).values({
    name,
    classification: classification as never,
    color,
    icon: "tag",
    monthlyLimitCents: limit ? parseDollarsToCents(limit) : null,
  });
  revalidatePath("/categories");
  revalidatePath("/dashboard");
}

export async function updateCategory(form: FormData) {
  const id = Number(form.get("id"));
  const name = String(form.get("name") || "").trim();
  const classification = String(form.get("classification") || "want");
  const color = String(form.get("color") || "#d4a574");
  const limit = String(form.get("limit") || "");
  if (!id) throw new Error("id required");
  await db
    .update(categories)
    .set({
      name,
      classification: classification as never,
      color,
      monthlyLimitCents: limit ? parseDollarsToCents(limit) : null,
    })
    .where(eq(categories.id, id));
  revalidatePath("/categories");
  revalidatePath("/dashboard");
}

export async function deleteCategory(id: number) {
  await db.delete(categories).where(eq(categories.id, id));
  revalidatePath("/categories");
  revalidatePath("/dashboard");
}
