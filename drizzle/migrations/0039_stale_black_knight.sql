CREATE TABLE `translations` (
	`locale` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`locale`, `key`)
);
