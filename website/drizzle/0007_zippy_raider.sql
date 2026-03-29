CREATE TABLE "activity_seen" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"user_id" text NOT NULL,
	"seen_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "auth_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "weather_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workout_id" text,
	"location" text,
	"lat" real,
	"lon" real,
	"condition" text,
	"temperature" real,
	"temp_c" real,
	"wind_speed" real,
	"humidity" integer,
	"is_adverse" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "body_metrics" ALTER COLUMN "date" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "changelogs" ALTER COLUMN "is_unreleased" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "global_events" ALTER COLUMN "is_active" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "global_events" ALTER COLUMN "is_active" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "global_events" ALTER COLUMN "push_sent" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "deadline" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "measurements" ALTER COLUMN "date" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "routines" ALTER COLUMN "is_public" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "routines" ALTER COLUMN "is_moderated" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "social_scoring_config" ALTER COLUMN "weather_bonus_enabled" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "social_scoring_config" ALTER COLUMN "weather_bonus_enabled" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "is_public" SET DATA TYPE boolean;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "is_public" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "last_active_date" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "changelogs" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "plate_inventory" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "score_events" ADD COLUMN "weather_id" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "social_scoring_config" ADD COLUMN "heat_threshold_c" real DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_exercise_prs" ADD COLUMN "workout_set_id" text;--> statement-breakpoint
ALTER TABLE "user_exercise_prs" ADD COLUMN "achieved_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "activity_seen_activity_user_idx" ON "activity_seen" USING btree ("activity_id","user_id");--> statement-breakpoint
CREATE INDEX "activity_seen_user_seen_idx" ON "activity_seen" USING btree ("user_id","seen_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_admin_created_idx" ON "admin_audit_logs" USING btree ("admin_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_action_created_idx" ON "admin_audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "weather_user_time_idx" ON "weather_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "feed_user_time_idx" ON "activity_feed" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "feed_action_idx" ON "activity_feed" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "feed_user_deleted_created_idx" ON "activity_feed" USING btree ("user_id","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "changelog_reactions_changelog_deleted_idx" ON "changelog_reactions" USING btree ("changelog_id","deleted_at");--> statement-breakpoint
CREATE INDEX "changelog_reactions_user_changelog_deleted_idx" ON "changelog_reactions" USING btree ("user_id","changelog_id","deleted_at");--> statement-breakpoint
CREATE INDEX "exercises_user_updated_idx" ON "exercises" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "exercises_user_name_idx" ON "exercises" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "exercises_user_origin_idx" ON "exercises" USING btree ("user_id","origin_id");--> statement-breakpoint
CREATE INDEX "exercises_system_name_idx" ON "exercises" USING btree ("is_system","name");--> statement-breakpoint
CREATE INDEX "friendships_users_idx" ON "friendships" USING btree ("user_id","friend_id");--> statement-breakpoint
CREATE INDEX "friendships_status_idx" ON "friendships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "friendships_user_status_deleted_idx" ON "friendships" USING btree ("user_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "friendships_friend_status_deleted_idx" ON "friendships" USING btree ("friend_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "kudos_feed_idx" ON "kudos" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "kudos_giver_idx" ON "kudos" USING btree ("giver_id");--> statement-breakpoint
CREATE INDEX "kudos_feed_deleted_giver_idx" ON "kudos" USING btree ("feed_id","deleted_at","giver_id");--> statement-breakpoint
CREATE INDEX "routine_days_routine_order_idx" ON "routine_days" USING btree ("routine_id","order_index");--> statement-breakpoint
CREATE INDEX "routine_days_routine_deleted_idx" ON "routine_days" USING btree ("routine_id","deleted_at");--> statement-breakpoint
CREATE INDEX "routine_exercises_day_order_idx" ON "routine_exercises" USING btree ("routine_day_id","order_index");--> statement-breakpoint
CREATE INDEX "routine_exercises_day_deleted_idx" ON "routine_exercises" USING btree ("routine_day_id","deleted_at");--> statement-breakpoint
CREATE INDEX "routines_user_updated_idx" ON "routines" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "routines_user_public_idx" ON "routines" USING btree ("user_id","is_public");--> statement-breakpoint
CREATE INDEX "score_user_time_idx" ON "score_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "score_type_idx" ON "score_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "score_user_deleted_created_idx" ON "score_events" USING btree ("user_id","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "score_user_workout_idx" ON "score_events" USING btree ("user_id","workout_id");--> statement-breakpoint
CREATE INDEX "settings_user_key_idx" ON "settings" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "settings_user_updated_idx" ON "settings" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "shares_inbox_receiver_updated_idx" ON "shares_inbox" USING btree ("receiver_id","updated_at");--> statement-breakpoint
CREATE INDEX "shares_inbox_receiver_deleted_updated_idx" ON "shares_inbox" USING btree ("receiver_id","deleted_at","updated_at");--> statement-breakpoint
CREATE INDEX "shares_inbox_sender_updated_idx" ON "shares_inbox" USING btree ("sender_id","updated_at");--> statement-breakpoint
CREATE INDEX "profile_username_idx" ON "user_profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "profile_public_idx" ON "user_profiles" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "profile_active_date_idx" ON "user_profiles" USING btree ("last_active_date");--> statement-breakpoint
CREATE INDEX "workout_sets_workout_idx" ON "workout_sets" USING btree ("workout_id");--> statement-breakpoint
CREATE INDEX "workout_sets_exercise_idx" ON "workout_sets" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "workout_sets_user_updated_idx" ON "workout_sets" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "workouts_user_updated_idx" ON "workouts" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "workouts_date_idx" ON "workouts" USING btree ("date");--> statement-breakpoint
CREATE INDEX "workouts_user_status_date_idx" ON "workouts" USING btree ("user_id","status","date");--> statement-breakpoint
CREATE INDEX "workouts_user_status_deleted_idx" ON "workouts" USING btree ("user_id","status","deleted_at");