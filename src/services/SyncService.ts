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
import { SyncMapper } from './SyncMapper';
import { SYNC_TABLES, getSyncOrder } from './SyncProtocol';

const BACKEND_URL = Config.API_URL;
const API_BASE_URL = `${BACKEND_URL}/api/sync`;
const MAX_RETRIES = 3;
const MAX_BATCH_SIZE = 500;
const REQUEST_TIMEOUT_MS = 20000;

const PULL_UPSERT_ORDER: ReadonlyArray<string> = getSyncOrder();

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
    'changelogs',
    'changelog_reactions',
    'kudos',
    'activity_feed',
    'shares_inbox',
    'friendships',
    'user_exercise_prs',
    'score_events',
    'weather_logs',
    'notification_reactions',
    'activity_seen',
    'plate_inventory',
    'settings',
    'user_profiles'
]);

const ALLOWED_TABLES = Array.from(TABLES_WITH_SOFT_DELETE);

interface SyncPayload {
    id: string;
    table_name: string;
    record_id: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    payload: string | null;
    created_at: number;
    batch_id: string | null;
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
    private isSyncing: boolean = false;
    private lastSyncAt: number = 0;
    private syncStartTime: number = 0;
    private lastError: any = null;

    private syncPreconditionError(code: 'ALREADY_SYNCING' | 'UNAUTHENTICATED' | 'OFFLINE' | 'OFFLINE_MODE_ACTIVE', message: string): Error {
        const e = new Error(message);
        (e as any).code = code;
        return e;
    }

    private async wait(ms: number): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    private async fetchAllTableSchemas(): Promise<Map<string, Set<string>>> {
        const schemas = new Map<string, Set<string>>();
        const tables = Object.keys(SYNC_TABLES);
        for (const table of tables) {
            try {
                const info = await dbService.getAll<{ name: string }>(`PRAGMA table_info('${table}')`);
                schemas.set(table, new Set(info.map(c => c.name)));
            } catch (e) {
                logger.captureException(e, { scope: 'SyncService.fetchAllSchema', table });
            }
        }
        return schemas;
    }

    private normalizeIncomingRecord(tableName: string, payload: Record<string, any>): Record<string, any> {
        const rawNorm = SyncMapper.mapObject(payload, tableName, 'FROM_REMOTE');
        return this.applyBusinessRules(tableName, rawNorm);
    }

    private applyBusinessRules(table: string, normalized: Record<string, any>): Record<string, any> {
        // 0. Scaling Seconds to Milliseconds for key timestamp fields (Legacy Support)
        if (table === 'workouts' || table === 'routine_days' || table === 'body_metrics' || table === 'measurements') {
            const timeFields = ['date', 'start_time', 'end_time', 'achieved_at', 'occurred_at', 'deadline_at'];
            for (const field of timeFields) {
                if (normalized[field] && typeof normalized[field] === 'number') {
                    // Unix epoch in seconds is ~1.7e9, in ms is ~1.7e12.
                    // If < 1e11 (100 billion), it is likely seconds.
                    if (normalized[field] > 0 && normalized[field] < 100000000000) {
                        normalized[field] = normalized[field] * 1000;
                    }
                }
            }
        }

        // 1. Categories deduping
        if (table === 'categories') {
            const name = typeof normalized.name === 'string' ? normalized.name : '';
            if (name === 'Sin categoría' || name === 'Uncategorized') {
                normalized.id = 'uncategorized';
                normalized.is_system = 1;
            }
        }

        // 2. Settings key scoped by user
        if (table === 'settings') {
            const userId = useAuthStore.getState().user?.id;
            if (typeof normalized.key === 'string' && normalized.key.includes(':')) {
                normalized.key = normalized.key.split(':').pop();
            }
            if (userId && normalized.key === 'last_pull_sync') {
                normalized.key = `last_pull_sync_${userId}`;
            }
            delete normalized.deleted_at;
        }

        // 3. Noon Normalization for Workouts
        if ((table === 'workouts' || table === 'routine_days') && normalized.date) {
            const d = new Date(Number(normalized.date));
            if (!isNaN(d.getTime())) {
                d.setHours(12, 0, 0, 0);
                normalized.date = d.getTime();
            }
        }

        return normalized;
    }

