import "server-only";
import { db } from "@/db";
import {
  accounts,
  categories,
  plaidItems,
  transactions,
  balanceSnapshots,
  type AccountType,
  type Category,
} from "@/db/schema";
import { eq, and, gte, inArray, isNotNull } from "drizzle-orm";
import { plaid } from "./plaid";
import { applyRules, getRules, checkReimbursable, getReimbursableRules } from "./categorize";
import {
  applyMerchantRules,
  getMerchantRules,
} from "./merchant-rename";
import type { CategoryRule } from "@/db/schema";

function pickCategory(
  merchant: string,
  pfc: { primary?: string | null; detailed?: string | null } | null | undefined,
  rules: CategoryRule[],
  userCategories: Category[],
  amountCents?: number | null,
): number | null {
  return (
    applyRules(merchant, rules, amountCents) ??
    mapPlaidDetailed(pfc?.detailed, userCategories) ??
    mapPlaidCategory(pfc?.primary, userCategories)
  );
}
import { dedupeHash } from "./csv-import";
import { format } from "date-fns";
import crypto from "node:crypto";
import type {
  AccountBase,
  Transaction as PlaidTransaction,
  RemovedTransaction,
} from "plaid";

// The day you made the purchase. Plaid's `date` is the day the bank posted a
// charge, usually a day or two after you swiped the card, so a Thursday lunch
// would show on Friday and disagree with your card statement and with Ramp.
// `authorized_date` is the purchase day; deposits and older rows may not have
// one, and then the posted day is the best there is.
//
// Plaid gives a plain YYYY-MM-DD. Anchor it to noon UTC so the calendar day
// survives display in any (esp. US, UTC-negative) timezone. Bare
// new Date("YYYY-MM-DD") is midnight UTC, which renders as the prior day.
function purchaseDay(t: Pick<PlaidTransaction, "date" | "authorized_date">): Date {
  return new Date((t.authorized_date ?? t.date) + "T12:00:00Z");
}

// Plaid's `personal_finance_category.primary` enum → keywords we look for in
// the user's own category names. First hit wins. Keeps the mapping decoupled
// from any specific user setup — if you renamed "Groceries" to "Food" both
// still match.
const PLAID_CATEGORY_HINTS: Record<string, string[]> = {
  INCOME: ["income", "salary", "paycheck", "wage"],
  TRANSFER_IN: ["transfer"],
  TRANSFER_OUT: [
    "brokerage",
    "investment",
    "retirement",
    "roth",
    "ira",
    "401",
    "hsa",
    "savings",
    "transfer",
  ],
  LOAN_PAYMENTS: ["loan", "mortgage", "debt", "student"],
  BANK_FEES: ["fee", "bank"],
  ENTERTAINMENT: ["entertainment", "fun", "subscription", "streaming"],
  FOOD_AND_DRINK: ["grocer", "food", "dining", "restaurant", "drink", "coffee"],
  GENERAL_MERCHANDISE: ["shop", "merchandise", "amazon"],
  HOME_IMPROVEMENT: ["home", "improvement", "furniture"],
  MEDICAL: ["medical", "health", "doctor", "pharmacy"],
  PERSONAL_CARE: ["personal", "care", "beauty", "hair"],
  GENERAL_SERVICES: ["service"],
  GOVERNMENT_AND_NON_PROFIT: ["tax", "government", "donation", "charity"],
  TRANSPORTATION: ["transport", "gas", "fuel", "uber", "lyft", "car", "parking"],
  TRAVEL: ["travel", "flight", "hotel", "airbnb", "rental"],
  RENT_AND_UTILITIES: [
    "rent",
    "utilit",
    "internet",
    "phone",
    "electric",
    "water",
    "gas bill",
  ],
};

function mapPlaidCategory(
  plaidPrimary: string | null | undefined,
  userCategories: Category[],
): number | null {
  if (!plaidPrimary) return null;
  const hints = PLAID_CATEGORY_HINTS[plaidPrimary];
  if (!hints) return null;
  for (const hint of hints) {
    const match = userCategories.find((c) =>
      c.name.toLowerCase().includes(hint),
    );
    if (match) return match.id;
  }
  return null;
}

// Plaid's `personal_finance_category.detailed` is much more specific than
// `primary` — e.g. it tells us a TRANSFER_OUT is specifically going to an
// investment/retirement account vs. just "some transfer". When present and
// matched, this takes precedence over the primary mapping.
const PLAID_DETAILED_HINTS: Record<string, string[]> = {
  TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS: [
    "brokerage",
    "investment",
    "retirement",
    "roth",
    "ira",
    "401",
  ],
  TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS: [
    "brokerage",
    "investment",
    "retirement",
    "roth",
    "ira",
    "401",
  ],
  TRANSFER_OUT_SAVINGS: ["emergency", "savings"],
  TRANSFER_IN_SAVINGS: ["emergency", "savings"],
  TRANSFER_OUT_HEALTH_SAVINGS_ACCOUNT: ["hsa", "health"],
  TRANSFER_IN_HEALTH_SAVINGS_ACCOUNT: ["hsa", "health"],
};

