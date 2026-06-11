import "server-only";
import { db } from "@/db";
import {
  accounts,
  plaidItems,
  transactions,
  balanceSnapshots,
  type AccountType,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { plaid } from "./plaid";
import { applyRules, getRules } from "./categorize";
import { dedupeHash } from "./csv-import";
import { format } from "date-fns";
import crypto from "node:crypto";
import type {
  AccountBase,
  Transaction as PlaidTransaction,
  RemovedTransaction,
} from "plaid";

function mapAccountType(
  type: string | null | undefined,
  subtype: string | null | undefined,
): AccountType {
  switch (subtype) {
    case "checking":
      return "checking";
    case "savings":
      return "savings";
    case "money market":
    case "cd":
      return "savings";
    case "hsa":
      return "hsa";
    case "401k":
    case "401a":
    case "403B":
      return "traditional_401k";
    case "roth":
    case "roth ira":
      return "roth_ira";
  }
  switch (type) {
    case "depository":
      return "checking";
    case "credit":
      return "credit";
    case "loan":
      return "loan";
    case "investment":
      return "brokerage";
    default:
      return "other";
  }
}

export async function upsertAccountsForItem(
  itemRowId: number,
  institutionName: string | null,
  plaidAccounts: AccountBase[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const pa of plaidAccounts) {
    const existing = await db
      .select()
      .from(accounts)
      .where(eq(accounts.plaidAccountId, pa.account_id))
      .limit(1);

    const balance = Math.round(
      ((pa.balances.current ?? pa.balances.available ?? 0) as number) * 100,
    );
    // Credit & loan balances from Plaid are positive when you owe money.
    // Our convention: debt accounts store balances as negative.
    const type = mapAccountType(pa.type, pa.subtype);
    const signed =
      type === "credit" || type === "loan" ? -Math.abs(balance) : balance;

    if (existing[0]) {
      await db
        .update(accounts)
        .set({
          currentBalanceCents: signed,
          institution: institutionName ?? existing[0].institution,
          plaidItemId: itemRowId,
        })
        .where(eq(accounts.id, existing[0].id));
      map.set(pa.account_id, existing[0].id);
    } else {
      const [row] = await db
        .insert(accounts)
        .values({
          name: pa.name || pa.official_name || "Account",
          type,
          institution: institutionName,
          currentBalanceCents: signed,
          plaidItemId: itemRowId,
          plaidAccountId: pa.account_id,
        })
        .returning();
      map.set(pa.account_id, row.id);
    }

    await db
      .insert(balanceSnapshots)
      .values({
        accountId: map.get(pa.account_id)!,
        date: format(new Date(), "yyyy-MM-dd"),
        balanceCents: signed,
      })
      .onConflictDoUpdate({
        target: [balanceSnapshots.accountId, balanceSnapshots.date],
        set: { balanceCents: signed },
      });
  }
  return map;
}

function plaidAmountToCents(amount: number, accountType: AccountType): number {
  // Plaid: positive = money leaving the account (debit).
  // Our convention: positive = inflow (credit to account), negative = outflow.
  // For credit cards: a charge in Plaid is positive; we still store it negative
  // because it reduces your net worth.
  const cents = Math.round(amount * 100);
  return -cents;
  void accountType;
}

async function findExistingByExternalId(externalId: string) {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.externalId, externalId))
    .limit(1);
  return rows[0];
}

async function findExistingByHash(hash: string) {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.dedupeHash, hash))
    .limit(1);
  return rows[0];
}

