CREATE TABLE `reimbursable_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_type` text NOT NULL,
	`pattern` text NOT NULL,
	`max_amount_cents` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `budget_settings` ADD `expected_income_override_cents` integer;