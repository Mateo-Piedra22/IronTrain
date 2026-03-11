import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { useAuthStore } from '../store/authStore';
import { Category, Exercise, ExerciseType, Workout, WorkoutSet } from '../types/db';

import { logger } from '../utils/logger';
import { uuidV4 } from '../utils/uuid';

const DB_NAME = 'irontrain_v1.db';
const SEED_DISABLED_KEY = 'irontrain_seed_disabled';
const UNCATEGORIZED_ID = 'uncategorized';
const UNCATEGORIZED_NAME = 'Sin categoría';
const LEGACY_UNCATEGORIZED_ID = 'sys-cat-1';


export class DatabaseService {
    private db: SQLite.SQLiteDatabase | null = null;
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;

    public async init(): Promise<void> {
        if (this.isInitialized) return;
        if (this.initPromise) {
            return await this.initPromise;
        }

        this.initPromise = (async () => {
            try {
                this.db = await SQLite.openDatabaseAsync(DB_NAME);

                // Enable foreign keys, set busy timeout and use WAL mode for better concurrency
                await this.db.execAsync('PRAGMA foreign_keys = ON;');
                await this.db.execAsync('PRAGMA busy_timeout = 10000;');
                await this.db.execAsync('PRAGMA journal_mode = WAL;');

                // Create Schema (calls runMigrations internally)
                await this.createTables();

                // Seed if empty
                await this.seedDatabase();

                this.isInitialized = true;
            } catch (error) {
                logger.captureException(error, { scope: 'DatabaseService.init', message: 'Database initialization failed' });
                throw error;
            } finally {
                this.initPromise = null;
            }
        })();
        await this.initPromise;
    }

    /**
     * Internal check to ensure DB is initialized before any non-init query.
     */
    private async ensureInitialized(): Promise<void> {
        if (this.isInitialized) return;

        // If the DB is already open and we are in the middle of initialization,
        // allow the call (likely an internal recursive call from init -> createTables -> run).
        if (this.db && this.initPromise) {
            return;
        }

        if (this.initPromise) {
            await this.initPromise;
        } else {
            await this.init();
        }
    }

    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('DB not open');

        const schema = `
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        is_system INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        color TEXT,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER,
        origin_id TEXT
      );

      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY NOT NULL,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        default_increment REAL DEFAULT 2.5,
        notes TEXT,
        is_system INTEGER DEFAULT 0,
        origin_id TEXT,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );

      CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY NOT NULL,
        date INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        finish_lat REAL,
        finish_lon REAL,
        name TEXT,
        notes TEXT,
        status TEXT NOT NULL,
        is_template INTEGER DEFAULT 0,
        duration INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS workout_sets (
        id TEXT PRIMARY KEY NOT NULL,
        workout_id TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL,
        reps INTEGER,
        distance REAL,
        time INTEGER,
        rpe REAL,
        order_index INTEGER NOT NULL,
        completed INTEGER DEFAULT 0,
        notes TEXT,
        superset_id TEXT,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER,
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        target_value REAL NOT NULL,
        current_value REAL DEFAULT 0,
        deadline INTEGER,
        type TEXT NOT NULL,
        reference_id TEXT,
        completed INTEGER DEFAULT 0,
        coop_user_id TEXT,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS measurements (
        id TEXT PRIMARY KEY NOT NULL,
        date INTEGER NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        unit TEXT NOT NULL,
        notes TEXT,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS body_metrics (
        id TEXT PRIMARY KEY NOT NULL,
        date INTEGER NOT NULL,
        weight REAL,
        body_fat REAL,
        notes TEXT,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS plate_inventory (
        id TEXT PRIMARY KEY NOT NULL,
        weight REAL NOT NULL,
        count INTEGER NOT NULL,
        available INTEGER NOT NULL,
        type TEXT DEFAULT 'standard',
        unit TEXT NOT NULL,
        color TEXT,
        updated_at INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS routine_days (
        id TEXT PRIMARY KEY NOT NULL,
        routine_id TEXT NOT NULL,
        name TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER,
        FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS routine_exercises (
        id TEXT PRIMARY KEY NOT NULL,
        routine_day_id TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        notes TEXT,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER,
        FOREIGN KEY (routine_day_id) REFERENCES routine_days (id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id)
      );

      CREATE TABLE IF NOT EXISTS badges (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT,
        group_name TEXT,
        is_system INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER,
        origin_id TEXT
      );

      CREATE TABLE IF NOT EXISTS exercise_badges (
        id TEXT PRIMARY KEY NOT NULL,
        exercise_id TEXT NOT NULL,
        badge_id TEXT NOT NULL,
        user_id TEXT,
        is_system INTEGER DEFAULT 0,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
        FOREIGN KEY (badge_id) REFERENCES badges (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_eb_exercise ON exercise_badges(exercise_id);


      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_public INTEGER DEFAULT 0,
        is_moderated INTEGER DEFAULT 0,
        moderation_message TEXT,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT,
        created_at INTEGER NOT NULL,
        synced_at INTEGER,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category_id);
      CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_id);
      CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets(workout_id);
      CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
      CREATE INDEX IF NOT EXISTS idx_routine_days_routine ON routine_days(routine_id);
      CREATE INDEX IF NOT EXISTS idx_routine_exercises_day ON routine_exercises(routine_day_id);

      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT,
        display_name TEXT,
        is_public INTEGER DEFAULT 1,
        share_stats INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        highest_streak INTEGER DEFAULT 0,
        score_lifetime INTEGER DEFAULT 0 NOT NULL,
        streak_weeks INTEGER DEFAULT 0 NOT NULL,
        streak_multiplier REAL DEFAULT 1 NOT NULL,
        streak_week_evaluated_at TEXT,
        last_active_date INTEGER,
        push_token TEXT,
        updated_at INTEGER DEFAULT 0,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS user_exercise_prs (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        weight REAL,
        reps INTEGER,
        one_rep_max REAL,
        date INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS score_events (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        points INTEGER NOT NULL,
        date INTEGER NOT NULL,
        reference_id TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS changelog_reactions (
        id TEXT PRIMARY KEY NOT NULL,
        changelog_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS kudos (
        id TEXT PRIMARY KEY NOT NULL,
        feed_id TEXT NOT NULL,
        giver_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS changelogs (
        id TEXT PRIMARY KEY NOT NULL,
        version TEXT NOT NULL,
        date INTEGER NOT NULL,
        items TEXT NOT NULL,
        is_unreleased INTEGER DEFAULT 0,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        reaction_count INTEGER DEFAULT 0 NOT NULL
      );

      CREATE TABLE IF NOT EXISTS friendships (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS shares_inbox (
        id TEXT PRIMARY KEY NOT NULL,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        seen_at INTEGER,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS activity_seen (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        activity_id TEXT NOT NULL,
        seen_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notification_reactions (
        id TEXT PRIMARY KEY NOT NULL,
        notification_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS activity_feed (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        reference_id TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        seen_at INTEGER,
        kudo_count INTEGER DEFAULT 0 NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id);
      CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
      CREATE INDEX IF NOT EXISTS idx_activity_feed_user ON activity_feed(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_seen_user ON activity_seen(user_id);
      CREATE INDEX IF NOT EXISTS idx_activity_seen_activity ON activity_seen(activity_id);
      CREATE INDEX IF NOT EXISTS idx_shares_receiver ON shares_inbox(receiver_id);
    `;

        await this.executeRaw(schema);

        // Safety check for settings table - ensure IT EXISTS
        try {
            const check = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='settings'");
            if (!check || check.count === 0) {
                await this.executeRaw(`
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY NOT NULL,
                        value TEXT NOT NULL,
                        description TEXT,
                        updated_at INTEGER DEFAULT 0
                    );
                 `);
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.createTables', message: 'Settings table check failed' });
        }

        await this.runMigrations();
    }

