const CLIENT_SYNC_READ_ONLY_TABLES = new Set([
    'changelogs',
    'score_events',
    'user_exercise_prs',
    'weather_logs',
]);

export function isClientSyncReadOnlyTable(tableName: string): boolean {
    return CLIENT_SYNC_READ_ONLY_TABLES.has(tableName);
}

export function listClientSyncReadOnlyTables(): string[] {
    return Array.from(CLIENT_SYNC_READ_ONLY_TABLES);
}
