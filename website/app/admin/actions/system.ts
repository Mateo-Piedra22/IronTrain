'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { getRedirectPath, requireAdminAction, writeAdminAuditLog } from './shared';

export async function handleScoringConfigAction(formData: FormData) {
    let redirectPath = '';
    let adminUserId: string | null = null;
    let adminRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    try {
        const admin = await requireAdminAction({ action: 'admin.system.scoring-config', requiredRole: 'superadmin' });
        const adminId = admin.userId;
        adminUserId = admin.userId;
        adminRole = admin.role;

        const toInt = (name: string, fallback: number) => {
            const value = Number(formData.get(name));
            if (!Number.isFinite(value)) return fallback;
            return Math.max(0, Math.round(value));
        };
        const toFloat = (name: string, fallback: number) => {
            const value = Number(formData.get(name));
            if (!Number.isFinite(value)) return fallback;
            return value;
        };

        const config = {
            workoutCompletePoints: toInt('workoutCompletePoints', 20),
            extraDayPoints: toInt('extraDayPoints', 10),
            extraDayWeeklyCap: toInt('extraDayWeeklyCap', 2),
            prNormalPoints: toInt('prNormalPoints', 10),
            prBig3Points: toInt('prBig3Points', 25),
            adverseWeatherPoints: toInt('adverseWeatherPoints', 15),
            weekTier2Min: toInt('weekTier2Min', 3),
            weekTier3Min: toInt('weekTier3Min', 5),
            weekTier4Min: toInt('weekTier4Min', 10),
            tier2Multiplier: toFloat('tier2Multiplier', 1.1),
            tier3Multiplier: toFloat('tier3Multiplier', 1.25),
            tier4Multiplier: toFloat('tier4Multiplier', 1.5),
            coldThresholdC: toFloat('coldThresholdC', 3),
            weatherBonusEnabled: formData.get('weatherBonusEnabled') === 'true',
        };

        await db.insert(schema.socialScoringConfig).values({
            id: 'default',
            ...config,
            updatedAt: new Date(),
            updatedBy: adminId,
        }).onConflictDoUpdate({
            target: schema.socialScoringConfig.id,
            set: {
                ...config,
                updatedAt: new Date(),
                updatedBy: adminId,
            }
        });

        revalidatePath('/admin');
        revalidatePath('/feed');
        redirectPath = await getRedirectPath(formData, 'social');

        await writeAdminAuditLog({
            adminUserId: admin.userId,
            adminRole: admin.role,
            action: 'admin.system.scoring-config',
            status: 'success',
        });
    } catch (error: any) {
        console.error('Scoring Config Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=social&section=config&error=config_failed';
        if (adminUserId) {
            await writeAdminAuditLog({
                adminUserId,
                adminRole,
                action: 'admin.system.scoring-config',
                status: 'error',
                message: error?.message || 'unknown_error',
            });
        }
    }
    if (redirectPath) redirect(redirectPath);
}
