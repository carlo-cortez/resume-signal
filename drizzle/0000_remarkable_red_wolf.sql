CREATE TABLE `job_descriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text,
	`title` text NOT NULL,
	`role_category` text NOT NULL,
	`raw_text` text NOT NULL,
	`keywords_json` text DEFAULT '[]' NOT NULL,
	`match_score` integer,
	`outcome` text DEFAULT 'applied' NOT NULL,
	`created_at` text NOT NULL
);
