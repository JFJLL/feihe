CREATE TABLE IF NOT EXISTS `note_covers` (
  `id` text PRIMARY KEY NOT NULL,
  `note_id` text NOT NULL,
  `project_id` text NOT NULL,
  `source_url` text DEFAULT '' NOT NULL,
  `r2_key` text DEFAULT '' NOT NULL,
  `content_type` text DEFAULT '' NOT NULL,
  `status` text DEFAULT '待抓取' NOT NULL,
  `fetched_at` text,
  `last_error` text DEFAULT '' NOT NULL,
  `updated_at` text NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_note_covers_project_status` ON `note_covers` (`project_id`,`status`);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_note_covers_project_note` ON `note_covers` (`project_id`,`note_id`);
