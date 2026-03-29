import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '../db';
import * as schema from '../db/schema';
import {
    auditAndReconcileSocialIntegrityForUser,
    auditSocialIntegrityForUser,
    type SocialIntegrityAuditResult,
    type SocialIntegrityReconcileResult,
} from './social-scoring';

type AuditRunOptions = {
    limit?: number;
    userIds?: string[];
    reconcile?: boolean;
    nowMs?: number;
};

type AuditRunSummary = {
    scannedUsers: number;
    usersWithoutProfile: number;
    scoreDriftUsers: number;
    staleStreakUsers: number;
    weekRecalcUsers: number;
    reconciledUsers: number;
    totalScoreDrift: number;
};

export type SocialIntegrityAuditRunResult = {
    mode: 'audit' | 'reconcile';
    summary: AuditRunSummary;
    users: Array<SocialIntegrityAuditResult | SocialIntegrityReconcileResult>;
};

async function loadTargetUserIds(limit: number, userIds?: string[]): Promise<string[]> {
    if (Array.isArray(userIds) && userIds.length > 0) {
        const unique = new Set(userIds.filter((value) => typeof value === 'string' && value.trim().length > 0));
        return Array.from(unique).slice(0, limit);
    }

    const rows = await db
        .select({ id: schema.userProfiles.id })
        .from(schema.userProfiles)
        .where(and(
            isNull(schema.userProfiles.deletedAt),
            eq(schema.userProfiles.isPublic, true)
        ))
        .orderBy(desc(schema.userProfiles.updatedAt))
        .limit(limit);

    return rows.map((row) => row.id);
}

export async function runSocialIntegrityAudit(options: AuditRunOptions = {}): Promise<SocialIntegrityAuditRunResult> {
    const reconcile = Boolean(options.reconcile);
    const limit = Math.max(1, Math.min(1000, Number(options.limit || 200)));
    const nowMs = Number(options.nowMs || Date.now());
    const targetUserIds = await loadTargetUserIds(limit, options.userIds);

    const users: Array<SocialIntegrityAuditResult | SocialIntegrityReconcileResult> = [];

    for (const userId of targetUserIds) {
        if (reconcile) {
            users.push(await db.transaction((trx) => auditAndReconcileSocialIntegrityForUser(trx, userId, nowMs)));
        } else {
            users.push(await db.transaction((trx) => auditSocialIntegrityForUser(trx, userId, nowMs)));
        }
    }

    const summary: AuditRunSummary = users.reduce<AuditRunSummary>((acc, item) => {
        if (!item.hasProfile) {
            acc.usersWithoutProfile += 1;
            return acc;
        }

        if (item.scoreLifetimeDrift !== 0) {
            acc.scoreDriftUsers += 1;
            acc.totalScoreDrift += item.scoreLifetimeDrift;
        }
        if (item.streakPossiblyStale) acc.staleStreakUsers += 1;
        if (item.streakWeekNeedsRecalc) acc.weekRecalcUsers += 1;
        if ('changed' in item && item.changed) acc.reconciledUsers += 1;
        return acc;
    }, {
        scannedUsers: users.length,
        usersWithoutProfile: 0,
        scoreDriftUsers: 0,
        staleStreakUsers: 0,
        weekRecalcUsers: 0,
        reconciledUsers: 0,
        totalScoreDrift: 0,
    });

    return {
        mode: reconcile ? 'reconcile' : 'audit',
        summary,
        users,
    };
}
