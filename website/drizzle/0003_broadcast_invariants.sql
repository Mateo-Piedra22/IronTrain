DO $$
BEGIN
    ALTER TABLE "changelogs"
    ADD CONSTRAINT "changelogs_reaction_count_non_negative"
    CHECK ("reaction_count" >= 0) NOT VALID;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "admin_notifications"
    ADD CONSTRAINT "admin_notifications_reaction_count_non_negative"
    CHECK ("reaction_count" >= 0) NOT VALID;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "changelog_reactions_unique_active"
ON "changelog_reactions" ("changelog_id", "user_id")
WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_reactions_unique_active"
ON "notification_reactions" ("notification_id", "user_id")
WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_logs_user_action_created_at"
ON "notification_logs" ("user_id", "action", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "changelog_reactions_user_changelog_active"
ON "changelog_reactions" ("user_id", "changelog_id")
WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_reactions_user_notification_active"
ON "notification_reactions" ("user_id", "notification_id")
WHERE "deleted_at" IS NULL;
