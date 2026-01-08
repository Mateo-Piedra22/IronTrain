import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('irontrain.db');

export class DatabaseService {
    static init() {
        try {
            db.execSync(`
        PRAGMA foreign_keys = ON;
        
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          theme TEXT DEFAULT 'system',
          unit_system TEXT DEFAULT 'metric',
          always_on BOOLEAN DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_system BOOLEAN DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id INTEGER,
          name TEXT NOT NULL,
          type TEXT CHECK(type IN ('weight_reps', 'distance_time', 'weight_only', 'reps_only')) DEFAULT 'weight_reps',
          notes TEXT,
          FOREIGN KEY (category_id) REFERENCES categories (id)
        );

        CREATE TABLE IF NOT EXISTS workouts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          name TEXT,
          duration_seconds INTEGER,
          is_template BOOLEAN DEFAULT 0,
          template_name TEXT
        );

        CREATE TABLE IF NOT EXISTS sets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workout_id INTEGER NOT NULL,
          exercise_id INTEGER NOT NULL,
          set_order INTEGER NOT NULL,
          weight REAL,
          reps INTEGER,
          distance REAL,
          time_seconds INTEGER,
          type TEXT DEFAULT 'normal', 
          is_completed BOOLEAN DEFAULT 0,
          comments TEXT,
          FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
          FOREIGN KEY (exercise_id) REFERENCES exercises (id)
        );

        CREATE TABLE IF NOT EXISTS body_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          weight REAL,
          body_fat REAL,
          notes TEXT
        );
        
        -- Seed default categories if empty
        INSERT OR IGNORE INTO categories (name, is_system) VALUES 
        ('Chest', 1), ('Back', 1), ('Legs', 1), ('Shoulders', 1), 
        ('Biceps', 1), ('Triceps', 1), ('Abs', 1), ('Cardio', 1);

        -- Seed default settings
        INSERT OR IGNORE INTO settings (id, theme, unit_system) VALUES (1, 'system', 'metric');
      `);
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    static getDb() {
        return db;
    }
}