function mapPlaidDetailed(
  plaidDetailed: string | null | undefined,
  userCategories: Category[],
): number | null {
  if (!plaidDetailed) return null;
  const hints = PLAID_DETAILED_HINTS[plaidDetailed];
  if (!hints) return null;
  for (const hint of hints) {
    const match = userCategories.find((c) =>
      c.name.toLowerCase().includes(hint),
    );
    if (match) return match.id;
  }
  return null;
}

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
): Promise<{ backfilled: number }> {
  const rules = await getRules();
  const reimbRules = await getReimbursableRules();
  const renameRules = await getMerchantRules();
  const userCategories = await db.select().from(categories);
  let backfilled = 0;

  for (const t of added) {
    const accountId = accountMap.get(t.account_id);
    if (!accountId) continue;
    const date = purchaseDay(t);
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
    // The same Plaid transaction, or the pending version this posted one
    // replaces (keeps its category, splits and payback links).
    const existingByExt =
      (await findExistingByExternalId(t.transaction_id)) ??
      (t.pending_transaction_id
        ? await findExistingByExternalId(t.pending_transaction_id)
        : undefined);
    if (existingByExt) {
      // Backfill the category if the existing row is still uncategorized —
      // a rule or Plaid PFC hint may now resolve to something.
      const backfilledCategoryId =
        existingByExt.categoryId ??
        pickCategory(
          merchant,
          t.personal_finance_category,
          rules,
          userCategories,
          cents,
        );
      if (!existingByExt.categoryId && backfilledCategoryId) backfilled++;
      await db
        .update(transactions)
        .set({
          amountCents: cents,
          merchantRaw: merchant,
          merchantClean:
            existingByExt.merchantClean ??
            applyMerchantRules(merchant, renameRules),
          date,
          isPending: !!t.pending,
          categoryId: backfilledCategoryId,
          externalId: t.transaction_id,
        })
        .where(eq(transactions.id, existingByExt.id));
      continue;
    }

    const hash = dedupeHash(accountId, date, cents, merchant);
    const existingByHash = await findExistingByHash(hash);
    const categoryId = pickCategory(
      merchant,
      t.personal_finance_category,
      rules,
      userCategories,
      cents,
    );

    // A CSV or hand-entered row for the same account, day and amount is this
    // transaction arriving from the bank: upgrade it. A row that already has
    // its own Plaid id is a different transaction that happens to match, like
    // two $14.34 reimbursements paid the same day, so it gets its own row.
    if (existingByHash && !existingByHash.externalId) {
      if (!existingByHash.categoryId && categoryId) backfilled++;
      await db
        .update(transactions)
        .set({
          externalId: t.transaction_id,
          source: "plaid",
          merchantRaw: merchant,
          merchantClean:
            existingByHash.merchantClean ??
            applyMerchantRules(merchant, renameRules),
          isPending: !!t.pending,
          categoryId: existingByHash.categoryId ?? categoryId,
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
        merchantClean: applyMerchantRules(merchant, renameRules),
        categoryId,
        reimbursable: cents < 0 ? checkReimbursable(merchant, reimbRules, cents) : false,
        source: "plaid",
        externalId: t.transaction_id,
        dedupeHash: existingByHash ? `${hash}:${t.transaction_id}` : hash,
        isPending: !!t.pending,
      })
      .onConflictDoNothing();

    void itemRowId;
  }

  for (const t of modified) {
    const existing = await findExistingByExternalId(t.transaction_id);
    if (!existing) continue;
    const date = purchaseDay(t);
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

  return { backfilled };
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
  let totalBackfilled = 0;

  while (hasMore) {
    const res = await plaid.transactionsSync({
      access_token: item.accessToken,
      cursor,
      count: 500,
    });
    const { added, modified, removed, next_cursor, has_more } = res.data;
    const { backfilled } = await applyTransactionsDelta(
      itemRowId,
      accountMap,
      added,
      modified,
      removed,
    );
    totalAdded += added.length;
    totalModified += modified.length;
    totalRemoved += removed.length;
    totalBackfilled += backfilled;
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

  return {
    added: totalAdded,
    modified: totalModified,
    removed: totalRemoved,
    backfilled: totalBackfilled,
  };
}

/**
 * Forces a full re-sync of every Plaid item by resetting their cursors.
 * applyTransactionsDelta backfills categoryId on already-imported rows that
 * are still uncategorized, so this is the path that "fixes" a batch of
 * uncategorized transactions after a user has added rules or after the
 * Plaid PFC → user-category mapping changes.
 */
export async function recategorizeAllFromPlaid() {
  await db.update(plaidItems).set({ cursor: null });
  return syncAllItems();
}

export type SyncItemResult = {
  itemId: number;
  added: number;
  modified: number;
  removed: number;
  backfilled: number;
  error?: string;
};

export async function syncAllItems(): Promise<SyncItemResult[]> {
  const items = await db.select().from(plaidItems);
  const results: SyncItemResult[] = [];
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
        backfilled: 0,
        error: msg,
      });
    }
  }
  return results;
}

