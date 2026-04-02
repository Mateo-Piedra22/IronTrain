import { relations } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

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
}, (table) => ({
    userUpdatedIdx: index('exercises_user_updated_idx').on(table.userId, table.updatedAt),
    userNameIdx: index('exercises_user_name_idx').on(table.userId, table.name),
    userOriginIdx: index('exercises_user_origin_idx').on(table.userId, table.originId),
    systemNameIdx: index('exercises_system_name_idx').on(table.isSystem, table.name),
}));

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
}, (table) => ({
    userUpdatedIdx: index('workouts_user_updated_idx').on(table.userId, table.updatedAt),
    dateIdx: index('workouts_date_idx').on(table.date),
    userStatusDateIdx: index('workouts_user_status_date_idx').on(table.userId, table.status, table.date),
    userStatusDeletedIdx: index('workouts_user_status_deleted_idx').on(table.userId, table.status, table.deletedAt),
}));

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
}, (table) => ({
    workoutIdx: index('workout_sets_workout_idx').on(table.workoutId),
    exerciseIdx: index('workout_sets_exercise_idx').on(table.exerciseId),
    userUpdatedIdx: index('workout_sets_user_updated_idx').on(table.userId, table.updatedAt),
}));

export const routines = pgTable('routines', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    isPublic: boolean('is_public').default(false), // Funciones Sociales
    isModerated: boolean('is_moderated').default(false), // Moderación de administración
    moderationMessage: text('moderation_message'), // Mensaje para el usuario si se modera
    ...commonFields,
}, (table) => ({
    userUpdatedIdx: index('routines_user_updated_idx').on(table.userId, table.updatedAt),
    userPublicIdx: index('routines_user_public_idx').on(table.userId, table.isPublic),
}));

export const routineDays = pgTable('routine_days', {
    id: text('id').primaryKey(),
    routineId: text('routine_id').notNull(),
    name: text('name').notNull(),
    orderIndex: integer('order_index').notNull(),
    ...commonFields,
}, (table) => ({
    routineOrderIdx: index('routine_days_routine_order_idx').on(table.routineId, table.orderIndex),
    routineDeletedIdx: index('routine_days_routine_deleted_idx').on(table.routineId, table.deletedAt),
}));

export const routineExercises = pgTable('routine_exercises', {
    id: text('id').primaryKey(),
    routineDayId: text('routine_day_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    orderIndex: integer('order_index').notNull(),
    notes: text('notes'),
    ...commonFields,
}, (table) => ({
    dayOrderIdx: index('routine_exercises_day_order_idx').on(table.routineDayId, table.orderIndex),
    dayDeletedIdx: index('routine_exercises_day_deleted_idx').on(table.routineDayId, table.deletedAt),
}));

export const sharedRoutines = pgTable('shared_routines', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    title: text('title').notNull(),
    sourceRoutineId: text('source_routine_id'),
    editMode: text('edit_mode').notNull().default('owner_only'), // owner_only | collaborative
    approvalMode: text('approval_mode').notNull().default('none'), // none | owner_review
    currentSnapshotId: text('current_snapshot_id'),
    currentRevision: integer('current_revision').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    ownerUpdatedIdx: index('shared_routines_owner_updated_idx').on(table.ownerId, table.updatedAt),
    ownerDeletedIdx: index('shared_routines_owner_deleted_idx').on(table.ownerId, table.deletedAt),
}));

export const sharedRoutineMembers = pgTable('shared_routine_members', {
    id: text('id').primaryKey(),
    sharedRoutineId: text('shared_routine_id').notNull(),
    userId: text('user_id').notNull(),
    role: text('role').notNull().default('viewer'), // owner | editor | viewer
    canEdit: boolean('can_edit').notNull().default(false),
    invitedBy: text('invited_by'),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    userDeletedIdx: index('shared_routine_members_user_deleted_idx').on(table.userId, table.deletedAt),
    routineDeletedIdx: index('shared_routine_members_routine_deleted_idx').on(table.sharedRoutineId, table.deletedAt),
    uniqueMemberIdx: uniqueIndex('shared_routine_members_unique_member_idx').on(table.sharedRoutineId, table.userId),
}));

