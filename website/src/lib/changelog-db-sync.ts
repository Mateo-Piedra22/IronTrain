import * as schema from '../db/schema';
import { getChangelog } from './changelog';
import { runDbTransaction } from './db-transaction';

let lastSyncAt = 0;
let inFlightSync: Promise<ChangelogSyncResult> | null = null;

export type ChangelogSyncResult = {
    skipped: boolean;
    reason: 'min_interval' | 'empty_source' | 'synced';
    sourceCount: number;
    upsertedCount: number;
    syncedAt: string;
};

function toDateOrNow(raw: string | null): Date {
    if (!raw) return new Date();
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function syncChangelogToDatabase(options?: { force?: boolean; minIntervalMs?: number }): Promise<ChangelogSyncResult> {
    const minIntervalMs = options?.minIntervalMs ?? 60_000;
    if (!options?.force && Date.now() - lastSyncAt < minIntervalMs) {
        return {
            skipped: true,
            reason: 'min_interval',
            sourceCount: 0,
            upsertedCount: 0,
            syncedAt: new Date(lastSyncAt || Date.now()).toISOString(),
        };
    }
    if (inFlightSync) return inFlightSync;

    inFlightSync = (async () => {
        const payload = await getChangelog();
        const releases = payload.releases ?? [];
        if (releases.length === 0) {
            lastSyncAt = Date.now();
            return {
                skipped: true,
                reason: 'empty_source',
                sourceCount: 0,
                upsertedCount: 0,
                syncedAt: new Date(lastSyncAt).toISOString(),
            } as ChangelogSyncResult;
        }

        let upsertedCount = 0;
        await runDbTransaction(async (trx) => {
            for (const release of releases) {
                const version = String(release.version || '').trim();
                if (!version) continue;
                const items = Array.isArray(release.items) ? release.items.filter((i) => typeof i === 'string' && i.trim().length > 0) : [];
                if (items.length === 0) continue;

                const isUnreleased = release.unreleased === true || release.date === null ? 1 : 0;

                // SKIPPED: Prevenir que forzar rebuilding traiga de vuelta la version unreleased borrada
                if (isUnreleased) continue;

                const date = toDateOrNow(release.date);
                const now = new Date();

                await trx.insert(schema.changelogs).values({
                    id: version,
                    version,
                    date,
                    items,
                    isUnreleased,
                    metadata: { source: 'docs/CHANGELOG.md' },
                    createdAt: now,
                    updatedAt: now,
                }).onConflictDoUpdate({
                    target: schema.changelogs.version,
                    set: {
                        date,
                        items,
                        isUnreleased,
                        updatedAt: now,
                    },
                });
                upsertedCount += 1;
            }
        });

        lastSyncAt = Date.now();
        return {
            skipped: false,
            reason: 'synced',
            sourceCount: releases.length,
            upsertedCount,
            syncedAt: new Date(lastSyncAt).toISOString(),
        } as ChangelogSyncResult;
    })().finally(() => {
        inFlightSync = null;
    });

    return inFlightSync;
}
