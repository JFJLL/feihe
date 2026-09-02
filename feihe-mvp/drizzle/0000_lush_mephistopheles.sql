CREATE TABLE `comment_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` text NOT NULL,
	`captured_at` text NOT NULL,
	`l1_count` integer NOT NULL,
	`l2_count` integer NOT NULL,
	`total_count` integer NOT NULL,
	`positive_count` integer NOT NULL,
	`negative_count` integer NOT NULL,
	`question_count` integer NOT NULL,
	`irrelevant_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `key_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`parent_id` text,
	`content` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`created_at` text,
	`sentiment` text NOT NULL,
	`category` text NOT NULL,
	`action` text NOT NULL,
	`treatment_status` text DEFAULT '待处理' NOT NULL,
	`treatment_method` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`disappeared_at` text,
	`reply_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`source_type` text DEFAULT 'scan' NOT NULL,
	`pipeline` text DEFAULT 'value_scan' NOT NULL,
	`level` text DEFAULT 'P3' NOT NULL,
	`product_scope` text DEFAULT '本品' NOT NULL,
	`published_at` text,
	`last_fetched_at` text,
	`comment_total` integer DEFAULT 0 NOT NULL,
	`positive_count` integer DEFAULT 0 NOT NULL,
	`negative_count` integer DEFAULT 0 NOT NULL,
	`question_count` integer DEFAULT 0 NOT NULL,
	`brand_mention_top5` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT '待抓取' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`target_count` integer NOT NULL,
	`delivered_count` integer DEFAULT 0 NOT NULL,
	`budget` real DEFAULT 0 NOT NULL,
	`spent` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `supplier_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_key` text NOT NULL,
	`note_id` text NOT NULL,
	`note_url` text DEFAULT '' NOT NULL,
	`creator` text DEFAULT '' NOT NULL,
	`planned_content` text NOT NULL,
	`comment_format` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT '待核验' NOT NULL,
	`matched_content` text,
	`verified_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_comments_external_key_unique` ON `supplier_comments` (`external_key`);