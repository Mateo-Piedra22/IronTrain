'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { systemStatusSchema } from './schemas';
import { getAuthenticatedAdmin, getRedirectPath } from './shared';

export async function handleUpdateSystemStatus(formData: FormData) {
    let redirectPath = '';
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const validated = systemStatusSchema.parse({
            maintenance_mode: formData.get('maintenanceMode') === '1',
            offline_only: formData.get('offlineOnlyMode') === '1',
            motd: String(formData.get('message') || '').trim()
        });

        await db.insert(schema.systemStatus).values({
            id: 'global',
            maintenanceMode: validated.maintenance_mode ? 1 : 0,
            offlineOnlyMode: validated.offline_only ? 1 : 0,
            message: validated.motd,
            updatedAt: new Date(),
            updatedBy: adminId,
        }).onConflictDoUpdate({
            target: schema.systemStatus.id,
            set: {
                maintenanceMode: validated.maintenance_mode ? 1 : 0,
                offlineOnlyMode: validated.offline_only ? 1 : 0,
                message: validated.motd,
                updatedAt: new Date(),
                updatedBy: adminId,
            }
        });

        revalidatePath('/admin');
        revalidatePath('/');
        redirectPath = await getRedirectPath(formData, 'system');
    } catch (error: any) {
        console.error('System Status Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=system&section=status&error=status_update_failed';
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleScoringConfigAction(formData: FormData) {
    let redirectPath = '';
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

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
            weatherBonusEnabled: formData.get('weatherBonusEnabled') === 'true' ? 1 : 0,
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
    } catch (error: any) {
        console.error('Scoring Config Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=social&section=config&error=config_failed';
    }
    if (redirectPath) redirect(redirectPath);
}