    private async requestWithRetry(input: RequestInfo, init: RequestInit): Promise<Response> {
        let lastError: unknown = null;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

                try {
                    const response = await fetch(input, { ...init, signal: controller.signal });
                    if (response.status === 503) {
                        try {
                            const data = await response.clone().json();
                            if (data.error === 'MAINTENANCE_MODE') {
                                useSettingsStore.getState().setServerStatus({ mode: 'maintenance', message: data.message });
                            }
                        } catch { }
                    } else if (response.ok) {
                        useSettingsStore.getState().setServerStatus({ mode: 'normal' });
                    }
                    return response;
                } finally {
                    clearTimeout(timeoutId);
                }
            } catch (e) {
                lastError = e;
                const delay = 2000 * Math.pow(2, attempt) + Math.random() * 1000;
                await this.wait(delay);
            }
        }
        throw lastError instanceof Error ? lastError : new Error('Network error');
    }

    public async syncBidirectional(options?: { forcePull?: boolean; verify?: boolean }): Promise<void> {
        if (this.isSyncing) throw this.syncPreconditionError('ALREADY_SYNCING', 'Sync in progress');
        if (analytics.isFeatureFlagEnabled('offline-mode')) throw this.syncPreconditionError('OFFLINE_MODE_ACTIVE', 'Sync disabled by offline mode');

        const userId = useAuthStore.getState().user?.id;
        if (!userId) throw new Error('Cannot sync: no active user');

        this.isSyncing = true;
        this.syncStartTime = Date.now();
        console.log(`[SyncService] Starting bidirectional sync (forcePull=${!!options?.forcePull}, verify=${!!options?.verify})`);

        let totalPushed = 0;
        let totalPulled = 0;

        try {
            const token = useAuthStore.getState().token;
            if (!token) throw this.syncPreconditionError('UNAUTHENTICATED', 'User not authenticated');

            const netState = await NetInfo.fetch();
            if (!netState.isConnected || !netState.isInternetReachable) throw this.syncPreconditionError('OFFLINE', 'No internet connection');

            // 1. Push Local -> Remote (Topological Order)
            totalPushed = await this.pushLocalChanges(token);

            // 2. Pull Remote -> Local (Topological Order)
            totalPulled = await this.pullRemoteChanges(token, options?.forcePull);

            // 3. Optional: Verification check if requested (God Mode Integrity)
            if (options?.verify) {
                console.log('[SyncService] Verifying data integrity parity...');
                const [localStatus, remoteStatus] = await Promise.all([
                    this.checkLocalStatus(),
                    this.checkRemoteStatus()
                ]);

                // Basic count parity check
                for (const t of ALLOWED_TABLES) {
                    const lc = (localStatus.counts as any)[t]?.active || 0;
                    const rc = (remoteStatus.counts as any)[t]?.active || 0;
                    if (lc !== rc) {
                        console.warn(`[SyncService] Verification mismatch for ${t}: local=${lc}, remote=${rc}`);
                    }
                }
            }

            analytics.capture('sync_completed', {
                success: true,
                force_pull: !!options?.forcePull,
                verified: !!options?.verify,
                records_pushed: totalPushed,
                records_pulled: totalPulled,
                duration_ms: Date.now() - this.syncStartTime
            });

            if (totalPulled > 0 || totalPushed > 0) {
                dataEventService.emit('DATA_UPDATED');
            }

            this.lastSyncAt = Date.now();
        } catch (error) {
            analytics.capture('sync_completed', { 
                success: false, 
                error: error instanceof Error ? error.message : String(error) 
            });
            logger.captureException(error, { scope: 'SyncService.syncBidirectional' });
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    public async hasPendingChanges(): Promise<boolean> {
        try {
            const row = await dbService.getFirst<{ count: number }>(
                "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'"
            );
            return (row?.count || 0) > 0;
        } catch (e) {
            return false;
        }
    }

    private async pushLocalChanges(token: string): Promise<number> {
        let totalCount = 0;
        let hasMore = true;
        const pushOrder = getSyncOrder();

        // Build a dynamic ranking SQL component based on topological order
        const tableRanks = pushOrder.map((name, index) => `WHEN '${name}' THEN ${index}`).join(' ');
        const rankExpression = `CASE table_name ${tableRanks} ELSE 999 END`;

        while (hasMore) {
            const pendingOps = await dbService.getAll<SyncPayload>(
                `SELECT id, table_name, record_id, operation, payload, created_at, batch_id
                 FROM sync_queue
                 WHERE status IN ('pending', 'failed') 
                   AND retry_count < ?
                 ORDER BY ${rankExpression} ASC, created_at ASC
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
                const validOperations: any[] = [];
                const invalidIds: string[] = [];

                for (const op of pendingOps) {
                    if (!ALLOWED_TABLES.includes(op.table_name)) {
                        invalidIds.push(op.id);
                        continue;
                    }
                    try {
                        const rawPayload = op.payload ? JSON.parse(op.payload) : null;
                        if (op.operation !== 'DELETE' && op.payload && !rawPayload) {
                            throw new Error('Invalid JSON payload');
                        }

                        const mappedPayload = rawPayload ? SyncMapper.mapObject(rawPayload, op.table_name, 'TO_REMOTE') : null;

                        validOperations.push({
                            id: op.id,
                            table: op.table_name,
                            recordId: op.record_id,
                            operation: op.operation,
                            payload: mappedPayload,
                            timestamp: op.created_at,
                            batchId: op.batch_id
                        });
                    } catch (e) {
                        logger.error(`[Sync] Failed to parse payload for op ${op.id}`, { error: e });
                        invalidIds.push(op.id);
                    }
                }

                if (invalidIds.length > 0) {
                    await dbService.run(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${invalidIds.map(() => '?').join(',')})`, invalidIds);
                }

                if (validOperations.length === 0) {
                    hasMore = pendingOps.length >= MAX_BATCH_SIZE;
                    continue;
                }

                const response = await this.requestWithRetry(`${API_BASE_URL}/push`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ operations: validOperations })
                });

                if (!response.ok) {
                    const bodyText = await response.text().catch(() => '');
                    throw new Error(`HTTP error! status: ${response.status} body=${bodyText}`);
                }

                const result = await response.json();
                const successIds: string[] = [];
                const failedIds: string[] = [];

                if (result.results && Array.isArray(result.results)) {
                    for (const res of result.results) {
                        if (res.status === 'error') failedIds.push(res.id);
                        else successIds.push(res.id);
                    }
                } else successIds.push(...validOperations.map(op => op.id));

                if (successIds.length > 0) {
                    await dbService.run(`UPDATE sync_queue SET status = 'synced', synced_at = ? WHERE id IN (${successIds.map(() => '?').join(',')})`, [Date.now(), ...successIds]);
                    totalCount += successIds.length;
                }

                if (failedIds.length > 0) {
                    const failedBatchIds = new Set(pendingOps.filter(op => failedIds.includes(op.id)).map(op => op.batch_id).filter(Boolean));
                    if (failedBatchIds.size > 0) {
                        const allFailedIds = Array.from(new Set([...failedIds, ...pendingOps.filter(op => op.batch_id && failedBatchIds.has(op.batch_id)).map(op => op.id)]));
                        await dbService.run(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${allFailedIds.map(() => '?').join(',')})`, allFailedIds);
                    } else {
                        await dbService.run(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${failedIds.map(() => '?').join(',')})`, failedIds);
                    }
                }
                
                hasMore = pendingOps.length >= MAX_BATCH_SIZE;
            } catch (error) {
                logger.captureException(error, { scope: 'SyncService.pushLocalChanges' });
                await dbService.run(`UPDATE sync_queue SET status = 'failed', retry_count = retry_count + 1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
                throw error;
            }
        }
        return totalCount;
    }

    private async pullRemoteChanges(token: string, forcePull: boolean = false, schemas?: Map<string, Set<string>>): Promise<number> {
        let totalCount = 0;
        const userId = useAuthStore.getState().user?.id;
        const syncKey = userId ? `last_pull_sync_${userId}` : 'last_pull_sync';
        const cursorKey = userId ? `last_pull_cursor_${userId}` : 'last_pull_cursor';
        const lastSyncRecord = await dbService.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', [syncKey]);
        const lastCursorRecord = await dbService.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', [cursorKey]);
        const lastSyncAt = (lastSyncRecord?.value && !forcePull) ? parseInt(lastSyncRecord.value, 10) : 0;

        let cursor: string | null = null;
        if (!forcePull) {
            const persistedCursor = typeof lastCursorRecord?.value === 'string' && lastCursorRecord.value.length > 0
                ? lastCursorRecord.value
                : null;
            cursor = persistedCursor ?? lastSyncAt.toString();
        }

        let hasMore = true;
        let loopCount = 0;
        const MAX_PULL_LOOPS = 20;
        let lastServerTime: any = null;
        let anyTableChanged = false;
        let settingsModified = false;
        let pullCompleted = true;

        const tableSchemas = schemas || await this.fetchAllTableSchemas();
        while (hasMore && loopCount < MAX_PULL_LOOPS) {
            loopCount++;
            const url = cursor && cursor.includes('-') ? `${API_BASE_URL}/pull?cursor=${encodeURIComponent(cursor)}` : `${API_BASE_URL}/pull?since=${cursor || 0}`;
            const response = await this.requestWithRetry(url, { method: 'GET', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } });
            if (!response.ok) throw new Error(`HTTP pull error! status: ${response.status}`);

            const data = await response.json();
            const changes = Array.isArray(data?.changes) ? data.changes : [];
            totalCount += changes.length;
            lastServerTime = data?.serverTime || lastServerTime;
            hasMore = data?.hasMore === true;
            cursor = data?.nextCursor;

            if (hasMore && !cursor) {
                logger.error('[Sync] hasMore=true but no cursor provided');
                pullCompleted = false;
                break;
            }

            const byTable = new Map<string, any[]>();
            for (const change of changes) {
                const table = change?.table;
                if (!table || !SYNC_TABLES[table]) continue;
                if (!byTable.has(table)) byTable.set(table, []);
                byTable.get(table)!.push(change);
            }

                if (byTable.size > 0) {
                anyTableChanged = true;
                if (byTable.has('settings')) settingsModified = true;

                const applyForTable = async (table: string, tableChanges: any[]): Promise<void> => {
                    const pkField = table === 'settings' ? 'key' : 'id';
                    const ids = tableChanges.map((c) => {
                        const p = c?.payload;
                        if (!p || typeof p !== 'object') return null;
                        if (pkField === 'key') {
                            const rk = p.key;
                            if (typeof rk !== 'string') return null;
                            if (rk.includes(':')) {
                                const pcs = rk.split(':');
                                const sfx = pcs.length > 1 ? pcs.slice(1).join(':') : rk;
                                return sfx === 'last_pull_sync' && userId ? `last_pull_sync_${userId}` : sfx;
                            }
                            return rk === 'last_pull_sync' && userId ? `last_pull_sync_${userId}` : rk;
                        }
                        return p.id ?? p.recordId;
                    }).filter((v): v is string => typeof v === 'string' && v.length > 0);

                    const existingRows: any[] = [];
                    if (ids.length > 0) {
                        for (let i = 0; i < ids.length; i += 900) {
                            const chunk = ids.slice(i, i + 900);
                            const rows = await dbService.getAll<any>(`SELECT * FROM ${table} WHERE ${pkField} IN (${chunk.map(() => '?').join(',')})`, chunk);
                            existingRows.push(...rows);
                        }
                    }
                    const existingById = new Map(existingRows.map((r) => [r[pkField], r]));

                    for (const change of tableChanges) {
                        const rawNorm = SyncMapper.mapObject(change.payload, table, 'FROM_REMOTE');
                        if (!rawNorm) continue;
                        const normalized = this.applyBusinessRules(table, rawNorm);
                        const recordId = table === 'settings' ? normalized.key : normalized.id;
                        if (!recordId) continue;

                        const local = existingById.get(recordId);
                        const remoteUA = (normalized.updated_at as number) || 0;
                        const localUA = (local?.updated_at as number) || 0;

                        if (change.operation === 'INSERT' || change.operation === 'UPDATE') {
                            if (local && localUA >= remoteUA) continue;
                            const keys = Object.keys(normalized);
                            if (local) {
                                const uKeys = keys.filter(k => k !== pkField);
                                await dbService.run(`UPDATE ${table} SET ${uKeys.map(k => `${k}=?`).join(',')} WHERE ${pkField}=?`, [...uKeys.map(k => normalized[k]), recordId]);
                            } else {
                                await dbService.run(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(normalized));
                            }
                        } else if (change.operation === 'DELETE') {
                            if (TABLES_WITH_SOFT_DELETE.has(table)) {
                                await dbService.run(`UPDATE ${table} SET deleted_at=?, updated_at=? WHERE ${pkField}=?`, [remoteUA || Date.now(), remoteUA || Date.now(), recordId]);
                            } else await dbService.run(`DELETE FROM ${table} WHERE ${pkField}=?`, [recordId]);
                        }
                    }
                };

                // Topological Pull Engine with Resilience
                const failedUpserts = new Set<string>();
                
                // Pass 1: Upserts (Topological Order)
                for (const t of PULL_UPSERT_ORDER) {
                    const tChanges = byTable.get(t);
                    if (!tChanges) continue;
                    const upserts = tChanges.filter(c => c.operation !== 'DELETE');
                    if (upserts.length > 0) {
                        try {
                            await applyForTable(t, upserts);
                        } catch (e: any) {
                            if (e.message && e.message.includes('FOREIGN KEY')) {
                                failedUpserts.add(t);
                            } else throw e;
                        }
                    }
                }

                // Pass 2: Retry Failed Upserts (One final attempt to handle out-of-order deps)
                if (failedUpserts.size > 0) {
                    for (const t of PULL_UPSERT_ORDER) {
                        if (failedUpserts.has(t)) {
                            const upserts = byTable.get(t)!.filter(c => c.operation !== 'DELETE');
                            await applyForTable(t, upserts);
                        }
                    }
                }

                // Pass 3: Deletes (Reverse Topological Order)
                for (const t of PULL_DELETE_ORDER) {
                    const tChanges = byTable.get(t);
                    if (!tChanges) continue;
                    const deletes = tChanges.filter(c => c.operation === 'DELETE');
                    if (deletes.length > 0) await applyForTable(t, deletes);
                }
            }
        }

        if (hasMore && loopCount >= MAX_PULL_LOOPS) {
            pullCompleted = false;
            logger.error('[Sync] Pull loop cap reached before pagination completed', {
                scope: 'SyncService.pullRemoteChanges',
                loopCount,
                cursor,
            });
        }

        if (pullCompleted) {
            await dbService.run('DELETE FROM settings WHERE key = ?', [cursorKey]);
            await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [syncKey, lastServerTime ? lastServerTime.toString() : Date.now().toString()]);
        } else if (cursor) {
            await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [cursorKey, cursor]);
        }

        if (anyTableChanged) {
            if (settingsModified) await configService.reload();
            dataEventService.emit('DATA_UPDATED');
        }
        if (userId) await dbService.repairDataConsistency(userId);
        return totalCount;
    }

    public async createDatabaseSnapshot(): Promise<string> {
        const snapshot: Record<string, any[]> = {};
        for (const table of ALLOWED_TABLES) snapshot[table] = await dbService.getAll(`SELECT * FROM ${table}`);
        const fileUri = FileSystem.documentDirectory + `irontrain_snapshot_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`;
        await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(snapshot, null, 2));
        return fileUri;
    }

    public async restoreDatabaseSnapshot(fileUri: string): Promise<void> {
        const snapshot = JSON.parse(await FileSystem.readAsStringAsync(fileUri));
        await dbService.executeRaw('PRAGMA foreign_keys = OFF;');
        try {
            await dbService.withTransaction(async () => {
                for (const t of PULL_DELETE_ORDER) await dbService.run(`DELETE FROM ${t}`);
                const schemas = await this.fetchAllTableSchemas();
                for (const t of PULL_UPSERT_ORDER) {
                    const recs = snapshot[t] || [];
                    const valid = schemas.get(t);
                    for (const r of recs) {
                        const rawNorm = SyncMapper.mapObject(r, t, 'FROM_REMOTE');
                        const norm = rawNorm ? this.applyBusinessRules(t, rawNorm) : null;
                        if (norm) {
                            const keys = Object.keys(norm);
                            await dbService.run(`INSERT INTO ${t} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(norm));
                        }
                    }
                }
                await dbService.run('DELETE FROM sync_queue');
            });
        } finally { await dbService.executeRaw('PRAGMA foreign_keys = ON;'); }
        await configService.reload();
        dataEventService.emit('DATA_UPDATED');
    }

    public async checkRemoteStatus(): Promise<SyncStatus> {
        const token = useAuthStore.getState().token;
        const res = await this.requestWithRetry(`${API_BASE_URL}/status`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
        return await res.json();
    }

    public async checkLocalStatus(): Promise<SyncStatus> {
        const counts: Record<string, any> = {};
        for (const t of ALLOWED_TABLES) {
            const r = await dbService.getFirst<{ c: number }>(`SELECT COUNT(*) as c FROM ${t} ${TABLES_WITH_SOFT_DELETE.has(t) ? 'WHERE deleted_at IS NULL' : ''}`);
            const d = TABLES_WITH_SOFT_DELETE.has(t) 
                ? await dbService.getFirst<{ c: number }>(`SELECT COUNT(*) as c FROM ${t} WHERE deleted_at IS NOT NULL`)
                : { c: 0 };
            
            const activeCount = r?.c || 0;
            const deletedCount = d?.c || 0;
            
            // Checksum logic mapping the backend implementation: count:deleted:max(updated_at)
            let checksum = `${activeCount}:${deletedCount}`;
            try {
                const latest = await dbService.getFirst<{ ts: number }>(`SELECT MAX(updated_at) as ts FROM ${t}`);
                if (latest?.ts) {
                    checksum += `:${latest.ts}`;
                }
            } catch { /* Table might not have updatedAt */ }

            counts[t] = { 
                active: activeCount,
                deleted: deletedCount,
                total: activeCount + deletedCount,
                checksum
            };
        }
        
        const recordCount = Object.values(counts).reduce((acc: number, v: any) => acc + (v?.active || 0), 0);
        return { hasData: recordCount > 0, recordCount, counts };
    }

    public async checkQueueStatus(): Promise<SyncQueueStatus> {
        const p = await dbService.getFirst<{ c: number }>("SELECT COUNT(*) as c FROM sync_queue WHERE status='pending'");
        const f = await dbService.getFirst<{ c: number }>("SELECT COUNT(*) as c FROM sync_queue WHERE status='failed'");
        const pr = await dbService.getFirst<{ c: number }>("SELECT COUNT(*) as c FROM sync_queue WHERE status='processing'");
        const pc = p?.c || 0;
        const fc = f?.c || 0;
        const prc = pr?.c || 0;
        return { pending: pc, failed: fc, processing: prc, totalOutstanding: pc + fc };
    }

    public async getDiagnostics(): Promise<SyncDiagnostics> {
        const [l, r, q] = await Promise.all([this.checkLocalStatus(), this.checkRemoteStatus(), this.checkQueueStatus()]);
        return { local: l, remote: r, queue: q };
    }

    public async pushLocalSnapshot(): Promise<void> {
        const token = useAuthStore.getState().token;
        const snapshot: Record<string, any[]> = {};
        for (const t of ALLOWED_TABLES) snapshot[t] = await dbService.getAll(`SELECT * FROM ${t}`);
        await this.requestWithRetry(`${API_BASE_URL}/snapshot`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ snapshot }) });
        await dbService.run('DELETE FROM sync_queue');
    }

    public async pullCloudSnapshot(): Promise<void> {
        const token = useAuthStore.getState().token;
        const response = await this.requestWithRetry(`${API_BASE_URL}/snapshot`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await response.json();
        const snapshot: Record<string, any[]> = data?.snapshot || {};

        await dbService.withTransaction(async () => {
            for (const [tableName, rows] of Object.entries(snapshot)) {
                if (!ALLOWED_TABLES.includes(tableName)) continue;
                await dbService.run(`DELETE FROM ${tableName}`);
                for (const row of rows as any[]) {
                    const keys = Object.keys(row);
                    const placeholders = keys.map(() => '?').join(', ');
                    const values = Object.values(row);
                    await dbService.run(`INSERT OR REPLACE INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`, values);
                }
            }
        });
        await dbService.run('DELETE FROM sync_queue');
    }

    public async wipeAllUserData(): Promise<void> {
        const token = useAuthStore.getState().token;
        await this.requestWithRetry(`${API_BASE_URL}/wipe`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    }
}

export const syncService = new SyncService();
