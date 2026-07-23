CREATE TABLE `product_variations` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`weight` text NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`sale_price` real,
	`stock` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `products` ADD `type` text DEFAULT 'simple' NOT NULL;