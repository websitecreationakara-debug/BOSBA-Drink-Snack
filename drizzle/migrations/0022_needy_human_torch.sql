CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text,
	`recipient_name` text,
	`phone` text,
	`address` text NOT NULL,
	`city` text,
	`location_lat` real,
	`location_lng` real,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
