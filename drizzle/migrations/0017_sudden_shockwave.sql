CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'special' NOT NULL,
	`description` text,
	`discount_pct` real,
	`starts_at` text,
	`ends_at` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `products` ADD `promotion_id` text REFERENCES promotions(id);