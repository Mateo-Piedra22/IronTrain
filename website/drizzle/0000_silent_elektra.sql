CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_system" integer DEFAULT 0,
	"sort_order" integer DEFAULT 0,
	"color" text,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"default_increment" real DEFAULT 2.5,
	"notes" text,
	"is_system" integer DEFAULT 0,
	"origin_id" text,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"friend_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"target_value" real NOT NULL,
	"current_value" real DEFAULT 0,
	"deadline" integer,
	"type" text NOT NULL,
	"reference_id" text,
	"completed" integer DEFAULT 0,
	"coop_user_id" text,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"date" integer NOT NULL,
	"type" text NOT NULL,
	"value" real NOT NULL,
	"unit" text NOT NULL,
	"notes" text,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "routine_days" (
	"id" text PRIMARY KEY NOT NULL,
	"routine_id" text NOT NULL,
	"name" text NOT NULL,
	"order_index" integer NOT NULL,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "routine_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"routine_day_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"order_index" integer NOT NULL,
	"notes" text,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_public" integer DEFAULT 0,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "shares_inbox" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"payload" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text,
	"display_name" text,
	"is_public" integer DEFAULT 1,
	"share_stats" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"workout_id" text NOT NULL,
	"exercise_id" text NOT NULL,
	"type" text DEFAULT 'normal',
	"weight" real,
	"reps" integer,
	"distance" real,
	"time" integer,
	"rpe" integer,
	"order_index" integer DEFAULT 0,
	"completed" integer DEFAULT 0,
	"notes" text,
	"superset_id" text,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" text PRIMARY KEY NOT NULL,
	"date" integer NOT NULL,
	"start_time" integer NOT NULL,
	"end_time" integer,
	"name" text NOT NULL,
	"notes" text,
	"status" text,
	"duration" integer,
	"is_template" integer DEFAULT 0,
	"user_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