export async function applyTransactionsDelta(
  itemRowId: number,
  accountMap: Map<string, number>,
  added: PlaidTransaction[],
  modified: PlaidTransaction[],
  removed: RemovedTransaction[],
) {
  const rules = await getRules();

  for (const t of added) {
    const accountId = accountMap.get(t.account_id);
    if (!accountId) continue;
    const date = new Date(t.date);
    // Account type for sign handling
    const [acct] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    const cents = plaidAmountToCents(t.amount ?? 0, acct?.type ?? "other");
    const merchant = t.merchant_name || t.name || "Unknown";

    // Dedupe: prefer existing Plaid row by transaction_id, otherwise
    // match an existing CSV/manual row by (account, date, amount) — the
    // same hash the CSV importer uses — and upgrade it to plaid source.
    const existingByExt = await findExistingByExternalId(t.transaction_id);
    if (existingByExt) {
      await db
        .update(transactions)
        .set({
          amountCents: cents,
          merchantRaw: merchant,
          date,
          isPending: !!t.pending,
        })
        .where(eq(transactions.id, existingByExt.id));
      continue;
    }

    const hash = dedupeHash(accountId, date, cents, merchant);
    const existingByHash = await findExistingByHash(hash);
    const categoryId = applyRules(merchant, rules);

    if (existingByHash) {
      await db
        .update(transactions)
        .set({
          externalId: t.transaction_id,
          source: "plaid",
          merchantRaw: merchant,
          isPending: !!t.pending,
        })
        .where(eq(transactions.id, existingByHash.id));
      continue;
    }

    await db
      .insert(transactions)
      .values({
        accountId,
        date,
        amountCents: cents,
        merchantRaw: merchant,
        categoryId,
        source: "plaid",
        externalId: t.transaction_id,
        dedupeHash: hash,
        isPending: !!t.pending,
      })
      .onConflictDoNothing();

    void itemRowId;
  }

  for (const t of modified) {
    const existing = await findExistingByExternalId(t.transaction_id);
    if (!existing) continue;
    const date = new Date(t.date);
    const [acct] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, existing.accountId))
      .limit(1);
    const cents = plaidAmountToCents(t.amount ?? 0, acct?.type ?? "other");
    const merchant = t.merchant_name || t.name || existing.merchantRaw;
    await db
      .update(transactions)
      .set({
        date,
        amountCents: cents,
        merchantRaw: merchant,
        isPending: !!t.pending,
      })
      .where(eq(transactions.id, existing.id));
  }

  for (const t of removed) {
    if (!t.transaction_id) continue;
    const existing = await findExistingByExternalId(t.transaction_id);
    if (existing) {
      await db.delete(transactions).where(eq(transactions.id, existing.id));
    }
  }
}

export async function syncItem(itemRowId: number) {
  const [item] = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.id, itemRowId))
    .limit(1);
  if (!item) throw new Error("plaid item not found");

  // Refresh accounts + balances
  const acctRes = await plaid.accountsGet({ access_token: item.accessToken });
  const accountMap = await upsertAccountsForItem(
    itemRowId,
    item.institutionName,
    acctRes.data.accounts,
  );

  // Paginate through /transactions/sync
  let cursor = item.cursor ?? undefined;
  let hasMore = true;
  let totalAdded = 0;
  let totalModified = 0;
  let totalRemoved = 0;

  while (hasMore) {
    const res = await plaid.transactionsSync({
      access_token: item.accessToken,
      cursor,
      count: 500,
    });
    const { added, modified, removed, next_cursor, has_more } = res.data;
    await applyTransactionsDelta(
      itemRowId,
      accountMap,
      added,
      modified,
      removed,
    );
    totalAdded += added.length;
    totalModified += modified.length;
    totalRemoved += removed.length;
    cursor = next_cursor;
    hasMore = has_more;
  }

  await db
    .update(plaidItems)
    .set({
      cursor,
      lastSyncedAt: new Date(),
      lastError: null,
    })
    .where(eq(plaidItems.id, itemRowId));

  return { added: totalAdded, modified: totalModified, removed: totalRemoved };
}

export async function syncAllItems() {
  const items = await db.select().from(plaidItems);
  const results: Array<{
    itemId: number;
    added: number;
    modified: number;
    removed: number;
    error?: string;
  }> = [];
  for (const it of items) {
    try {
      const r = await syncItem(it.id);
      results.push({ itemId: it.id, ...r });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db
        .update(plaidItems)
        .set({ lastError: msg })
        .where(eq(plaidItems.id, it.id));
      results.push({
        itemId: it.id,
        added: 0,
        modified: 0,
        removed: 0,
        error: msg,
      });
    }
  }
  return results;
}

// Silences unused-import warning when nothing else references crypto.
void crypto;
void and;
