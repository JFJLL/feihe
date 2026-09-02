CREATE INDEX `idx_snapshots_note_time` ON `comment_snapshots` (`note_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `idx_key_comments_action_status` ON `key_comments` (`action`,`treatment_status`);--> statement-breakpoint
CREATE INDEX `idx_key_comments_note_id` ON `key_comments` (`note_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_pipeline` ON `notes` (`pipeline`);--> statement-breakpoint
CREATE INDEX `idx_supplier_note_visibility` ON `supplier_comments` (`note_id`,`visibility`);