// Silences unused-import warning when nothing else references crypto.
void crypto;
void and;


// Before the fix above, a second Plaid transaction with the same account, day
// and amount as one already stored was merged into it and never saved (two
// $14.34 FieldPulse reimbursements paid on Sep 17 became one). This replays the
// bank's full history and adds back only those merged-away transactions: an
// id we don't have, whose account/day/amount row already belongs to another
// Plaid id. Nothing else changes, rows you deleted stay deleted, and the
// item's sync cursor is left alone.
export async function recoverMergedTransactions(itemRowId: number): Promise<{
  restored: { date: string; amountCents: number; merchant: string }[];
}> {
  const [item] = await db
    .select()
    .from(plaidItems)
    .where(eq(plaidItems.id, itemRowId))
    .limit(1);
  if (!item) throw new Error("plaid item not found");

  const acctRes = await plaid.accountsGet({ access_token: item.accessToken });
  const accountMap = new Map<string, number>();
  for (const a of acctRes.data.accounts) {
    const [row] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.plaidAccountId, a.account_id))
      .limit(1);
    if (row) accountMap.set(a.account_id, row.id);
  }

  const rules = await getRules();
  const reimbRules = await getReimbursableRules();
  const renameRules = await getMerchantRules();
  const userCategories = await db.select().from(categories);
  const restored: { date: string; amountCents: number; merchant: string }[] = [];

  let cursor: string | undefined = undefined;
  let hasMore = true;
  while (hasMore) {
    const res = await plaid.transactionsSync({
      access_token: item.accessToken,
      cursor,
      count: 500,
    });
    for (const t of res.data.added) {
      if (t.pending) continue;
      const accountId = accountMap.get(t.account_id);
      if (!accountId) continue;
      if (await findExistingByExternalId(t.transaction_id)) continue;
      const date = purchaseDay(t);
      const cents = plaidAmountToCents(t.amount ?? 0, "other");
      const merchant = t.merchant_name || t.name || "Unknown";
      const hash = dedupeHash(accountId, date, cents, merchant);
      const twin = await findExistingByHash(hash);
      // A pending twin is this same transaction before it posted (the next
      // sync swaps it over), not a second one that got merged away.
      if (!twin || !twin.externalId || twin.isPending || twin.accountId !== accountId) continue;
      await db
        .insert(transactions)
        .values({
          accountId,
          date,
          amountCents: cents,
          merchantRaw: merchant,
          merchantClean: applyMerchantRules(merchant, renameRules),
          categoryId: pickCategory(merchant, t.personal_finance_category, rules, userCategories, cents),
          reimbursable: cents < 0 ? checkReimbursable(merchant, reimbRules, cents) : false,
          source: "plaid",
          externalId: t.transaction_id,
          dedupeHash: `${hash}:${t.transaction_id}`,
          isPending: false,
        })
        .onConflictDoNothing();
      restored.push({ date: t.date, amountCents: cents, merchant });
    }
    cursor = res.data.next_cursor;
    hasMore = res.data.has_more;
  }
  return { restored };
}

