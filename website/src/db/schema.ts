import { relations } from 'drizzle-orm';
import { bigint, boolean, integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';

const commonFields = {
    userId: text('user_id').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
};

export const categories = pgTable('categories', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    isSystem: integer('is_system').default(0),
    sortOrder: integer('sort_order').default(0),
    color: text('color'),
    originId: text('origin_id'), // Official Marketplace Category ID
    ...commonFields,
});

export const badges = pgTable('badges', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    icon: text('icon'),
    groupName: text('group_name'),
    isSystem: integer('is_system').default(0),
    originId: text('origin_id'), // Official Marketplace Badge ID
    ...commonFields,
});

export const exerciseBadges = pgTable('exercise_badges', {
    id: text('id').primaryKey(),
    exerciseId: text('exercise_id').notNull(),
    badgeId: text('badge_id').notNull(),
    isSystem: integer('is_system').default(0),
    ...commonFields,
});

export const exercises = pgTable('exercises', {
    id: text('id').primaryKey(),
    categoryId: text('category_id').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'weight_reps', 'distance_time', 'weight_only', 'reps_only'
    defaultIncrement: real('default_increment').default(2.5),
    notes: text('notes'),
    isSystem: integer('is_system').default(0),
    originId: text('origin_id'), // Para deduping social P2P
    ...commonFields,
});

export const workouts = pgTable('workouts', {
    id: text('id').primaryKey(),
    date: bigint('date', { mode: 'number' }).notNull(),
    startTime: bigint('start_time', { mode: 'number' }).notNull(),
    endTime: bigint('end_time', { mode: 'number' }),
    finishLat: real('finish_lat'),
    finishLon: real('finish_lon'),
    name: text('name'),
    notes: text('notes'),
    status: text('status'),
    duration: bigint('duration', { mode: 'number' }),
    isTemplate: integer('is_template').default(0),
    ...commonFields,
});

export const workoutSets = pgTable('workout_sets', {
    id: text('id').primaryKey(),
    workoutId: text('workout_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    type: text('type').default('normal'),
    weight: real('weight'),
    reps: integer('reps'),
    distance: real('distance'),
    time: bigint('time', { mode: 'number' }),
    rpe: integer('rpe'),
    orderIndex: bigint('order_index', { mode: 'number' }).default(0),
    completed: integer('completed').default(0),
    notes: text('notes'),
    supersetId: text('superset_id'),
    ...commonFields,
});

export const routines = pgTable('routines', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    isPublic: boolean('is_public').default(false), // Funciones Sociales
    isModerated: boolean('is_moderated').default(false), // Moderación de administración
    moderationMessage: text('moderation_message'), // Mensaje para el usuario si se modera
    ...commonFields,
});

export const routineDays = pgTable('routine_days', {
    id: text('id').primaryKey(),
    routineId: text('routine_id').notNull(),
    name: text('name').notNull(),
    orderIndex: integer('order_index').notNull(),
    ...commonFields,
});

export const routineExercises = pgTable('routine_exercises', {
    id: text('id').primaryKey(),
    routineDayId: text('routine_day_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    orderIndex: integer('order_index').notNull(),
    notes: text('notes'),
    ...commonFields,
});

export const measurements = pgTable('measurements', {
    id: text('id').primaryKey(),
    date: bigint('date', { mode: 'number' }).notNull(),
    type: text('type').notNull(),
    value: real('value').notNull(),
    unit: text('unit').notNull(),
    notes: text('notes'),
    ...commonFields,
});

export const goals = pgTable('goals', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    targetValue: real('target_value').notNull(),
    currentValue: real('current_value').default(0),
    deadline: bigint('deadline', { mode: 'number' }),
    type: text('type').notNull(),
    referenceId: text('reference_id'),
    completed: integer('completed').default(0),
    coopUserId: text('coop_user_id'), // IronSocial Multiplayer Goals
    ...commonFields,
});

export const bodyMetrics = pgTable('body_metrics', {
    id: text('id').primaryKey(),
    date: bigint('date', { mode: 'number' }).notNull(),
    weight: real('weight'),
    bodyFat: real('body_fat'),
    notes: text('notes'),
    ...commonFields,
});

