CREATE TABLE `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_email` text,
	`role` text,
	`action` text,
	`detail` text,
	`ip_address` text,
	`country` text,
	`created_at` integer
);
