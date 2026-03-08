'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../src/db';
import * as schema from '../../src/db/schema';
import { auth } from '../../src/lib/auth/server';
import { buildDerivedGlobalEventAnnouncement } from '../../src/lib/broadcast-admin';
import { syncChangelogToDatabase } from '../../src/lib/changelog-db-sync';
import { sendSegmentedPush } from '../../src/lib/firebase-admin';

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);

export async function getAuthenticatedAdmin(): Promise<string | null> {
    try {
        const { data: session } = await auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return null;
        if (ADMIN_USER_IDS.length === 0) return null;
        if (ADMIN_USER_IDS.includes(userId)) return userId;
        return null;
    } catch {
        return null;
    }
}

function getRedirectPath(formData: FormData, defaultSection?: string) {
    const tab = (formData.get('origin_tab') as string) || 'content';
    const section = (formData.get('origin_section') as string) || defaultSection || '';
    let path = `/admin?tab=${tab}`;
    if (section) path += `&section=${section}`;
    return path;
}

export async function markFeedbackStatus(formData: FormData) {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');
    const id = formData.get('id') as string;
    const status = formData.get('status') as string;
    if (!id || !status) return;
    await db.update(schema.feedback).set({ status, updatedAt: new Date() }).where(eq(schema.feedback.id, id));
    revalidatePath('/admin');
}

export async function handleGlobalEventDeriveAnnouncementAction(formData: FormData) {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const id = String(formData.get('id') || '').trim();
    if (!id) {
        revalidatePath('/admin');
        return;
    }

    const [event] = await db.select().from(schema.globalEvents).where(eq(schema.globalEvents.id, id)).limit(1);
    if (!event) {
        revalidatePath('/admin');
        return;
    }

    const derived = buildDerivedGlobalEventAnnouncement(event);

    await db.insert(schema.adminNotifications)
        .values({
            id: derived.id,
            title: derived.title,
            message: derived.message,
            type: derived.type,
            priority: derived.priority,
            displayMode: derived.displayMode,
            targetVersion: derived.targetVersion,
            targetPlatform: derived.targetPlatform,
            targetSegment: derived.targetSegment,
            metadata: derived.metadata,
            isActive: derived.isActive,
            updatedAt: new Date(),
        })
        .onConflictDoUpdate({
            target: schema.adminNotifications.id,
            set: {
                title: derived.title,
                message: derived.message,
                type: derived.type,
                priority: derived.priority,
                displayMode: derived.displayMode,
                targetVersion: derived.targetVersion,
                targetPlatform: derived.targetPlatform,
                targetSegment: derived.targetSegment,
                metadata: derived.metadata,
                isActive: derived.isActive,
                updatedAt: new Date(),
            }
        });

    revalidatePath('/admin');
}

export async function handleChangelogPublishAction(formData: FormData) {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const id = String(formData.get('id') || '').trim();
    if (!id) {
        revalidatePath('/admin');
        return;
    }

    const [existing] = await db.select().from(schema.changelogs).where(eq(schema.changelogs.id, id)).limit(1);
    if (!existing) {
        revalidatePath('/admin');
        return;
    }

    if (existing.isUnreleased !== 1) {
        revalidatePath('/admin');
        return;
    }

    await db.update(schema.changelogs)
        .set({ isUnreleased: 0, updatedAt: new Date() })
        .where(eq(schema.changelogs.id, id));

    await sendSegmentedPush('all', 'Nueva Versión Disponible', `Actualización v${existing.version} lista. Entra para ver qué hay de nuevo.`, {
        type: 'system',
        actionUrl: 'irontrain://changelog'
    });

    revalidatePath('/admin');
}

export async function handleRoutineAction(formData: FormData) {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const id = formData.get('id') as string;
    const action = formData.get('action') as string;
    const currentModerated = formData.get('currentModerated') === '1';
    const message = formData.get('message') as string;

    if (action === 'toggle-moderation') {
        const newStatus = currentModerated ? 0 : 1;
        await db.update(schema.routines)
            .set({
                isModerated: newStatus,
                moderationMessage: newStatus === 1 ? (message || 'Contenido ocultado por incumplir las normas de la comunidad.') : null,
                ...(newStatus === 1 ? { isPublic: 0 } : {}),
                updatedAt: new Date()
            })
            .where(eq(schema.routines.id, id));
    } else if (action === 'purge') {
        await db.update(schema.routines)
            .set({
                deletedAt: new Date(),
                isPublic: 0,
                isModerated: 1,
                moderationMessage: 'Esta rutina ha sido eliminada permanentemente por un administrador.',
                updatedAt: new Date()
            })
            .where(eq(schema.routines.id, id));
    }
    revalidatePath('/admin');
}

