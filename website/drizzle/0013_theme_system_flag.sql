ALTER TABLE "theme_packs"
ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "theme_packs_system_status_updated_idx"
ON "theme_packs" ("is_system", "status", "updated_at");
