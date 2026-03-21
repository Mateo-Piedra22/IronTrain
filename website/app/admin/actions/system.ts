'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { getAuthenticatedAdmin, getRedirectPath } from './shared';

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
    } catch (error: any) {
        console.error('Scoring Config Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=social&section=config&error=config_failed';
    }
    if (redirectPath) redirect(redirectPath);
}
