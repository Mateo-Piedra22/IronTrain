export type PushOperation = {
    id: string;
    table: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    recordId?: string;
    payload?: unknown;
};

export function collectIncomingRecordIdsByTable(ops: PushOperation[]): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();

    for (const op of ops) {
        const table = typeof op?.table === 'string' ? op.table : '';
        if (!table) continue;
        if (op.operation === 'DELETE') continue;

        const payload = op.payload as Record<string, unknown> | undefined;
        const id = typeof payload?.id === 'string' ? payload.id : (typeof op.recordId === 'string' ? op.recordId : null);
        if (!id) continue;

        if (!out.has(table)) out.set(table, new Set());
        out.get(table)!.add(id);
    }

    return out;
}

export function shouldDeferWorkoutSetUpsert(params: {
    workoutId: string;
    parentExistsInDb: boolean;
    incomingWorkouts: Set<string>;
}): boolean {
    if (params.parentExistsInDb) return false;
    return params.incomingWorkouts.has(params.workoutId);
}
