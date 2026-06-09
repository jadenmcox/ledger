import "dotenv/config";
import Database from "better-sqlite3";
import { db } from "../src/db";
import {
  accounts,
  balanceSnapshots,
  categories,
  transactions,
  imports,
  categoryRules,
  recurringGroups,
} from "../src/db/schema";

async function check() {
  const [a, c, t, s] = await Promise.all([
    db.select().from(accounts),
    db.select().from(categories),
    db.select().from(transactions),
    db.select().from(balanceSnapshots),
  ]);
  console.log("REMOTE STATE:", {
    accounts: a.length,
    categories: c.length,
    transactions: t.length,
    snapshots: s.length,
  });
  return { a, c, t, s };
}

async function wipe() {
  await db.delete(transactions);
  await db.delete(balanceSnapshots);
  await db.delete(imports);
  await db.delete(categoryRules);
  await db.delete(recurringGroups);
  await db.delete(accounts);
  await db.delete(categories);
  console.log("WIPED");
}

type LocalCategory = {
  id: number;
  name: string;
  parent_id: number | null;
  color: string;
  icon: string;
  classification: "need" | "want" | "savings" | "income";
  monthly_limit_cents: number | null;
  is_system: number;
  is_archived: number;
  sort_order: number;
};
type LocalAccount = {
  id: number;
  name: string;
  type: string;
  institution: string | null;
  currency: string;
  current_balance_cents: number;
  is_active: number;
  created_at: number;
};
type LocalTx = {
  id: number;
  account_id: number;
  date: number;
  amount_cents: number;
  merchant_raw: string;
  merchant_clean: string | null;
  category_id: number | null;
  notes: string | null;
  source: "csv" | "teller" | "manual";
  external_id: string | null;
  dedupe_hash: string;
  is_recurring: number;
  recurring_group_id: number | null;
  is_pending: number;
  is_transfer: number;
  import_id: number | null;
  created_at: number;
};
type LocalSnap = {
  account_id: number;
  date: string;
  balance_cents: number;
};

async function sync() {
  const local = new Database("local.db", { readonly: true });
  const locCats = local.prepare("SELECT * FROM categories").all() as LocalCategory[];
  const locAccts = local.prepare("SELECT * FROM accounts").all() as LocalAccount[];
  const locTxs = local.prepare("SELECT * FROM transactions").all() as LocalTx[];
  const locSnaps = local.prepare("SELECT * FROM balance_snapshots").all() as LocalSnap[];

  console.log("LOCAL STATE:", {
    accounts: locAccts.length,
    categories: locCats.length,
    transactions: locTxs.length,
    snapshots: locSnaps.length,
  });

  await wipe();

  // Insert with explicit IDs so FKs line up.
  if (locCats.length) {
    await db.insert(categories).values(
      locCats.map((c) => ({
        id: c.id,
        name: c.name,
        parentId: c.parent_id,
        color: c.color,
        icon: c.icon,
        classification: c.classification,
        monthlyLimitCents: c.monthly_limit_cents,
        isSystem: Boolean(c.is_system),
        isArchived: Boolean(c.is_archived),
        sortOrder: c.sort_order,
      })),
    );
  }

  if (locAccts.length) {
    await db.insert(accounts).values(
      locAccts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type as never,
        institution: a.institution,
        currency: a.currency,
        currentBalanceCents: a.current_balance_cents,
        isActive: Boolean(a.is_active),
        createdAt: new Date(a.created_at * 1000),
      })),
    );
  }

  if (locSnaps.length) {
    await db.insert(balanceSnapshots).values(
      locSnaps.map((s) => ({
        accountId: s.account_id,
        date: s.date,
        balanceCents: s.balance_cents,
      })),
    );
  }

  if (locTxs.length) {
    await db.insert(transactions).values(
      locTxs.map((t) => ({
        id: t.id,
        accountId: t.account_id,
        date: new Date(t.date * 1000),
        amountCents: t.amount_cents,
        merchantRaw: t.merchant_raw,
        merchantClean: t.merchant_clean,
        categoryId: t.category_id,
        notes: t.notes,
        source: t.source,
        externalId: t.external_id,
        dedupeHash: t.dedupe_hash,
        isRecurring: Boolean(t.is_recurring),
        recurringGroupId: t.recurring_group_id,
        isPending: Boolean(t.is_pending),
        isTransfer: Boolean(t.is_transfer),
        importId: t.import_id,
        createdAt: new Date(t.created_at * 1000),
      })),
    );
  }

  console.log("SYNCED");
  await check();
}

const mode = process.argv[2];
(async () => {
  if (mode === "check") await check();
  else if (mode === "wipe") {
    await wipe();
    await check();
  } else if (mode === "sync") await sync();
  else {
    console.error("usage: tsx scripts/sync-to-prod.ts check|wipe|sync");
    process.exit(1);
  }
  process.exit(0);
})();