    private async runMigrations(): Promise<void> {
        // Migration 0: Migrate any legacy numeric IDs to UUIDs (Critical Task 1)
        try {
            // Check if we need to migrate first to avoid taking a lock if unnecessary
            const hasLegacy = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM categories WHERE length(id) < 15");

            if (hasLegacy && hasLegacy.count > 0) {
                logger.info('Running Critical Migration: Converting numeric IDs to UUIDs');
                await this.executeRaw('PRAGMA foreign_keys = OFF;');
                await this.withTransaction(async () => {
                    await this.run('DELETE FROM categories WHERE length(id) < 15;');
                    await this.run('DELETE FROM exercises WHERE length(id) < 15 OR length(category_id) < 15;');
                    await this.run('DELETE FROM workouts WHERE length(id) < 15;');
                    await this.run('DELETE FROM workout_sets WHERE length(id) < 15 OR length(workout_id) < 15 OR length(exercise_id) < 15;');
                    await this.run('DELETE FROM measurements WHERE length(id) < 15;');
                    await this.run('DELETE FROM goals WHERE length(id) < 15;');
                });
                await this.executeRaw('PRAGMA foreign_keys = ON;');
                logger.info('Legacy numeric data cleared for UUID consistency.');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Failed to migrate numeric IDs, rolling back' });
        }

        // Migration 1: Add superset_id to workout_sets if it doesn't exist
        try {
            const result = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('workout_sets') WHERE name='superset_id'");
            if (result && result.count === 0) {
                logger.info('Running Migration: Adding superset_id to workout_sets');
                await this.executeRaw('ALTER TABLE workout_sets ADD COLUMN superset_id TEXT');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration check failed (superset_id)' });
        }

        // Migration to fix goals table schema
        try {
            const result = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('goals') WHERE name='title'");
            if (result && result.count === 0) {
                logger.info('Running Migration: Fixing goals table schema');
                await this.executeRaw('DROP TABLE IF EXISTS goals');
                await this.executeRaw(`
                    CREATE TABLE IF NOT EXISTS goals (
                        id TEXT PRIMARY KEY NOT NULL,
                        title TEXT NOT NULL,
                        target_value REAL NOT NULL,
                        current_value REAL DEFAULT 0,
                        deadline INTEGER,
                        type TEXT NOT NULL,
                        reference_id TEXT,
                        completed INTEGER DEFAULT 0,
                        coop_user_id TEXT,
                        updated_at INTEGER DEFAULT 0,
                        deleted_at INTEGER
                    );
                `);
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration check failed (goals schema)' });
        }

        // Migration 2: Add rpe to workout_sets if it doesn't exist (Legacy DB support)
        try {
            const result = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('workout_sets') WHERE name='rpe'");
            if (result && result.count === 0) {
                logger.info('Running Migration: Adding rpe to workout_sets');
                await this.executeRaw('ALTER TABLE workout_sets ADD COLUMN rpe REAL');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration check failed (rpe)' });
        }

        // Migration 3: Create goals table
        try {
            await this.executeRaw(`
                CREATE TABLE IF NOT EXISTS goals (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    target_value REAL NOT NULL,
                    current_value REAL NOT NULL,
                    deadline INTEGER,
                    type TEXT NOT NULL,
                    reference_id TEXT,
                    completed INTEGER DEFAULT 0
                )
            `);
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration check failed (goals table)' });
        }

        // Migration 4: Ensure "Sin categoría" exists for safe reassignment
        try {
            const hasStable = await this.getFirst<{ id: string }>('SELECT id FROM categories WHERE id = ?', [UNCATEGORIZED_ID]);
            const hasLegacy = await this.getFirst<{ id: string }>('SELECT id FROM categories WHERE id = ?', [LEGACY_UNCATEGORIZED_ID]);

            if (hasLegacy?.id && !hasStable?.id) {
                await this.executeRaw('PRAGMA foreign_keys = OFF;');
                try {
                    await this.withTransaction(async () => {
                        await this.run('UPDATE categories SET id = ? WHERE id = ?', [UNCATEGORIZED_ID, LEGACY_UNCATEGORIZED_ID]);
                        await this.run('UPDATE exercises SET category_id = ? WHERE category_id = ?', [UNCATEGORIZED_ID, LEGACY_UNCATEGORIZED_ID]);
                    });
                } finally {
                    await this.executeRaw('PRAGMA foreign_keys = ON;');
                }
            }

            const systemCat = await this.getFirst<{ id: string }>('SELECT id FROM categories WHERE id = ?', [UNCATEGORIZED_ID]);
            if (!systemCat) {
                logger.info('Running Migration Check: Re-creating default category.');
                await this.run(
                    'INSERT OR IGNORE INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, 1, 999, ?)',
                    [UNCATEGORIZED_ID, UNCATEGORIZED_NAME, '#64748b']
                );
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration check failed (create system cat)' });
        }

        // Migration 5: Add origin_id to exercises and is_public to routines
        try {
            const resultEx = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('exercises') WHERE name='origin_id'");
            if (resultEx && resultEx.count === 0) {
                logger.info('Running Migration: Adding origin_id to exercises');
                await this.executeRaw('ALTER TABLE exercises ADD COLUMN origin_id TEXT');
            }

            const resultCat = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('categories') WHERE name='origin_id'");
            if (resultCat && resultCat.count === 0) {
                logger.info('Running Migration: Adding origin_id to categories');
                await this.executeRaw('ALTER TABLE categories ADD COLUMN origin_id TEXT');
            }

            const resultCatSys = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('categories') WHERE name='is_system'");
            if (resultCatSys && resultCatSys.count === 0) {
                logger.info('Running Migration: Adding is_system to categories');
                await this.executeRaw('ALTER TABLE categories ADD COLUMN is_system INTEGER DEFAULT 0');
            }

            const resultExSys = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('exercises') WHERE name='is_system'");
            if (resultExSys && resultExSys.count === 0) {
                logger.info('Running Migration: Adding is_system to exercises');
                await this.executeRaw('ALTER TABLE exercises ADD COLUMN is_system INTEGER DEFAULT 0');
            }

            const resultExOr = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('exercises') WHERE name='origin_id'");
            if (resultExOr && resultExOr.count === 0) {
                logger.info('Running Migration: Adding origin_id to exercises');
                await this.executeRaw('ALTER TABLE exercises ADD COLUMN origin_id TEXT');
            }

            const resultEB = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('exercise_badges') WHERE name='user_id'");
            if (resultEB && resultEB.count === 0) {
                logger.info('Running Migration: Adding user_id to exercise_badges');
                await this.executeRaw('ALTER TABLE exercise_badges ADD COLUMN user_id TEXT');
            }

            const resultEB_IS = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('exercise_badges') WHERE name='is_system'");
            if (resultEB_IS && resultEB_IS.count === 0) {
                logger.info('Running Migration: Adding is_system to exercise_badges');
                await this.executeRaw('ALTER TABLE exercise_badges ADD COLUMN is_system INTEGER DEFAULT 0');
            }

            const resultBadgeOr = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('badges') WHERE name='origin_id'");
            if (resultBadgeOr && resultBadgeOr.count === 0) {
                logger.info('Running Migration: Adding origin_id to badges');
                await this.executeRaw('ALTER TABLE badges ADD COLUMN origin_id TEXT');
            }

            const resultBadgeSys = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('badges') WHERE name='is_system'");
            if (resultBadgeSys && resultBadgeSys.count === 0) {
                logger.info('Running Migration: Adding is_system to badges');
                await this.executeRaw('ALTER TABLE badges ADD COLUMN is_system INTEGER DEFAULT 0');
            }

            const resultRoutine = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('routines') WHERE name='is_public'");
            if (resultRoutine && resultRoutine.count === 0) {
                logger.info('Running Migration: Adding is_public to routines');
                await this.executeRaw('ALTER TABLE routines ADD COLUMN is_public INTEGER DEFAULT 0');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration check failed (Migration 5/origin_id overhaul)' });
        }

        // Migration 6: Fix plate_inventory PK to include unit (weight,type,unit)
        try {
            const info = await this.getAll<{ name: string }>("PRAGMA table_info('plate_inventory')");
            const columns = info.map(c => c.name);
            if (!columns.includes('unit')) {
                await this.executeRaw("ALTER TABLE plate_inventory ADD COLUMN unit TEXT DEFAULT 'kg'");
            }

            const createSql = await this.getAll<{ sql: string | null }>(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='plate_inventory'"
            );
            const sqlText = createSql?.[0]?.sql ?? '';
            const pkHasUnit = /PRIMARY KEY\s*\(\s*weight\s*,\s*type\s*,\s*unit\s*\)/i.test(sqlText);

            if (!pkHasUnit) {
                await this.withTransaction(async () => {
                    await this.executeRaw(`
                        CREATE TABLE IF NOT EXISTS plate_inventory_new (
                            weight REAL NOT NULL,
                            count INTEGER DEFAULT 0,
                            type TEXT DEFAULT 'standard',
                            unit TEXT DEFAULT 'kg',
                            color TEXT,
                            PRIMARY KEY (weight, type, unit)
                        );
                    `);
                    await this.executeRaw(`
                        INSERT OR REPLACE INTO plate_inventory_new (weight, count, type, unit, color)
                        SELECT weight, count, type, COALESCE(unit, 'kg') as unit, NULL as color
                        FROM plate_inventory;
                    `);
                    await this.executeRaw('DROP TABLE plate_inventory;');
                    await this.executeRaw('ALTER TABLE plate_inventory_new RENAME TO plate_inventory;');
                });
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration check failed (plate_inventory pk/unit)' });
        }

        // Migration 11: Repair plate_inventory if a legacy migration removed required columns (id/available)
        try {
            const info = await this.getAll<{ name: string }>("PRAGMA table_info('plate_inventory')");
            const columns = info.map(c => c.name);

            const needsRepair = !columns.includes('id') || !columns.includes('available') || !columns.includes('updated_at');
            if (needsRepair) {
                await this.withTransaction(async () => {
                    await this.executeRaw(`
                        CREATE TABLE IF NOT EXISTS plate_inventory_new (
                            id TEXT PRIMARY KEY NOT NULL,
                            weight REAL NOT NULL,
                            count INTEGER NOT NULL,
                            available INTEGER NOT NULL,
                            type TEXT DEFAULT 'standard',
                            unit TEXT NOT NULL,
                            color TEXT,
                            updated_at INTEGER DEFAULT 0
                        );
                    `);

                    const hasUnit = columns.includes('unit');
                    const hasType = columns.includes('type');
                    const hasColor = columns.includes('color');
                    const hasCount = columns.includes('count');

                    const selectUnit = hasUnit ? "COALESCE(unit, 'kg')" : "'kg'";
                    const selectType = hasType ? "COALESCE(type, 'standard')" : "'standard'";
                    const selectColor = hasColor ? 'color' : 'NULL';
                    const selectCount = hasCount ? 'COALESCE(count, 0)' : '0';

                    await this.executeRaw(`
                        INSERT OR REPLACE INTO plate_inventory_new (id, weight, count, available, type, unit, color, updated_at)
                        SELECT
                            lower(hex(randomblob(16))) as id,
                            weight,
                            ${selectCount} as count,
                            1 as available,
                            ${selectType} as type,
                            ${selectUnit} as unit,
                            ${selectColor} as color,
                            0 as updated_at
                        FROM plate_inventory;
                    `);

                    await this.executeRaw('DROP TABLE plate_inventory;');
                    await this.executeRaw('ALTER TABLE plate_inventory_new RENAME TO plate_inventory;');
                    await this.executeRaw('CREATE UNIQUE INDEX IF NOT EXISTS idx_plate_inventory_unique ON plate_inventory(weight, type, unit);');
                });
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 11 failed (plate_inventory repair)' });
        }

        // Migration 6: Add color column to plate_inventory
        try {
            const info = await this.getAll<{ name: string }>("PRAGMA table_info('plate_inventory')");
            const columns = info.map(c => c.name);
            if (!columns.includes('color')) {
                logger.info('Running Migration: Adding color to plate_inventory');
                await this.executeRaw('ALTER TABLE plate_inventory ADD COLUMN color TEXT');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration check failed (plate_inventory color)' });
        }

        // Migration 7: Add duration column to workouts (elapsed seconds for timer persistence)
        try {
            const result = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('workouts') WHERE name='duration'");
            if (result && result.count === 0) {
                await this.executeRaw('ALTER TABLE workouts ADD COLUMN duration INTEGER DEFAULT 0');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration check failed (workouts duration)' });
        }

        // Migration 9: Add updated_at and deleted_at to all syncable tables for cloud sync
        const syncableTables = [
            'categories', 'exercises', 'workouts', 'workout_sets',
            'routines', 'routine_days', 'routine_exercises',
            'measurements', 'goals', 'plate_inventory', 'settings',
            'body_metrics', 'badges', 'exercise_badges', 'user_profiles',
            'changelog_reactions', 'kudos', 'activity_feed',
            'user_exercise_prs', 'score_events'
        ];

        const softDeleteTables = [
            'categories', 'exercises', 'workouts', 'workout_sets',
            'routines', 'routine_days', 'routine_exercises',
            'measurements', 'goals', 'body_metrics', 'badges',
            'exercise_badges', 'changelog_reactions', 'kudos', 'activity_feed',
            'user_exercise_prs', 'score_events'
        ];

        logger.info('Running Migration 9: Ensuring updated_at and deleted_at on all tables');
        for (const table of syncableTables) {
            try {
                const info = await this.getAll<{ name: string }>(`PRAGMA table_info('${table}')`);
                const columns = info.map(c => c.name);

                if (!columns.includes('updated_at')) {
                    logger.info(`[Migration] Adding updated_at to ${table}`);
                    await this.executeRaw(`ALTER TABLE ${table} ADD COLUMN updated_at INTEGER DEFAULT 0`);
                }

                if (!columns.includes('deleted_at') && softDeleteTables.includes(table)) {
                    logger.info(`[Migration] Adding deleted_at to ${table}`);
                    await this.executeRaw(`ALTER TABLE ${table} ADD COLUMN deleted_at INTEGER`);
                }
            } catch (e) {
                logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: `[Migration] Migration 9 failed for ${table}`, table });
            }
        }

        // Migration 10: Ensure synced_at exists in sync_queue
        try {
            const info = await this.getAll<{ name: string }>("PRAGMA table_info('sync_queue')");
            const columns = info.map(c => c.name);
            if (!columns.includes('synced_at')) {
                logger.info('Migration 10: Adding synced_at to sync_queue');
                await this.executeRaw('ALTER TABLE sync_queue ADD COLUMN synced_at INTEGER');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 10 failed' });
        }

        // Migration 11: Add moderation columns to routines
        try {
            const info = await this.getAll<{ name: string }>("PRAGMA table_info('routines')");
            const columns = info.map(c => c.name);
            if (!columns.includes('is_moderated')) {
                logger.info('Migration 11: Adding moderation columns to routines');
                await this.executeRaw('ALTER TABLE routines ADD COLUMN is_moderated INTEGER DEFAULT 0');
                await this.executeRaw('ALTER TABLE routines ADD COLUMN moderation_message TEXT');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 11 failed' });
        }

        // Migration 12: Add unit column to measurements if it doesn't exist
        try {
            const result = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('measurements') WHERE name='unit'");
            if (result && result.count === 0) {
                logger.info('Running Migration 12: Adding unit to measurements');
                await this.executeRaw("ALTER TABLE measurements ADD COLUMN unit TEXT DEFAULT 'cm'");
                // Fix legacy weights/fat if any
                await this.run("UPDATE measurements SET unit = 'kg' WHERE type = 'weight'");
                await this.run("UPDATE measurements SET unit = '%' WHERE type = 'body_fat'");
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 12 failed (measurements unit)' });
        }

        // Migration 13: Create changelog_reactions and kudos tables
        try {
            await this.executeRaw(`
                CREATE TABLE IF NOT EXISTS changelog_reactions (
                    id TEXT PRIMARY KEY NOT NULL,
                    changelog_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER
                );

                CREATE TABLE IF NOT EXISTS kudos (
                    id TEXT PRIMARY KEY NOT NULL,
                    feed_id TEXT NOT NULL,
                    giver_id TEXT NOT NULL,
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER
                );

                CREATE TABLE IF NOT EXISTS activity_feed (
                    id TEXT PRIMARY KEY NOT NULL,
                    user_id TEXT NOT NULL,
                    action_type TEXT NOT NULL,
                    reference_id TEXT,
                    metadata TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER,
                    kudo_count INTEGER DEFAULT 0 NOT NULL
                );
            `);

            const chRes = await this.getFirst<{ count: number }>(
                "SELECT count(*) as count FROM pragma_table_info('changelogs') WHERE name='reaction_count'"
            );
            if (chRes && chRes.count === 0) {
                await this.executeRaw("ALTER TABLE changelogs ADD COLUMN reaction_count INTEGER DEFAULT 0 NOT NULL");
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 13 failed (changelog_reactions/kudos/activity_feed)' });
        }

        try {
            const info = await this.getAll<{ name: string }>("PRAGMA table_info('workouts')");
            const columns = info.map((c) => c.name);
            if (!columns.includes('finish_lat')) {
                await this.executeRaw('ALTER TABLE workouts ADD COLUMN finish_lat REAL');
            }
            if (!columns.includes('finish_lon')) {
                await this.executeRaw('ALTER TABLE workouts ADD COLUMN finish_lon REAL');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 14 failed (workouts finish location)' });
        }

        // Migration 15: Social scoring columns and tables
        try {
            const userProfileInfo = await this.getAll<{ name: string }>("PRAGMA table_info('user_profiles')");
            const userProfileColumns = userProfileInfo.map(c => c.name);
            const scoringColumns = {
                'score_lifetime': 'INTEGER DEFAULT 0 NOT NULL',
                'streak_weeks': 'INTEGER DEFAULT 0 NOT NULL',
                'streak_multiplier': 'REAL DEFAULT 1 NOT NULL',
                'streak_week_evaluated_at': 'TEXT'
            };

            for (const [col, def] of Object.entries(scoringColumns)) {
                if (!userProfileColumns.includes(col)) {
                    logger.info(`[Migration] Adding ${col} to user_profiles`);
                    await this.executeRaw(`ALTER TABLE user_profiles ADD COLUMN ${col} ${def}`);
                }
            }

            // Create new scoring tables if missing
            await this.executeRaw(`
                CREATE TABLE IF NOT EXISTS user_exercise_prs (
                    id TEXT PRIMARY KEY NOT NULL,
                    user_id TEXT NOT NULL,
                    exercise_id TEXT NOT NULL,
                    weight REAL,
                    reps INTEGER,
                    one_rep_max REAL,
                    date INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER
                )
            `);
            await this.executeRaw(`
                CREATE TABLE IF NOT EXISTS score_events (
                    id TEXT PRIMARY KEY NOT NULL,
                    user_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    points INTEGER NOT NULL,
                    date INTEGER NOT NULL,
                    reference_id TEXT,
                    metadata TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER
                )
            `);
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: '[Migration] Migration 15 failed (social scoring)' });
        }

        // Migration 16: Robust alignment of scoring tables with remote schema (Social 2.1.0)
        try {
            logger.info('[Migration] Running Migration 16: Scoring alignment');
            const prInfo = await this.getAll<{ name: string }>("PRAGMA table_info('user_exercise_prs')");
            const prCols = prInfo.map(c => c.name);
            if (!prCols.includes('exercise_name')) {
                await this.executeRaw('ALTER TABLE user_exercise_prs ADD COLUMN exercise_name TEXT');
            }
            if (!prCols.includes('best_1rm_kg')) {
                await this.executeRaw('ALTER TABLE user_exercise_prs ADD COLUMN best_1rm_kg REAL');
            }

            const scoreInfo = await this.getAll<{ name: string }>("PRAGMA table_info('score_events')");
            const scoreCols = scoreInfo.map(c => c.name);
            if (!scoreCols.includes('event_type')) {
                await this.executeRaw('ALTER TABLE score_events ADD COLUMN event_type TEXT');
            }
            if (!scoreCols.includes('event_key')) {
                await this.executeRaw('ALTER TABLE score_events ADD COLUMN event_key TEXT');
            }
            if (!scoreCols.includes('points_base')) {
                await this.executeRaw('ALTER TABLE score_events ADD COLUMN points_base INTEGER');
            }
            if (!scoreCols.includes('points_awarded')) {
                await this.executeRaw('ALTER TABLE score_events ADD COLUMN points_awarded INTEGER');
            }
            if (!scoreCols.includes('streak_multiplier')) {
                await this.executeRaw('ALTER TABLE score_events ADD COLUMN streak_multiplier REAL DEFAULT 1');
            }
            if (!scoreCols.includes('global_multiplier')) {
                await this.executeRaw('ALTER TABLE score_events ADD COLUMN global_multiplier REAL DEFAULT 1');
            }
            if (!scoreCols.includes('workout_id')) {
                await this.executeRaw('ALTER TABLE score_events ADD COLUMN workout_id TEXT');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 16 failed' });
        }

        // Migration 17: Generic Name-Based Deduplication (Repairing Sync Issues)
        try {
            logger.info('[Migration] Running Migration 17: Generic Deduplication Repair');
            await this.repairDataConsistency();
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: '[Migration] Migration 17 failed' });
        }

        // Migration 18: Add updated_at to settings table
        try {
            const hasUpdatedAt = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('settings') WHERE name='updated_at'");
            if (!hasUpdatedAt || hasUpdatedAt.count === 0) {
                logger.info('[Migration] Migration 18: Adding updated_at to settings');
                await this.executeRaw('ALTER TABLE settings ADD COLUMN updated_at INTEGER DEFAULT 0');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 18 failed' });
        }

        // Migration 19: Add notification_reactions table (Push Center Kudos)
        try {
            logger.info('[Migration] Running Migration 19: notification_reactions');
            await this.executeRaw(`
                CREATE TABLE IF NOT EXISTS notification_reactions (
                    id TEXT PRIMARY KEY,
                    notification_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    type TEXT DEFAULT 'kudos',
                    created_at INTEGER,
                    updated_at INTEGER,
                    deleted_at INTEGER
                )
            `);
            await this.executeRaw(`CREATE INDEX IF NOT EXISTS idx_notif_reactions_notif ON notification_reactions (notification_id)`);
            await this.executeRaw(`CREATE INDEX IF NOT EXISTS idx_notif_reactions_user ON notification_reactions (user_id)`);
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 19 failed' });
        }

        // Migration 20: Add Marketplace Infrastructure Columns (Existing User Support)
        try {
            logger.info('[Migration] Running Migration 20: Adding Marketplace columns to categories/exercises/badges');
            const catInfo = await this.getAll<{ name: string }>("PRAGMA table_info('categories')");
            const catCols = catInfo.map(c => c.name);
            if (!catCols.includes('origin_id')) {
                await this.executeRaw('ALTER TABLE categories ADD COLUMN origin_id TEXT');
                await this.executeRaw('ALTER TABLE categories ADD COLUMN is_system INTEGER DEFAULT 0');
            }

            const exInfo = await this.getAll<{ name: string }>("PRAGMA table_info('exercises')");
            const exCols = exInfo.map(c => c.name);
            if (!exCols.includes('origin_id')) {
                await this.executeRaw('ALTER TABLE exercises ADD COLUMN origin_id TEXT');
                await this.executeRaw('ALTER TABLE exercises ADD COLUMN is_system INTEGER DEFAULT 0');
            }

            const badgeInfo = await this.getAll<{ name: string }>("PRAGMA table_info('badges')");
            const badgeCols = badgeInfo.map(c => c.name);
            if (!badgeCols.includes('origin_id')) {
                await this.executeRaw('ALTER TABLE badges ADD COLUMN origin_id TEXT');
                await this.executeRaw('ALTER TABLE badges ADD COLUMN is_system INTEGER DEFAULT 0');
            }

            const ebInfo = await this.getAll<{ name: string }>("PRAGMA table_info('exercise_badges')");
            const ebCols = ebInfo.map(c => c.name);
            if (!ebCols.includes('user_id')) {
                await this.executeRaw('ALTER TABLE exercise_badges ADD COLUMN user_id TEXT');
                await this.executeRaw('ALTER TABLE exercise_badges ADD COLUMN is_system INTEGER DEFAULT 0');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 20 failed' });
        }

        // Migration 21: Systemic Zero Trust alignment of user_id across all syncable tables
        try {
            logger.info('[Migration] Running Migration 21: Systemic user_id alignment');
            const syncableTables = [
                'exercises', 'categories', 'workouts', 'workout_sets',
                'routines', 'routine_days', 'routine_exercises',
                'measurements', 'goals', 'plate_inventory', 'settings',
                'body_metrics', 'badges', 'exercise_badges'
            ];

            for (const table of syncableTables) {
                const info = await this.getAll<{ name: string }>(`PRAGMA table_info('${table}')`);
                const cols = info.map(c => c.name);
                if (!cols.includes('user_id')) {
                    logger.info(`[Migration 21] Adding user_id to ${table}`);
                    await this.executeRaw(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`);
                }
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 21 failed' });
        }

        // Migration 22: Add seen_at to activity_feed
        try {
            const info = await this.getAll<{ name: string }>("PRAGMA table_info('activity_feed')");
            const cols = info.map(c => c.name);
            if (!cols.includes('seen_at')) {
                logger.info('[Migration 22] Adding seen_at to activity_feed');
                await this.executeRaw('ALTER TABLE activity_feed ADD COLUMN seen_at INTEGER');
            }
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 22 failed' });
        }

        // Migration 23: Social Sync Infrastructure (shares_inbox, activity_seen, notification_reactions)
        try {
            logger.info('[Migration] Running Migration 23: Social Infrastructure');

            await this.executeRaw(`
                CREATE TABLE IF NOT EXISTS shares_inbox (
                    id TEXT PRIMARY KEY NOT NULL,
                    sender_id TEXT NOT NULL,
                    receiver_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    seen_at INTEGER,
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER
                );
            `);

            await this.executeRaw(`
                CREATE TABLE IF NOT EXISTS activity_seen (
                    id TEXT PRIMARY KEY NOT NULL,
                    user_id TEXT NOT NULL,
                    activity_id TEXT NOT NULL,
                    seen_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
            `);

            await this.executeRaw(`
                CREATE TABLE IF NOT EXISTS notification_reactions (
                    id TEXT PRIMARY KEY NOT NULL,
                    notification_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    type TEXT NOT NULL,
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER
                );
            `);

            await this.executeRaw(`
                CREATE TABLE IF NOT EXISTS friendships (
                    id TEXT PRIMARY KEY NOT NULL,
                    user_id TEXT NOT NULL,
                    friend_id TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER
                );
            `);

            await this.executeRaw('CREATE INDEX IF NOT EXISTS idx_activity_seen_user ON activity_seen(user_id)');
            await this.executeRaw('CREATE INDEX IF NOT EXISTS idx_activity_seen_activity ON activity_seen(activity_id)');
            await this.executeRaw('CREATE INDEX IF NOT EXISTS idx_shares_receiver ON shares_inbox(receiver_id)');
            await this.executeRaw('CREATE INDEX IF NOT EXISTS idx_friendships_user ON friendships(user_id)');
            await this.executeRaw('CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id)');
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.runMigrations', message: 'Migration 23 failed' });
        }
    }

    /**
     * Public method to deduplicate categories, exercises, and badges.
     * Can be called during migrations OR after a sync pull to ensure zero duplicates.
     */
    public async repairDataConsistency(): Promise<void> {
        await this.executeRaw('PRAGMA foreign_keys = OFF;');
        try {
            await this.withTransaction(async () => {

                // Helper to queue deletions for merged records
                const queueDelete = async (table: string, id: string) => {
                    await this.queueSyncMutation(table, id, 'DELETE');
                };

                // 1. Uncategorized Consistency
                const uncategorizedRows = await this.getAll<{ id: string }>(
                    "SELECT id FROM categories WHERE name = ? OR id = ? OR id = ?",
                    [UNCATEGORIZED_NAME, UNCATEGORIZED_ID, LEGACY_UNCATEGORIZED_ID]
                );
                if (uncategorizedRows.length > 0) {
                    for (const row of uncategorizedRows) {
                        if (row.id !== UNCATEGORIZED_ID) {
                            await this.run('UPDATE exercises SET category_id = ? WHERE category_id = ?', [UNCATEGORIZED_ID, row.id]);
                            await this.run('DELETE FROM categories WHERE id = ?', [row.id]);
                            await queueDelete('categories', row.id);
                        }
                    }
                    await this.run(
                        "INSERT OR REPLACE INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, 1, 999, '#64748b')",
                        [UNCATEGORIZED_ID, UNCATEGORIZED_NAME]
                    );
                }

                // 2. Generic Category Deduplication (Marketplace Aware)
                // Priority: origin_id > is_system > id
                const duplicateCats = await this.getAll<{ name: string }>(
                    "SELECT name FROM categories WHERE name != ? GROUP BY name HAVING COUNT(*) > 1",
                    [UNCATEGORIZED_NAME]
                );
                for (const cat of duplicateCats) {
                    const instances = await this.getAll<{ id: string, origin_id: string, is_system: number }>(
                        "SELECT id, origin_id, is_system FROM categories WHERE name = ? ORDER BY origin_id DESC, is_system DESC, id ASC",
                        [cat.name]
                    );
                    const master = instances[0];
                    const duplicates = instances.slice(1);
                    for (const dupe of duplicates) {
                        // Level 3: Auto-Link if dupe has NO origin_id but master DOES
                        await this.run('UPDATE exercises SET category_id = ? WHERE category_id = ?', [master.id, dupe.id]);
                        await this.run('DELETE FROM categories WHERE id = ?', [dupe.id]);
                        await queueDelete('categories', dupe.id);
                    }
                }

                // 3. Generic Badge Deduplication (Marketplace Aware)
                const duplicateBadges = await this.getAll<{ name: string }>("SELECT name FROM badges GROUP BY name HAVING COUNT(*) > 1");
                for (const b of duplicateBadges) {
                    const instances = await this.getAll<{ id: string, origin_id: string }>(
                        "SELECT id, origin_id FROM badges WHERE name = ? ORDER BY origin_id DESC, id ASC",
                        [b.name]
                    );
                    const masterId = instances[0].id;
                    const duplicates = instances.slice(1);
                    for (const dupe of duplicates) {
                        await this.run('UPDATE exercise_badges SET badge_id = ? WHERE badge_id = ?', [masterId, dupe.id]);
                        await this.run('DELETE FROM badges WHERE id = ?', [dupe.id]);
                        await queueDelete('badges', dupe.id);
                    }
                }

                // 4. Badge-Aware Exercise Deduplication (Marketplace Aware)
                // Signature includes category_id, name (lowercased), and sorted badges
                const allExs = await this.getAll<{ id: string, name: string, category_id: string, origin_id: string }>(
                    "SELECT id, name, category_id, origin_id FROM exercises"
                );

                const exerciseMap = new Map<string, Array<{ id: string, origin_id: string }>>();

                for (const ex of allExs) {
                    const badgeRows = await this.getAll<{ badge_id: string }>(
                        "SELECT badge_id FROM exercise_badges WHERE exercise_id = ? AND deleted_at IS NULL ORDER BY badge_id ASC",
                        [ex.id]
                    );
                    const badgeSig = badgeRows.map(b => b.badge_id).join('|');
                    const signature = `${ex.category_id}#${ex.name.toLowerCase().trim()}#${badgeSig}`;

                    if (!exerciseMap.has(signature)) {
                        exerciseMap.set(signature, []);
                    }
                    exerciseMap.get(signature)!.push({ id: ex.id, origin_id: ex.origin_id || '' });
                }

                for (const [signature, records] of exerciseMap.entries()) {
                    if (records.length > 1) {
                        // Priority: record with origin_id
                        const sorted = [...records].sort((a, b) => b.origin_id.localeCompare(a.origin_id) || a.id.localeCompare(b.id));
                        const master = sorted[0];
                        const duplicates = sorted.slice(1);

                        for (const dupe of duplicates) {
                            await this.run('UPDATE workout_sets SET exercise_id = ? WHERE exercise_id = ?', [master.id, dupe.id]);
                            await this.run('UPDATE routine_exercises SET exercise_id = ? WHERE exercise_id = ?', [master.id, dupe.id]);
                            await this.run('UPDATE user_exercise_prs SET exercise_id = ? WHERE exercise_id = ?', [master.id, dupe.id]);

                            // Deduplicate badges before moving to avoid PK/Unique issues on the master
                            const masterBadges = await this.getAll<{ badge_id: string }>('SELECT badge_id FROM exercise_badges WHERE exercise_id = ?', [master.id]);
                            const masterBadgeIds = masterBadges.map(b => b.badge_id);

                            if (masterBadgeIds.length > 0) {
                                // Delete badges from the duplicate that already exist on the master
                                const placeHolders = masterBadgeIds.map(() => '?').join(',');
                                await this.run(`DELETE FROM exercise_badges WHERE exercise_id = ? AND badge_id IN (${placeHolders})`, [dupe.id, ...masterBadgeIds]);
                            }

                            await this.run('UPDATE exercise_badges SET exercise_id = ? WHERE exercise_id = ?', [master.id, dupe.id]);
                            await this.run('DELETE FROM exercises WHERE id = ?', [dupe.id]);
                            await queueDelete('exercises', dupe.id);
                        }
                    }
                }

                // 5. Workout Sets Deduplication (Sync Glitch: same workout_id + order_index)
                const dupeSets = await this.getAll<{ id: string }>(`
                    SELECT id FROM workout_sets 
                    WHERE rowid NOT IN (
                        SELECT MIN(rowid) FROM workout_sets GROUP BY workout_id, order_index
                    )
                `);
                for (const s of dupeSets) {
                    await this.run('DELETE FROM workout_sets WHERE id = ?', [s.id]);
                    await queueDelete('workout_sets', s.id);
                }

                // 6. Routine Day Deduplication
                const dupeDays = await this.getAll<{ id: string }>(`
                    SELECT id FROM routine_days 
                    WHERE rowid NOT IN (
                        SELECT MIN(rowid) FROM routine_days GROUP BY routine_id, order_index
                    )
                `);
                for (const d of dupeDays) {
                    await this.run('DELETE FROM routine_days WHERE id = ?', [d.id]);
                    await queueDelete('routine_days', d.id);
                }

                // 7. PR Deduplication
                const dupePRs = await this.getAll<{ id: string }>(`
                    SELECT id FROM user_exercise_prs
                    WHERE rowid NOT IN (
                        SELECT MIN(rowid) FROM user_exercise_prs GROUP BY user_id, exercise_id, weight, reps, date
                    )
                `);
                for (const pr of dupePRs) {
                    await this.run('DELETE FROM user_exercise_prs WHERE id = ?', [pr.id]);
                    await queueDelete('user_exercise_prs', pr.id);
                }

                // 8. Body Metrics / Measurements Deduplication (Keep newest entry per day)
                const dupeMetrics = await this.getAll<{ id: string }>(`SELECT id FROM body_metrics WHERE rowid NOT IN (SELECT MAX(rowid) FROM body_metrics GROUP BY date)`);
                for (const m of dupeMetrics) { await this.run('DELETE FROM body_metrics WHERE id = ?', [m.id]); await queueDelete('body_metrics', m.id); }

                const dupeMeasures = await this.getAll<{ id: string }>(`SELECT id FROM measurements WHERE rowid NOT IN (SELECT MAX(rowid) FROM measurements GROUP BY date, type)`);
                for (const m of dupeMeasures) { await this.run('DELETE FROM measurements WHERE id = ?', [m.id]); await queueDelete('measurements', m.id); }

                // 9. Legacy Fixes & Names
                await this.run("UPDATE measurements SET unit = 'kg' WHERE type = 'weight' AND (unit IS NULL OR unit = 'cm')");
                await this.run("UPDATE measurements SET unit = '%' WHERE type = 'body_fat' AND (unit IS NULL OR unit = 'cm')");
                await this.run(`
                    UPDATE user_exercise_prs 
                    SET exercise_name = (SELECT name FROM exercises WHERE exercises.id = user_exercise_prs.exercise_id)
                    WHERE exercise_name IS NULL OR exercise_name = ''
                `);

                // 10. Social System Deduplication (Feed, Kudos, Reactions)
                const dupeReactions = await this.getAll<{ id: string }>(`SELECT id FROM changelog_reactions WHERE rowid NOT IN (SELECT MIN(rowid) FROM changelog_reactions GROUP BY user_id, changelog_id, type)`);
                for (const r of dupeReactions) { await this.run('DELETE FROM changelog_reactions WHERE id = ?', [r.id]); await queueDelete('changelog_reactions', r.id); }

                const dupeKudos = await this.getAll<{ id: string }>(`SELECT id FROM kudos WHERE rowid NOT IN (SELECT MIN(rowid) FROM kudos GROUP BY feed_id, giver_id)`);
                for (const k of dupeKudos) { await this.run('DELETE FROM kudos WHERE id = ?', [k.id]); await queueDelete('kudos', k.id); }

                const dupeScore = await this.getAll<{ id: string }>(`SELECT id FROM score_events WHERE rowid NOT IN (SELECT MIN(rowid) FROM score_events GROUP BY user_id, type, reference_id, date)`);
                for (const s of dupeScore) { await this.run('DELETE FROM score_events WHERE id = ?', [s.id]); await queueDelete('score_events', s.id); }

                const dupeFeed = await this.getAll<{ id: string }>(`SELECT id FROM activity_feed WHERE rowid NOT IN (SELECT MIN(rowid) FROM activity_feed GROUP BY user_id, action_type, reference_id, created_at)`);
                for (const f of dupeFeed) { await this.run('DELETE FROM activity_feed WHERE id = ?', [f.id]); await queueDelete('activity_feed', f.id); }

                // 11. Cross-Table Integrity Cleanup (Orphans)
                // Remove kudos whose feed item is gone
                const orphanKudos = await this.getAll<{ id: string }>(`SELECT id FROM kudos WHERE feed_id NOT IN (SELECT id FROM activity_feed)`);
                for (const k of orphanKudos) { await this.run('DELETE FROM kudos WHERE id = ?', [k.id]); await queueDelete('kudos', k.id); }

                // Remove reactions whose changelog is gone
                const orphanReactions = await this.getAll<{ id: string }>(`SELECT id FROM changelog_reactions WHERE changelog_id NOT IN (SELECT id FROM changelogs)`);
                for (const r of orphanReactions) { await this.run('DELETE FROM changelog_reactions WHERE id = ?', [r.id]); await queueDelete('changelog_reactions', r.id); }

                // 12. Junction Table Cleanup (Final physical safety, no sync needed as it's a junction)
                await this.executeRaw(`DELETE FROM exercise_badges WHERE rowid NOT IN (SELECT MIN(rowid) FROM exercise_badges GROUP BY exercise_id, badge_id)`);
                await this.executeRaw(`DELETE FROM routine_exercises WHERE rowid NOT IN (SELECT MIN(rowid) FROM routine_exercises GROUP BY routine_day_id, exercise_id, order_index)`);

                // 13. Systemic Backfill of user_id for all syncable tables (Zero Trust)
                const userId = useAuthStore.getState().user?.id;
                if (userId) {
                    const syncableTables = [
                        'exercises', 'categories', 'workouts', 'workout_sets',
                        'routines', 'routine_days', 'routine_exercises',
                        'measurements', 'goals', 'plate_inventory', 'settings',
                        'body_metrics', 'badges', 'exercise_badges',
                        'user_exercise_prs', 'score_events', 'activity_feed',
                        'notification_reactions', 'changelog_reactions', 'kudos'
                    ];

                    for (const table of syncableTables) {
                        try {
                            const info = await this.getAll<{ name: string }>(`PRAGMA table_info('${table}')`);
                            const cols = info.map(c => c.name);
                            if (cols.includes('user_id')) {
                                await this.run(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL OR user_id = ''`, [userId]);
                            } else if (table === 'kudos' && cols.includes('giver_id')) {
                                await this.run(`UPDATE kudos SET giver_id = ? WHERE giver_id IS NULL OR giver_id = ''`, [userId]);
                            }
                        } catch (e) {
                            // Silent catch for individual tables
                        }
                    }
                }
            });
        } finally {
            await this.executeRaw('PRAGMA foreign_keys = ON;');
        }
    }

    private async seedDatabase(): Promise<void> {
        const seedDisabled = await SecureStore.getItemAsync(SEED_DISABLED_KEY);
        if (seedDisabled === '1') {
            return;
        }

        // Just ensure Sin categoría exists. No other system data.
        const uncategorized = await this.getFirst('SELECT id FROM categories WHERE id = ? OR name = ?', [UNCATEGORIZED_ID, UNCATEGORIZED_NAME]);
        if (!uncategorized) {
            await this.run(
                'INSERT INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, 1, 999, "#64748b")',
                [UNCATEGORIZED_ID, UNCATEGORIZED_NAME]
            );
        }
    }

    private async seedBadges(): Promise<void> {
        // No longer seeding system badges as user builds their own.
    }


    // --- CATEGORIES ---

    public async getCategories(): Promise<Category[]> {
        return await this.getAll<Category>('SELECT * FROM categories ORDER BY sort_order ASC');
    }

    // --- EXERCISES ---

    /**
     * Search exercises by name (case insensitive usually via LIKE)
     * Optional category filtering.
     */
    public async searchExercises(query: string, categoryId?: string): Promise<(Exercise & { category_name: string; category_color: string })[]> {
        let sql = `
            SELECT e.*, c.name as category_name, c.color as category_color
            FROM exercises e
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (query) {
            sql += ` AND e.name LIKE ?`;
            params.push(`%${query}%`);
        }

        if (categoryId && categoryId !== 'all') {
            sql += ` AND e.category_id = ?`;
            params.push(categoryId);
        }

        sql += ` ORDER BY e.name ASC`;

        return await this.getAll(sql, params);
    }

    public async getExercises(): Promise<Exercise[]> {
        return this.getAll<Exercise>(`
      SELECT e.*, c.name as category_name 
      FROM exercises e 
      LEFT JOIN categories c ON e.category_id = c.id
      ORDER BY e.name ASC
    `);
    }

    public async getExerciseById(id: string): Promise<Exercise | null> {
        return this.getFirst<Exercise>('SELECT * FROM exercises WHERE id = ?', [id]);
    }

    public async createExercise(exercise: Partial<Exercise>): Promise<string> {
        const id = this.generateId();
        const now = Date.now();
        await this.run(
            `INSERT INTO exercises (id, category_id, name, type, default_increment, notes, is_system, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                exercise.category_id,
                exercise.name,
                exercise.type,
                exercise.default_increment ?? 2.5,
                exercise.notes ?? null,
                0, // User created
                now
            ]
        );
        await this.queueSyncMutation('exercises', id, 'INSERT', { ...exercise, id, is_system: 0, updated_at: now, deleted_at: null });
        return id;
    }

    public async updateExercise(id: string, updates: Partial<Exercise>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        const now = Date.now();

        Object.entries(updates).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        values.push(now);

        values.push(id);
        await this.run(`UPDATE exercises SET ${fields.join(', ')} WHERE id = ?`, values);
        await this.queueSyncMutation('exercises', id, 'UPDATE', { ...updates, updated_at: now });
    }

    // --- WORKOUTS ---

    public async getWorkoutByDate(dateStart: number, dateEnd: number): Promise<Workout | null> {
        return await this.getFirst<Workout>(
            'SELECT * FROM workouts WHERE date >= ? AND date < ? ORDER BY start_time DESC, date DESC LIMIT 1',
            [dateStart, dateEnd]
        );
    }

    public async getWorkoutById(id: string): Promise<Workout | null> {
        return await this.getFirst<Workout>('SELECT * FROM workouts WHERE id = ?', [id]);
    }

    public async createWorkout(date: number): Promise<string> {
        const id = this.generateId();
        const now = Date.now();
        await this.run(
            'INSERT INTO workouts (id, date, start_time, status, is_template, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
            [id, date, now, 'in_progress', 0, now]
        );
        await this.queueSyncMutation('workouts', id, 'INSERT', { id, date, start_time: now, status: 'in_progress', is_template: 0, updated_at: now, deleted_at: null });
        return id;
    }

    // --- SETS ---

    public async getSetsForWorkout(workoutId: string): Promise<(WorkoutSet & { exercise_name: string; category_color: string; exercise_type: ExerciseType; badges: any[] })[]> {
        // Join with exercises to get names for the UI, and subquery for badges
        const rows = await this.getAll<any>(
            `SELECT ws.*, e.name as exercise_name, e.type as exercise_type, c.color as category_color,
            (SELECT GROUP_CONCAT(b.name || '|' || b.color || '|' || COALESCE(b.icon, '')) 
             FROM badges b 
             JOIN exercise_badges eb ON b.id = eb.badge_id 
             WHERE eb.exercise_id = e.id AND eb.deleted_at IS NULL AND b.deleted_at IS NULL) as badges_csv
        FROM workout_sets ws
        JOIN exercises e ON ws.exercise_id = e.id
        LEFT JOIN categories c ON e.category_id = c.id
        WHERE ws.workout_id = ? 
        ORDER BY ws.order_index ASC`,
            [workoutId]
        );

        return rows.map(row => {
            const badges = row.badges_csv ? row.badges_csv.split(',').map((s: string) => {
                const [name, color, icon] = s.split('|');
                return { name, color, icon: icon || undefined };
            }) : [];
            return { ...row, badges };
        });
    }

    public async addSet(set: Partial<WorkoutSet> & { workout_id: string; exercise_id: string; order_index: number; type: string }): Promise<string> {
        const id = this.generateId();
        const now = Date.now();
        await this.run(
            `INSERT INTO workout_sets (id, workout_id, exercise_id, type, weight, reps, distance, time, rpe, order_index, completed, notes, superset_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                set.workout_id,
                set.exercise_id,
                set.type,
                set.weight ?? null,
                set.reps ?? null,
                set.distance ?? null,
                set.time ?? null,
                set.rpe ?? null,
                set.order_index,
                set.completed ?? 0,
                set.notes ?? null,
                set.superset_id ?? null,
                now
            ]
        );
        await this.queueSyncMutation('workout_sets', id, 'INSERT', { ...set, id, updated_at: now, deleted_at: null });
        return id;
    }

    public async updateSet(id: string, updates: Partial<WorkoutSet>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        const now = Date.now();

        Object.entries(updates).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (fields.length === 0) return;

        fields.push('updated_at = ?');
        values.push(now);

        values.push(id);
        await this.run(`UPDATE workout_sets SET ${fields.join(', ')} WHERE id = ?`, values);
        await this.queueSyncMutation('workout_sets', id, 'UPDATE', { ...updates, updated_at: now });
    }

    public async deleteSet(id: string): Promise<void> {
        await this.run('DELETE FROM workout_sets WHERE id = ?', [id]);
        await this.queueSyncMutation('workout_sets', id, 'DELETE');
    }

    public async getSetById(id: string): Promise<WorkoutSet | null> {
        return await this.getFirst<WorkoutSet>('SELECT * FROM workout_sets WHERE id = ?', [id]);
    }

    public async factoryReset(): Promise<void> {
        await this.executeRaw('PRAGMA foreign_keys = OFF;');
        try {
            await this.withTransaction(async () => {
                await this.run('DELETE FROM workout_sets');
                await this.run('DELETE FROM workouts');

                await this.run('DELETE FROM measurements');
                await this.run('DELETE FROM goals');
                await this.run('DELETE FROM body_metrics');
                await this.run('DELETE FROM plate_inventory');

                await this.run('DELETE FROM routine_exercises');
                await this.run('DELETE FROM routine_days');
                await this.run('DELETE FROM routines');

                await this.run('DELETE FROM exercises');
                await this.run('DELETE FROM categories');
                await this.run("INSERT OR IGNORE INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, 1, 999, '#64748b')", [UNCATEGORIZED_ID, UNCATEGORIZED_NAME]);

                await this.run('DELETE FROM exercise_badges');
                await this.run('DELETE FROM badges');

                await this.run('DELETE FROM sync_queue');
                await this.run('DELETE FROM settings');
            });
        } finally {
            await this.executeRaw('PRAGMA foreign_keys = ON;');
        }

        const fkIssues = await this.getAll<{ table: string; rowid: number; parent: string; fkid: number }>('PRAGMA foreign_key_check;');
        if (fkIssues.length > 0) {
            const first = fkIssues[0];
            throw new Error(`Factory reset integrity check failed (foreign_key_check). First issue: table=${first.table} rowid=${first.rowid} parent=${first.parent} fkid=${first.fkid}`);
        }

        await SecureStore.setItemAsync(SEED_DISABLED_KEY, '1');
    }

    // --- GHOST VALUES / HISTORY ---

    /**
     * Findings the most recent completed set for a specific exercise to use as ghost values.
     * Excluding current workout if possible, or just strict history.
     */
    public async getLastSetForExercise(exerciseId: string): Promise<WorkoutSet | null> {
        return await this.getFirst<WorkoutSet>(
            `SELECT * FROM workout_sets 
       WHERE exercise_id = ? AND completed = 1 
       ORDER BY rowid DESC LIMIT 1`,
            [exerciseId]
        );
    }

    // --- SYNC QUEUE HELPERS (OFFLINE FIRST) ---
    /**
     * Enqueues a mutation representing a locally performed operation.
     * This ensures any offline changes are eventually synced to the server.
     */
    public async queueSyncMutation(
        tableName: string,
        recordId: string,
        operation: 'INSERT' | 'UPDATE' | 'DELETE',
        payload?: any
    ): Promise<void> {
        if (!this.db) return;
        try {
            // --- Zero Trust: Automatic user_id injection for sync payloads ---
            let finalPayload = payload;
            if (operation !== 'DELETE' && payload && typeof payload === 'object') {
                const userId = useAuthStore.getState().user?.id;
                if (userId && !payload.user_id && !payload.userId) {
                    finalPayload = { ...payload, user_id: userId };
                }
            }

            await this.run(
                `INSERT INTO sync_queue (id, table_name, record_id, operation, payload, created_at, status, retry_count)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`,
                [
                    this.generateId(),
                    tableName,
                    recordId,
                    operation,
                    finalPayload ? JSON.stringify(finalPayload) : null,
                    Date.now()
                ]
            );
        } catch (e) {
            logger.captureException(e, { scope: 'DatabaseService.queueSyncMutation', message: '[SyncQueue] Failed to enqueue mutation' });
        }
    }

    // Helper Utils
    public getDatabase(): SQLite.SQLiteDatabase {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }
        return this.db;
    }

    private generateId(): string {
        return uuidV4();
    }

    private normalizeParams(params: any[] = []): any[] {
        if (!Array.isArray(params)) return [];
        return params.map((p) => (p === undefined ? null : p));
    }

    // --- UTILITIES ---

    private async executeWithRetry<T>(operation: () => Promise<T>, retries = 3, delay = 150): Promise<T> {
        let lastError: any;
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;
                const msg = error?.message || '';
                const isForeignKey = msg.includes('FOREIGN KEY constraint failed');
                const isUnique = msg.includes('UNIQUE constraint failed');
                const isLocked = (
                    msg.includes('database is locked')
                    || error?.code === 'SQLITE_BUSY'
                    || (msg.includes('finalizeAsync') && (!isForeignKey && !isUnique))
                    || (msg.includes('finalizeAsync') && isUnique) // Retry on finalize UNIQUE race
                );
                if (isLocked) {
                    logger.warn(`[Database] Busy/Locked/Race (attempt ${i + 1}/${retries}). Retrying...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }
        throw lastError;
    }

    public async run(sql: string, params: any[] = []): Promise<SQLite.SQLiteRunResult> {
        await this.ensureInitialized();
        return await this.executeWithRetry(async () => {
            return await this.db!.runAsync(sql, ...this.normalizeParams(params));
        });
    }

    public async executeRaw(sql: string): Promise<void> {
        await this.ensureInitialized();
        return await this.executeWithRetry(async () => {
            await this.db!.execAsync(sql);
        });
    }

    public async withTransaction(callback: () => Promise<void>): Promise<void> {
        await this.ensureInitialized();
        return await this.executeWithRetry(async () => {
            return await this.db!.withTransactionAsync(callback);
        });
    }

    public async withTransactionAsync(callback: (db: SQLite.SQLiteDatabase) => Promise<void>): Promise<void> {
        await this.ensureInitialized();
        return await this.executeWithRetry(async () => {
            return await this.db!.withTransactionAsync(() => callback(this.db!));
        });
    }

    public async getAll<T>(sql: string, params: any[] = []): Promise<T[]> {
        await this.ensureInitialized();
        return await this.executeWithRetry(async () => {
            return await this.db!.getAllAsync(sql, ...this.normalizeParams(params)) as T[];
        });
    }

    public async getFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
        await this.ensureInitialized();
        return await this.executeWithRetry(async () => {
            return await this.db!.getFirstAsync(sql, ...this.normalizeParams(params)) as T | null;
        });
    }
}

export const dbService = new DatabaseService();
