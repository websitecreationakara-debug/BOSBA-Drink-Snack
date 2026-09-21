ALTER TABLE `social_posts` ADD `extra_note` text;--> statement-breakpoint
ALTER TABLE `social_posts` ADD `scheduled_for` text NOT NULL;--> statement-breakpoint
ALTER TABLE `social_posts` ADD `platforms` text;