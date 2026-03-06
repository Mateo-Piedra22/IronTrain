ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "finish_lat" real;
--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "finish_lon" real;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "score_lifetime" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "streak_weeks" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "streak_multiplier" real DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "streak_week_evaluated_at" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_scoring_config" (
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
CREATE TABLE IF NOT EXISTS "global_events" (
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
CREATE TABLE IF NOT EXISTS "user_exercise_prs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"exercise_name" text NOT NULL,
	"best_1rm_kg" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "score_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workout_id" text,
	"event_type" text NOT NULL,
	"event_key" text NOT NULL UNIQUE,
	"points_base" integer NOT NULL,
	"streak_multiplier" real DEFAULT 1 NOT NULL,
	"global_multiplier" real DEFAULT 1 NOT NULL,
	"points_awarded" integer NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "social_scoring_config" ("id")
VALUES ('default')
ON CONFLICT ("id") DO NOTHING;
