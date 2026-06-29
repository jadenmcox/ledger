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

export const txSources = ["csv", "teller", "manual", "plaid"] as const;
export type TxSource = (typeof txSources)[number];

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type", { enum: accountTypes }).notNull(),
  institution: text("institution"),
  currency: text("currency").notNull().default("USD"),
  currentBalanceCents: integer("current_balance_cents").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  plaidItemId: integer("plaid_item_id"),
  plaidAccountId: text("plaid_account_id"),
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
    // Set when a human picks the category by hand. Locked rows are never
    // overwritten by rule re-application or Plaid re-sync, so a manual
    // override (e.g. one Costco run categorized as Transportation for gas)
    // sticks even when a broader merchant rule exists.
    categoryLocked: integer("category_locked", { mode: "boolean" })
      .notNull()
      .default(false),
    // A charge you expect to be paid back for (a reimbursed work lunch) or the
    // incoming reimbursement itself. Reimbursable outflows are kept out of
    // "spent" and reimbursable inflows out of "income", so the pair nets to
    // zero instead of inflating both sides of the budget.
    reimbursable: integer("reimbursable", { mode: "boolean" })
      .notNull()
      .default(false),
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
  // Optional amount condition (on the absolute value, in cents). Lets a rule
  // be narrowed by size, e.g. "Costco under $50 -> Transportation" alongside a
  // broader "Costco -> Groceries". Null bounds mean unbounded on that side.
  minAmountCents: integer("min_amount_cents"),
  maxAmountCents: integer("max_amount_cents"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const merchantRules = sqliteTable("merchant_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  matchType: text("match_type", {
    enum: ["merchant_contains", "merchant_exact", "regex"],
  }).notNull(),
  pattern: text("pattern").notNull(),
  cleanName: text("clean_name").notNull(),
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

// User-defined recurring transaction schedules (vs. recurringGroups which
// represents auto-DETECTED patterns from transaction history).
export const recurringCadences = [
  "monthly",
  "semi_monthly", // 1st & 16th, or any two days
  "weekly",
  "biweekly",
] as const;
export type RecurringCadence = (typeof recurringCadences)[number];

export const recurringSchedules = sqliteTable("recurring_schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(), // signed: + income, - expense
  merchantRaw: text("merchant_raw").notNull(),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  cadence: text("cadence", { enum: recurringCadences }).notNull(),
  // For monthly/semi_monthly: JSON array of day-of-month, e.g. "[1, 16]"
  // For weekly/biweekly: ignored (uses startDate as anchor)
  daysOfMonth: text("days_of_month"),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date"), // YYYY-MM-DD, optional
  lastCreatedDate: text("last_created_date"), // YYYY-MM-DD, set as backfill runs
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type CategoryRule = typeof categoryRules.$inferSelect;
export type NewCategoryRule = typeof categoryRules.$inferInsert;
export type MerchantRule = typeof merchantRules.$inferSelect;
export type NewMerchantRule = typeof merchantRules.$inferInsert;
export type RecurringSchedule = typeof recurringSchedules.$inferSelect;
export type NewRecurringSchedule = typeof recurringSchedules.$inferInsert;

export const plaidItems = sqliteTable("plaid_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itemId: text("item_id").notNull().unique(),
  accessToken: text("access_token").notNull(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  cursor: text("cursor"),
  lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type PlaidItem = typeof plaidItems.$inferSelect;
export type NewPlaidItem = typeof plaidItems.$inferInsert;

export const budgetFrameworks = ["50_30_20", "zero_based", "custom"] as const;
export type BudgetFramework = (typeof budgetFrameworks)[number];

export const budgetSettings = sqliteTable("budget_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  framework: text("framework", { enum: budgetFrameworks })
    .notNull()
    .default("custom"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type BudgetSettings = typeof budgetSettings.$inferSelect;

export const savingsGoals = sqliteTable("savings_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  // Optional linked account whose balance is the goal's "current" amount.
  // If null, the user enters currentBalanceCents manually.
  accountId: integer("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  // Target by end of calendar year, in cents.
  yearEndTargetCents: integer("year_end_target_cents").notNull().default(0),
  // Planned per-month contribution, in cents. Used to grade "did I hit my plan."
  monthlyTargetCents: integer("monthly_target_cents").notNull().default(0),
  // Manual balance when no account is linked. Ignored when accountId is set.
  manualBalanceCents: integer("manual_balance_cents").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: integer("is_archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;
