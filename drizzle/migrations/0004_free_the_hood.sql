CREATE TABLE `hero_slides` (
	`id` text PRIMARY KEY NOT NULL,
	`eyebrow` text,
	`title_top` text,
	`title_accent` text,
	`title_bottom` text,
	`body` text,
	`image_url` text,
	`cta_label` text,
	`cta_link` text DEFAULT '/shop' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
