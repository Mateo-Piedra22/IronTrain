CREATE TABLE IF NOT EXISTS "theme_packs" (
  "id" text PRIMARY KEY,
  "owner_id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "supports_light" boolean NOT NULL DEFAULT true,
  "supports_dark" boolean NOT NULL DEFAULT true,
  "visibility" text NOT NULL DEFAULT 'private',
  "status" text NOT NULL DEFAULT 'draft',
  "moderation_message" text,
  "current_version" integer NOT NULL DEFAULT 1,
  "downloads_count" integer NOT NULL DEFAULT 0,
  "applies_count" integer NOT NULL DEFAULT 0,
  "rating_avg" real NOT NULL DEFAULT 0,
  "rating_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "theme_packs_slug_unique_idx" ON "theme_packs" ("slug");
CREATE INDEX IF NOT EXISTS "theme_packs_owner_updated_idx" ON "theme_packs" ("owner_id", "updated_at");
CREATE INDEX IF NOT EXISTS "theme_packs_status_visibility_updated_idx" ON "theme_packs" ("status", "visibility", "updated_at");
CREATE INDEX IF NOT EXISTS "theme_packs_deleted_updated_idx" ON "theme_packs" ("deleted_at", "updated_at");

CREATE TABLE IF NOT EXISTS "theme_pack_versions" (
  "id" text PRIMARY KEY,
  "theme_pack_id" text NOT NULL REFERENCES "theme_packs"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "payload" jsonb NOT NULL,
  "changelog" text,
  "created_by" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "theme_pack_versions_pack_version_unique_idx" ON "theme_pack_versions" ("theme_pack_id", "version");
CREATE INDEX IF NOT EXISTS "theme_pack_versions_pack_created_idx" ON "theme_pack_versions" ("theme_pack_id", "created_at");

CREATE TABLE IF NOT EXISTS "theme_pack_installs" (
  "id" text PRIMARY KEY,
  "theme_pack_id" text NOT NULL REFERENCES "theme_packs"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "installed_version" integer NOT NULL,
  "applied_light" boolean NOT NULL DEFAULT false,
  "applied_dark" boolean NOT NULL DEFAULT false,
  "installed_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "theme_pack_installs_pack_user_unique_idx" ON "theme_pack_installs" ("theme_pack_id", "user_id");
CREATE INDEX IF NOT EXISTS "theme_pack_installs_user_updated_idx" ON "theme_pack_installs" ("user_id", "updated_at");

CREATE TABLE IF NOT EXISTS "theme_pack_ratings" (
  "id" text PRIMARY KEY,
  "theme_pack_id" text NOT NULL REFERENCES "theme_packs"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "rating" integer NOT NULL,
  "review" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "deleted_at" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "theme_pack_ratings_pack_user_unique_idx" ON "theme_pack_ratings" ("theme_pack_id", "user_id");
CREATE INDEX IF NOT EXISTS "theme_pack_ratings_pack_deleted_idx" ON "theme_pack_ratings" ("theme_pack_id", "deleted_at");

CREATE TABLE IF NOT EXISTS "theme_pack_feedback" (
  "id" text PRIMARY KEY,
  "theme_pack_id" text NOT NULL REFERENCES "theme_packs"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "message" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "theme_pack_feedback_pack_status_created_idx" ON "theme_pack_feedback" ("theme_pack_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "theme_pack_reports" (
  "id" text PRIMARY KEY,
  "theme_pack_id" text NOT NULL REFERENCES "theme_packs"("id") ON DELETE CASCADE,
  "reporter_user_id" text NOT NULL,
  "reason" text NOT NULL,
  "details" text,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "theme_pack_reports_status_created_idx" ON "theme_pack_reports" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "theme_pack_reports_pack_status_idx" ON "theme_pack_reports" ("theme_pack_id", "status");