export const sharedRoutineInvitations = pgTable('shared_routine_invitations', {
    id: text('id').primaryKey(),
    sharedRoutineId: text('shared_routine_id').notNull(),
    invitedUserId: text('invited_user_id').notNull(),
    invitedBy: text('invited_by').notNull(),
    proposedRole: text('proposed_role').notNull().default('viewer'), // editor | viewer
    status: text('status').notNull().default('pending'), // pending | accepted | rejected | cancelled
    respondedAt: timestamp('responded_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    invitedUserStatusIdx: index('shared_routine_invites_user_status_idx').on(table.invitedUserId, table.status),
    routineStatusIdx: index('shared_routine_invites_routine_status_idx').on(table.sharedRoutineId, table.status),
    uniqueInviteIdx: uniqueIndex('shared_routine_invites_unique_idx').on(table.sharedRoutineId, table.invitedUserId),
}));

export const sharedRoutineSnapshots = pgTable('shared_routine_snapshots', {
    id: text('id').primaryKey(),
    sharedRoutineId: text('shared_routine_id').notNull(),
    revision: integer('revision').notNull(),
    payload: jsonb('payload').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    routineRevisionIdx: uniqueIndex('shared_routine_snapshots_routine_revision_idx').on(table.sharedRoutineId, table.revision),
    routineCreatedIdx: index('shared_routine_snapshots_routine_created_idx').on(table.sharedRoutineId, table.createdAt),
}));

export const sharedRoutineChanges = pgTable('shared_routine_changes', {
    id: text('id').primaryKey(),
    sharedRoutineId: text('shared_routine_id').notNull(),
    snapshotId: text('snapshot_id'),
    actorId: text('actor_id').notNull(),
    actionType: text('action_type').notNull(), // created | owner_sync | member_joined | member_removed
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    routineCreatedIdx: index('shared_routine_changes_routine_created_idx').on(table.sharedRoutineId, table.createdAt),
    actorCreatedIdx: index('shared_routine_changes_actor_created_idx').on(table.actorId, table.createdAt),
}));

export const sharedRoutineComments = pgTable('shared_routine_comments', {
    id: text('id').primaryKey(),
    sharedRoutineId: text('shared_routine_id').notNull(),
    actorId: text('actor_id').notNull(),
    snapshotId: text('snapshot_id'),
    message: text('message').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    routineCreatedIdx: index('shared_routine_comments_routine_created_idx').on(table.sharedRoutineId, table.createdAt),
    actorCreatedIdx: index('shared_routine_comments_actor_created_idx').on(table.actorId, table.createdAt),
}));

export const sharedRoutineReviewRequests = pgTable('shared_routine_review_requests', {
    id: text('id').primaryKey(),
    sharedRoutineId: text('shared_routine_id').notNull(),
    requesterId: text('requester_id').notNull(),
    requestedBaseRevision: integer('requested_base_revision').notNull(),
    candidatePayload: jsonb('candidate_payload').notNull(),
    sourceRoutineId: text('source_routine_id'),
    status: text('status').notNull().default('pending'), // pending | approved | rejected | cancelled
    decidedBy: text('decided_by'),
    decidedAt: timestamp('decided_at'),
    decisionNote: text('decision_note'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    routineStatusCreatedIdx: index('shared_routine_review_requests_routine_status_created_idx').on(table.sharedRoutineId, table.status, table.createdAt),
    requesterCreatedIdx: index('shared_routine_review_requests_requester_created_idx').on(table.requesterId, table.createdAt),
}));

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
    deletedAt: timestamp('deleted_at'),
});

export const settings = pgTable('settings', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    description: text('description'),
    userId: text('user_id').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    userKeyIdx: index('settings_user_key_idx').on(table.userId, table.key),
    userUpdatedIdx: index('settings_user_updated_idx').on(table.userId, table.updatedAt),
}));

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

export const adminAuditLogs = pgTable('admin_audit_logs', {
    id: text('id').primaryKey(),
    adminUserId: text('admin_user_id').notNull(),
    adminRole: text('admin_role').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    status: text('status').notNull(),
    message: text('message'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    adminCreatedIdx: index('admin_audit_logs_admin_created_idx').on(table.adminUserId, table.createdAt),
    actionCreatedIdx: index('admin_audit_logs_action_created_idx').on(table.action, table.createdAt),
}));

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
    streakWeekEvaluatedAt: text('streak_week_evaluated_at'), // Format: YYYY-MM-DD
    lastActiveDate: bigint('last_active_date', { mode: 'number' }), // Unix timestamp
    pushToken: text('push_token'), // For FCM
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
    lastUsernameChangeAt: timestamp('last_username_change_at'),
}, (table) => ({
    userNameIdx: index('profile_username_idx').on(table.username),
    publicIdx: index('profile_public_idx').on(table.isPublic),
    activeDateIdx: index('profile_active_date_idx').on(table.lastActiveDate),
}));

