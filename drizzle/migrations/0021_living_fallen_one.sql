ALTER TABLE `orders` ADD `payment_method` text DEFAULT 'cod' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_status` text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_ref` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `paid_at` text;