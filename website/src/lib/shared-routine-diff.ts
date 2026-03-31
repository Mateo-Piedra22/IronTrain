type PayloadRecord = Record<string, unknown>;

type IdSetSummary = {
    routineDays: Set<string>;
    routineExercises: Set<string>;
    exercises: Set<string>;
    categories: Set<string>;
    badges: Set<string>;
    exerciseBadges: Set<string>;
};

type CollectionSummary = {
    routineDays: number;
    routineExercises: number;
    exercises: number;
    categories: number;
    badges: number;
    exerciseBadges: number;
};

const toArray = (value: unknown): PayloadRecord[] =>
    Array.isArray(value) ? value.filter((item): item is PayloadRecord => !!item && typeof item === 'object') : [];

const collectIds = (rows: PayloadRecord[]): Set<string> => {
    const ids = new Set<string>();
    for (const row of rows) {
        const candidate = row.id;
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            ids.add(candidate);
        }
    }
    return ids;
};

const buildSummary = (payload: PayloadRecord): IdSetSummary => ({
    routineDays: collectIds(toArray(payload.routine_days)),
    routineExercises: collectIds(toArray(payload.routine_exercises)),
    exercises: collectIds(toArray(payload.exercises)),
    categories: collectIds(toArray(payload.categories)),
    badges: collectIds(toArray(payload.badges)),
    exerciseBadges: collectIds(toArray(payload.exercise_badges)),
});

const setDelta = (before: Set<string>, after: Set<string>) => {
    let added = 0;
    let removed = 0;

    for (const id of after) {
        if (!before.has(id)) added += 1;
    }

    for (const id of before) {
        if (!after.has(id)) removed += 1;
    }

    return {
        added,
        removed,
        net: added - removed,
    };
};

const toCounts = (summary: IdSetSummary): CollectionSummary => ({
    routineDays: summary.routineDays.size,
    routineExercises: summary.routineExercises.size,
    exercises: summary.exercises.size,
    categories: summary.categories.size,
    badges: summary.badges.size,
    exerciseBadges: summary.exerciseBadges.size,
});

export function summarizeSharedRoutinePayload(payload: PayloadRecord) {
    const summary = buildSummary(payload);
    return toCounts(summary);
}

export function diffSharedRoutinePayload(prevPayload: PayloadRecord, nextPayload: PayloadRecord) {
    const prev = buildSummary(prevPayload);
    const next = buildSummary(nextPayload);

    return {
        previous: toCounts(prev),
        next: toCounts(next),
        delta: {
            routineDays: setDelta(prev.routineDays, next.routineDays),
            routineExercises: setDelta(prev.routineExercises, next.routineExercises),
            exercises: setDelta(prev.exercises, next.exercises),
            categories: setDelta(prev.categories, next.categories),
            badges: setDelta(prev.badges, next.badges),
            exerciseBadges: setDelta(prev.exerciseBadges, next.exerciseBadges),
        },
    };
}
