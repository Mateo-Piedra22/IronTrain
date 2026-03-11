import { relations } from 'drizzle-orm';
import { bigint, integer, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';

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
    isPublic: integer('is_public').default(0), // Funciones Sociales
    isModerated: integer('is_moderated').default(0), // Moderación de administración
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
    date: integer('date').notNull(),
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
    deadline: integer('deadline'),
    type: text('type').notNull(),
    referenceId: text('reference_id'),
    completed: integer('completed').default(0),
    coopUserId: text('coop_user_id'), // IronSocial Multiplayer Goals
    ...commonFields,
});

export const bodyMetrics = pgTable('body_metrics', {
    id: text('id').primaryKey(),
    date: integer('date').notNull(),
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

// --- IRON SOCIAL ---
export const userProfiles = pgTable('user_profiles', {
    id: text('id').primaryKey(), // The user's ID
    username: text('username').unique(), // Optional searchable tag
    displayName: text('display_name'),
    isPublic: integer('is_public').default(1),
    shareStats: integer('share_stats').default(0),
    currentStreak: integer('current_streak').default(0), // A.3: Streak tracking
    highestStreak: integer('highest_streak').default(0),
    scoreLifetime: integer('score_lifetime').default(0).notNull(),
    streakWeeks: integer('streak_weeks').default(0).notNull(),
    streakMultiplier: real('streak_multiplier').default(1).notNull(),
    streakWeekEvaluatedAt: text('streak_week_evaluated_at'),
    lastActiveDate: integer('last_active_date'), // Unix timestamp
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
    payload: text('payload').notNull(), // JSON string representing the Routine/Exercise
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
    metadata: text('metadata'), // JSON string with specific info (e.g. weight, exercise name)
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    seenAt: timestamp('seen_at'), // Backwards compatibility for personal-only views
    kudoCount: integer('kudo_count').default(0).notNull(),
});

export const activitySeen = pgTable('activity_seen', {
    id: text('id').primaryKey(), // user_id + activity_id
    userId: text('user_id').notNull(),
    activityId: text('activity_id').notNull(),
    seenAt: timestamp('seen_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
export const appInstalls = pgTable('app_installs', {
    id: text('id').primaryKey(), // uniquely generated uuid per device installation
    platform: text('platform').notNull(), // 'android', 'ios', 'web'
    version: text('version'), // e.g. '1.0.0'
    metadata: text('metadata'), // Extra JSON data (device model, os version)
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const feedback = pgTable('feedback', {
    id: text('id').primaryKey(),
    userId: text('user_id'), // Optional if anonymous, refs userProfiles.id
    type: text('type').notNull(), // 'bug', 'feature_request', 'review', 'other'
    message: text('message').notNull(),
    status: text('status').default('open').notNull(), // 'open', 'in_progress', 'resolved', 'closed'
    metadata: text('metadata'), // JSON string with app version, OS, etc. for repro
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- CHANGELOG SYSTEM ---
export const changelogs = pgTable('changelogs', {
    id: text('id').primaryKey(), // Usually UUID
    version: text('version').notNull().unique(), // e.g. '1.2.0'
    date: timestamp('date').defaultNow().notNull(),
    items: text('items').notNull(), // JSON string: string[]
    isUnreleased: integer('is_unreleased').default(0),
    metadata: text('metadata'), // JSON string: icon, bannerImage, etc.
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    reactionCount: integer('reaction_count').default(0).notNull(),
});

// --- NOTIFICATION SYSTEM ---
export const adminNotifications = pgTable('admin_notifications', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    type: text('type').notNull(), // 'toast', 'modal', 'system'
    priority: text('priority').default('normal'), // 'low', 'normal', 'high', 'critical'
    displayMode: text('display_mode').default('once'), // 'once', 'always', 'until_closed'
    targetVersion: text('target_version'), // if null, all versions
    targetPlatform: text('target_platform'), // 'android', 'ios', 'all'
    targetSegment: text('target_segment'), // 'all', 'premium', 'new_users', etc.
    isActive: integer('is_active').default(1),
    scheduledAt: timestamp('scheduled_at').defaultNow().notNull(),
    metadata: text('metadata'), // JSON string: icons, action buttons, styles
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    reactionCount: integer('reaction_count').default(0).notNull(),
});

export const notificationLogs = pgTable('notification_logs', {
    id: text('id').primaryKey(),
    notificationId: text('notification_id').notNull(),
    userId: text('user_id').notNull(),
    action: text('action').notNull(), // 'seen', 'closed', 'clicked'
    metadata: text('metadata'), // e.g. platform, app version when action was taken
    createdAt: timestamp('created_at').defaultNow().notNull(),
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

export const notificationReactions = pgTable('notification_reactions', {
    id: text('id').primaryKey(),
    notificationId: text('notification_id').notNull(),
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
    weatherBonusEnabled: integer('weather_bonus_enabled').default(1).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: text('updated_by'),
});

export const globalEvents = pgTable('global_events', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    multiplier: real('multiplier').default(1).notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),
    isActive: integer('is_active').default(1).notNull(),
    pushSent: integer('push_sent').default(0).notNull(),
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
    metadata: text('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const systemStatus = pgTable('system_status', {
    id: text('id').primaryKey(), // singleton: 'global'
    maintenanceMode: integer('maintenance_mode').default(0).notNull(), // 0: off, 1: on
    offlineOnlyMode: integer('offline_only_mode').default(0).notNull(), // 0: off, 1: on
    message: text('message'), // Optional custom message for maintenance
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    updatedBy: text('updated_by'),
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
