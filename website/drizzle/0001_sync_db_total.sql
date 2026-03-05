CREATE TABLE IF NOT EXISTS "body_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"date" integer NOT NULL,
	"weight" real,
	"body_fat" real,
	"notes" text,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);

CREATE TABLE IF NOT EXISTS "plate_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"weight" real NOT NULL,
	"count" integer NOT NULL,
	"available" integer NOT NULL,
	"type" text DEFAULT 'standard',
	"unit" text NOT NULL,
	"color" text,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "wipe_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"ip_hash" text NOT NULL,
	"user_agent" text,
	"status" text NOT NULL,
	"error_message" text
);

CREATE TABLE IF NOT EXISTS "sync_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"window_start_at" timestamp DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_body_metrics_user_updated" ON "body_metrics" ("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "idx_plate_inventory_user_updated" ON "plate_inventory" ("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "idx_settings_user_updated" ON "settings" ("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "idx_wipe_audit_user_requested" ON "wipe_audit" ("user_id", "requested_at");
CREATE INDEX IF NOT EXISTS "idx_sync_rate_limits_user_action" ON "sync_rate_limits" ("user_id", "action");
