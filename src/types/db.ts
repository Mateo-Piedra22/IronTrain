export interface Category {
    id: string; // UUID
    name: string;
    is_system: number; // 1 | 0
    sort_order: number;
    color?: string; // Hex code
}

export type ExerciseType = 'weight_reps' | 'distance_time' | 'weight_only' | 'reps_only';

export interface Exercise {
    id: string; // UUID
    category_id: string;
    name: string;
    type: ExerciseType;
    default_increment?: number;
    notes?: string;
    is_system: number; // 1 | 0
}

export type WorkoutStatus = 'in_progress' | 'completed';

export interface Workout {
    id: string; // UUID
    name?: string; // Optional user name for the session
    date: number; // Unix Timestamp
    start_time: number; // Unix Timestamp
    end_time?: number; // Unix Timestamp
    notes?: string;
    status: WorkoutStatus;
    duration?: number;
    is_template: number; // 1 | 0
}

export type SetType = 'normal' | 'warmup' | 'failure' | 'drop' | 'pr';

export interface WorkoutSet {
    id: string; // UUID
    workout_id: string;
    exercise_id: string;
    type: SetType;
    weight?: number; // kg/lbs
    reps?: number;
    distance?: number; // meters
    time?: number; // seconds
    rpe?: number; // 1-10
    order_index: number;
    completed: number; // 1 | 0
    notes?: string;
    superset_id?: string; // UUID for grouping
    // Ghost values for UI pre-filling
    previous_weight?: number;
    previous_reps?: number;
    previous_rpe?: number;
}

export type MeasurementType = 'weight' | 'body_fat' | 'neck' | 'shoulders' | 'chest' | 'bicep' | 'forearm' | 'waist' | 'hips' | 'thigh' | 'calf';

export interface Measurement {
    id: string; // UUID
    date: number; // Unix Timestamp
    type: MeasurementType;
    value: number;
    unit: string;
    notes?: string;
}

export type PlateType = 'standard' | 'bumper' | 'calibrated';

export interface PlateInventory {
    weight: number;
    count: number;
    type: PlateType;
    unit: 'kg' | 'lbs';
}

export interface Setting {
    key: string;
    value: string; // JSON stringified value
    description?: string;
}

export interface Goal {
    id: string;
    title: string;
    target_value: number;
    current_value: number;
    deadline?: number; // Unix timestamp
    type: 'exercise_weight' | 'body_weight' | 'total_volume' | 'workout_count';
    reference_id?: string; // e.g. exercise_id
    completed: number; // 0 or 1
}
