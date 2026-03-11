CREATE TABLE "activity_seen" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"seen_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changelog_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"changelog_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text DEFAULT 'kudos' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "global_events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"multiplier" real DEFAULT 1 NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"push_sent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
CREATE TABLE "notification_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"notification_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text DEFAULT 'kudos' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "score_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workout_id" text,
	"event_type" text NOT NULL,
	"event_key" text,
	"points_base" integer NOT NULL,
	"streak_multiplier" real DEFAULT 1 NOT NULL,
	"global_multiplier" real DEFAULT 1 NOT NULL,
	"points_awarded" integer NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "score_events_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "social_scoring_config" (
	"id" text PRIMARY KEY NOT NULL,
	"workout_complete_points" integer DEFAULT 20 NOT NULL,
	"extra_day_points" integer DEFAULT 10 NOT NULL,
	"extra_day_weekly_cap" integer DEFAULT 2 NOT NULL,
	"pr_normal_points" integer DEFAULT 10 NOT NULL,
	"pr_big3_points" integer DEFAULT 25 NOT NULL,
	"adverse_weather_points" integer DEFAULT 15 NOT NULL,
	"week_tier2_min" integer DEFAULT 3 NOT NULL,
	"week_tier3_min" integer DEFAULT 5 NOT NULL,
	"week_tier4_min" integer DEFAULT 10 NOT NULL,
	"tier2_multiplier" real DEFAULT 1.1 NOT NULL,
	"tier3_multiplier" real DEFAULT 1.25 NOT NULL,
	"tier4_multiplier" real DEFAULT 1.5 NOT NULL,
	"cold_threshold_c" real DEFAULT 3 NOT NULL,
	"weather_bonus_enabled" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "system_status" (
	"id" text PRIMARY KEY NOT NULL,
	"maintenance_mode" integer DEFAULT 0 NOT NULL,
	"offline_only_mode" integer DEFAULT 0 NOT NULL,
	"message" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "user_exercise_prs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"exercise_name" text NOT NULL,
	"best_1rm_kg" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "workout_sets" ALTER COLUMN "time" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "workout_sets" ALTER COLUMN "order_index" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "date" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "start_time" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "end_time" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ALTER COLUMN "duration" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD COLUMN "seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "activity_feed" ADD COLUMN "kudo_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_notifications" ADD COLUMN "target_segment" text;--> statement-breakpoint
ALTER TABLE "admin_notifications" ADD COLUMN "reaction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "badges" ADD COLUMN "origin_id" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "origin_id" text;--> statement-breakpoint
ALTER TABLE "changelogs" ADD COLUMN "reaction_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_badges" ADD COLUMN "is_system" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "kudos" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "kudos" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "shares_inbox" ADD COLUMN "seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "score_lifetime" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "streak_weeks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "streak_multiplier" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "streak_week_evaluated_at" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "push_token" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "last_username_change_at" timestamp;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "finish_lat" real;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "finish_lon" real;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_username_unique" UNIQUE("username");