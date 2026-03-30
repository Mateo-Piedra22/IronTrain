CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
	"id" text PRIMARY KEY,
	"admin_user_id" text NOT NULL,
	"admin_role" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"status" text NOT NULL,
	"message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_admin_created_idx" ON "admin_audit_logs" USING btree ("admin_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_logs_action_created_idx" ON "admin_audit_logs" USING btree ("action", "created_at");