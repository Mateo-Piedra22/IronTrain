import { integer, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';

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
    date: integer('date').notNull(),
    startTime: integer('start_time').notNull(),
    endTime: integer('end_time'),
    name: text('name').notNull(),
    notes: text('notes'),
    status: text('status'),
    duration: integer('duration'),
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
    time: integer('time'),
    rpe: integer('rpe'),
    orderIndex: integer('order_index').default(0),
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
    username: text('username'), // Optional searchable tag
    displayName: text('display_name'),
    isPublic: integer('is_public').default(1),
    shareStats: integer('share_stats').default(0),
    currentStreak: integer('current_streak').default(0), // A.3: Streak tracking
    highestStreak: integer('highest_streak').default(0),
    lastActiveDate: integer('last_active_date'), // Unix timestamp
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
});

export const kudos = pgTable('kudos', {
    id: text('id').primaryKey(),
    feedId: text('feed_id').notNull(),
    giverId: text('giver_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
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
