ALTER TABLE `products` ADD `product_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `products_product_code_unique` ON `products` (`product_code`);