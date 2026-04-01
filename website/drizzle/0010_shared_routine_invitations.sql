CREATE TABLE IF NOT EXISTS "shared_routine_invitations" (
    "id" text PRIMARY KEY NOT NULL,
    "shared_routine_id" text NOT NULL,
    "invited_user_id" text NOT NULL,
    "invited_by" text NOT NULL,
    "proposed_role" text DEFAULT 'viewer' NOT NULL,
    "status" text DEFAULT 'pending' NOT NULL,
    "responded_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "shared_routine_invites_user_status_idx"
    ON "shared_routine_invitations" ("invited_user_id", "status");

CREATE INDEX IF NOT EXISTS "shared_routine_invites_routine_status_idx"
    ON "shared_routine_invitations" ("shared_routine_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "shared_routine_invites_unique_idx"
    ON "shared_routine_invitations" ("shared_routine_id", "invited_user_id");
