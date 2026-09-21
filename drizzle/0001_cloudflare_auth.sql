CREATE TABLE IF NOT EXISTS `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `app_users_email_unique` ON `app_users` (`email`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auth_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_auth_sessions_user_id` ON `auth_sessions` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_auth_sessions_expires_at` ON `auth_sessions` (`expires_at`);
