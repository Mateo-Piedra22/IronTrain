import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { SYNC_TABLES } from '../../../../src/constants/sync';
import { db } from '../../../../src/db';
import * as schema from '../../../../src/db/schema';
import { verifyAuth } from '../../../../src/lib/auth';
import { RATE_LIMITS } from '../../../../src/lib/rate-limit';
import {
    collectMissingParentIdsFromChanges,
    type SyncChange,
    type SyncParentRelation,
} from '../../../../src/lib/sync-parent-workouts';
import { parseSyncCursor } from '../../../../src/lib/sync/cursor-parser';
import { computeNextCursor } from '../../../../src/lib/sync/pull-cursor';
import { SyncMapper } from '../../../../src/lib/sync/SyncMapper';

export const runtime = 'nodejs';

type SyncRow = Record<string, unknown> & { updatedAt?: Date | string | number | null; id?: string | number | null };
type PullRowItem = { row: SyncRow; tableName: string };


const unscopedSettingsKey = (userId: string, key: string): string => {
    const prefix = `${userId}:`;
    if (key.startsWith(prefix)) return key.slice(prefix.length);
    return key;
};

export async function GET(req: NextRequest) {
    const userId = await verifyAuth(req);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limiting
    const rateLimit = await RATE_LIMITS.SYNC_PULL(userId);
    if (!rateLimit.ok) {
        return NextResponse.json(
            { error: 'Too many sync requests. Please try again later.' },
            { 
                status: 429,
                headers: { 
                    'Retry-After': String(Math.ceil((rateLimit.resetAtMs - Date.now()) / 1000)),
                }
            }
        );
    }

    const sp = req.nextUrl.searchParams;
    
    const cursorParam = sp.get('cursor') || sp.get('since');
    const { sinceDate, tieBreakerOffset } = parseSyncCursor(cursorParam);

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tableMap: Record<string, any> = {};
        for (const tableName of SYNC_TABLES) {
            // Mapping SYNC_TABLES keys to schema export names
            let schemaKey = tableName.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            if (tableName === 'workout_sets') schemaKey = 'workoutSets';
            if (tableName === 'routine_days') schemaKey = 'routineDays';
            if (tableName === 'routine_exercises') schemaKey = 'routineExercises';
            if (tableName === 'exercise_badges') schemaKey = 'exerciseBadges';
            if (tableName === 'user_profiles') schemaKey = 'userProfiles';
            if (tableName === 'activity_feed') schemaKey = 'activityFeed';
            if (tableName === 'shares_inbox') schemaKey = 'sharesInbox';
            if (tableName === 'changelog_reactions') schemaKey = 'changelogReactions';
            if (tableName === 'user_exercise_prs') schemaKey = 'userExercisePrs';
            if (tableName === 'score_events') schemaKey = 'scoreEvents';
            if (tableName === 'body_metrics') schemaKey = 'bodyMetrics';
            if (tableName === 'plate_inventory') schemaKey = 'plateInventory';
            if (tableName === 'notification_reactions') schemaKey = 'notificationReactions';

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tableMap[tableName] = (schema as any)[schemaKey];
        }

        const MAX_PULL_RECORDS = 1000;

        // Concurrency limit for parallel queries
        const CONCURRENCY_LIMIT = 5;
        const results: PullRowItem[][] = [];
        
        for (let i = 0; i < SYNC_TABLES.length; i += CONCURRENCY_LIMIT) {
            const chunk = SYNC_TABLES.slice(i, i + CONCURRENCY_LIMIT);
            const chunkResults = await Promise.all(chunk.map(async (tableName) => {
                const tableSchema = tableMap[tableName];
                if (!tableSchema) return [];

                const conditions = [];
                conditions.push(sql`${tableSchema.updatedAt} >= ${sinceDate}`);

                const SYSTEM_ASSET_TABLES = ['categories', 'badges', 'exercises', 'exercise_badges'];
                const PURE_GLOBAL_TABLES = ['changelogs'];

                if (SYSTEM_ASSET_TABLES.includes(tableName)) {
                    if ('userId' in tableSchema && 'isSystem' in tableSchema) {
                        conditions.push(sql`(${tableSchema.isSystem} = 1 OR ${tableSchema.userId} = ${userId})`);
                    } else if ('isSystem' in tableSchema) {
                        conditions.push(eq(tableSchema.isSystem, 1));
                    } else if ('userId' in tableSchema) {
                        conditions.push(eq(tableSchema.userId, userId));
                    }
                } else if (tableName === 'user_profiles') {
                    conditions.push(or(eq(tableSchema.id, userId), eq(tableSchema.isPublic, true)));
                } else if (!PURE_GLOBAL_TABLES.includes(tableName)) {
                    if (tableName === 'activity_feed' || tableName === 'kudos') {
                        const userCol = tableName === 'kudos' ? tableSchema.giverId : tableSchema.userId;
                        conditions.push(sql`(${userCol} = ${userId} OR EXISTS (
                            SELECT 1 FROM friendships f 
                            WHERE ((f.user_id = ${userId} AND f.friend_id = ${userCol}) 
                               OR (f.user_id = ${userCol} AND f.friend_id = ${userId})) 
                            AND f.status = 'accepted'
                            AND f.deleted_at IS NULL
                        ))`);
                    } else if (tableName === 'friendships') {
                        conditions.push(sql`(${tableSchema.userId} = ${userId} OR ${tableSchema.friendId} = ${userId})`);
                    } else if (tableName === 'shares_inbox') {
                        conditions.push(sql`(${tableSchema.senderId} = ${userId} OR ${tableSchema.receiverId} = ${userId})`);
                    } else if ('userId' in tableSchema) {
                        conditions.push(eq(tableSchema.userId, userId));
                    }

                    if (tableName === 'routine_exercises') {
                        conditions.push(sql`exists (
                            select 1
                            from ${schema.routineDays}
                            where ${schema.routineDays.id} = ${tableSchema.routineDayId}
                              and ${schema.routineDays.userId} = ${userId}
                              and ${schema.routineDays.deletedAt} is null
                        )`);
                    }
                }

                const rows = await db.select().from(tableSchema)
                    .where(and(...conditions))
                    .orderBy(asc(tableSchema.updatedAt))
                    .limit(MAX_PULL_RECORDS + tieBreakerOffset); 
                
                return rows.map((row) => ({ row: row as SyncRow, tableName }));
            }));
            results.push(...chunkResults);
        }
        
        const allRows: PullRowItem[] = [];
        for (const res of results) {
            allRows.push(...res);
        }

        // Sort globally by updatedAt ASC
        allRows.sort((a, b) => {
            const timeA = a.row.updatedAt ? new Date(a.row.updatedAt).getTime() : 0;
            const timeB = b.row.updatedAt ? new Date(b.row.updatedAt).getTime() : 0;
            return timeA - timeB;
        });

        // Filter out those strictly older than sinceDate, and apply offset for the EXACT sinceDate
        const filteredRows: PullRowItem[] = [];
        let skippedOffset = 0;
        const sinceMs = sinceDate.getTime();
        
        for (const item of allRows) {
            const t = item.row.updatedAt ? new Date(item.row.updatedAt).getTime() : 0;
            if (t < sinceMs) continue; 
            if (t === sinceMs) {
                if (skippedOffset < tieBreakerOffset) {
                    skippedOffset++;
                    continue;
                }
            }
            filteredRows.push(item);
        }

        // Enforce MAX_PULL_RECORDS limit
        const hasMore = filteredRows.length > MAX_PULL_RECORDS;
        const slicedRows = filteredRows.slice(0, MAX_PULL_RECORDS);

        const SENSITIVE_FIELDS = ['push_token', 'password', 'token', 'secret', 'ip_hash'];
        const changes: SyncChange[] = [];

        for (const { row, tableName } of slicedRows) {
            const snakeRow = SyncMapper.mapObject(row as Record<string, unknown>, tableName, 'TO_REMOTE') as Record<string, unknown>;
            for (const field of SENSITIVE_FIELDS) {
                if (Object.prototype.hasOwnProperty.call(snakeRow, field)) delete snakeRow[field];
            }
            if (tableName === 'settings') {
                snakeRow.key = unscopedSettingsKey(userId, String(snakeRow.key ?? ''));
            }
            changes.push({
                table: tableName,
                operation: snakeRow.deleted_at ? 'DELETE' : 'UPDATE',
                payload: snakeRow
            });
        }

        const nextCursor = computeNextCursor(
            filteredRows.map((item) => ({ updatedAt: item.row.updatedAt })),
            MAX_PULL_RECORDS
        );

        // Fetch parents (we do this sequentially as it requires collecting missing IDs)
        // Note: fetchParents should theoretically not affect pagination cursor, they are just bundled in.
        const relations: SyncParentRelation[] = [
            { childTable: 'workout_sets', parentTable: 'workouts', fkField: 'workout_id' },
            { childTable: 'workout_sets', parentTable: 'exercises', fkField: 'exercise_id' },
            { childTable: 'exercises', parentTable: 'categories', fkField: 'category_id' },
            { childTable: 'routine_days', parentTable: 'routines', fkField: 'routine_id' },
            { childTable: 'routine_exercises', parentTable: 'routine_days', fkField: 'routine_day_id' },
            { childTable: 'routine_exercises', parentTable: 'exercises', fkField: 'exercise_id' },
            { childTable: 'exercise_badges', parentTable: 'exercises', fkField: 'exercise_id' },
            { childTable: 'exercise_badges', parentTable: 'badges', fkField: 'badge_id' },
            { childTable: 'user_exercise_prs', parentTable: 'exercises', fkField: 'exercise_id' },
            { childTable: 'score_events', parentTable: 'workouts', fkField: 'workout_id' },
            { childTable: 'kudos', parentTable: 'activity_feed', fkField: 'feed_id' },
            { childTable: 'changelog_reactions', parentTable: 'changelogs', fkField: 'changelog_id' },
        ];

        let parentsTotalCount = 0;
        const fetchParents = async (parentTable: string, ids: string[]): Promise<void> => {
            if (parentsTotalCount >= 500) return; // limit parent fetches
            if (ids.length === 0) return;
            const tableSchema = tableMap[parentTable];
            if (!tableSchema) return;

            const remaining = 500 - parentsTotalCount;
            const limited = ids.slice(0, remaining);
            const pkField = parentTable === 'settings' ? tableSchema.key : tableSchema.id;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const baseConditions: any[] = [];
            const SYSTEM_ASSET_TABLES = ['categories', 'badges', 'exercises', 'exercise_badges'];
            const PURE_GLOBAL_TABLES = ['changelogs'];

            if (parentTable === 'activity_feed') {
                baseConditions.push(inArray(pkField, limited));
                baseConditions.push(sql`(${tableSchema.userId} = ${userId} OR EXISTS (
                    SELECT 1 FROM friendships f
                    WHERE ((f.user_id = ${userId} AND f.friend_id = ${tableSchema.userId})
                       OR (f.user_id = ${tableSchema.userId} AND f.friend_id = ${userId}))
                    AND f.status = 'accepted'
                    AND f.deleted_at IS NULL
                ))`);
            } else if (SYSTEM_ASSET_TABLES.includes(parentTable)) {
                baseConditions.push(inArray(pkField, limited));
                if ('userId' in tableSchema && 'isSystem' in tableSchema) {
                    baseConditions.push(sql`(${tableSchema.isSystem} = 1 OR ${tableSchema.userId} = ${userId})`);
                } else if ('isSystem' in tableSchema) {
                    baseConditions.push(eq(tableSchema.isSystem, 1));
                } else if ('userId' in tableSchema) {
                    baseConditions.push(eq(tableSchema.userId, userId));
                }
            } else if (parentTable === 'user_profiles') {
                baseConditions.push(inArray(pkField, limited));
                baseConditions.push(or(eq(tableSchema.id, userId), eq(tableSchema.isPublic, true)));
            } else if (!PURE_GLOBAL_TABLES.includes(parentTable)) {
                baseConditions.push(inArray(pkField, limited));
                if (parentTable === 'friendships') {
                    baseConditions.push(sql`(${tableSchema.userId} = ${userId} OR ${tableSchema.friendId} = ${userId})`);
                } else if (parentTable === 'shares_inbox') {
                    baseConditions.push(sql`(${tableSchema.senderId} = ${userId} OR ${tableSchema.receiverId} = ${userId})`);
                } else if (parentTable === 'kudos') {
                    baseConditions.push(eq(tableSchema.giverId, userId));
                } else if ('userId' in tableSchema) {
                    baseConditions.push(eq(tableSchema.userId, userId));
                }
            } else {
                baseConditions.push(inArray(pkField, limited));
            }

            const rows = await db.select().from(tableSchema).where(and(...baseConditions));

            for (const row of rows) {
                const snakeRow = SyncMapper.mapObject(row as Record<string, unknown>, parentTable, 'TO_REMOTE') as Record<string, unknown>;
                for (const field of SENSITIVE_FIELDS) {
                    if (Object.prototype.hasOwnProperty.call(snakeRow, field)) delete snakeRow[field];
                }
                if (parentTable === 'settings') {
                    snakeRow.key = unscopedSettingsKey(userId, String(snakeRow.key ?? ''));
                }
                changes.push({
                    table: parentTable,
                    operation: snakeRow.deleted_at ? 'DELETE' : 'UPDATE',
                    payload: snakeRow,
                });
                parentsTotalCount++;
            }
        };

        for (let pass = 0; pass < 3 && parentsTotalCount < 500; pass++) {
            const missingByTable = collectMissingParentIdsFromChanges(changes, relations);
            const entries = Object.entries(missingByTable);
            if (entries.length === 0) break;
            for (const [parentTable, ids] of entries) {
                await fetchParents(parentTable, ids);
            }
        }

        return NextResponse.json({
            success: true,
            serverTime: new Date().getTime(),
            changes,
            hasMore,
            nextCursor
        });
    } catch (e: unknown) {
        const error = e as Error;
        console.error(`[Sync/Pull] Error pulling for user ${userId}:`, error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            details: error.toString()
        }, { status: 500 });
    }
}
