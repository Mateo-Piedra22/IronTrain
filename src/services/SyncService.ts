import NetInfo from '@react-native-community/netinfo';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system/legacy';
import { useAuthStore } from '../store/authStore';
import { dbService } from './DatabaseService';

const API_BASE_URL = 'https://irontrain.motiona.xyz/api/sync';
const MAX_BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const ALLOWED_TABLES = [
    'exercises', 'categories', 'workouts', 'workout_sets',
    'routines', 'routine_days', 'routine_exercises',
    'measurements', 'goals', 'plate_inventory', 'settings',
    'body_metrics'
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

    private async requestWithRetry(input: RequestInfo, init: RequestInit): Promise<Response> {
        let lastError: unknown = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                return await fetch(input, init);
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

            await this.pushLocalChanges(token);
            await this.pullRemoteChanges(token, options?.forcePull);
        } catch (error) {
            console.error('[Sync] Bidirectional sync failed:', error);
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
                    throw new Error(`HTTP error! status: ${response.status}`);
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
                console.error(`Sync push error:`, error);
                await dbService.run(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
                throw error; // Throw to abort sync chain if push fails fully
            }
        }
    }

    /**
     * Pulls remote changes that happened after the last sync timestamp.
     */
    private async pullRemoteChanges(token: string, forcePull = false): Promise<void> {
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
                    for (const [table, tableChanges] of byTable.entries()) {
                        const ids = tableChanges
                            .map((c) => (c?.payload?.id ?? c?.payload?.recordId) as unknown)
                            .filter((v): v is string => typeof v === 'string' && v.length > 0);

                        const existingRows = ids.length > 0
                            ? await dbService.getAll<{ id: string; updated_at?: number | null; deleted_at?: number | null }>(
                                `SELECT id, updated_at, deleted_at FROM ${table} WHERE id IN (${ids.map(() => '?').join(', ')})`,
                                ids
                            )
                            : [];

                        const existingById = new Map(existingRows.map((r) => [r.id, r] as const));

                        for (const change of tableChanges) {
                            const operation = typeof change?.operation === 'string' ? change.operation : null;
                            const payload = change?.payload && typeof change.payload === 'object' ? change.payload : null;
                            if (!operation || !payload) continue;

                            const recordId = payload.id || payload.recordId;
                            if (typeof recordId !== 'string' || recordId.length === 0) continue;

                            const local = existingById.get(recordId);

                            if (operation === 'INSERT' || operation === 'UPDATE') {
                                const remoteUpdatedAt = typeof payload.updated_at === 'number' ? payload.updated_at : null;
                                const localUpdatedAt = typeof local?.updated_at === 'number' ? local.updated_at : null;
                                if (remoteUpdatedAt !== null && localUpdatedAt !== null && localUpdatedAt >= remoteUpdatedAt) {
                                    continue;
                                }

                                const keys = Object.keys(payload);
                                const values = Object.values(payload);
                                const placeholders = keys.map(() => '?').join(', ');

                                await dbService.run(
                                    `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                                    values as any
                                );
                                continue;
                            }

                            if (operation === 'DELETE') {
                                const remoteUpdatedAt = typeof payload.updated_at === 'number' ? payload.updated_at : null;
                                const localUpdatedAt = typeof local?.updated_at === 'number' ? local.updated_at : null;
                                if (remoteUpdatedAt !== null && localUpdatedAt !== null && localUpdatedAt >= remoteUpdatedAt) {
                                    continue;
                                }
                                await dbService.run(`DELETE FROM ${table} WHERE id = ?`, [recordId]);
                            }
                        }
                    }
                });
            }

            // Update local sync time with SERVER time to avoid clock drift issues
            const nextSyncTime = serverTime ? serverTime.toString() : Date.now().toString();
            await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_pull_sync', nextSyncTime]);

        } catch (error) {
            console.error('PULL sync failed:', error);
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
            'measurements', 'goals', 'plate_inventory', 'settings'
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

            await dbService.withTransaction(async () => {
                // Wipe current tables
                const tables = Object.keys(snapshot);
                for (const table of tables) {
                    // Check if table allowed to prevent SQL injections into meta tables like sqlite_master
                    if (!['exercises', 'categories', 'workouts', 'workout_sets', 'routines', 'routine_days', 'routine_exercises', 'measurements', 'goals', 'plate_inventory', 'settings'].includes(table)) {
                        continue;
                    }
                    await dbService.run(`DELETE FROM ${table}`);

                    const records = snapshot[table];
                    for (const record of records) {
                        const keys = Object.keys(record);
                        const values = Object.values(record);
                        const placeholders = keys.map(() => '?').join(', ');
                        await dbService.run(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values as any);
                    }
                }

                // Append full sync event to avoid pushing this as mutations
                await dbService.run('DELETE FROM sync_queue');
            });
        } catch (error) {
            console.error('Failed to restore snapshot:', error);
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
        let count = 0;
        const tables = ['workouts', 'routines', 'exercises'];
        for (const t of tables) {
            const res = await dbService.getFirst<{ count: number }>(`SELECT COUNT(*) as count FROM ${t}`);
            count += res?.count || 0;
        }
        return { hasData: count > 0, recordCount: count };
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
            'measurements', 'goals'
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
            throw new Error(`Snapshot push failed! status: ${response.status}`);
        }

        await dbService.run('DELETE FROM sync_queue');
        await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_pull_sync', Date.now().toString()]);
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

        await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_pull_sync', Date.now().toString()]);
    }
}

export const syncService = new SyncService();
