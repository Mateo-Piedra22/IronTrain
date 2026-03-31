CREATE INDEX IF NOT EXISTS "feed_deleted_created_idx"
ON "activity_feed" ("user_id", "deleted_at", "created_at")
WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "activity_seen_user_activity_idx"
ON "activity_seen" ("user_id", "activity_id");
