import NetInfo from '@react-native-community/netinfo';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import { Config } from '../constants/Config';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { logger } from '../utils/logger';
import { configService } from './ConfigService';
import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';

const BACKEND_URL = Config.API_URL;
const API_BASE_URL = `${BACKEND_URL}/api/sync`;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const MAX_BATCH_SIZE = 50;
const REQUEST_TIMEOUT_MS = 12000;

const PULL_UPSERT_ORDER: ReadonlyArray<string> = [
    'categories',
    'routines',
    'routine_days',
    'badges',
    'exercises',
    'exercise_badges',
    'user_profiles',
    'workouts',
    'workout_sets',
    'routine_exercises',
    'goals',
    'measurements',
    'body_metrics',
    'plate_inventory',
    'settings',
    'changelog_reactions',
    'notification_reactions',
    'kudos',
    'activity_feed',
    'user_exercise_prs',
    'score_events',
];

const PULL_DELETE_ORDER: ReadonlyArray<string> = [...PULL_UPSERT_ORDER].reverse();

const TABLES_WITH_SOFT_DELETE: ReadonlySet<string> = new Set([
    'categories',
    'exercises',
    'workouts',
    'workout_sets',
    'routines',
    'routine_days',
    'routine_exercises',
    'goals',
    'measurements',
    'body_metrics',
    'badges',
    'exercise_badges',
    'changelog_reactions',
    'notification_reactions',
    'kudos',
    'activity_feed',
    'user_exercise_prs',
    'score_events',
]);

const ALLOWED_TABLES = [
    'exercises', 'categories', 'workouts', 'workout_sets',
    'routines', 'routine_days', 'routine_exercises',
    'measurements', 'goals', 'plate_inventory', 'settings',
    'body_metrics', 'badges', 'exercise_badges', 'user_profiles',
    'changelog_reactions', 'notification_reactions', 'kudos', 'activity_feed',
    'user_exercise_prs', 'score_events'
];


interface SyncPayload {
    id: string;
    table_name: string;
    record_id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: any;
    created_at: number;
}

export interface SyncStatus {
    hasData: boolean;
    recordCount: number;
    counts?: Record<string, { active: number; deleted: number; total: number }>;
}

export interface SyncQueueStatus {
    pending: number;
    failed: number;
    processing: number;
    totalOutstanding: number;
}

export interface SyncDiagnostics {
    local: SyncStatus;
    remote: SyncStatus;
    queue: SyncQueueStatus;
}

export class SyncService {
    private isSyncing = false;

    private async wait(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    private toSnakeKey(k: string): string {
        return k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    }

    private async fetchAllTableSchemas(): Promise<Map<string, Set<string>>> {
        const schemas = new Map<string, Set<string>>();
        for (const table of ALLOWED_TABLES) {
            try {
                const info = await dbService.getAll<{ name: string }>(`PRAGMA table_info('${table}')`);
                schemas.set(table, new Set(info.map(c => c.name)));
            } catch (e) {
                logger.captureException(e, { scope: 'SyncService.fetchAllTableSchemas', table });
            }
        }
        return schemas;
    }

    private normalizeIncomingRecord(table: string, raw: unknown, validColumns?: Set<string>): Record<string, unknown> | null {
        if (!raw || typeof raw !== 'object') return null;
        const obj = raw as Record<string, unknown>;
        const out: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
            // Exclude cloud-only columns that don't exist in local SQLite schema
            if (key === 'userId' || key === 'user_id') {
                continue;
            }

            if (key === 'updatedAt' || key === 'updated_at') {
                if (typeof value === 'number') {
                    out.updated_at = value;
                } else if (typeof value === 'string') {
                    const ms = Date.parse(value);
                    if (!Number.isNaN(ms)) out.updated_at = ms;
                }
                continue;
            }

            if (key === 'deletedAt' || key === 'deleted_at') {
                if (value === null || value === undefined) {
                    out.deleted_at = null;
                } else if (typeof value === 'number') {
                    out.deleted_at = value;
                } else if (typeof value === 'string') {
                    const ms = Date.parse(value);
                    if (!Number.isNaN(ms)) out.deleted_at = ms;
                }
                continue;
            }

            const normalizedKey = key.includes('_') ? key : this.toSnakeKey(key);
            out[normalizedKey] = value;
        }

        // --- ID Standardization for Protected Records ---
        const recordName = typeof out.name === 'string' ? out.name : '';

        if (table === 'categories' && (recordName === 'Sin categoría' || recordName === 'Uncategorized')) {
            out.id = 'uncategorized';
            out.is_system = 1;
        }

        if (table === 'settings') {
            const keyValue = out.key;
            if (typeof keyValue === 'string' && keyValue.includes(':')) {
                const pieces = keyValue.split(':');
                if (pieces.length > 1) {
                    out.key = pieces.slice(1).join(':');
                }
            }
            // settings has no deleted_at in local schema
            delete out.deleted_at;
        }

        // --- Schema-Aware Robustness Fix: Only keep columns that exist in local SQLite ---
        if (validColumns) {
            for (const key of Object.keys(out)) {
                if (!validColumns.has(key)) {
                    delete out[key];
                }
            }
        }

        return out;
    }

