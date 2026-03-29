export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

-- 1. Base / Configuration
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    is_system INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS exercises (
    id TEXT PRIMARY KEY NOT NULL,
    category_id TEXT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'weight_reps',
    notes TEXT,
    is_system INTEGER DEFAULT 0,
    user_id TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
);

-- 2. Training Core
CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    name TEXT,
    date INTEGER NOT NULL,
    start_time INTEGER,
    end_time INTEGER,
    duration INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT DEFAULT 'in_progress', -- in_progress, completed
    is_template INTEGER DEFAULT 0,
    finish_lat REAL,
    finish_lon REAL,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS workout_sets (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
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
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER,
    FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
);

-- 3. Routines & Planning
CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS routine_days (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    routine_id TEXT NOT NULL,
    name TEXT NOT NULL,
    day_index INTEGER DEFAULT 0, -- 0-6
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER,
    FOREIGN KEY (routine_id) REFERENCES routines (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    routine_day_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER,
    FOREIGN KEY (routine_day_id) REFERENCES routine_days (id) ON DELETE CASCADE,
    FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
);

-- 4. Social & Scoring
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY NOT NULL,
    display_name TEXT,
    username TEXT,
    avatar_url TEXT,
    bio TEXT,
    score_lifetime INTEGER DEFAULT 0,
    streak_weeks INTEGER DEFAULT 0,
    highest_streak INTEGER DEFAULT 0,
    last_active_date INTEGER,
    is_public INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS user_exercise_prs (
    id TEXT PRIMARY KEY NOT NULL, -- user_id + exercise_id
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    exercise_name TEXT,
    best_1rm_kg REAL DEFAULT 0,
    occurred_at INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS score_events (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    workout_id TEXT,
    event_type TEXT NOT NULL,
    event_key TEXT,
    points_base REAL DEFAULT 0,
    points_awarded REAL DEFAULT 0,
    streak_multiplier REAL DEFAULT 1,
    global_multiplier REAL DEFAULT 1,
    weather_id TEXT,
    occurred_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS activity_feed (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    metadata TEXT, -- JSON
    is_private INTEGER DEFAULT 0,
    seen_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS kudos (
    id TEXT PRIMARY KEY NOT NULL,
    feed_id TEXT NOT NULL,
    giver_id TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS friendships (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    friend_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, accepted, blocked
    status_updated_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

-- 5. System & Engagement
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS exercise_badges (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER,
    FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS changelogs (
    id TEXT PRIMARY KEY NOT NULL,
    version TEXT NOT NULL,
    title TEXT,
    body TEXT,
    published_at INTEGER,
    is_unreleased INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS changelog_reactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    changelog_id TEXT NOT NULL,
    reaction TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER,
    FOREIGN KEY (changelog_id) REFERENCES changelogs (id) ON DELETE CASCADE
);

-- 6. Health & Environmental
CREATE TABLE IF NOT EXISTS body_metrics (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    weight REAL,
    body_fat REAL,
    muscle_mass REAL,
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS measurements (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    date INTEGER NOT NULL,
    measurement_type TEXT NOT NULL, -- chest, waist, hips, arms, etc
    value REAL NOT NULL,
    notes TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS plate_inventory (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    weight REAL NOT NULL,
    count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS weather_logs (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    workout_id TEXT,
    lat REAL,
    lon REAL,
    condition TEXT,
    temp_c REAL,
    wind_speed REAL,
    humidity REAL,
    is_adverse INTEGER DEFAULT 0,
    created_at INTEGER
);

CREATE TABLE IF NOT EXISTS notification_reactions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS activity_seen (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    seen_at INTEGER,
    updated_at INTEGER
);

-- 7. Infrastructure
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    target_value REAL,
    current_value REAL DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    deadline_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    payload TEXT, -- JSON
    status TEXT DEFAULT 'pending', -- pending, processing, synced, failed
    retry_count INTEGER DEFAULT 0,
    batch_id TEXT,
    synced_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS shares_inbox (
    id TEXT PRIMARY KEY NOT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    type TEXT NOT NULL, -- workout, routine
    payload TEXT, -- JSON
    status TEXT DEFAULT 'pending',
    seen_at INTEGER,
    created_at INTEGER,
    updated_at INTEGER,
    deleted_at INTEGER
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category_id);
CREATE INDEX IF NOT EXISTS idx_sets_workout ON workout_sets(workout_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_seen ON activity_seen(user_id, item_id);
CREATE INDEX IF NOT EXISTS idx_prs_user ON user_exercise_prs(user_id, exercise_id);
`;

export const INITIAL_DATA_SQL = `
-- Migration initial data logic would go here if needed.
-- But since we are doing pull sync, we mostly rely on cloud data.
`;
