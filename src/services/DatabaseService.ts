import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { Category, Exercise, ExerciseType, Workout, WorkoutSet } from '../types/db';
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
                console.error('[Error] Database initialization failed:', error);
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
        deleted_at INTEGER
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

      CREATE TABLE IF NOT EXISTS routines (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_public INTEGER DEFAULT 0,
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
                        description TEXT
                    );
                 `);
            }
        } catch (e) {
            console.error('Settings table check failed', e);
        }

        await this.runMigrations();
    }

    private async runMigrations(): Promise<void> {
        // Migration 0: Migrate any legacy numeric IDs to UUIDs (Critical Task 1)
        try {
            // Check if we need to migrate first to avoid taking a lock if unnecessary
            const hasLegacy = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM categories WHERE length(id) < 15");

            if (hasLegacy && hasLegacy.count > 0) {
                console.log('Running Critical Migration: Converting numeric IDs to UUIDs');
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
                console.log('Legacy numeric data cleared for UUID consistency.');
            }
        } catch (e) {
            console.error('Failed to migrate numeric IDs, rolling back', e);
        }

        // Migration 1: Add superset_id to workout_sets if it doesn't exist
        try {
            const result = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('workout_sets') WHERE name='superset_id'");
            if (result && result.count === 0) {
                console.log('Running Migration: Adding superset_id to workout_sets');
                await this.executeRaw('ALTER TABLE workout_sets ADD COLUMN superset_id TEXT');
            }
        } catch (e) {
            console.warn('Migration check failed (superset_id):', e);
        }

        // Migration to fix goals table schema
        try {
            const result = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('goals') WHERE name='title'");
            if (result && result.count === 0) {
                console.log('Running Migration: Fixing goals table schema');
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
            console.error('Migration check failed (goals schema):', e);
        }

        // Migration 2: Add rpe to workout_sets if it doesn't exist (Legacy DB support)
        try {
            const result = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('workout_sets') WHERE name='rpe'");
            if (result && result.count === 0) {
                console.log('Running Migration: Adding rpe to workout_sets');
                await this.executeRaw('ALTER TABLE workout_sets ADD COLUMN rpe REAL');
            }
        } catch (e) {
            console.warn('Migration check failed (rpe):', e);
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
            console.warn('Migration check failed (goals table):', e);
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
                console.log('Running Migration Check: Re-creating default category.');
                await this.run(
                    'INSERT INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, 1, 999, ?)',
                    [UNCATEGORIZED_ID, UNCATEGORIZED_NAME, '#64748b']
                );
            }
        } catch (e) {
            console.warn('Migration check failed (create system cat):', e);
        }

        // Migration 5: Add origin_id to exercises and is_public to routines
        try {
            const resultEx = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('exercises') WHERE name='origin_id'");
            if (resultEx && resultEx.count === 0) {
                console.log('Running Migration: Adding origin_id to exercises');
                await this.executeRaw('ALTER TABLE exercises ADD COLUMN origin_id TEXT');
            }

            const resultRoutine = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('routines') WHERE name='is_public'");
            if (resultRoutine && resultRoutine.count === 0) {
                console.log('Running Migration: Adding is_public to routines');
                await this.executeRaw('ALTER TABLE routines ADD COLUMN is_public INTEGER DEFAULT 0');
            }
        } catch (e) {
            console.warn('Migration check failed (Migration 5):', e);
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
            console.warn('Migration check failed (plate_inventory pk/unit):', e);
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
            console.warn('Migration 11 failed (plate_inventory repair):', e);
        }

        // Migration 6: Add color column to plate_inventory
        try {
            const info = await this.getAll<{ name: string }>("PRAGMA table_info('plate_inventory')");
            const columns = info.map(c => c.name);
            if (!columns.includes('color')) {
                console.log('Running Migration: Adding color to plate_inventory');
                await this.executeRaw('ALTER TABLE plate_inventory ADD COLUMN color TEXT');
            }
        } catch (e) {
            console.warn('Migration check failed (plate_inventory color):', e);
        }

        // Migration 7: Add duration column to workouts (elapsed seconds for timer persistence)
        try {
            const result = await this.getFirst<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('workouts') WHERE name='duration'");
            if (result && result.count === 0) {
                await this.executeRaw('ALTER TABLE workouts ADD COLUMN duration INTEGER DEFAULT 0');
            }
        } catch (e) {
            console.warn('Migration check failed (workouts duration):', e);
        }

        // Migration 9: Add updated_at and deleted_at to all syncable tables for cloud sync
        const syncableTables = [
            'categories', 'exercises', 'workouts', 'workout_sets',
            'routines', 'routine_days', 'routine_exercises',
            'measurements', 'goals', 'plate_inventory', 'settings'
        ];

        for (const table of syncableTables) {
            try {
                const info = await this.getAll<{ name: string }>(`PRAGMA table_info('${table}')`);
                const columns = info.map(c => c.name);

                if (!columns.includes('updated_at')) {
                    console.log(`Migration 9: Adding updated_at to ${table}`);
                    await this.executeRaw(`ALTER TABLE ${table} ADD COLUMN updated_at INTEGER DEFAULT 0`);
                }

                if (!columns.includes('deleted_at') && !['settings', 'plate_inventory', 'goals'].includes(table)) {
                    console.log(`Migration 9: Adding deleted_at to ${table}`);
                    await this.executeRaw(`ALTER TABLE ${table} ADD COLUMN deleted_at INTEGER`);
                }
            } catch (e) {
                console.warn(`Migration 9 failed for ${table}:`, e);
            }
        }

        // Migration 10: Ensure synced_at exists in sync_queue
        try {
            const info = await this.getAll<{ name: string }>("PRAGMA table_info('sync_queue')");
            const columns = info.map(c => c.name);
            if (!columns.includes('synced_at')) {
                console.log('Migration 10: Adding synced_at to sync_queue');
                await this.executeRaw('ALTER TABLE sync_queue ADD COLUMN synced_at INTEGER');
            }
        } catch (e) {
            console.warn('Migration 10 failed:', e);
        }
    }

    private async seedDatabase(): Promise<void> {
        const seedDisabled = await SecureStore.getItemAsync(SEED_DISABLED_KEY);
        if (seedDisabled === '1') {
            return;
        }
        const result = await this.getFirst<{ count: number }>('SELECT count(*) as count FROM categories');
        if (result && result.count > 0) {
            return; // Already seeded
        }



        // Default Categories
        // Default Categories - Standardized to Grayscale/Orange Industrial Theme
        const categories = [
            { name: 'Pecho', color: '#fb923c' }, // Primary Orange
            { name: 'Espalda', color: '#94a3b8' }, // Slate 400
            { name: 'Piernas', color: '#f97316' }, // Darker Orange
            { name: 'Hombros', color: '#cbd5e1' }, // Slate 300
            { name: 'Bíceps', color: '#ffedd5' }, // Orange 100
            { name: 'Tríceps', color: '#fed7aa' }, // Orange 200
            { name: 'Abdominales', color: '#64748b' }, // Slate 500
            { name: 'Cardio', color: '#475569' } // Slate 600
        ];

        // Optimize seeding with a Transaction
        try {
            await this.withTransaction(async () => {
                for (const [index, cat] of categories.entries()) {
                    const catId = this.generateId();
                    await this.run(
                        'INSERT INTO categories (id, name, is_system, sort_order, color) VALUES (?, ?, 1, ?, ?)',
                        [catId, cat.name, index, cat.color]
                    );

                    // Seed Basic Exercises for each category
                    const exercises = this.getInitialExercises(cat.name);
                    for (const ex of exercises) {
                        await this.run(
                            'INSERT INTO exercises (id, category_id, name, type, is_system) VALUES (?, ?, ?, ?, 1)',
                            [this.generateId(), catId, ex.name, ex.type]
                        );
                    }
                }
            });
        } catch (error) {
            console.error('Seeding failed', error);
            throw error;
        }
    }

    private getInitialExercises(categoryName: string): { name: string; type: ExerciseType }[] {
        const commonType: ExerciseType = 'weight_reps';

        switch (categoryName) {
            case 'Pecho':
                return [
                    { name: 'Press de Banca (Barra)', type: commonType },
                    { name: 'Press Inclinado (Mancuernas)', type: commonType },
                    { name: 'Aperturas', type: commonType },
                    { name: 'Flexiones', type: 'reps_only' }
                ];
            case 'Espalda':
                return [
                    { name: 'Dominadas', type: 'reps_only' },
                    { name: 'Remo con Barra', type: commonType },
                    { name: 'Jalón al Pecho', type: commonType },
                    { name: 'Peso Muerto', type: commonType }
                ];
            case 'Piernas':
                return [
                    { name: 'Sentadilla', type: commonType },
                    { name: 'Prensa', type: commonType },
                    { name: 'Estocadas', type: commonType },
                    { name: 'Extensiones de Cuádriceps', type: commonType },
                    { name: 'Curl Femoral', type: commonType }
                ];
            case 'Hombros':
                return [
                    { name: 'Press Militar', type: commonType },
                    { name: 'Elevaciones Laterales', type: commonType },
                    { name: 'Pájaros (Posterior)', type: commonType }
                ];
            case 'Bíceps':
                return [
                    { name: 'Curl con Barra', type: commonType },
                    { name: 'Curl Martillo', type: commonType }
                ];
            case 'Tríceps':
                return [
                    { name: 'Fondos', type: 'reps_only' },
                    { name: 'Press Francés', type: commonType },
                    { name: 'Extensiones en Polea', type: commonType }
                ];
            case 'Abdominales':
                return [
                    { name: 'Crunch', type: 'reps_only' },
                    { name: 'Plancha', type: 'distance_time' }, // using time
                    { name: 'Elevación de Piernas', type: 'reps_only' }
                ];
            case 'Cardio':
                return [
                    { name: 'Cinta de Correr', type: 'distance_time' },
                    { name: 'Bicicleta', type: 'distance_time' },
                    { name: 'Elíptica', type: 'distance_time' }
                ];
            default:
                return [];
        }
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

    public async getSetsForWorkout(workoutId: string): Promise<(WorkoutSet & { exercise_name: string; category_color: string; exercise_type: ExerciseType })[]> {
        // Join with exercises to get names for the UI
        return await this.getAll(
            `SELECT ws.*, e.name as exercise_name, e.type as exercise_type, c.color as category_color 
       FROM workout_sets ws
       JOIN exercises e ON ws.exercise_id = e.id
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE ws.workout_id = ? 
       ORDER BY ws.order_index ASC`,
            [workoutId]
        );
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
                await this.run("INSERT INTO categories (id, name, is_system, sort_order, color) VALUES ('sys-cat-1', 'Sin categoría', 1, 999, '#64748b')");

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
            await this.run(
                `INSERT INTO sync_queue (id, table_name, record_id, operation, payload, created_at, status, retry_count)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', 0)`,
                [
                    this.generateId(),
                    tableName,
                    recordId,
                    operation,
                    payload ? JSON.stringify(payload) : null,
                    Date.now()
                ]
            );
        } catch (e) {
            console.error('[SyncQueue] Failed to enqueue mutation:', e);
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
                const isLocked = (
                    msg.includes('database is locked')
                    || error?.code === 'SQLITE_BUSY'
                    || (msg.includes('finalizeAsync') && !isForeignKey)
                );
                if (isLocked) {
                    console.warn(`[Database] Busy/Locked (attempt ${i + 1}/${retries}). Retrying...`);
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
