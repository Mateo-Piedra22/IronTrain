export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    is_system INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'weight_reps',
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT,
    date INTEGER DEFAULT (unixepoch()),
    duration INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'in_progress', -- in_progress, completed
    is_template INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id TEXT PRIMARY KEY NOT NULL,
    workout_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    type TEXT DEFAULT 'normal', -- normal, warmup, drop, failure
    weight REAL DEFAULT 0,
    reps INTEGER DEFAULT 0,
    rpe REAL,
    distance REAL,
    time INTEGER,
    order_index INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_id);

CREATE TABLE IF NOT EXISTS body_metrics (
    id TEXT PRIMARY KEY NOT NULL,
    date INTEGER DEFAULT (unixepoch()),
    weight REAL,
    body_fat REAL,
    notes TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (key, value) VALUES 
('sound_enabled', 'true'),
('haptics_enabled', 'true'),
('keep_awake', 'true');
`;

export const INITIAL_DATA_SQL = `
INSERT OR IGNORE INTO categories (id, name, is_system) VALUES 
('cat_chest', 'Chest', 1),
('cat_back', 'Back', 1),
('cat_legs', 'Legs', 1),
('cat_shoulders', 'Shoulders', 1),
('cat_arms', 'Arms', 1),
('cat_core', 'Core', 1),
('cat_cardio', 'Cardio', 1);

INSERT OR IGNORE INTO exercises (id, category_id, name, type) VALUES
('ex_bench_press', 'cat_chest', 'Barbell Bench Press', 'weight_reps'),
('ex_squat', 'cat_legs', 'Barbell Squat', 'weight_reps'),
('ex_deadlift', 'cat_back', 'Deadlift', 'weight_reps'),
('ex_ohp', 'cat_shoulders', 'Overhead Press', 'weight_reps'),
('ex_pullup', 'cat_back', 'Pull Up', 'weight_reps'),
('ex_dumbbell_curl', 'cat_arms', 'Dumbbell Curl', 'weight_reps'),
('ex_tricep_pushdown', 'cat_arms', 'Tricep Pushdown', 'weight_reps');
`;
