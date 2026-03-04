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
    id: number;
    table_name: string;
    record_id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: any;
    created_at: number;
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
    public async syncBidirectional(): Promise<void> {
        if (this.isSyncing) return;

        const token = useAuthStore.getState().token;
        if (!token) throw new Error('Usuario no autenticado para sincronizar');

        this.isSyncing = true;
        try {
            await this.pushLocalChanges(token);
            await this.pullRemoteChanges(token);
        } catch (error) {
            console.error('Error during bidirectional sync:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Pushes pending mutations from the local database out to the remote server.
     */
    private async pushLocalChanges(token: string): Promise<void> {
        const db = dbService.getDatabase();

        let hasMore = true;
        while (hasMore) {
            const pendingOps = await db.getAllAsync<SyncPayload>(
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
            await db.runAsync(`UPDATE sync_queue SET status = 'processing' WHERE id IN (${ids.map(() => '?').join(',')})`, ids);

            try {
                const validOperations: {
                    id: number;
                    table: string;
                    recordId: string;
                    operation: 'INSERT' | 'UPDATE' | 'DELETE';
                    payload: Record<string, unknown> | null;
                    timestamp: number;
                }[] = [];
                const invalidIds: number[] = [];

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
                    await db.runAsync(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${invalidIds.map(() => '?').join(',')})`, invalidIds);
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

                await db.runAsync(`UPDATE sync_queue SET status = 'synced', synced_at = ? WHERE id IN (${validOperations.map(() => '?').join(',')})`, [Date.now(), ...validOperations.map(op => op.id)]);
            } catch (error) {
                console.error(`Sync push error:`, error);

                await db.runAsync(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
            }
        }
    }

    /**
     * Pulls remote changes that happened after the last sync timestamp.
     */
    private async pullRemoteChanges(token: string): Promise<void> {
        const db = dbService.getDatabase();

        // Retrieve the last synced timestamp from local settings
        const lastSyncRecord = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['last_pull_sync']);
        const lastSyncAt = lastSyncRecord?.value ? parseInt(lastSyncRecord.value, 10) : 0;

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

            if (changes.length > 0) {
                await db.runAsync('BEGIN TRANSACTION');
                try {
                    for (const change of changes) {
                        const table = typeof change?.table === 'string' ? change.table : null;
                        const operation = typeof change?.operation === 'string' ? change.operation : null;
                        const payload = change?.payload && typeof change.payload === 'object' ? change.payload : null;
                        if (!table || !operation || !payload) {
                            continue;
                        }
                        if (!ALLOWED_TABLES.includes(table)) {
                            continue;
                        }

                        if (operation === 'INSERT' || operation === 'UPDATE') {
                            const keys = Object.keys(payload);
                            const values = Object.values(payload);
                            const placeholders = keys.map(() => '?').join(', ');

                            await db.runAsync(
                                `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                                values as any
                            );
                        } else if (operation === 'DELETE') {
                            if (typeof payload.id === 'string' && payload.id.length > 0) {
                                await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [payload.id]);
                            }
                        }
                    }
                    await db.runAsync('COMMIT');
                } catch (e) {
                    await db.runAsync('ROLLBACK');
                    throw e;
                }
            }

            // Update local sync time
            await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_pull_sync', Date.now().toString()]);

        } catch (error) {
            console.error('PULL sync failed:', error);
            // Non critical, just retry next time
        }
    }

    /**
     * Generates a complete JSON snapshot of the local database.
     */
    public async createDatabaseSnapshot(): Promise<string> {
        const db = dbService.getDatabase();
        const tables = [
            'exercises', 'categories', 'workouts', 'workout_sets',
            'routines', 'routine_days', 'routine_exercises',
            'measurements', 'goals', 'plate_inventory', 'settings'
        ];

        const snapshot: Record<string, any[]> = {};

        for (const table of tables) {
            snapshot[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
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

            const db = dbService.getDatabase();

            await db.runAsync('BEGIN TRANSACTION');
            try {
                // Wipe current tables
                const tables = Object.keys(snapshot);
                for (const table of tables) {
                    // Check if table allowed to prevent SQL injections into meta tables like sqlite_master
                    if (!['exercises', 'categories', 'workouts', 'workout_sets', 'routines', 'routine_days', 'routine_exercises', 'measurements', 'goals', 'plate_inventory', 'settings'].includes(table)) {
                        continue;
                    }
                    await db.runAsync(`DELETE FROM ${table}`);

                    const records = snapshot[table];
                    for (const record of records) {
                        const keys = Object.keys(record);
                        const values = Object.values(record);
                        const placeholders = keys.map(() => '?').join(', ');
                        await db.runAsync(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`, values as any);
                    }
                }

                // Append full sync event to avoid pushing this as mutations
                await db.runAsync('DELETE FROM sync_queue');

                await db.runAsync('COMMIT');
            } catch (e) {
                await db.runAsync('ROLLBACK');
                throw e;
            }
        } catch (error) {
            console.error('Failed to restore snapshot:', error);
            throw error;
        }
    }
}

export const syncService = new SyncService();
