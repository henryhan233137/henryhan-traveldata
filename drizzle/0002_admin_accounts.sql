ALTER TABLE `app_users` ADD COLUMN `disabled` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `app_users` ADD COLUMN `last_login_at` text;
--> statement-breakpoint
CREATE TABLE `password_reset_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_password_reset_codes_user_id` ON `password_reset_codes` (`user_id`);