export const plateInventory = pgTable('plate_inventory', {
    id: text('id').primaryKey(),
    weight: real('weight').notNull(),
    count: integer('count').notNull(),
    available: integer('available').notNull(),
    type: text('type').default('standard'),
    unit: text('unit').notNull(),
    color: text('color'),
    userId: text('user_id').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const settings = pgTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    description: text('description'),
    userId: text('user_id').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const wipeAudit = pgTable('wipe_audit', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    requestedAt: timestamp('requested_at').defaultNow().notNull(),
    ipHash: text('ip_hash').notNull(),
    userAgent: text('user_agent'),
    status: text('status').notNull(),
    errorMessage: text('error_message'),
});

export const syncRateLimits = pgTable('sync_rate_limits', {
    key: text('key').primaryKey(),
    userId: text('user_id').notNull(),
    action: text('action').notNull(),
    windowStartAt: timestamp('window_start_at').defaultNow().notNull(),
    count: integer('count').default(0).notNull(),
});

export const authCodes = pgTable('auth_codes', {
    code: text('code').primaryKey(),
    userId: text('user_id').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- IRON SOCIAL ---
export const userProfiles = pgTable('user_profiles', {
    id: text('id').primaryKey(), // The user's ID
    username: text('username').unique(), // Optional searchable tag
    displayName: text('display_name'),
    isPublic: boolean('is_public').default(true),
    shareStats: integer('share_stats').default(0),
    currentStreak: integer('current_streak').default(0), // A.3: Streak tracking
    highestStreak: integer('highest_streak').default(0),
    scoreLifetime: integer('score_lifetime').default(0).notNull(),
    streakWeeks: integer('streak_weeks').default(0).notNull(),
    streakMultiplier: real('streak_multiplier').default(1).notNull(),
    streakWeekEvaluatedAt: text('streak_week_evaluated_at'),
    lastActiveDate: bigint('last_active_date', { mode: 'number' }), // Unix timestamp
    pushToken: text('push_token'), // For FCM
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    lastUsernameChangeAt: timestamp('last_username_change_at'),
});

export const friendships = pgTable('friendships', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // The one who initiated, or just User A
    friendId: text('friend_id').notNull(), // User B
    status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'blocked'
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const sharesInbox = pgTable('shares_inbox', {
    id: text('id').primaryKey(),
    senderId: text('sender_id').notNull(),
    receiverId: text('receiver_id').notNull(),
    payload: jsonb('payload').notNull(), // JSON Represents the Routine/Exercise
    type: text('type').notNull(), // 'routine'
    status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'rejected'
    seenAt: timestamp('seen_at'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const activityFeed = pgTable('activity_feed', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    actionType: text('action_type').notNull(), // 'workout_completed', 'pr_broken', 'routine_shared'
    referenceId: text('reference_id'), // ID of the workout, routine, etc.
    metadata: jsonb('metadata'), // JSON with specific info (e.g. weight, exercise name)
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    seenAt: timestamp('seen_at'), // Backwards compatibility for personal-only views
    kudoCount: integer('kudo_count').default(0).notNull(),
});

export const kudos = pgTable('kudos', {
    id: text('id').primaryKey(),
    feedId: text('feed_id').notNull(),
    giverId: text('giver_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

// --- ADMIN & METRICS ---
// --- CHANGELOG SYSTEM ---
export const changelogs = pgTable('changelogs', {
    id: text('id').primaryKey(), // Usually UUID
    version: text('version').notNull().unique(), // e.g. '1.2.0'
    date: timestamp('date').defaultNow().notNull(),
    items: jsonb('items').notNull(), // JSON: string[]
    isUnreleased: boolean('is_unreleased').default(false),
    metadata: jsonb('metadata'), // JSON: icon, bannerImage, etc.
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    reactionCount: integer('reaction_count').default(0).notNull(),
});

export const changelogReactions = pgTable('changelog_reactions', {
    id: text('id').primaryKey(),
    changelogId: text('changelog_id').notNull(),
    userId: text('user_id').notNull(),
    type: text('type').notNull().default('kudos'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const socialScoringConfig = pgTable('social_scoring_config', {
    id: text('id').primaryKey(),
    workoutCompletePoints: integer('workout_complete_points').default(20).notNull(),
    extraDayPoints: integer('extra_day_points').default(10).notNull(),
    extraDayWeeklyCap: integer('extra_day_weekly_cap').default(2).notNull(),
    prNormalPoints: integer('pr_normal_points').default(10).notNull(),
    prBig3Points: integer('pr_big3_points').default(25).notNull(),
    adverseWeatherPoints: integer('adverse_weather_points').default(15).notNull(),
    weekTier2Min: integer('week_tier2_min').default(3).notNull(),
    weekTier3Min: integer('week_tier3_min').default(5).notNull(),
    weekTier4Min: integer('week_tier4_min').default(10).notNull(),
    tier2Multiplier: real('tier2_multiplier').default(1.1).notNull(),
    tier3Multiplier: real('tier3_multiplier').default(1.25).notNull(),
    tier4Multiplier: real('tier4_multiplier').default(1.5).notNull(),
    coldThresholdC: real('cold_threshold_c').default(3).notNull(),
    weatherBonusEnabled: boolean('weather_bonus_enabled').default(true).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: text('updated_by'),
});

export const globalEvents = pgTable('global_events', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    multiplier: real('multiplier').default(1).notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    pushSent: boolean('push_sent').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: text('created_by'),
});

export const userExercisePrs = pgTable('user_exercise_prs', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    exerciseName: text('exercise_name').notNull(),
    best1RmKg: real('best_1rm_kg').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const scoreEvents = pgTable('score_events', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    workoutId: text('workout_id'),
    eventType: text('event_type').notNull(),
    eventKey: text('event_key').unique(), // Removed .notNull() to allow flexibility if needed, but unique is key
    pointsBase: integer('points_base').notNull(),
    streakMultiplier: real('streak_multiplier').default(1).notNull(),
    globalMultiplier: real('global_multiplier').default(1).notNull(),
    pointsAwarded: integer('points_awarded').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

// --- RELATIONS FOR DRIZZLE QUERY API ---
export const categoriesRelations = relations(categories, ({ many }) => ({
    exercises: many(exercises),
}));

export const exerciseBadgesRelations = relations(exerciseBadges, ({ one }) => ({
    exercise: one(exercises, {
        fields: [exerciseBadges.exerciseId],
        references: [exercises.id],
    }),
    badge: one(badges, {
        fields: [exerciseBadges.badgeId],
        references: [badges.id],
    }),
}));

export const exercisesRelations = relations(exercises, ({ one, many }) => ({
    category: one(categories, {
        fields: [exercises.categoryId],
        references: [categories.id],
    }),
    badges: many(exerciseBadges),
}));

export const badgesRelations = relations(badges, ({ many }) => ({
    exerciseBadges: many(exerciseBadges),
}));
