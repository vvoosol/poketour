CREATE TABLE `game_events` (
	`user_id` text NOT NULL,
	`event_id` integer NOT NULL,
	`event` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `event_id`)
);
