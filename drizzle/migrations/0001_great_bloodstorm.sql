CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`url` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text,
	`size` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_key_unique` ON `media` (`key`);