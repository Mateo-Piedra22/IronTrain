import NetInfo from '@react-native-community/netinfo';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import { Config } from '../constants/Config';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/useSettingsStore';
import * as analytics from '../utils/analytics';
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
    'activity_seen',
    'shares_inbox',
    'friendships',
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
    'shares_inbox',
    'friendships',
    'user_exercise_prs',
    'score_events',
]);

const ALLOWED_TABLES = [
    'exercises', 'categories', 'workouts', 'workout_sets',
    'routines', 'routine_days', 'routine_exercises',
    'measurements', 'goals', 'plate_inventory', 'settings',
    'body_metrics', 'badges', 'exercise_badges', 'user_profiles',
    'changelog_reactions', 'notification_reactions', 'kudos', 'activity_feed',
    'activity_seen', 'shares_inbox', 'friendships',
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

    private syncPreconditionError(code: 'ALREADY_SYNCING' | 'UNAUTHENTICATED' | 'OFFLINE', message: string): Error {
        const e = new Error(message);
        (e as any).code = code;
        return e;
    }

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

        const normalizeEpochMs = (v: unknown): unknown => {
            // Accept numbers, numeric strings, and ISO date strings.
            let n: number | null = null;

            if (typeof v === 'number') {
                if (!Number.isFinite(v)) return v;
                n = v;
            } else if (typeof v === 'string') {
                const trimmed = v.trim();
                if (trimmed.length === 0) return v;

                // Numeric string (seconds or ms)
                if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
                    const parsed = Number(trimmed);
                    if (Number.isFinite(parsed)) n = parsed;
                } else {
                    // ISO string
                    const ms = Date.parse(trimmed);
                    if (!Number.isNaN(ms)) n = ms;
                }
            }

            if (n === null) return v;

            // Heuristic: seconds since epoch are usually 10 digits (~1e9-1e10), ms are 13 digits (~1e12-1e13)
            if (n > 0 && n < 100_000_000_000) {
                return Math.floor(n * 1000);
            }
            return Math.floor(n);
        };

        for (const [key, value] of Object.entries(obj)) {
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

            // SQLite doesn't have a boolean type, so we convert true/false to 1/0
            let finalValue: any = value;
            if (typeof value === 'boolean') {
                finalValue = value ? 1 : 0;
            } else if (value === 'true' || value === 'false') {
                finalValue = value === 'true' ? 1 : 0;
            }

            // --- Field Aliasing ---
            // Handle common cloud vs local field name mismatches
            let targetKey = normalizedKey;
            if (table === 'workout_sets') {
                if (normalizedKey === 'is_completed') targetKey = 'completed';
                if (normalizedKey === 'set_type') targetKey = 'type';
                if (normalizedKey === 'sort_order') targetKey = 'order_index';
            } else if (table === 'workouts') {
                if (normalizedKey === 'is_completed' && finalValue === 1) {
                    out['status'] = 'completed';
                    continue;
                }
            } else if (table === 'exercises') {
                if (normalizedKey === 'exercise_type') targetKey = 'type';
            }

            // Normalization: Ensure workout dates land on Local Noon to prevent timezone splits
            // CRITICAL: ONLY for the 'date' field used for day grouping, NOT for 'start_time' or 'end_time'
            if (table === 'workouts' && targetKey === 'date' && typeof finalValue === 'number') {
                const dateObj = new Date(finalValue);
                dateObj.setHours(12, 0, 0, 0);
                finalValue = dateObj.getTime();
            }

            // --- Type Casts ---
            // Local SQLite uses 1/0 for booleans. JSON uses true/false.
            // Ensure column name matches the expected type.
            const isBoolField = targetKey === 'completed' || targetKey === 'is_template' || targetKey === 'is_system' || targetKey === 'active';
            if (isBoolField && finalValue !== null && finalValue !== undefined) {
                if (typeof finalValue === 'string') {
                    finalValue = (finalValue.toLowerCase() === 'true' || finalValue === '1') ? 1 : 0;
                } else {
                    finalValue = finalValue ? 1 : 0;
                }
            }

            if (validColumns && !validColumns.has(targetKey)) continue;

            if (table === 'workouts' && (targetKey === 'date' || targetKey === 'start_time' || targetKey === 'end_time')) {
                out[targetKey] = normalizeEpochMs(finalValue);
            } else {
                out[targetKey] = finalValue;
            }
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
            Object.keys(out).forEach(key => {
                if (!validColumns.has(key)) {
                    delete out[key];
                }
            });
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
                    const response = await fetch(input, { ...init, signal });

                    if (response.status === 503) {
                        try {
                            const data = await response.clone().json();
                            if (data.error === 'MAINTENANCE_MODE') {
                                useSettingsStore.getState().setServerStatus({
                                    mode: 'maintenance',
                                    message: data.message
                                });
                            } else if (data.error === 'OFFLINE_ONLY_MODE') {
                                useSettingsStore.getState().setServerStatus({
                                    mode: 'offline',
                                    message: data.message
                                });
                            }
                        } catch {
                            // Silently fail if body is not JSON
                        }
                    } else if (response.ok) {
                        // If sync is successful, reset status to normal
                        const currentStatus = useSettingsStore.getState().serverStatus;
                        if (currentStatus.mode !== 'normal') {
                            useSettingsStore.getState().setServerStatus({ mode: 'normal' });
                        }
                    }

                    return response;
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
     * @param options.forcePull If true, pulls all remote data regardless of last sync timestamp
     * @param options.verify If true, performs an additional push check if pull triggered consistency repairs
     */
    public async syncBidirectional(options?: { forcePull?: boolean; verify?: boolean }): Promise<void> {
        if (this.isSyncing) {
            throw this.syncPreconditionError('ALREADY_SYNCING', 'Sync en progreso');
        }
        this.isSyncing = true;

        let totalPushed = 0;
        let totalPulled = 0;

        try {
            const token = useAuthStore.getState().token;
            if (!token) {
                throw this.syncPreconditionError('UNAUTHENTICATED', 'Usuario no autenticado');
            }

            const netState = await NetInfo.fetch();
            if (!netState.isConnected || !netState.isInternetReachable) {
                throw this.syncPreconditionError('OFFLINE', 'Sin conexión a internet');
            }

            // Retry failed records that haven't hit the limit
            await dbService.run(`UPDATE sync_queue SET status = 'pending' WHERE status = 'failed' AND retry_count < ?`, [MAX_RETRIES]);

            // Fetch current local table schemas to ensure sync robustness
            const tableSchemas = await this.fetchAllTableSchemas();

            // 1. Initial Push: Send any pending local changes
            totalPushed += await this.pushLocalChanges(token);

            // 2. Pull: Get remote changes and run consistency fixes (repairs)
            totalPulled += await this.pullRemoteChanges(token, options?.forcePull);

            analytics.capture('sync_completed', {
                success: true,
                force_pull: !!options?.forcePull,
                verify: !!options?.verify,
                records_pushed: totalPushed,
                records_pulled: totalPulled,
            });

            // 3. Verification: If 'verify' is true, check if pull/repairs added new mutations to the queue
            if (options?.verify) {
                const hasMore = await this.hasPendingChanges();
                if (hasMore) {
                    logger.info('[Sync] Post-pull verify: Found new changes (likely from duplicate cleanup). Pushing again...');
                    totalPushed += await this.pushLocalChanges(token);
                }
            }
        } catch (error) {
            analytics.capture('sync_completed', {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            });
            logger.captureException(error, { scope: 'SyncService.syncBidirectional' });
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Checks if there are any pending or failed (retryable) changes in the sync queue.
     */
    public async hasPendingChanges(): Promise<boolean> {
        try {
            const row = await dbService.getFirst<{ count: number }>(
                "SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'failed') AND retry_count < ?",
                [MAX_RETRIES]
            );
            return Number(row?.count ?? 0) > 0;
        } catch (e) {
            logger.captureException(e, { scope: 'SyncService.hasPendingChanges' });
            return false;
        }
    }

    /**
     * Pushes pending mutations from the local database out to the remote server.
     */
    private async pushLocalChanges(token: string): Promise<number> {
        let totalCount = 0;
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
                    totalCount += successIds.length;
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
        return totalCount;
    }


    /**
     * Pulls remote changes that happened after the last sync timestamp.
     */
    private async pullRemoteChanges(token: string, forcePull: boolean = false): Promise<number> {
        let totalCount = 0;
        const userId = useAuthStore.getState().user?.id;
        const syncKey = userId ? `last_pull_sync_${userId}` : 'last_pull_sync';

        // Retrieve the last synced timestamp from local settings
        const lastSyncRecord = await dbService.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', [syncKey]);
        const lastSyncAt = (lastSyncRecord?.value && !forcePull) ? parseInt(lastSyncRecord.value, 10) : 0;

        try {
            const tableSchemas = await this.fetchAllTableSchemas();
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
            totalCount = changes.length;
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
                        const pkField = table === 'settings' ? 'key' : 'id';
                        const ids = tableChanges
                            .map((c) => {
                                const payload = c?.payload as any;
                                if (!payload || typeof payload !== 'object') return null;
                                if (pkField === 'key') return payload.key as unknown;
                                return (payload.id ?? payload.recordId) as unknown;
                            })
                            .filter((v): v is string => typeof v === 'string' && v.length > 0);

                        const hasSoftDelete = TABLES_WITH_SOFT_DELETE.has(table);
                        // Chunk IDs to avoid SQLite parameter limits (usually 999)
                        const CHUNK_SIZE = 900;
                        const existingRows: any[] = [];

                        if (ids.length > 0) {
                            for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                                const chunk = ids.slice(i, i + CHUNK_SIZE);
                                const rows = await dbService.getAll<any>(
                                    `SELECT * FROM ${table} WHERE ${pkField} IN (${chunk.map(() => '?').join(', ')})`,
                                    chunk
                                ).catch(e => {
                                    logger.captureException(e, { scope: 'SyncService.pullRemoteChanges.queryExisting', table });
                                    throw e;
                                });
                                existingRows.push(...rows);
                            }
                        }

                        const existingById = new Map(existingRows
                            .map((r) => [(r as any)?.[pkField], r] as const)
                            .filter((pair) => typeof pair[0] === 'string' && pair[0].length > 0)
                        );

                        for (const change of tableChanges) {
                            const operation = typeof change?.operation === 'string' ? change.operation : null;
                            const payload = change?.payload && typeof change.payload === 'object' ? change.payload : null;
                            if (!operation || !payload) continue;

                            const normalized = this.normalizeIncomingRecord(table, payload, validColumns);
                            if (!normalized) continue;

                            const recordId = table === 'settings'
                                ? (normalized.key || payload.key)
                                : (normalized.id || normalized.record_id || payload.recordId);
                            if (typeof recordId !== 'string' || recordId.length === 0) continue;

                            const local = existingById.get(recordId);
                            const remoteUpdatedAt = typeof normalized.updated_at === 'number' ? normalized.updated_at : null;
                            const localUpdatedAt = typeof local?.updated_at === 'number' ? local.updated_at : null;

                            if (operation === 'INSERT' || operation === 'UPDATE') {
                                if (remoteUpdatedAt !== null && localUpdatedAt !== null && localUpdatedAt >= remoteUpdatedAt) {
                                    continue;
                                }

                                try {
                                    if (local) {
                                        // Merge: Use existing record as base, overwrite with incoming columns
                                        const merged = { ...local };
                                        const schemaKeys = tableSchemas?.get(table);

                                        Object.keys(normalized).forEach(k => {
                                            if (schemaKeys && !schemaKeys.has(k)) return;
                                            merged[k] = normalized[k];
                                        });

                                        const updateKeys = Object.keys(merged).filter(k => k !== pkField);
                                        const updatePlaceholders = updateKeys.map(k => `${k} = ?`).join(', ');
                                        const updateValues = updateKeys.map(k => merged[k]);

                                        await dbService.run(
                                            `UPDATE ${table} SET ${updatePlaceholders} WHERE ${pkField} = ?`,
                                            [...updateValues, recordId]
                                        );
                                    } else {
                                        const keys = Object.keys(normalized);
                                        const placeholders = keys.map(() => '?').join(', ');
                                        const values = keys.map((k) => normalized[k]);

                                        await dbService.run(
                                            `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                                            values as any
                                        );
                                    }
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

                                if (hasSoftDelete) {
                                    const deletedAt = typeof normalized.deleted_at === 'number'
                                        ? normalized.deleted_at
                                        : (remoteUpdatedAt !== null ? remoteUpdatedAt : Date.now());
                                    const updatedAt = remoteUpdatedAt !== null ? remoteUpdatedAt : deletedAt;
                                    await dbService.run(
                                        `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE ${pkField} = ?`,
                                        [deletedAt, updatedAt, recordId]
                                    );
                                } else {
                                    await dbService.run(`DELETE FROM ${table} WHERE ${pkField} = ?`, [recordId]);
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

                    if (deferredUpserts.length > 0) {
                        let pendingDeferred = [...deferredUpserts];
                        for (let pass = 0; pass < 3 && pendingDeferred.length > 0; pass++) {
                            const nextPending: Array<{ table: string; change: any }> = [];
                            for (const item of pendingDeferred) {
                                const payload = item?.change?.payload && typeof item.change.payload === 'object' ? item.change.payload : null;
                                if (!payload) continue;
                                const pkField = item.table === 'settings' ? 'key' : 'id';
                                const recordId = item.table === 'settings' ? payload.key : (payload.id || payload.recordId);
                                if (typeof recordId !== 'string' || recordId.length === 0) continue;

                                const localRow = await dbService.getFirst<{ updated_at?: number | null }>(
                                    `SELECT updated_at FROM ${item.table} WHERE ${pkField} = ?`,
                                    [recordId]
                                );

                                const normalized = this.normalizeIncomingRecord(item.table, payload, tableSchemas?.get(item.table));
                                if (!normalized) continue;

                                const remoteUpdatedAt = typeof normalized.updated_at === 'number' ? normalized.updated_at : null;
                                const localUpdatedAt = typeof localRow?.updated_at === 'number' ? localRow.updated_at : null;
                                if (remoteUpdatedAt !== null && localUpdatedAt !== null && localUpdatedAt >= remoteUpdatedAt) {
                                    continue;
                                }

                                try {
                                    const existing = await dbService.getFirst<Record<string, any>>(`SELECT * FROM ${item.table} WHERE ${pkField} = ?`, [recordId]);

                                    if (existing) {
                                        const schemaKeys = tableSchemas?.get(item.table);
                                        const merged = { ...existing };
                                        Object.keys(normalized).forEach(k => {
                                            if (schemaKeys && !schemaKeys.has(k)) return;
                                            merged[k] = normalized[k];
                                        });

                                        const updateKeys = Object.keys(merged).filter(k => k !== pkField);
                                        const updatePlaceholders = updateKeys.map(k => `${k} = ?`).join(', ');
                                        const updateValues = updateKeys.map(k => merged[k]);

                                        await dbService.run(
                                            `UPDATE ${item.table} SET ${updatePlaceholders} WHERE ${pkField} = ?`,
                                            [...updateValues, recordId]
                                        );
                                    } else {
                                        const keys = Object.keys(normalized);
                                        const placeholders = keys.map(() => '?').join(', ');
                                        const values = keys.map((k) => normalized[k]);

                                        await dbService.run(
                                            `INSERT INTO ${item.table} (${keys.join(', ')}) VALUES (${placeholders})`,
                                            values as any
                                        );
                                    }
                                } catch (e: any) {
                                    const msg = e?.message || '';
                                    if (msg.includes('FOREIGN KEY constraint failed')) {
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

            const nextSyncTime = serverTime ? serverTime.toString() : Date.now().toString();
            await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [syncKey, nextSyncTime]);

            if (byTable.size > 0) {
                if (byTable.has('settings')) {
                    await configService.reload();
                    dataEventService.emit('SETTINGS_UPDATED');
                }
                dataEventService.emit('DATA_UPDATED');
            }

            logger.info('[Sync] Performing post-pull consistency check...');
            await dbService.repairDataConsistency(userId);

        } catch (error) {
            logger.captureException(error, { scope: 'SyncService.pullRemoteChanges' });
            throw error;
        }
        return totalCount;
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
            // Actually, in SQLite, PRAGMA foreign_keys = OFF is a noop inside a transaction.
            // It MUST be executed OUTSIDE the transaction.
            await dbService.executeRaw('PRAGMA foreign_keys = OFF;');

            try {
                await dbService.withTransactionAsync(async (db) => {
                    const allowed = new Set(TABLES);
                    const tablesInSnapshot = snapshot && typeof snapshot === 'object' ? Object.keys(snapshot) : [];
                    const presentInOrder = TABLES.filter((t) => allowed.has(t) && tablesInSnapshot.includes(t));
                    const deleteOrder = [...presentInOrder].reverse();

                    for (const table of deleteOrder) {
                        await db.runAsync(`DELETE FROM ${table}`);
                    }

                    // Fetch table schemas to be schema-aware during restoration
                    const tableSchemas = await this.fetchAllTableSchemas();

                    for (const table of presentInOrder) {
                        const recordsRaw = (snapshot as any)?.[table];
                        const records: unknown[] = Array.isArray(recordsRaw) ? recordsRaw : [];
                        const validColumns = tableSchemas.get(table);

                        for (const record of records) {
                            const normalized = this.normalizeIncomingRecord(table, record, validColumns);
                            if (!normalized) continue;
                            const keys = Object.keys(normalized);
                            if (keys.length === 0) continue;
                            const values = Object.values(normalized);
                            const placeholders = keys.map(() => '?').join(', ');
                            await db.runAsync(
                                `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                                values as any
                            );
                        }
                    }

                    // Defensive fix: ensure critical epoch fields remain numeric in SQLite.
                    // If the snapshot came with numeric strings, SQLite may persist them as TEXT,
                    // breaking range queries like \`WHERE date >= ? AND date < ?\`.
                    await db.runAsync(
                        `UPDATE workouts
                         SET date = CAST(date AS INTEGER)
                         WHERE date IS NOT NULL AND typeof(date) != 'integer'`
                    );
                    await db.runAsync(
                        `UPDATE workouts
                         SET start_time = CAST(start_time AS INTEGER)
                         WHERE start_time IS NOT NULL AND typeof(start_time) != 'integer'`
                    );
                    await db.runAsync(
                        `UPDATE workouts
                         SET end_time = CAST(end_time AS INTEGER)
                         WHERE end_time IS NOT NULL AND typeof(end_time) != 'integer'`
                    );

                    // --------------------------------------------------------------------------------
                    // DYNAMIC ORPHAN CLEANUP
                    // Since PRAGMA foreign_keys = OFF is active, ON DELETE CASCADE didn't fire during
                    // table replacement. We dynamically find and delete any orphaned records 
                    // until the database is structurally sound.
                    // --------------------------------------------------------------------------------
                    let fkPass = 0;
                    while (true) {
                        const fkIssues = await db.getAllAsync<{ table: string; rowid: number; parent: string; fkid: number }>('PRAGMA foreign_key_check;');
                        if (fkIssues.length === 0) break;

                        for (const issue of fkIssues) {
                            logger.warn(`[Sync] Cleaning up orphaned row during restore: table=${issue.table}, rowid=${issue.rowid}, missing parent=${issue.parent}`);
                            await db.runAsync(`DELETE FROM ${issue.table} WHERE rowid = ?`, [issue.rowid]);
                        }

                        fkPass++;
                        if (fkPass > 10) {
                            throw new Error('Too many passes attempting to resolve snapshot foreign key violations. Snapshot data might be fundamentally corrupted.');
                        }
                    }

                    // Append full sync event to avoid pushing this as mutations
                    await db.runAsync('DELETE FROM sync_queue');
                });
            } finally {
                await dbService.executeRaw('PRAGMA foreign_keys = ON;');
            }

            // Deterministic hydration sanity check.
            // If workouts exist but `date` ends up stored as TEXT/REAL or in seconds, the UI will show empty
            // due to range queries (date >= startMs AND date < endMs).
            const workoutCountRow = await dbService.getFirst<{ count: number }>('SELECT COUNT(*) as count FROM workouts');
            const workoutCount = Number(workoutCountRow?.count || 0);
            if (workoutCount > 0) {
                const typeStats = await dbService.getFirst<{ integer_count: number; non_integer_count: number }>(
                    `SELECT
                        SUM(CASE WHEN typeof(date) = 'integer' THEN 1 ELSE 0 END) as integer_count,
                        SUM(CASE WHEN date IS NOT NULL AND typeof(date) != 'integer' THEN 1 ELSE 0 END) as non_integer_count
                     FROM workouts`
                );

                const rangeStats = await dbService.getFirst<{ min_date: number | null; max_date: number | null }>(
                    'SELECT MIN(CAST(date AS INTEGER)) as min_date, MAX(CAST(date AS INTEGER)) as max_date FROM workouts'
                );

                const integerCount = Number(typeStats?.integer_count || 0);
                const nonIntegerCount = Number(typeStats?.non_integer_count || 0);
                const maxDate = rangeStats?.max_date === null || rangeStats?.max_date === undefined ? null : Number(rangeStats.max_date);

                // If any non-integer remain after our casts, or maxDate looks like seconds, treat as fatal.
                if (nonIntegerCount > 0 || integerCount === 0 || (maxDate !== null && maxDate > 0 && maxDate < 100_000_000_000)) {
                    const sample = await dbService.getAll<{ id: string; date: any; date_type: string }>(
                        "SELECT id, date, typeof(date) as date_type FROM workouts ORDER BY CAST(date AS INTEGER) DESC LIMIT 5"
                    );
                    logger.error('Snapshot restore hydration sanity check failed', {
                        workoutCount,
                        integerCount,
                        nonIntegerCount,
                        minDate: rangeStats?.min_date ?? null,
                        maxDate,
                        sample,
                    });
                    throw new Error('Snapshot restore completed but hydration validation failed (workouts.date type/unit mismatch). Please retry sync; if persists, export logs.');
                }
            }

            // Trigger reload for settings and other critical data
            await configService.reload();
            dataEventService.emit('SETTINGS_UPDATED');
            dataEventService.emit('DATA_UPDATED');
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
        const data = await response.json();

        // Refine remote hasData/recordCount to match local logic (user data only)
        const userDataTables = [
            'workouts', 'workout_sets', 'routines', 'routine_days',
            'routine_exercises', 'measurements', 'goals', 'body_metrics',
            'plate_inventory', 'badges'
        ];

        let recordCount = 0;
        if (data.counts) {
            recordCount = Object.entries(data.counts).reduce((acc, [key, v]: [string, any]) => {
                if (userDataTables.includes(key)) {
                    return acc + (v.active || 0);
                }
                return acc;
            }, 0);
        } else {
            recordCount = data.recordCount || 0;
        }

        return {
            hasData: recordCount > 0,
            recordCount,
            counts: data.counts
        };
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
            const authUserId = useAuthStore.getState().user?.id;

            const activeSql = hasDeleteAt
                ? `SELECT COUNT(*) as count FROM ${t.table} WHERE deleted_at IS NULL`
                : t.table === 'user_profiles' && typeof authUserId === 'string' && authUserId.length > 0
                    ? `SELECT COUNT(*) as count FROM ${t.table} WHERE id = ?`
                    : `SELECT COUNT(*) as count FROM ${t.table}`;
            const deletedSql = hasDeleteAt
                ? `SELECT COUNT(*) as count FROM ${t.table} WHERE deleted_at IS NOT NULL`
                : null;

            const activeRes = t.table === 'user_profiles' && typeof authUserId === 'string' && authUserId.length > 0 && !hasDeleteAt
                ? await dbService.getFirst<{ count: number }>(activeSql, [authUserId])
                : await dbService.getFirst<{ count: number }>(activeSql);
            const deletedRes = deletedSql ? await dbService.getFirst<{ count: number }>(deletedSql) : { count: 0 };
            const active = activeRes?.count || 0;
            const deleted = deletedRes?.count || 0;
            counts[t.key] = { active, deleted, total: active + deleted };
        }

        const recordCount = Object.entries(counts).reduce((acc, [key, v]) => {
            // Only count tables that represent actual user data
            // Ignore system categories, settings, etc. for "hasData" detection
            const userDataTables = [
                'workouts', 'workout_sets', 'routines', 'routine_days',
                'routine_exercises', 'measurements', 'goals', 'body_metrics',
                'plate_inventory', 'badges'
            ];
            if (userDataTables.includes(key)) {
                return acc + v.active;
            }
            return acc;
        }, 0);
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
            'categories', 'exercises', 'workouts', 'workout_sets',
            'routines', 'routine_days', 'routine_exercises',
            'measurements', 'goals', 'plate_inventory', 'settings',
            'body_metrics', 'badges', 'exercise_badges', 'user_profiles',
            'activity_feed', 'changelog_reactions', 'kudos'
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

        const userId = useAuthStore.getState().user?.id;
        const syncKey = userId ? `last_pull_sync_${userId}` : 'last_pull_sync';
        await dbService.run('DELETE FROM sync_queue');
        await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [syncKey, Date.now().toString()]);
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
            const bodyText = await response.text().catch(() => '');
            const suffix = bodyText ? ` body=${bodyText}` : '';
            throw new Error(`Snapshot pull failed! status: ${response.status}${suffix}`);
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

        const userId = useAuthStore.getState().user?.id;
        const syncKey = userId ? `last_pull_sync_${userId}` : 'last_pull_sync';
        await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [syncKey, Date.now().toString()]);

        // Notify app
        dataEventService.emit('DATA_UPDATED');
        dataEventService.emit('SETTINGS_UPDATED');
        dataEventService.emit('SOCIAL_UPDATED');
    }
}

export const syncService = new SyncService();
