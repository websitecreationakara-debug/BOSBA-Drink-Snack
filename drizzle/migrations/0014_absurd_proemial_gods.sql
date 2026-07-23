PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`customer_name` text,
	`customer_email` text,
	`customer_phone` text,
	`location_lat` real,
	`location_lng` real,
	`address` text,
	`city` text,
	`postal_code` text,
	`items` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total` real NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "user_id", "customer_name", "customer_email", "customer_phone", "location_lat", "location_lng", "address", "city", "postal_code", "items", "status", "total", "created_at") SELECT "id", "user_id", "customer_name", "customer_email", "customer_phone", "location_lat", "location_lng", "address", "city", "postal_code", "items", "status", "total", "created_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
PRAGMA foreign_keys=ON;