export const friendships = pgTable('friendships', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(), // The one who initiated, or just User A
    friendId: text('friend_id').notNull(), // User B
    status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'blocked'
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    usersIdx: index('friendships_users_idx').on(table.userId, table.friendId),
    statusIdx: index('friendships_status_idx').on(table.status),
    userStatusDeletedIdx: index('friendships_user_status_deleted_idx').on(table.userId, table.status, table.deletedAt),
    friendStatusDeletedIdx: index('friendships_friend_status_deleted_idx').on(table.friendId, table.status, table.deletedAt),
    userDeletedUpdatedIdx: index('friendships_user_deleted_updated_idx').on(table.userId, table.deletedAt, table.updatedAt),
    friendDeletedUpdatedIdx: index('friendships_friend_deleted_updated_idx').on(table.friendId, table.deletedAt, table.updatedAt),
}));

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
}, (table) => ({
    receiverUpdatedIdx: index('shares_inbox_receiver_updated_idx').on(table.receiverId, table.updatedAt),
    receiverDeletedUpdatedIdx: index('shares_inbox_receiver_deleted_updated_idx').on(table.receiverId, table.deletedAt, table.updatedAt),
    senderUpdatedIdx: index('shares_inbox_sender_updated_idx').on(table.senderId, table.updatedAt),
}));

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
}, (table) => ({
    userTimeIdx: index('feed_user_time_idx').on(table.userId, table.createdAt),
    actionIdx: index('feed_action_idx').on(table.actionType),
    userDeletedCreatedIdx: index('feed_user_deleted_created_idx').on(table.userId, table.deletedAt, table.createdAt),
    deletedCreatedIdx: index('feed_deleted_created_idx').on(table.deletedAt, table.createdAt),
    userDeletedUpdatedIdx: index('feed_user_deleted_updated_idx').on(table.userId, table.deletedAt, table.updatedAt),
}));

export const kudos = pgTable('kudos', {
    id: text('id').primaryKey(),
    feedId: text('feed_id').notNull().references(() => activityFeed.id, { onDelete: 'cascade' }),
    giverId: text('giver_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    feedIdx: index('kudos_feed_idx').on(table.feedId),
    giverIdx: index('kudos_giver_idx').on(table.giverId),
    feedDeletedGiverIdx: index('kudos_feed_deleted_giver_idx').on(table.feedId, table.deletedAt, table.giverId),
}));

export const themePacks = pgTable('theme_packs', {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    supportsLight: boolean('supports_light').notNull().default(true),
    supportsDark: boolean('supports_dark').notNull().default(true),
    isSystem: boolean('is_system').notNull().default(false),
    visibility: text('visibility').notNull().default('private'),
    status: text('status').notNull().default('draft'),
    moderationMessage: text('moderation_message'),
    currentVersion: integer('current_version').notNull().default(1),
    downloadsCount: integer('downloads_count').notNull().default(0),
    appliesCount: integer('applies_count').notNull().default(0),
    ratingAvg: real('rating_avg').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    slugUniqueIdx: uniqueIndex('theme_packs_slug_unique_idx').on(table.slug),
    ownerUpdatedIdx: index('theme_packs_owner_updated_idx').on(table.ownerId, table.updatedAt),
    systemStatusUpdatedIdx: index('theme_packs_system_status_updated_idx').on(table.isSystem, table.status, table.updatedAt),
    statusVisibilityUpdatedIdx: index('theme_packs_status_visibility_updated_idx').on(table.status, table.visibility, table.updatedAt),
    deletedUpdatedIdx: index('theme_packs_deleted_updated_idx').on(table.deletedAt, table.updatedAt),
}));

