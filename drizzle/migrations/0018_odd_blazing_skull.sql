PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_product_variations` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`weight` text NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`sale_price` real,
	`stock` integer,
	`pcs` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_product_variations`("id", "product_id", "weight", "price", "sale_price", "stock", "pcs", "sort_order", "created_at") SELECT "id", "product_id", "weight", "price", "sale_price", "stock", "pcs", "sort_order", "created_at" FROM `product_variations`;--> statement-breakpoint
DROP TABLE `product_variations`;--> statement-breakpoint
ALTER TABLE `__new_product_variations` RENAME TO `product_variations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`price` real DEFAULT 0 NOT NULL,
	`sale_price` real,
	`category_id` text,
	`stock` integer,
	`status` text DEFAULT 'published' NOT NULL,
	`image_url` text,
	`badge` text,
	`rating` real DEFAULT 4.5,
	`weight` text,
	`pcs` integer,
	`type` text DEFAULT 'simple' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`promotion_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "title", "description", "price", "sale_price", "category_id", "stock", "status", "image_url", "badge", "rating", "weight", "pcs", "type", "sort_order", "promotion_id", "created_at", "updated_at") SELECT "id", "title", "description", "price", "sale_price", "category_id", "stock", "status", "image_url", "badge", "rating", "weight", "pcs", "type", "sort_order", "promotion_id", "created_at", "updated_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
UPDATE `products` SET `stock` = NULL WHERE `stock` = 0;--> statement-breakpoint
UPDATE `product_variations` SET `stock` = NULL WHERE `stock` = 0;