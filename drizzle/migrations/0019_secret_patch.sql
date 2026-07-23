CREATE TABLE `promo_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`type` text DEFAULT 'percent' NOT NULL,
	`value` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promo_codes_code_unique` ON `promo_codes` (`code`);--> statement-breakpoint
ALTER TABLE `orders` ADD `promo_code` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `discount` real DEFAULT 0 NOT NULL;