export async function handleChangelogAction(formData: FormData) {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const id = formData.get('id') as string || crypto.randomUUID();
    const action = formData.get('action') as string;
    const version = formData.get('version') as string;
    const itemsRaw = formData.get('items') as string;
    const isUnreleased = formData.get('isUnreleased') === 'true' ? 1 : 0;

    if (action === 'save') {
        if (!version || !itemsRaw) return;
        const items = itemsRaw.split('\n').filter(i => i.trim().length > 0);

        const existing = await db.select().from(schema.changelogs).where(eq(schema.changelogs.id, id)).then(res => res[0]);
        const becomingReleased = isUnreleased === 0 && (!existing || existing.isUnreleased === 1);

        await db.insert(schema.changelogs)
            .values({
                id,
                version,
                items: JSON.stringify(items),
                isUnreleased,
                date: new Date(),
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: schema.changelogs.id,
                set: {
                    version,
                    items: JSON.stringify(items),
                    isUnreleased,
                    updatedAt: new Date(),
                }
            });

        if (becomingReleased) {
            await sendSegmentedPush('all', 'Nueva Versión Disponible', `Actualización v${version} lista. Entra para ver qué hay de nuevo.`, {
                type: 'system',
                actionUrl: 'irontrain://changelog'
            });
        }
    } else if (action === 'delete') {
        await db.delete(schema.changelogs).where(eq(schema.changelogs.id, id));
    }
    revalidatePath('/admin');
    redirect(getRedirectPath(formData, 'changelog'));
}

export async function handleChangelogSyncAction() {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const result = await syncChangelogToDatabase({ force: true, minIntervalMs: 0 });
    revalidatePath('/admin');

    const query = new URLSearchParams();
    query.set('changelogSyncStatus', result.reason);
    query.set('changelogUpserted', String(result.upsertedCount));
    query.set('changelogSource', String(result.sourceCount));
    query.set('changelogSyncedAt', result.syncedAt);
    redirect(`/admin?${query.toString()}`);
}

export async function handleNotificationAction(formData: FormData) {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const id = formData.get('id') as string || crypto.randomUUID();
    const action = formData.get('action') as string;
    const title = formData.get('title') as string;
    const message = formData.get('message') as string;
    const type = formData.get('type') as string;
    const displayMode = formData.get('displayMode') as string;
    const priority = formData.get('priority') as string || 'normal';
    const targetVersion = formData.get('targetVersion') as string;
    const targetPlatform = formData.get('targetPlatform') as string;
    const targetSegment = formData.get('targetSegment') as string || 'all';
    const actionUrl = formData.get('actionUrl') as string;
    const isActive = formData.get('isActive') === 'true' ? 1 : 0;

    const metadata = actionUrl ? JSON.stringify({ actionUrl }) : null;

    if (action === 'save') {
        if (!title || !message) return;
        await db.insert(schema.adminNotifications)
            .values({
                id,
                title,
                message,
                type: type || 'toast',
                priority,
                displayMode: displayMode || 'once',
                targetVersion: targetVersion || null,
                targetPlatform: targetPlatform || 'all',
                targetSegment: targetSegment,
                metadata,
                isActive,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: schema.adminNotifications.id,
                set: {
                    title,
                    message,
                    type: type || 'toast',
                    priority,
                    displayMode: displayMode || 'once',
                    targetVersion: targetVersion || null,
                    targetPlatform: targetPlatform || 'all',
                    targetSegment: targetSegment,
                    metadata,
                    isActive,
                    updatedAt: new Date(),
                }
            });

        if (isActive) {
            sendSegmentedPush(targetSegment, title, message, {
                id,
                type: type || 'toast',
                actionUrl: actionUrl || ''
            });
        }
    } else if (action === 'delete') {
        await db.delete(schema.adminNotifications).where(eq(schema.adminNotifications.id, id));
    }
    revalidatePath('/admin');
    redirect(getRedirectPath(formData, 'broadcast'));
}

export async function handleScoringConfigAction(formData: FormData) {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

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

    await db.insert(schema.socialScoringConfig).values({
        id: 'default',
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
        updatedAt: new Date(),
        updatedBy: adminId,
    }).onConflictDoUpdate({
        target: schema.socialScoringConfig.id,
        set: {
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
            updatedAt: new Date(),
            updatedBy: adminId,
        }
    });

    revalidatePath('/admin');
}

