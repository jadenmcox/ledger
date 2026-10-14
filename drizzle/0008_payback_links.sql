CREATE TABLE `payback_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`payback_id` integer NOT NULL,
	`charge_id` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`payback_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`charge_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `payback_links_payback_idx` ON `payback_links` (`payback_id`);--> statement-breakpoint
CREATE INDEX `payback_links_charge_idx` ON `payback_links` (`charge_id`);