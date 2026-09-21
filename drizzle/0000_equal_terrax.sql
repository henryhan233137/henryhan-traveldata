CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`title` text NOT NULL,
	`snapshot` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trips_slug_unique` ON `trips` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_trips_owner_id` ON `trips` (`owner_id`);