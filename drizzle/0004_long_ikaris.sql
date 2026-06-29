ALTER TABLE `category_rules` ADD `min_amount_cents` integer;--> statement-breakpoint
ALTER TABLE `category_rules` ADD `max_amount_cents` integer;--> statement-breakpoint
ALTER TABLE `transactions` ADD `reimbursable` integer DEFAULT false NOT NULL;