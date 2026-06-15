CREATE TABLE `budget_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`framework` text DEFAULT 'custom' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