    private async requestWithRetry(input: RequestInfo, init: RequestInit): Promise<Response> {
        let lastError: unknown = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const AbortControllerImpl = (globalThis as any).AbortController as typeof AbortController | undefined;
                if (!AbortControllerImpl) {
                    return await fetch(input, init);
                }

                const controller = new AbortControllerImpl();
                const signal = controller.signal;
                const outerSignal = init.signal;

                let timeoutId: ReturnType<typeof setTimeout> | null = null;
                const abortFromOuter = () => {
                    try {
                        controller.abort();
                    } catch {
                        // ignore
                    }
                };

                if (outerSignal) {
                    if (outerSignal.aborted) {
                        abortFromOuter();
                    } else {
                        outerSignal.addEventListener('abort', abortFromOuter, { once: true });
                    }
                }

                timeoutId = setTimeout(() => {
                    try {
                        controller.abort();
                    } catch {
                        // ignore
                    }
                }, REQUEST_TIMEOUT_MS);

                try {
                    return await fetch(input, { ...init, signal });
                } finally {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (outerSignal) outerSignal.removeEventListener('abort', abortFromOuter);
                }
            } catch (e) {
                lastError = e;
                const delay = 300 * Math.pow(2, attempt);
                await this.wait(delay);
            }
        }
        throw lastError instanceof Error ? lastError : new Error('Network error');
    }

    /**
     * Executes a full bidirectional sync: Push local changes, then Pull remote changes.
     */
    public async syncBidirectional(options?: { forcePull?: boolean }): Promise<void> {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const token = useAuthStore.getState().token;
            if (!token) {
                return;
            }

            const netState = await NetInfo.fetch();
            if (!netState.isConnected || !netState.isInternetReachable) {
                return;
            }

            // Reintentar los fallidos que aún no superaron el límite
            await dbService.run(`UPDATE sync_queue SET status = 'pending' WHERE status = 'failed' AND retry_count < ?`, [MAX_RETRIES]);

            // Fetch current local table schemas to ensure sync robustness
            const tableSchemas = await this.fetchAllTableSchemas();

            await this.pushLocalChanges(token);
            await this.pullRemoteChanges(token, options?.forcePull, tableSchemas);
        } catch (error) {
            logger.captureException(error, { scope: 'SyncService.syncBidirectional' });
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Pushes pending mutations from the local database out to the remote server.
     */
    private async pushLocalChanges(token: string): Promise<void> {

        let hasMore = true;
        while (hasMore) {
            const pendingOps = await dbService.getAll<SyncPayload>(
                `SELECT id, table_name, record_id, operation, payload, created_at
                 FROM sync_queue
                 WHERE status IN ('pending', 'failed') AND retry_count < ?
                 ORDER BY created_at ASC
                 LIMIT ?`,
                [MAX_RETRIES, MAX_BATCH_SIZE]
            );

            if (pendingOps.length === 0) {
                hasMore = false;
                break;
            }

            const ids = pendingOps.map(op => op.id);
            await dbService.run(`UPDATE sync_queue SET status = 'processing' WHERE id IN (${ids.map(() => '?').join(',')})`, ids);

            try {
                const validOperations: {
                    id: string;
                    table: string;
                    recordId: string;
                    operation: 'INSERT' | 'UPDATE' | 'DELETE';
                    payload: Record<string, unknown> | null;
                    timestamp: number;
                }[] = [];
                const invalidIds: string[] = [];

                for (const op of pendingOps) {
                    if (!ALLOWED_TABLES.includes(op.table_name)) {
                        invalidIds.push(op.id);
                        continue;
                    }
                    try {
                        const parsed = op.payload ? JSON.parse(op.payload) : null;
                        validOperations.push({
                            id: op.id,
                            table: op.table_name,
                            recordId: op.record_id,
                            operation: op.operation,
                            payload: parsed,
                            timestamp: op.created_at
                        });
                    } catch {
                        invalidIds.push(op.id);
                    }
                }

                if (invalidIds.length > 0) {
                    await dbService.run(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${invalidIds.map(() => '?').join(',')})`, invalidIds);
                }

                if (validOperations.length === 0) {
                    continue;
                }

                const response = await this.requestWithRetry(`${API_BASE_URL}/push`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ operations: validOperations })
                });

                if (!response.ok) {
                    const bodyText = await response.text().catch(() => '');
                    const suffix = bodyText ? ` body=${bodyText}` : '';
                    throw new Error(`HTTP error! status: ${response.status}${suffix}`);
                }

                const result = await response.json();

                // Track IDs of successfully synced versus failed operations
                const successIds: string[] = [];
                const failedIds: string[] = [];

                if (result.results && Array.isArray(result.results)) {
                    for (const res of result.results) {
                        if (res.status === 'error') {
                            failedIds.push(res.id);
                        } else {
                            successIds.push(res.id);
                        }
                    }
                } else {
                    // Fallback to treat all as successful if the response is OK but contains no detailed results
                    successIds.push(...validOperations.map(op => op.id));
                }

                if (successIds.length > 0) {
                    await dbService.run(`UPDATE sync_queue SET status = 'synced', synced_at = ? WHERE id IN (${successIds.map(() => '?').join(',')})`, [Date.now(), ...successIds]);
                }

                if (failedIds.length > 0) {
                    await dbService.run(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${failedIds.map(() => '?').join(',')})`, failedIds);
                }

                hasMore = validOperations.length === MAX_BATCH_SIZE; // Continue if we processed a full batch
            } catch (error) {
                logger.captureException(error, { scope: 'SyncService.pushLocalChanges' });
                await dbService.run(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
                throw error; // Throw to abort sync chain if push fails fully
            }
        }
    }

    /**
     * Pulls remote changes that happened after the last sync timestamp.
     */
    private async pullRemoteChanges(token: string, forcePull = false, tableSchemas?: Map<string, Set<string>>): Promise<void> {
        // Retrieve the last synced timestamp from local settings
        const lastSyncRecord = await dbService.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['last_pull_sync']);
        const lastSyncAt = (lastSyncRecord?.value && !forcePull) ? parseInt(lastSyncRecord.value, 10) : 0;

        try {
            const response = await this.requestWithRetry(`${API_BASE_URL}/pull?since=${lastSyncAt}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP pull error! status: ${response.status}`);
            }

            const data = await response.json();
            const changes = Array.isArray(data?.changes) ? data.changes : [];
            const serverTime = data?.serverTime;

            const byTable = new Map<string, any[]>();
            for (const change of changes) {
                const table = typeof change?.table === 'string' ? change.table : null;
                if (!table || !ALLOWED_TABLES.includes(table)) continue;
                if (!byTable.has(table)) byTable.set(table, []);
                byTable.get(table)!.push(change);
            }

            if (byTable.size > 0) {
                await dbService.withTransaction(async () => {
                    const deferredUpserts: Array<{ table: string; change: any }> = [];

                    const applyForTable = async (table: string, tableChanges: any[]): Promise<void> => {
                        const validColumns = tableSchemas?.get(table);
                        const ids = tableChanges
                            .map((c) => (c?.payload?.id ?? c?.payload?.recordId) as unknown)
                            .filter((v): v is string => typeof v === 'string' && v.length > 0);

                        const hasSoftDelete = TABLES_WITH_SOFT_DELETE.has(table);
                        const pkField = table === 'settings' ? 'key' : 'id';
                        const columns = [pkField, 'updated_at'];
                        if (hasSoftDelete) columns.push('deleted_at');

                        const existingRows = ids.length > 0
                            ? await dbService.getAll<any>(
                                `SELECT ${columns.join(', ')} FROM ${table} WHERE ${pkField} IN (${ids.map(() => '?').join(', ')})`,
                                ids
                            ).catch(e => {
                                logger.captureException(e, { scope: 'SyncService.pullRemoteChanges.queryExisting', table, columns });
                                throw e;
                            })
                            : [];

                        const existingById = new Map(existingRows.map((r) => [r.id, r] as const));

                        for (const change of tableChanges) {
                            const operation = typeof change?.operation === 'string' ? change.operation : null;
                            const payload = change?.payload && typeof change.payload === 'object' ? change.payload : null;
                            if (!operation || !payload) continue;

                            const normalized = this.normalizeIncomingRecord(table, payload, validColumns);
                            if (!normalized) continue;

                            const recordId = normalized.id || normalized.record_id || payload.recordId;
                            if (typeof recordId !== 'string' || recordId.length === 0) continue;

                            const local = existingById.get(recordId);
                            const remoteUpdatedAt = typeof normalized.updated_at === 'number' ? normalized.updated_at : null;
                            const localUpdatedAt = typeof local?.updated_at === 'number' ? local.updated_at : null;

                            if (operation === 'INSERT' || operation === 'UPDATE') {
                                if (remoteUpdatedAt !== null && localUpdatedAt !== null && localUpdatedAt >= remoteUpdatedAt) {
                                    continue;
                                }

                                const keys = Object.keys(normalized);
                                const values = Object.values(normalized);
                                const placeholders = keys.map(() => '?').join(', ');

                                try {
                                    await dbService.run(
                                        `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                                        values as any
                                    );
                                } catch (e: any) {
                                    const msg = e?.message || '';
                                    if (msg.includes('FOREIGN KEY constraint failed')) {
                                        deferredUpserts.push({ table, change });
                                        continue;
                                    }
                                    throw e;
                                }
                                continue;
                            }

                            if (operation === 'DELETE') {
                                if (remoteUpdatedAt !== null && localUpdatedAt !== null && localUpdatedAt >= remoteUpdatedAt) {
                                    continue;
                                }

                                if (TABLES_WITH_SOFT_DELETE.has(table)) {
                                    const deletedAt = typeof normalized.deleted_at === 'number'
                                        ? normalized.deleted_at
                                        : (remoteUpdatedAt !== null ? remoteUpdatedAt : Date.now());
                                    const updatedAt = remoteUpdatedAt !== null ? remoteUpdatedAt : deletedAt;
                                    await dbService.run(
                                        `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
                                        [deletedAt, updatedAt, recordId]
                                    );
                                } else {
                                    await dbService.run(`DELETE FROM ${table} WHERE id = ?`, [recordId]);
                                }
                            }
                        }
                    };

                    const upsertTablesInOrder = PULL_UPSERT_ORDER.filter((t) => byTable.has(t));
                    const deleteTablesInOrder = PULL_DELETE_ORDER.filter((t) => byTable.has(t));

                    for (const table of upsertTablesInOrder) {
                        const tableChanges = byTable.get(table) ?? [];
                        const upserts = tableChanges.filter((c) => c?.operation === 'INSERT' || c?.operation === 'UPDATE');
                        if (upserts.length > 0) {
                            await applyForTable(table, upserts);
                        }
                    }

                    // Retry deferred upserts that failed due to missing parent references.
                    // This occurs when remote changes reference parents that are also part of the pull set.
                    if (deferredUpserts.length > 0) {
                        let pendingDeferred = [...deferredUpserts];
                        for (let pass = 0; pass < 3 && pendingDeferred.length > 0; pass++) {
                            const nextPending: Array<{ table: string; change: any }> = [];
                            for (const item of pendingDeferred) {
                                const operation = typeof item?.change?.operation === 'string' ? item.change.operation : null;
                                const payload = item?.change?.payload && typeof item.change.payload === 'object' ? item.change.payload : null;
                                if (!operation || !payload) continue;
                                const recordId = payload.id || payload.recordId;
                                if (typeof recordId !== 'string' || recordId.length === 0) continue;

                                // Re-apply LWW check against current local state
                                const localRow = await dbService.getFirst<{ updated_at?: number | null }>(
                                    `SELECT updated_at FROM ${item.table} WHERE id = ?`,
                                    [recordId]
                                );

                                const normalized = this.normalizeIncomingRecord(item.table, payload, tableSchemas?.get(item.table));
                                if (!normalized) continue;

                                const remoteUpdatedAt = typeof normalized.updated_at === 'number' ? normalized.updated_at : null;
                                const localUpdatedAt = typeof localRow?.updated_at === 'number' ? localRow.updated_at : null;
                                if (remoteUpdatedAt !== null && localUpdatedAt !== null && localUpdatedAt >= remoteUpdatedAt) {
                                    continue;
                                }

                                const keys = Object.keys(normalized);
                                const values = Object.values(normalized);
                                const placeholders = keys.map(() => '?').join(', ');

                                try {
                                    await dbService.run(
                                        `INSERT OR REPLACE INTO ${item.table} (${keys.join(', ')}) VALUES (${placeholders})`,
                                        values as any
                                    );
                                } catch (e: any) {
                                    const msg = e?.message || '';
                                    const isFk = msg.includes('FOREIGN KEY constraint failed');
                                    if (isFk) {
                                        nextPending.push(item);
                                        continue;
                                    }
                                    throw e;
                                }
                            }
                            pendingDeferred = nextPending;
                        }
                    }

                    for (const table of deleteTablesInOrder) {
                        const tableChanges = byTable.get(table) ?? [];
                        const deletes = tableChanges.filter((c) => c?.operation === 'DELETE');
                        if (deletes.length > 0) {
                            await applyForTable(table, deletes);
                        }
                    }
                });
            }

            // Update local sync time with SERVER time to avoid clock drift issues
            const nextSyncTime = serverTime ? serverTime.toString() : Date.now().toString();
            await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_pull_sync', nextSyncTime]);

            if (byTable.size > 0) {
                dataEventService.emit('DATA_UPDATED');
            }

            // --- Post-Sync Clean (Industrial Repair) ---
            // After downloading changes, fix any potential duplicates from the cloud
            logger.info('[Sync] Performing post-pull consistency check...');
            await dbService.repairDataConsistency();

        } catch (error) {
            logger.captureException(error, { scope: 'SyncService.pullRemoteChanges' });
            throw error; // Throw so syncBidirectional fails loudly
        }
    }

    /**
     * Generates a complete JSON snapshot of the local database.
     */
    public async createDatabaseSnapshot(): Promise<string> {
        const tables = [
            'exercises', 'categories', 'workouts', 'workout_sets',
            'routines', 'routine_days', 'routine_exercises',
            'measurements', 'goals', 'plate_inventory', 'settings', 'body_metrics', 'badges', 'exercise_badges'
        ];

        const snapshot: Record<string, any[]> = {};

        for (const table of tables) {
            snapshot[table] = await dbService.getAll(`SELECT * FROM ${table}`);
        }

        const jsonString = JSON.stringify(snapshot, null, 2);

        const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
        const fileUri = FileSystem.documentDirectory + `irontrain_snapshot_${timestamp}.json`;

        await FileSystem.writeAsStringAsync(fileUri, jsonString, { encoding: FileSystem.EncodingType?.UTF8 || 'utf8' });

        return fileUri;
    }

    /**
     * Imports a JSON database snapshot back into the local database.
     * Overwrites existing data while maintaining table structures.
     */
    public async restoreDatabaseSnapshot(fileUri: string): Promise<void> {
        try {
            const jsonString = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType?.UTF8 || 'utf8' });
            const snapshot = JSON.parse(jsonString);

            const TABLES: ReadonlyArray<string> = [
                'categories',
                'exercises',
                'routines',
                'routine_days',
                'routine_exercises',
                'workouts',
                'workout_sets',
                'measurements',
                'goals',
                'plate_inventory',
                'settings',
                'body_metrics',
                'badges',
                'exercise_badges',
                'user_profiles',
                'activity_feed',
                'changelog_reactions',
                'kudos',
            ];

            // IMPORTANT:
            // Keep PRAGMA foreign_keys=OFF for the entire restore transaction.
            // If we re-enable inside the transaction, SQLite may still validate at COMMIT and fail.
            await dbService.executeRaw('PRAGMA foreign_keys = OFF;');

            try {
                await dbService.withTransaction(async () => {
                    const allowed = new Set(TABLES);
                    const tablesInSnapshot = snapshot && typeof snapshot === 'object' ? Object.keys(snapshot) : [];
                    const presentInOrder = TABLES.filter((t) => allowed.has(t) && tablesInSnapshot.includes(t));
                    const deleteOrder = [...presentInOrder].reverse();

                    for (const table of deleteOrder) {
                        await dbService.run(`DELETE FROM ${table}`);
                    }

                    for (const table of presentInOrder) {
                        const recordsRaw = (snapshot as any)?.[table];
                        const records: unknown[] = Array.isArray(recordsRaw) ? recordsRaw : [];
                        for (const record of records) {
                            const normalized = this.normalizeIncomingRecord(table, record);
                            if (!normalized) continue;
                            const keys = Object.keys(normalized);
                            if (keys.length === 0) continue;
                            const values = Object.values(normalized);
                            const placeholders = keys.map(() => '?').join(', ');
                            await dbService.run(
                                `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                                values as any
                            );
                        }
                    }

                    await dbService.run(
                        `DELETE FROM exercises
                         WHERE category_id IS NOT NULL
                           AND category_id NOT IN (SELECT id FROM categories)`
                    );

                    await dbService.run(
                        `DELETE FROM routine_days
                         WHERE routine_id NOT IN (SELECT id FROM routines)`
                    );

                    await dbService.run(
                        `DELETE FROM routine_exercises
                         WHERE routine_day_id NOT IN (SELECT id FROM routine_days)
                            OR exercise_id NOT IN (SELECT id FROM exercises)`
                    );

                    await dbService.run(
                        `DELETE FROM workout_sets
                         WHERE workout_id NOT IN (SELECT id FROM workouts)
                            OR exercise_id NOT IN (SELECT id FROM exercises)`
                    );

                    // Append full sync event to avoid pushing this as mutations
                    await dbService.run('DELETE FROM sync_queue');
                });
            } finally {
                await dbService.executeRaw('PRAGMA foreign_keys = ON;');
            }

            const fkIssues = await dbService.getAll<{ table: string; rowid: number; parent: string; fkid: number }>('PRAGMA foreign_key_check;');
            if (fkIssues.length > 0) {
                const first = fkIssues[0];
                throw new Error(`Snapshot restore integrity check failed (foreign_key_check). First issue: table=${first.table} rowid=${first.rowid} parent=${first.parent} fkid=${first.fkid}`);
            }
        } catch (error) {
            logger.captureException(error, { scope: 'SyncService.restoreDatabaseSnapshot' });
            throw error;
        }
    }

    public async checkRemoteStatus(): Promise<SyncStatus> {
        const token = useAuthStore.getState().token;
        if (!token) throw new Error('Usuario no autenticado');

        const response = await this.requestWithRetry(`${API_BASE_URL}/status`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    }

    public async checkLocalStatus(): Promise<SyncStatus> {
        const tables: Array<{ key: string; table: string; supportsDelete: boolean }> = [
            { key: 'categories', table: 'categories', supportsDelete: true },
            { key: 'exercises', table: 'exercises', supportsDelete: true },
            { key: 'workouts', table: 'workouts', supportsDelete: true },
            { key: 'workout_sets', table: 'workout_sets', supportsDelete: true },
            { key: 'routines', table: 'routines', supportsDelete: true },
            { key: 'routine_days', table: 'routine_days', supportsDelete: true },
            { key: 'routine_exercises', table: 'routine_exercises', supportsDelete: true },
            { key: 'measurements', table: 'measurements', supportsDelete: true },
            { key: 'goals', table: 'goals', supportsDelete: true },
            { key: 'body_metrics', table: 'body_metrics', supportsDelete: true },
            { key: 'plate_inventory', table: 'plate_inventory', supportsDelete: false },
            { key: 'settings', table: 'settings', supportsDelete: false },
            { key: 'badges', table: 'badges', supportsDelete: true },
            { key: 'exercise_badges', table: 'exercise_badges', supportsDelete: true },
            { key: 'user_profiles', table: 'user_profiles', supportsDelete: false },
            { key: 'changelog_reactions', table: 'changelog_reactions', supportsDelete: true },
            { key: 'kudos', table: 'kudos', supportsDelete: true },
            { key: 'activity_feed', table: 'activity_feed', supportsDelete: true },
        ];

        const counts: Record<string, { active: number; deleted: number; total: number }> = {};
        for (const t of tables) {
            const hasDeleteAt = t.supportsDelete && TABLES_WITH_SOFT_DELETE.has(t.table);
            const activeSql = hasDeleteAt
                ? `SELECT COUNT(*) as count FROM ${t.table} WHERE deleted_at IS NULL`
                : `SELECT COUNT(*) as count FROM ${t.table}`;
            const deletedSql = hasDeleteAt
                ? `SELECT COUNT(*) as count FROM ${t.table} WHERE deleted_at IS NOT NULL`
                : null;

            const activeRes = await dbService.getFirst<{ count: number }>(activeSql);
            const deletedRes = deletedSql ? await dbService.getFirst<{ count: number }>(deletedSql) : { count: 0 };
            const active = activeRes?.count || 0;
            const deleted = deletedRes?.count || 0;
            counts[t.key] = { active, deleted, total: active + deleted };
        }

        const recordCount = Object.values(counts).reduce((acc, v) => acc + v.active, 0);
        return { hasData: recordCount > 0, recordCount, counts };
    }

    public async checkQueueStatus(): Promise<SyncQueueStatus> {
        const [pending, failed, processing] = await Promise.all([
            dbService.getFirst<{ count: number }>("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'"),
            dbService.getFirst<{ count: number }>("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'"),
            dbService.getFirst<{ count: number }>("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'processing'"),
        ]);

        const pendingCount = pending?.count ?? 0;
        const failedCount = failed?.count ?? 0;
        const processingCount = processing?.count ?? 0;

        return {
            pending: pendingCount,
            failed: failedCount,
            processing: processingCount,
            totalOutstanding: pendingCount + failedCount + processingCount,
        };
    }

    public async getDiagnostics(): Promise<SyncDiagnostics> {
        const [local, remote, queue] = await Promise.all([
            this.checkLocalStatus(),
            this.checkRemoteStatus(),
            this.checkQueueStatus(),
        ]);

        return { local, remote, queue };
    }

    public async pushLocalSnapshot(): Promise<void> {
        const token = useAuthStore.getState().token;
        if (!token) throw new Error('Usuario no autenticado');

        const tables = [
            'exercises', 'categories', 'workouts', 'workout_sets',
            'routines', 'routine_days', 'routine_exercises',
            'measurements', 'goals', 'plate_inventory', 'settings', 'body_metrics'
        ];

        const snapshot: Record<string, any[]> = {};
        for (const table of tables) {
            snapshot[table] = await dbService.getAll(`SELECT * FROM ${table}`);
        }

        const response = await this.requestWithRetry(`${API_BASE_URL}/snapshot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ snapshot })
        });

        if (!response.ok) {
            const bodyText = await response.text().catch(() => '');
            const suffix = bodyText ? ` body=${bodyText}` : '';
            throw new Error(`Snapshot push failed! status: ${response.status}${suffix}`);
        }

        await dbService.run('DELETE FROM sync_queue');
        await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_pull_sync', Date.now().toString()]);
    }

    public async wipeAllUserData(): Promise<void> {
        const token = useAuthStore.getState().token;
        if (!token) throw new Error('Usuario no autenticado');

        const response = await this.requestWithRetry(`${API_BASE_URL}/wipe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const bodyText = await response.text().catch(() => '');
            const suffix = bodyText ? ` body=${bodyText}` : '';
            throw new Error(`Wipe failed! status: ${response.status}${suffix}`);
        }
    }

    public async pullCloudSnapshot(): Promise<void> {
        const token = useAuthStore.getState().token;
        if (!token) throw new Error('Usuario no autenticado');

        const response = await this.requestWithRetry(`${API_BASE_URL}/snapshot`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Snapshot pull failed! status: ${response.status}`);
        }

        const data = await response.json();
        const snapshot = data.snapshot;
        if (!snapshot) throw new Error('Invalid snapshot received');

        const fileUri = FileSystem.documentDirectory + 'irontrain_cloud_snapshot.json';
        await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(snapshot));

        await this.restoreDatabaseSnapshot(fileUri);

        // Reload services & stores after snapshot restore
        await configService.reload();
        await useSettingsStore.getState().loadSettings();

        await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_pull_sync', Date.now().toString()]);

        // Notify app
        dataEventService.emit('DATA_UPDATED');
        dataEventService.emit('SETTINGS_UPDATED');
        dataEventService.emit('SOCIAL_UPDATED');
    }
}

export const syncService = new SyncService();
