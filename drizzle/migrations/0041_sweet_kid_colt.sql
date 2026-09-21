CREATE TABLE `social_post_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`platform` text NOT NULL,
	`status` text NOT NULL,
	`remote_post_id` text,
	`error` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`product_title` text NOT NULL,
	`image_url` text,
	`caption` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`published_at` text
);
--> statement-breakpoint
CREATE TABLE `social_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`facebook_page_id` text,
	`facebook_page_access_token` text,
	`instagram_business_account_id` text,
	`telegram_bot_token` text,
	`telegram_channel_id` text,
	`tiktok_access_token` text,
	`tiktok_post_visibility` text DEFAULT 'private' NOT NULL,
	`updated_at` text NOT NULL
);
