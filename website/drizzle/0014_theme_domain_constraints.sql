UPDATE "theme_packs"
SET "visibility" = 'private'
WHERE "visibility" NOT IN ('private', 'friends', 'public');
--> statement-breakpoint
UPDATE "theme_packs"
SET "status" = 'draft'
WHERE "status" NOT IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended');
--> statement-breakpoint
UPDATE "theme_pack_feedback"
SET "kind" = 'suggestion'
WHERE "kind" NOT IN ('issue', 'suggestion', 'praise');
--> statement-breakpoint
UPDATE "theme_pack_reports"
SET "reason" = 'other'
WHERE "reason" NOT IN ('nsfw', 'hate', 'spam', 'impersonation', 'malware', 'other');
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "theme_packs"
    ADD CONSTRAINT "theme_packs_visibility_allowed"
    CHECK ("visibility" IN ('private', 'friends', 'public')) NOT VALID;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "theme_packs"
    ADD CONSTRAINT "theme_packs_status_allowed"
    CHECK ("status" IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended')) NOT VALID;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "theme_pack_feedback"
    ADD CONSTRAINT "theme_pack_feedback_kind_allowed"
    CHECK ("kind" IN ('issue', 'suggestion', 'praise')) NOT VALID;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "theme_pack_reports"
    ADD CONSTRAINT "theme_pack_reports_reason_allowed"
    CHECK ("reason" IN ('nsfw', 'hate', 'spam', 'impersonation', 'malware', 'other')) NOT VALID;
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "theme_packs" VALIDATE CONSTRAINT "theme_packs_visibility_allowed";
--> statement-breakpoint
ALTER TABLE "theme_packs" VALIDATE CONSTRAINT "theme_packs_status_allowed";
--> statement-breakpoint
ALTER TABLE "theme_pack_feedback" VALIDATE CONSTRAINT "theme_pack_feedback_kind_allowed";
--> statement-breakpoint
ALTER TABLE "theme_pack_reports" VALIDATE CONSTRAINT "theme_pack_reports_reason_allowed";
