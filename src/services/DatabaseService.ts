import * as SQLite from 'expo-sqlite';
import { Category, Exercise, ExerciseType, Workout, WorkoutSet } from '../types/db';

const DB_NAME = 'irontrain_v1.db';

export class DatabaseService {
    private db: SQLite.SQLiteDatabase | null = null;
    private isInitialized = false;

    public async init(): Promise<void> {
        if (this.isInitialized) return;

        try {
            this.db = await SQLite.openDatabaseAsync(DB_NAME);

            // Enable foreign keys
            await this.db.execAsync('PRAGMA foreign_keys = ON;');

            // Create Schema
            await this.createTables();

            // Seed if empty
            await this.seedDatabase();

            this.isInitialized = true;

        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
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
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS exercises (
        id TEXT PRIMARY KEY NOT NULL,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- 'weight_reps', 'distance_time', 'weight_only', 'reps_only'
        default_increment REAL DEFAULT 2.5,
        notes TEXT,
        is_system INTEGER DEFAULT 0,
        FOREIGN KEY (category_id) REFERENCES categories (id)
      );

      CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY NOT NULL,
        date INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        name TEXT,
        notes TEXT,
        status TEXT NOT NULL, -- 'in_progress', 'completed'
        is_template INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS workout_sets (
        id TEXT PRIMARY KEY NOT NULL,
        workout_id TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        type TEXT NOT NULL, -- 'normal', 'warmup', 'failure', 'drop', 'pr'
        weight REAL,
        reps INTEGER,
        distance REAL,
        time INTEGER,
        rpe REAL,
        order_index INTEGER NOT NULL,
        completed INTEGER DEFAULT 0,
        notes TEXT,
        superset_id TEXT, -- NEW: For grouping exercises
        FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
        FOREIGN KEY (exercise_id) REFERENCES exercises (id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        description TEXT
      );

      -- NEW: Body Tracker
      CREATE TABLE IF NOT EXISTS measurements (
        id TEXT PRIMARY KEY NOT NULL,
        date INTEGER NOT NULL,
        type TEXT NOT NULL, -- 'weight', 'body_fat', 'neck', 'shoulders', 'chest', 'bicep', 'forearm', 'waist', 'hips', 'thigh', 'calf'
        value REAL NOT NULL,
        unit TEXT NOT NULL, -- 'kg', 'lbs', 'cm', 'in', '%'
        notes TEXT
      );

      -- NEW: Plate Calculator Inventory
      CREATE TABLE IF NOT EXISTS plate_inventory (
        weight REAL NOT NULL,
        count INTEGER DEFAULT 0,
        type TEXT DEFAULT 'standard', -- 'standard', 'bumper', 'calibrated'
        unit TEXT DEFAULT 'kg',
        PRIMARY KEY (weight, type)
      );
    `;

        await this.db.execAsync(schema);

        // Safety check for settings table - ensure IT EXISTS
        try {
            const check = await this.db.getFirstAsync<{ count: number }>("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='settings'");
            if (!check || check.count === 0) {
                await this.db.execAsync(`
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
        // Migration 1: Add superset_id to workout_sets if it doesn't exist
        try {
            const result = await this.db?.getFirstAsync<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('workout_sets') WHERE name='superset_id'");
            if (result && result.count === 0) {
                console.log('Running Migration: Adding superset_id to workout_sets');
                await this.db?.execAsync('ALTER TABLE workout_sets ADD COLUMN superset_id TEXT');
            }
        } catch (e) {
            console.log('Migration check failed (superset_id):', e);
        }

        // Migration 2: Add rpe to workout_sets if it doesn't exist (Legacy DB support)
        try {
            const result = await this.db?.getFirstAsync<{ count: number }>("SELECT count(*) as count FROM pragma_table_info('workout_sets') WHERE name='rpe'");
            if (result && result.count === 0) {
                console.log('Running Migration: Adding rpe to workout_sets');
                await this.db?.execAsync('ALTER TABLE workout_sets ADD COLUMN rpe REAL');
            }
        } catch (e) {
            console.log('Migration check failed (rpe):', e);
        }

        // Migration 3: Create goals table
        try {
            await this.db?.execAsync(`
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
            console.log('Migration check failed (goals table):', e);
        }
    }

    private async seedDatabase(): Promise<void> {
        if (!this.db) throw new Error('DB not open');

        const result = await this.db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM categories');
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
        const db = this.getDatabase();
        return await db.getAllAsync<Category>('SELECT * FROM categories ORDER BY sort_order ASC');
    }

    // --- EXERCISES ---

    /**
     * Search exercises by name (case insensitive usually via LIKE)
     * Optional category filtering.
     */
    public async searchExercises(query: string, categoryId?: string): Promise<(Exercise & { category_name: string; category_color: string })[]> {
        const db = this.getDatabase();
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

        return await db.getAllAsync(sql, params);
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
        await this.run(
            `INSERT INTO exercises (id, category_id, name, type, default_increment, notes, is_system) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                exercise.category_id,
                exercise.name,
                exercise.type,
                exercise.default_increment ?? 2.5,
                exercise.notes ?? null,
                0 // User created
            ]
        );
        return id;
    }

    public async updateExercise(id: string, updates: Partial<Exercise>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (fields.length === 0) return;

        values.push(id);
        await this.run(`UPDATE exercises SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // --- WORKOUTS ---

    public async getWorkoutByDate(dateStart: number, dateEnd: number): Promise<Workout | null> {
        const db = this.getDatabase();
        return await db.getFirstAsync<Workout>(
            'SELECT * FROM workouts WHERE date >= ? AND date < ? LIMIT 1',
            [dateStart, dateEnd]
        );
    }

    public async getWorkoutById(id: string): Promise<Workout | null> {
        const db = this.getDatabase();
        return await db.getFirstAsync<Workout>('SELECT * FROM workouts WHERE id = ?', [id]);
    }

    public async createWorkout(date: number): Promise<string> {
        const id = this.generateId();
        await this.run(
            'INSERT INTO workouts (id, date, start_time, status, is_template) VALUES (?, ?, ?, ?, ?)',
            [id, date, Date.now(), 'in_progress', 0]
        );
        return id;
    }

    // --- SETS ---

    public async getSetsForWorkout(workoutId: string): Promise<(WorkoutSet & { exercise_name: string; category_color: string })[]> {
        const db = this.getDatabase();
        // Join with exercises to get names for the UI
        return await db.getAllAsync(
            `SELECT ws.*, e.name as exercise_name, c.color as category_color 
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
        await this.run(
            `INSERT INTO workout_sets (id, workout_id, exercise_id, type, weight, reps, distance, time, rpe, order_index, completed, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                set.notes ?? null
            ]
        );
        return id;
    }

    public async updateSet(id: string, updates: Partial<WorkoutSet>): Promise<void> {
        const fields: string[] = [];
        const values: any[] = [];

        Object.entries(updates).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (fields.length === 0) return;

        values.push(id);
        await this.run(`UPDATE workout_sets SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    public async deleteSet(id: string): Promise<void> {
        await this.run('DELETE FROM workout_sets WHERE id = ?', [id]);
    }

    // --- GHOST VALUES / HISTORY ---

    /**
     * Findings the most recent completed set for a specific exercise to use as ghost values.
     * Excluding current workout if possible, or just strict history.
     */
    public async getLastSetForExercise(exerciseId: string): Promise<WorkoutSet | null> {
        const db = this.getDatabase();
        return await db.getFirstAsync<WorkoutSet>(
            `SELECT * FROM workout_sets 
       WHERE exercise_id = ? AND completed = 1 
       ORDER BY rowid DESC LIMIT 1`,
            [exerciseId]
        );
    }

    // Helper Utils
    public getDatabase(): SQLite.SQLiteDatabase {
        if (!this.db) {
            throw new Error('Database not initialized. Call init() first.');
        }
        return this.db;
    }

    private generateId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    public async run(sql: string, params: any[] = []): Promise<SQLite.SQLiteRunResult> {
        const db = this.getDatabase();
        return await db.runAsync(sql, params);
    }

    public async getAll<T>(sql: string, params: any[] = []): Promise<T[]> {
        const db = this.getDatabase();
        return await db.getAllAsync<T>(sql, params);
    }

    public async getFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
        const db = this.getDatabase();
        return await db.getFirstAsync<T>(sql, params);
    }
}

export const dbService = new DatabaseService();
