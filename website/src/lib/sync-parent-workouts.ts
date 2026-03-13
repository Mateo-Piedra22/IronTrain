export type SyncChange = {
    table: string;
    operation: string;
    payload: unknown;
};

export type SyncParentRelation = {
    childTable: string;
    parentTable: string;
    fkField: string;
};

export type MissingParentsByTable = Record<string, string[]>;

function safeString(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    return s.length > 0 ? s : null;
}

function getPresentIdsByTable(changes: SyncChange[]): Map<string, Set<string>> {
    const present = new Map<string, Set<string>>();
    for (const c of changes) {
        const table = safeString(c?.table) ?? '';
        if (!table) continue;
        const payload = c?.payload as Record<string, unknown> | null;
        if (!payload || typeof payload !== 'object') continue;
        const id = safeString(payload.id);
        if (!id) continue;
        if (!present.has(table)) present.set(table, new Set());
        present.get(table)!.add(id);
    }
    return present;
}

export function collectMissingParentIdsFromChanges(
    changes: SyncChange[],
    relations: SyncParentRelation[],
): MissingParentsByTable {
    const presentByTable = getPresentIdsByTable(changes);

    const neededByParent = new Map<string, Set<string>>();

    for (const c of changes) {
        const childTable = safeString(c?.table);
        if (!childTable) continue;
        const payload = c?.payload as Record<string, unknown> | null;
        if (!payload || typeof payload !== 'object') continue;

        for (const rel of relations) {
            if (rel.childTable !== childTable) continue;
            const fk = safeString(payload[rel.fkField]);
            if (!fk) continue;
            if (!neededByParent.has(rel.parentTable)) neededByParent.set(rel.parentTable, new Set());
            neededByParent.get(rel.parentTable)!.add(fk);
        }
    }

    const result: MissingParentsByTable = {};
    for (const [parentTable, ids] of neededByParent.entries()) {
        const present = presentByTable.get(parentTable) ?? new Set<string>();
        const missing = Array.from(ids).filter((id) => !present.has(id));
        if (missing.length > 0) {
            missing.sort();
            result[parentTable] = missing;
        }
    }
    return result;
}

export function collectMissingWorkoutIdsFromChanges(changes: SyncChange[]): string[] {
    const missing = collectMissingParentIdsFromChanges(changes, [
        { childTable: 'workout_sets', parentTable: 'workouts', fkField: 'workout_id' },
    ]);
    return missing.workouts ?? [];
}
