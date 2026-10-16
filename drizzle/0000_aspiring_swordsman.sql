CREATE TABLE `analytics_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day` text DEFAULT (date('now')) NOT NULL,
	`event_name` text NOT NULL,
	`section` text,
	`query` text,
	`result_count` integer,
	`asset_id` text,
	`variant` text,
	`color` text
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_events_day_event` ON `analytics_events` (`day`,`event_name`);--> statement-breakpoint
CREATE INDEX `idx_analytics_events_zero_query` ON `analytics_events` (`query`) WHERE "analytics_events"."event_name" = 'zero_result';