// Recovery across every linked bank. One bank failing doesn't stop the rest.
export async function recoverAllMergedTransactions(): Promise<{
  restored: { date: string; amountCents: number; merchant: string }[];
  errors: string[];
}> {
  const items = await db.select().from(plaidItems);
  const restored: { date: string; amountCents: number; merchant: string }[] = [];
  const errors: string[] = [];
  for (const it of items) {
    try {
      restored.push(...(await recoverMergedTransactions(it.id)).restored);
    } catch (e) {
      errors.push(`${it.institutionName ?? "A bank"}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { restored, errors };
}

export type DateFix = {
  id: number;
  merchant: string;
  amountCents: number;
  from: string;
  to: string;
};

// Rows saved before Budgetly used purchase dates carry the day the bank
// posted them. This replays each bank's history and moves every stored bank
// row onto its purchase day (see purchaseDay). Only the date changes. With
// `apply` false it just lists what would move.
export async function realignPurchaseDates(
  apply: boolean,
): Promise<{ checked: number; moved: DateFix[] }> {
  const stored = await db
    .select({
      id: transactions.id,
      externalId: transactions.externalId,
      date: transactions.date,
      amountCents: transactions.amountCents,
      merchantRaw: transactions.merchantRaw,
      merchantClean: transactions.merchantClean,
    })
    .from(transactions)
    .where(isNotNull(transactions.externalId));
  const byExternalId = new Map(stored.map((r) => [r.externalId!, r]));
  const dayOf = (d: Date) => d.toISOString().slice(0, 10);

  const items = await db.select().from(plaidItems);
  const moved: DateFix[] = [];
  const updates: Date[] = [];
  let checked = 0;
  for (const item of items) {
    let cursor: string | undefined = undefined;
    let hasMore = true;
    while (hasMore) {
      const res = await plaid.transactionsSync({
        access_token: item.accessToken,
        cursor,
        count: 500,
      });
      for (const t of res.data.added) {
        const row = byExternalId.get(t.transaction_id);
        if (!row) continue;
        checked++;
        const day = purchaseDay(t);
        if (dayOf(row.date) === dayOf(day)) continue;
        moved.push({
          id: row.id,
          merchant: row.merchantClean || row.merchantRaw,
          amountCents: row.amountCents,
          from: dayOf(row.date),
          to: dayOf(day),
        });
        updates.push(day);
      }
      cursor = res.data.next_cursor;
      hasMore = res.data.has_more;
    }
  }

  if (apply) {
    const statements = moved.map((m, i) =>
      db.update(transactions).set({ date: updates[i] }).where(eq(transactions.id, m.id)),
    );
    for (let i = 0; i < statements.length; i += 100) {
      const chunk = statements.slice(i, i + 100);
      if (chunk.length) await db.batch(chunk as [typeof chunk[0], ...typeof chunk]);
    }
  }
  return { checked, moved };
}

export type BankGap = {
  bank: string;
  date: string;
  amountCents: number;
  name: string;
  why: string;
};

export type BankExtra = {
  id: number;
  date: string;
  amountCents: number;
  merchant: string;
  isPending: boolean;
  externalId: string;
};

// Read only. Replays each bank's full history and lists every posted
// transaction the bank has that Budgetly doesn't, with a guess at why (a
// same-day twin, or a row whose stored hash no longer matches its date).
// Nothing is written.
//
// Also lists the reverse: rows Budgetly got from the bank whose bank id the
// bank no longer has (within the history it still returns), like a pending
// charge that posted under a new id but stayed behind as a second copy.
export async function findBankGaps(): Promise<{
  checked: number;
  gaps: BankGap[];
  extras: BankExtra[];
}> {
  const items = await db.select().from(plaidItems);
  const gaps: BankGap[] = [];
  const extras: BankExtra[] = [];
  let checked = 0;
  for (const item of items) {
    const acctRes = await plaid.accountsGet({ access_token: item.accessToken });
    const accountMap = new Map<string, number>();
    for (const a of acctRes.data.accounts) {
      const [row] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.plaidAccountId, a.account_id))
        .limit(1);
      if (row) accountMap.set(a.account_id, row.id);
    }
    const bankIds = new Set<string>();
    let earliest = "9999-12-31";
    let cursor: string | undefined = undefined;
    let hasMore = true;
    while (hasMore) {
      const res = await plaid.transactionsSync({
        access_token: item.accessToken,
        cursor,
        count: 500,
      });
      for (const t of res.data.added) {
        bankIds.add(t.transaction_id);
        if (t.date < earliest) earliest = t.date;
        if (t.pending) continue;
        checked++;
        if (await findExistingByExternalId(t.transaction_id)) continue;
        const accountId = accountMap.get(t.account_id);
        const cents = plaidAmountToCents(t.amount ?? 0, "other");
        let why = "no account in Budgetly";
        if (accountId) {
          const date = purchaseDay(t);
          const twin = await findExistingByHash(dedupeHash(accountId, date, cents, ""));
          why = twin
            ? `same-day twin #${twin.id} (${twin.externalId ? "bank id" : "no bank id"}, ${twin.source})`
            : "no same-day twin";
        }
        gaps.push({
          bank: item.institutionName ?? "bank",
          date: t.date,
          amountCents: cents,
          name: `${t.merchant_name ?? ""} / ${t.name ?? ""}`,
          why,
        });
      }
      cursor = res.data.next_cursor;
      hasMore = res.data.has_more;
    }

    const accountIds = [...accountMap.values()];
    if (accountIds.length === 0) continue;
    const stored = await db
      .select()
      .from(transactions)
      .where(
        and(
          inArray(transactions.accountId, accountIds),
          gte(transactions.date, new Date(earliest + "T00:00:00Z")),
        ),
      );
    for (const r of stored) {
      if (!r.externalId || bankIds.has(r.externalId)) continue;
      extras.push({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        amountCents: r.amountCents,
        merchant: r.merchantClean || r.merchantRaw,
        isPending: r.isPending,
        externalId: r.externalId,
      });
    }
  }
  return { checked, gaps, extras };
}
