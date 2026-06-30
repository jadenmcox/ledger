"use server";

import { db } from "@/db";
import { accounts, imports, transactions } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import {
  dedupeHash,
  mapRows,
  parseCsv,
  type ColumnMap,
} from "@/lib/csv-import";
import { applyRules, getRules, checkReimbursable, getReimbursableRules } from "@/lib/categorize";
import {
  applyMerchantRules,
  getMerchantRules,
} from "@/lib/merchant-rename";

export type ImportResult = {
  inserted: number;
  duplicates: number;
  totalRows: number;
  categorized: number;
};

export async function runImport(args: {
  accountId: number;
  csv: string;
  filename?: string;
  columns: ColumnMap;
  amountSign?: "as-is" | "flip";
}): Promise<ImportResult> {
  const { rows } = parseCsv(args.csv);
  const mapped = mapRows(rows, args.columns, {
    amountSign: args.amountSign ?? "as-is",
  });

  const acct = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, args.accountId));
  if (acct.length === 0) throw new Error("Account not found");

  const rules = await getRules();
  const reimbRules = await getReimbursableRules();
  const merchantRules = await getMerchantRules();

  const [importRow] = await db
    .insert(imports)
    .values({
      source: "csv",
      filename: args.filename ?? null,
      accountId: args.accountId,
      rowCount: mapped.length,
    })
    .returning();

  let inserted = 0;
  let duplicates = 0;
  let categorized = 0;

  for (const m of mapped) {
    const hash = dedupeHash(
      args.accountId,
      m.date,
      m.amountCents,
      m.merchantRaw,
    );
    const matchedCategoryId = applyRules(m.merchantRaw, rules, m.amountCents);
    try {
      await db.insert(transactions).values({
        accountId: args.accountId,
        date: m.date,
        amountCents: m.amountCents,
        merchantRaw: m.merchantRaw,
        merchantClean:
          applyMerchantRules(m.merchantRaw, merchantRules) ??
          cleanMerchant(m.merchantRaw),
        categoryId: matchedCategoryId,
        reimbursable: m.amountCents < 0 ? checkReimbursable(m.merchantRaw, reimbRules, m.amountCents) : false,
        source: "csv",
        dedupeHash: hash,
        importId: importRow.id,
      });
      inserted++;
      if (matchedCategoryId) categorized++;
    } catch (e: unknown) {
      // unique constraint = duplicate
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("UNIQUE") || msg.includes("unique")) {
        duplicates++;
      } else {
        throw e;
      }
    }
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");

  return {
    inserted,
    duplicates,
    totalRows: mapped.length,
    categorized,
  };
}

function cleanMerchant(raw: string) {
  return raw
    .replace(/\s{2,}/g, " ")
    .replace(/\b(POS|DEBIT|CREDIT|PURCHASE|PAYMENT)\b/gi, "")
    .replace(/\s+\d{6,}/g, "")
    .replace(/\s+#\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