export async function handleGlobalEventAction(formData: FormData) {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const action = String(formData.get('action') || '');
    const id = String(formData.get('id') || crypto.randomUUID());

    if (action === 'delete') {
        await db.delete(schema.globalEvents).where(eq(schema.globalEvents.id, id));
        revalidatePath('/admin');
        redirect(getRedirectPath(formData, 'events'));
    }

    const name = String(formData.get('name') || '').trim();
    const multiplier = Number(formData.get('multiplier') || 1);
    const startRaw = String(formData.get('startDate') || '');
    const endRaw = String(formData.get('endDate') || '');
    const isActive = formData.get('isActive') === 'true' ? 1 : 0;
    const sendPush = formData.get('sendPush') === 'true';

    if (!name || !Number.isFinite(multiplier) || multiplier <= 0 || !startRaw || !endRaw) {
        revalidatePath('/admin');
        return;
    }

    const startDate = new Date(startRaw);
    const endDate = new Date(endRaw);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        revalidatePath('/admin');
        return;
    }

    await db.insert(schema.globalEvents).values({
        id,
        name,
        multiplier,
        startDate,
        endDate,
        isActive,
        pushSent: 0,
        updatedAt: new Date(),
        createdBy: adminId,
    }).onConflictDoUpdate({
        target: schema.globalEvents.id,
        set: {
            name,
            multiplier,
            startDate,
            endDate,
            isActive,
            updatedAt: new Date(),
        }
    });

    if (isActive === 1 && sendPush) {
        await sendSegmentedPush(
            'all',
            '¡Evento Global Activo!',
            `${name} · multiplicador x${multiplier.toFixed(2)} en todo tu puntaje.`,
            { type: 'system', actionUrl: 'irontrain://social' }
        );
        await db.update(schema.globalEvents).set({ pushSent: 1, updatedAt: new Date() }).where(eq(schema.globalEvents.id, id));
    }

    revalidatePath('/admin');
}

export async function handleMarketplaceEntityAction(formData: FormData) {
    const adminId = await getAuthenticatedAdmin();
    if (!adminId) throw new Error('Unauthorized');

    const table = formData.get('table') as 'exercises' | 'categories' | 'badges';
    const action = formData.get('action') as string;
    const id = formData.get('id') as string || crypto.randomUUID();

    if (action === 'delete') {
        if (table === 'exercises') await db.delete(schema.exercises).where(eq(schema.exercises.id, id));
        if (table === 'categories') await db.delete(schema.categories).where(eq(schema.categories.id, id));
        if (table === 'badges') await db.delete(schema.badges).where(eq(schema.badges.id, id));
        revalidatePath('/admin');
        redirect(getRedirectPath(formData, 'marketplace'));
    }

    if (action === 'save') {
        if (table === 'categories') {
            const name = formData.get('name') as string;
            const color = formData.get('color') as string;
            const sortOrder = Number(formData.get('sortOrder') || 0);

            await db.insert(schema.categories).values({
                id,
                name,
                color,
                sortOrder,
                isSystem: 1,
                userId: adminId,
                updatedAt: new Date()
            }).onConflictDoUpdate({
                target: schema.categories.id,
                set: { name, color, sortOrder, isSystem: 1, updatedAt: new Date() }
            });
        } else if (table === 'badges') {
            const name = formData.get('name') as string;
            const color = formData.get('color') as string;
            const icon = formData.get('icon') as string;
            const groupName = formData.get('groupName') as string;

            await db.insert(schema.badges).values({
                id,
                name,
                color,
                icon,
                groupName,
                isSystem: 1,
                userId: adminId,
                updatedAt: new Date()
            }).onConflictDoUpdate({
                target: schema.badges.id,
                set: { name, color, icon, groupName, isSystem: 1, updatedAt: new Date() }
            });
        } else if (table === 'exercises') {
            const name = formData.get('name') as string;
            const type = formData.get('type') as string;
            const categoryId = formData.get('categoryId') as string;
            const notes = formData.get('notes') as string;
            const defaultIncrement = Number(formData.get('defaultIncrement') || 2.5);
            const badgeIds = formData.getAll('badgeIds') as string[];

            await db.transaction(async (tx) => {
                await tx.insert(schema.exercises).values({
                    id,
                    name,
                    type,
                    categoryId,
                    notes,
                    defaultIncrement,
                    isSystem: 1,
                    userId: adminId,
                    updatedAt: new Date()
                }).onConflictDoUpdate({
                    target: schema.exercises.id,
                    set: { name, type, categoryId, notes, defaultIncrement, isSystem: 1, updatedAt: new Date() }
                });

                // Update Badges
                await tx.delete(schema.exerciseBadges).where(eq(schema.exerciseBadges.exerciseId, id));
                for (const bId of badgeIds) {
                    await tx.insert(schema.exerciseBadges).values({
                        id: `eb_${crypto.randomUUID()}`,
                        exerciseId: id,
                        badgeId: bId,
                        isSystem: 1,
                        userId: adminId,
                        updatedAt: new Date()
                    });
                }
            });
        }
    }

    revalidatePath('/admin');
    revalidatePath('/feed');
    redirect(getRedirectPath(formData, 'marketplace'));
}