export const themePackVersions = pgTable('theme_pack_versions', {
    id: text('id').primaryKey(),
    themePackId: text('theme_pack_id').notNull().references(() => themePacks.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    payload: jsonb('payload').notNull(),
    changelog: text('changelog'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    packVersionUniqueIdx: uniqueIndex('theme_pack_versions_pack_version_unique_idx').on(table.themePackId, table.version),
    packCreatedIdx: index('theme_pack_versions_pack_created_idx').on(table.themePackId, table.createdAt),
}));

export const themePackInstalls = pgTable('theme_pack_installs', {
    id: text('id').primaryKey(),
    themePackId: text('theme_pack_id').notNull().references(() => themePacks.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    installedVersion: integer('installed_version').notNull(),
    appliedLight: boolean('applied_light').notNull().default(false),
    appliedDark: boolean('applied_dark').notNull().default(false),
    installedAt: timestamp('installed_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    packUserUniqueIdx: uniqueIndex('theme_pack_installs_pack_user_unique_idx').on(table.themePackId, table.userId),
    userUpdatedIdx: index('theme_pack_installs_user_updated_idx').on(table.userId, table.updatedAt),
}));

export const themePackRatings = pgTable('theme_pack_ratings', {
    id: text('id').primaryKey(),
    themePackId: text('theme_pack_id').notNull().references(() => themePacks.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    rating: integer('rating').notNull(),
    review: text('review'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    packUserUniqueIdx: uniqueIndex('theme_pack_ratings_pack_user_unique_idx').on(table.themePackId, table.userId),
    packDeletedIdx: index('theme_pack_ratings_pack_deleted_idx').on(table.themePackId, table.deletedAt),
}));

export const themePackFeedback = pgTable('theme_pack_feedback', {
    id: text('id').primaryKey(),
    themePackId: text('theme_pack_id').notNull().references(() => themePacks.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    message: text('message').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    packStatusCreatedIdx: index('theme_pack_feedback_pack_status_created_idx').on(table.themePackId, table.status, table.createdAt),
}));

export const themePackReports = pgTable('theme_pack_reports', {
    id: text('id').primaryKey(),
    themePackId: text('theme_pack_id').notNull().references(() => themePacks.id, { onDelete: 'cascade' }),
    reporterUserId: text('reporter_user_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    statusCreatedIdx: index('theme_pack_reports_status_created_idx').on(table.status, table.createdAt),
    packStatusIdx: index('theme_pack_reports_pack_status_idx').on(table.themePackId, table.status),
}));


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
    deletedAt: timestamp('deleted_at'),
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
}, (table) => ({
    changelogDeletedIdx: index('changelog_reactions_changelog_deleted_idx').on(table.changelogId, table.deletedAt),
    userChangelogDeletedIdx: index('changelog_reactions_user_changelog_deleted_idx').on(table.userId, table.changelogId, table.deletedAt),
}));

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
    heatThresholdC: real('heat_threshold_c').default(30).notNull(),
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
    workoutSetId: text('workout_set_id'), // Reference to the set that achieved this PR
    achievedAt: timestamp('achieved_at'),
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
    weatherId: text('weather_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    userTimeIdx: index('score_user_time_idx').on(table.userId, table.createdAt),
    typeIdx: index('score_type_idx').on(table.eventType),
    userDeletedCreatedIdx: index('score_user_deleted_created_idx').on(table.userId, table.deletedAt, table.createdAt),
    userDeletedUpdatedIdx: index('score_user_deleted_updated_idx').on(table.userId, table.deletedAt, table.updatedAt),
    userWorkoutIdx: index('score_user_workout_idx').on(table.userId, table.workoutId),
}));

export const weatherLogs = pgTable('weather_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    workoutId: text('workout_id'),
    location: text('location'),
    lat: real('lat'),
    lon: real('lon'),
    condition: text('condition'),
    temperature: real('temperature'),
    tempC: real('temp_c'), // Legacy compatibility
    windSpeed: real('wind_speed'),
    humidity: integer('humidity'),
    isAdverse: boolean('is_adverse').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    userTimeIdx: index('weather_user_time_idx').on(table.userId, table.createdAt),
}));

export const notificationReactions = pgTable('notification_reactions', {
    id: text('id').primaryKey(),
    notificationId: text('notification_id').notNull(),
    userId: text('user_id').notNull(),
    type: text('type').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
});

export const activitySeen = pgTable('activity_seen', {
    id: text('id').primaryKey(),
    activityId: text('activity_id').notNull(),
    userId: text('user_id').notNull(),
    seenAt: timestamp('seen_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
}, (table) => ({
    activityUserIdx: index('activity_seen_activity_user_idx').on(table.activityId, table.userId),
    userActivityIdx: index('activity_seen_user_activity_idx').on(table.userId, table.activityId),
    userSeenIdx: index('activity_seen_user_seen_idx').on(table.userId, table.seenAt),
}));

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
