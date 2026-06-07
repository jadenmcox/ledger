import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const accountTypes = [
  "checking",
  "savings",
  "hys",
  "credit",
  "cash",
  "brokerage",
  "roth_ira",
  "traditional_401k",
  "hsa",
  "loan",
  "other",
] as const;
export type AccountType = (typeof accountTypes)[number];

export const classifications = ["need", "want", "savings", "income"] as const;
export type Classification = (typeof classifications)[number];

export const txSources = ["csv", "teller", "manual"] as const;
export type TxSource = (typeof txSources)[number];

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: accountTypes }).notNull(),
  institution: text("institution"),
  currency: text("currency").notNull().default("USD"),
  currentBalanceCents: integer("current_balance_cents").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    color: text("color").notNull().default("#6b7280"),
    icon: text("icon").notNull().default("tag"),
    classification: text("classification", { enum: classifications }).notNull(),
    monthlyLimitCents: integer("monthly_limit_cents"),
    isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
    isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("categories_name_unique").on(t.name)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    date: integer("date", { mode: "timestamp" }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    merchantRaw: text("merchant_raw").notNull(),
    merchantClean: text("merchant_clean"),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    source: text("source", { enum: txSources }).notNull(),
    externalId: text("external_id"),
    dedupeHash: text("dedupe_hash").notNull(),
    isRecurring: integer("is_recurring", { mode: "boolean" })
      .notNull()
      .default(false),
    recurringGroupId: integer("recurring_group_id"),
    isPending: integer("is_pending", { mode: "boolean" }).notNull().default(false),
    isTransfer: integer("is_transfer", { mode: "boolean" }).notNull().default(false),
    importId: integer("import_id").references(() => imports.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("transactions_dedupe_hash_unique").on(t.dedupeHash),
    index("transactions_date_idx").on(t.date),
    index("transactions_account_idx").on(t.accountId),
    index("transactions_category_idx").on(t.categoryId),
  ],
);

export const categoryRules = sqliteTable("category_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchType: text("match_type", {
    enum: ["merchant_contains", "merchant_exact", "regex"],
  }).notNull(),
  pattern: text("pattern").notNull(),
  categoryId: integer("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const recurringGroups = sqliteTable("recurring_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  merchantPattern: text("merchant_pattern").notNull(),
  expectedAmountCents: integer("expected_amount_cents").notNull(),
  cadence: text("cadence", {
    enum: ["weekly", "monthly", "yearly"],
  }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  lastSeen: integer("last_seen", { mode: "timestamp" }),
  nextExpected: integer("next_expected", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const imports = sqliteTable("imports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source", { enum: txSources }).notNull(),
  filename: text("filename"),
  accountId: integer("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  rowCount: integer("row_count").notNull().default(0),
  importedAt: integer("imported_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const balanceSnapshots = sqliteTable(
  "balance_snapshots",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    balanceCents: integer("balance_cents").notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.date] })],
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type CategoryRule = typeof categoryRules.$inferSelect;
export type NewCategoryRule = typeof categoryRules.$inferInsert;
