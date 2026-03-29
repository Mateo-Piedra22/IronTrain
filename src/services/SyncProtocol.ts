/**
 * SyncProtocol.ts
 * 
 * Centralized definition of the synchronization contract between the Mobile App and Cloud Backend.
 * This ensures that normalization rules, table definitions, and security policies are shared.
 * 
 * NOTE: Keys in bigIntColumns and booleanColumns must match the SNAKE_CASE database keys
 * to ensure consistency across Mobile (SQLite) and API (JSON).
 */

export interface TableConfig {
    name: string;
    requiresOwnership: boolean;
    localTable: string;
    remoteTable: string;
    bigIntColumns: string[];
    booleanColumns: string[];
    timestampColumns?: string[];
    // Tables that must be synced BEFORE this table to avoid FK issues
    dependsOn?: string[];
    // Manual overrides for field mapping if they don't follow camelCase/snake_case convention
    overrides?: Record<string, string>;
}

export const SYNC_TABLES: Record<string, TableConfig> = {
    workouts: {
        name: 'workouts',
        requiresOwnership: true,
        localTable: 'workouts',
        remoteTable: 'workouts',
        bigIntColumns: ['date', 'start_time', 'end_time', 'duration', 'updated_at', 'created_at', 'deleted_at'],
        booleanColumns: ['is_template'],
        timestampColumns: ['date', 'start_time', 'end_time', 'updated_at', 'created_at', 'deleted_at'],
    },
    workout_sets: {
        name: 'workout_sets',
        requiresOwnership: true,
        localTable: 'workout_sets',
        remoteTable: 'workout_sets',
        bigIntColumns: ['order_index', 'updated_at', 'created_at', 'deleted_at'],
        booleanColumns: ['completed'],
        timestampColumns: ['updated_at', 'created_at', 'deleted_at'],
        dependsOn: ['workouts', 'exercises'],
    },
    exercises: {
        name: 'exercises',
        requiresOwnership: false,
        localTable: 'exercises',
        remoteTable: 'exercises',
        bigIntColumns: ['updated_at', 'created_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['updated_at', 'created_at', 'deleted_at'],
        dependsOn: ['categories'],
    },
    categories: {
        name: 'categories',
        requiresOwnership: false,
        localTable: 'categories',
        remoteTable: 'categories',
        bigIntColumns: ['updated_at', 'created_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['updated_at', 'created_at', 'deleted_at'],
    },
    body_metrics: {
        name: 'body_metrics',
        requiresOwnership: true,
        localTable: 'body_metrics',
        remoteTable: 'body_metrics',
        bigIntColumns: ['date', 'created_at', 'updated_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['date', 'created_at', 'updated_at', 'deleted_at'],
    },
    measurements: {
        name: 'measurements',
        requiresOwnership: true,
        localTable: 'measurements',
        remoteTable: 'measurements',
        bigIntColumns: ['date', 'created_at', 'updated_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['date', 'created_at', 'updated_at', 'deleted_at'],
    },
    plate_inventory: {
        name: 'plate_inventory',
        requiresOwnership: true,
        localTable: 'plate_inventory',
        remoteTable: 'plate_inventory',
        bigIntColumns: ['updated_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['updated_at', 'deleted_at'],
    },
    routines: {
        name: 'routines',
        requiresOwnership: true,
        localTable: 'routines',
        remoteTable: 'routines',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at'],
        booleanColumns: ['is_active'],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at'],
    },
    routine_days: {
        name: 'routine_days',
        requiresOwnership: true,
        localTable: 'routine_days',
        remoteTable: 'routine_days',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at'],
        dependsOn: ['routines'],
    },
    routine_exercises: {
        name: 'routine_exercises',
        requiresOwnership: true,
        localTable: 'routine_exercises',
        remoteTable: 'routine_exercises',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at'],
        dependsOn: ['routine_days', 'exercises'],
    },
    goals: {
        name: 'goals',
        requiresOwnership: true,
        localTable: 'goals',
        remoteTable: 'goals',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at', 'deadline_at'],
        booleanColumns: ['is_completed'],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at', 'deadline_at'],
    },
    settings: {
        name: 'settings',
        requiresOwnership: true,
        localTable: 'settings',
        remoteTable: 'settings',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at'],
    },
    user_profiles: {
        name: 'user_profiles',
        requiresOwnership: true,
        localTable: 'user_profiles',
        remoteTable: 'user_profiles',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at', 'last_username_change_at', 'last_active_date', 'score_lifetime'],
        booleanColumns: ['is_public'],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at', 'last_username_change_at', 'last_active_date'],
    },
    kudos: {
        name: 'kudos',
        requiresOwnership: true,
        localTable: 'kudos',
        remoteTable: 'kudos',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at'],
        dependsOn: ['activity_feed'],
    },
    activity_feed: {
        name: 'activity_feed',
        requiresOwnership: true,
        localTable: 'activity_feed',
        remoteTable: 'activity_feed',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at', 'seen_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at', 'seen_at'],
    },
    shares_inbox: {
        name: 'shares_inbox',
        requiresOwnership: true,
        localTable: 'shares_inbox',
        remoteTable: 'shares_inbox',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at', 'seen_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at', 'seen_at'],
    },
    score_events: {
        name: 'score_events',
        requiresOwnership: true,
        localTable: 'score_events',
        remoteTable: 'score_events',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at', 'occurred_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at', 'occurred_at'],
        dependsOn: ['workouts'],
    },
    user_exercise_prs: {
        name: 'user_exercise_prs',
        requiresOwnership: true,
        localTable: 'user_exercise_prs',
        remoteTable: 'user_exercise_prs',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at', 'achieved_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at', 'achieved_at'],
        dependsOn: ['exercises', 'workouts'],
        overrides: {
            date: 'achieved_at',
            best_1rm_kg: 'best_1rm_kg',
            workout_set_id: 'workout_set_id'
        }
    },
    friendships: {
        name: 'friendships',
        requiresOwnership: true,
        localTable: 'friendships',
        remoteTable: 'friendships',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at', 'status_updated_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at', 'status_updated_at'],
    },
    changelogs: {
        name: 'changelogs',
        requiresOwnership: false,
        localTable: 'changelogs',
        remoteTable: 'changelogs',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at', 'published_at'],
        booleanColumns: ['is_unreleased'],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at', 'published_at'],
    },
    changelog_reactions: {
        name: 'changelog_reactions',
        requiresOwnership: true,
        localTable: 'changelog_reactions',
        remoteTable: 'changelog_reactions',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at'],
    },
    badges: {
        name: 'badges',
        requiresOwnership: false,
        localTable: 'badges',
        remoteTable: 'badges',
        bigIntColumns: ['updated_at', 'created_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['updated_at', 'created_at', 'deleted_at'],
    },
    exercise_badges: {
        name: 'exercise_badges',
        requiresOwnership: true,
        localTable: 'exercise_badges',
        remoteTable: 'exercise_badges',
        bigIntColumns: ['updated_at', 'created_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['updated_at', 'created_at', 'deleted_at'],
        dependsOn: ['exercises', 'badges'],
    },
    weather_logs: {
        name: 'weather_logs',
        requiresOwnership: true,
        localTable: 'weather_logs',
        remoteTable: 'weather_logs',
        bigIntColumns: ['created_at', 'updated_at', 'deleted_at'],
        booleanColumns: ['is_adverse'],
        timestampColumns: ['created_at', 'updated_at', 'deleted_at'],
        dependsOn: ['workouts'],
        overrides: {
            temperature: 'temp_c',
            temp_c: 'temp_c',
            wind_speed: 'wind_speed',
            is_adverse: 'is_adverse'
        }
    },
    notification_reactions: {
        name: 'notification_reactions',
        requiresOwnership: true,
        localTable: 'notification_reactions',
        remoteTable: 'notification_reactions',
        bigIntColumns: ['updated_at', 'created_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['updated_at', 'created_at', 'deleted_at'],
    },
    activity_seen: {
        name: 'activity_seen',
        requiresOwnership: true,
        localTable: 'activity_seen',
        remoteTable: 'activity_seen',
        bigIntColumns: ['seen_at', 'updated_at', 'deleted_at'],
        booleanColumns: [],
        timestampColumns: ['seen_at', 'updated_at', 'deleted_at'],
        dependsOn: ['activity_feed'],
        overrides: {
            activity_id: 'activity_id'
        }
    }
};

/**
 * Audit fields that are present in almost all tables
 */
export const COMMON_AUDIT_FIELDS = ['id', 'user_id', 'created_at', 'updated_at', 'deleted_at'];

/**
 * Mapping directions
 */
export type MapDirection = 'TO_REMOTE' | 'FROM_REMOTE' | 'TO_DRIZZLE';

/**
 * Returns tables in topological order based on dependencies.
 * Use for UPSERT (Parents first).
 */
export function getSyncOrder(): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const processing = new Set<string>();

    const visit = (tableName: string) => {
        if (processing.has(tableName)) return;
        if (visited.has(tableName)) return;

        processing.add(tableName);
        const config = SYNC_TABLES[tableName];
        if (config?.dependsOn) {
            for (const dep of config.dependsOn) {
                visit(dep);
            }
        }
        processing.delete(tableName);
        visited.add(tableName);
        sorted.push(tableName);
    };

    Object.keys(SYNC_TABLES).forEach(visit);
    return sorted;
}

/**
 * Pre-calculated orders for Pull/Push operations.
 */
export const PULL_UPSERT_ORDER = getSyncOrder();
export const PULL_DELETE_ORDER = [...PULL_UPSERT_ORDER].reverse();
