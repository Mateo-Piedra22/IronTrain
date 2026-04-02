-- Theme Marketplace Blueprint (v1)
-- Draft técnico para migración Drizzle/SQL.
-- No ejecutar directo en producción sin revisión de migraciones.

CREATE TABLE IF NOT EXISTS theme_packs (
  id text PRIMARY KEY,
  owner_id text NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  supports_light boolean NOT NULL DEFAULT true,
  supports_dark boolean NOT NULL DEFAULT true,
  visibility text NOT NULL DEFAULT 'private', -- private|friends|public
  status text NOT NULL DEFAULT 'draft', -- draft|pending_review|approved|rejected|suspended
  moderation_message text,
  current_version integer NOT NULL DEFAULT 1,
  downloads_count integer NOT NULL DEFAULT 0,
  applies_count integer NOT NULL DEFAULT 0,
  rating_avg real NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp
);

CREATE INDEX IF NOT EXISTS theme_packs_owner_idx ON theme_packs(owner_id, updated_at);
CREATE INDEX IF NOT EXISTS theme_packs_status_visibility_idx ON theme_packs(status, visibility, updated_at);
CREATE INDEX IF NOT EXISTS theme_packs_deleted_updated_idx ON theme_packs(deleted_at, updated_at);

CREATE TABLE IF NOT EXISTS theme_pack_versions (
  id text PRIMARY KEY,
  theme_pack_id text NOT NULL REFERENCES theme_packs(id) ON DELETE CASCADE,
  version integer NOT NULL,
  payload jsonb NOT NULL,
  changelog text,
  created_by text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(theme_pack_id, version)
);

CREATE INDEX IF NOT EXISTS theme_pack_versions_pack_created_idx ON theme_pack_versions(theme_pack_id, created_at DESC);

CREATE TABLE IF NOT EXISTS theme_pack_installs (
  id text PRIMARY KEY,
  theme_pack_id text NOT NULL REFERENCES theme_packs(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  installed_version integer NOT NULL,
  applied_light boolean NOT NULL DEFAULT false,
  applied_dark boolean NOT NULL DEFAULT false,
  installed_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(theme_pack_id, user_id)
);

CREATE INDEX IF NOT EXISTS theme_pack_installs_user_idx ON theme_pack_installs(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS theme_pack_ratings (
  id text PRIMARY KEY,
  theme_pack_id text NOT NULL REFERENCES theme_packs(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp,
  UNIQUE(theme_pack_id, user_id)
);

CREATE INDEX IF NOT EXISTS theme_pack_ratings_pack_idx ON theme_pack_ratings(theme_pack_id, deleted_at);

CREATE TABLE IF NOT EXISTS theme_pack_feedback (
  id text PRIMARY KEY,
  theme_pack_id text NOT NULL REFERENCES theme_packs(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  kind text NOT NULL, -- issue|suggestion|praise
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open|reviewed|closed
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS theme_pack_feedback_pack_status_idx ON theme_pack_feedback(theme_pack_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS theme_pack_reports (
  id text PRIMARY KEY,
  theme_pack_id text NOT NULL REFERENCES theme_packs(id) ON DELETE CASCADE,
  reporter_user_id text NOT NULL,
  reason text NOT NULL, -- nsfw|hate|spam|impersonation|malware|other
  details text,
  status text NOT NULL DEFAULT 'open', -- open|triaged|actioned|dismissed
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS theme_pack_reports_status_idx ON theme_pack_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS theme_pack_reports_pack_idx ON theme_pack_reports(theme_pack_id, status);

-- Extensión sugerida sobre activity_feed:
-- action_type = 'theme_shared'
-- metadata = {
--   themePackId, slug, name, supportsLight, supportsDark, previewSeed
-- }
