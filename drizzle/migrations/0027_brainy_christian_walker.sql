CREATE TABLE `rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text,
	`count` integer,
	`last_request` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_key_unique` ON `rate_limit` (`key`);