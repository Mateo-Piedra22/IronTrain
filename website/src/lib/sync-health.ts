import { desc, sql } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { getDbTransactionDiagnostics } from './db-transaction';

type OperationHealth = {
    ok: boolean;
    mode: 'native' | 'fallback_db' | 'read_only' | 'unknown';
    reason: string;
};

export type SyncHealthReport = {
    generatedAt: string;
    db: {
        driver: string;
        databaseUrlConfigured: boolean;
        pingMs: number | null;
        ok: boolean;
    };
    transaction: {
        hasTransactionMethod: boolean;
        supportsNativeTransaction: boolean;
        mode: 'native' | 'fallback_db';
    };
    operations: {
        pull: OperationHealth;
        push: OperationHealth;
        snapshot: OperationHealth;
        wipe: OperationHealth;
        status: OperationHealth;
    };
    signals: {
        latestUserProfileUpdateAt: string | null;
        latestWorkoutUpdateAt: string | null;
        latestScoreEventAt: string | null;
        latestWipeAuditAt: string | null;
    };
};

function toIsoOrNull(value: Date | null | undefined): string | null {
    if (!value) return null;
    return value.toISOString();
}

export async function getSyncHealthReport(): Promise<SyncHealthReport> {
    const pingStart = Date.now();
    let dbOk = true;
    try {
        await db.execute(sql`select 1`);
    } catch {
        dbOk = false;
    }
    const pingMs = dbOk ? Date.now() - pingStart : null;

    const txDiag = await getDbTransactionDiagnostics();
    const writeMode = txDiag.supportsNativeTransaction ? 'native' : 'fallback_db';
    const writeOk = dbOk && (txDiag.supportsNativeTransaction || !txDiag.supportsNativeTransaction);

    const [latestProfile, latestWorkout, latestScoreEvent, latestWipeAudit] = await Promise.all([
        db.select({ updatedAt: schema.userProfiles.updatedAt }).from(schema.userProfiles).orderBy(desc(schema.userProfiles.updatedAt)).limit(1),
        db.select({ updatedAt: schema.workouts.updatedAt }).from(schema.workouts).orderBy(desc(schema.workouts.updatedAt)).limit(1),
        db.select({ createdAt: schema.scoreEvents.createdAt }).from(schema.scoreEvents).orderBy(desc(schema.scoreEvents.createdAt)).limit(1),
        db.select({ requestedAt: schema.wipeAudit.requestedAt }).from(schema.wipeAudit).orderBy(desc(schema.wipeAudit.requestedAt)).limit(1),
    ]);

    return {
        generatedAt: new Date().toISOString(),
        db: {
            driver: 'drizzle-orm/neon-serverless',
            databaseUrlConfigured: Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0),
            pingMs,
            ok: dbOk,
        },
        transaction: {
            hasTransactionMethod: txDiag.hasTransactionMethod,
            supportsNativeTransaction: txDiag.supportsNativeTransaction,
            mode: txDiag.mode,
        },
        operations: {
            pull: {
                ok: dbOk,
                mode: 'read_only',
                reason: dbOk ? 'read queries disponibles' : 'db ping falló',
            },
            push: {
                ok: writeOk,
                mode: writeMode,
                reason: writeMode === 'native' ? 'transacción nativa activa' : 'modo fallback controlado sin transacción',
            },
            snapshot: {
                ok: writeOk,
                mode: writeMode,
                reason: writeMode === 'native' ? 'replace transaccional activo' : 'replace en modo fallback controlado',
            },
            wipe: {
                ok: writeOk,
                mode: writeMode,
                reason: writeMode === 'native' ? 'wipe transaccional activo' : 'wipe en modo fallback controlado',
            },
            status: {
                ok: dbOk,
                mode: 'read_only',
                reason: dbOk ? 'endpoint de estado puede consultar conteos' : 'db ping falló',
            },
        },
        signals: {
            latestUserProfileUpdateAt: toIsoOrNull(latestProfile[0]?.updatedAt),
            latestWorkoutUpdateAt: toIsoOrNull(latestWorkout[0]?.updatedAt),
            latestScoreEventAt: toIsoOrNull(latestScoreEvent[0]?.createdAt),
            latestWipeAuditAt: toIsoOrNull(latestWipeAudit[0]?.requestedAt),
        },
    };
}
