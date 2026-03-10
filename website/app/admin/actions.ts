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
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const id = String(formData.get('id') || '').trim();
        const status = String(formData.get('status') || '').trim();

        if (!id || !status) {
            console.error('Validation failed: id or status missing in feedback');
            redirect(getRedirectPath(formData, 'feedback'));
        }

        await db.update(schema.feedback).set({ status, updatedAt: new Date() }).where(eq(schema.feedback.id, id));
        revalidatePath('/admin');
        redirect(getRedirectPath(formData, 'feedback'));
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Feedback Action Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=moderation&section=feedback&error=feedback_failed');
    }
}

export async function handleGlobalEventDeriveAnnouncementAction(formData: FormData) {
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const id = String(formData.get('id') || '').trim();
        if (!id) throw new Error('MISSING_EVENT_ID');

        const [event] = await db.select().from(schema.globalEvents).where(eq(schema.globalEvents.id, id)).limit(1);
        if (!event) throw new Error('EVENT_NOT_FOUND');

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
        redirect(getRedirectPath(formData, 'broadcast'));
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Derive Announcement Action Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=content&section=broadcast&error=derive_failed');
    }
}

export async function handleChangelogPublishAction(formData: FormData) {
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const id = String(formData.get('id') || '').trim();
        if (!id) throw new Error('MISSING_CHANGELOG_ID');

        const [existing] = await db.select().from(schema.changelogs).where(eq(schema.changelogs.id, id)).limit(1);
        if (!existing) throw new Error('CHANGELOG_NOT_FOUND');

        if (existing.isUnreleased !== 1) {
            console.warn('Attempted to publish an already released changelog');
            revalidatePath('/admin');
            return;
        }

        await db.update(schema.changelogs)
            .set({ isUnreleased: 0, updatedAt: new Date() })
            .where(eq(schema.changelogs.id, id));

        try {
            await sendSegmentedPush('all', 'Nueva Versión Disponible', `Actualización v${existing.version} lista. Entra para ver qué hay de nuevo.`, {
                type: 'system',
                actionUrl: 'irontrain://changelog'
            });
        } catch (pushErr) {
            console.error('Push notification failed during publish, but changelog was updated:', pushErr);
        }

        revalidatePath('/admin');
        redirect(getRedirectPath(formData, 'changelog'));
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Changelog Publish Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=content&section=changelog&error=publish_failed');
    }
}

export async function handleRoutineAction(formData: FormData) {
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const id = String(formData.get('id') || '').trim();
        const action = String(formData.get('action') || '').trim();
        const currentModerated = formData.get('currentModerated') === '1';
        const message = String(formData.get('message') || '').trim();

        if (!id) throw new Error('MISSING_ROUTINE_ID');

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
        } else {
            console.error('Invalid routine action:', action);
            return;
        }

        revalidatePath('/admin');
        revalidatePath('/feed');
        redirect(getRedirectPath(formData, 'social'));
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Routine Moderation Action Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=social&section=moderation&error=routine_failed');
    }
}

export async function handleChangelogAction(formData: FormData) {
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const action = String(formData.get('action') || '');
        const id = String(formData.get('id') || '').trim() || crypto.randomUUID();
        const version = String(formData.get('version') || '').trim();
        const itemsRaw = String(formData.get('items') || '').trim();
        const isUnreleased = formData.get('isUnreleased') === 'true' ? 1 : 0;

        if (action === 'delete') {
            if (!id) redirect(getRedirectPath(formData, 'changelog'));
            await db.delete(schema.changelogs).where(eq(schema.changelogs.id, id));
        } else if (action === 'save') {
            if (!version || !itemsRaw) {
                console.error('Validation failed: version or items missing');
                redirect(getRedirectPath(formData, 'changelog'));
            }
            const items = itemsRaw.split('\n').map(i => i.trim()).filter(i => i.length > 0);

            const existingList = await db.select().from(schema.changelogs).where(eq(schema.changelogs.id, id)).limit(1);
            const existing = existingList[0];
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
                try {
                    await sendSegmentedPush('all', 'Nueva Versión Disponible', `Actualización v${version} lista. Entra para ver qué hay de nuevo.`, {
                        type: 'system',
                        actionUrl: 'irontrain://changelog'
                    });
                } catch (pushErr) {
                    console.error('Push notification failed during changelog save:', pushErr);
                }
            }
        } else {
            redirect(getRedirectPath(formData, 'changelog'));
        }

        revalidatePath('/admin');
        redirect(getRedirectPath(formData, 'changelog'));
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Changelog Action Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=content&section=changelog&error=action_failed');
    }
}

export async function handleChangelogSyncAction() {
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const result = await syncChangelogToDatabase({ force: true, minIntervalMs: 0 });
        revalidatePath('/admin');

        const query = new URLSearchParams();
        query.set('changelogSyncStatus', result.reason);
        query.set('changelogUpserted', String(result.upsertedCount));
        query.set('changelogSource', String(result.sourceCount));
        query.set('changelogSyncedAt', result.syncedAt);
        redirect(`/admin?tab=content&section=changelog&${query.toString()}`);
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Changelog Sync Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=content&section=changelog&error=sync_failed');
    }
}

export async function handleNotificationAction(formData: FormData) {
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const action = String(formData.get('action') || '');
        const id = String(formData.get('id') || '').trim() || crypto.randomUUID();
        const title = String(formData.get('title') || '').trim();
        const message = String(formData.get('message') || '').trim();
        const type = String(formData.get('type') || 'toast');
        const displayMode = String(formData.get('displayMode') || 'once');
        const priority = String(formData.get('priority') || 'normal');
        const targetVersion = formData.get('targetVersion') as string;
        const targetPlatform = formData.get('targetPlatform') as string;
        const targetSegment = String(formData.get('targetSegment') || 'all');
        const actionUrl = formData.get('actionUrl') as string;
        const isActive = formData.get('isActive') === 'true' ? 1 : 0;

        const metadata = actionUrl ? JSON.stringify({ actionUrl }) : null;

        if (action === 'delete') {
            await db.delete(schema.adminNotifications).where(eq(schema.adminNotifications.id, id));
        } else if (action === 'save') {
            if (!title || !message) {
                console.error('Validation failed: title or message missing');
                redirect(getRedirectPath(formData, 'broadcast'));
            }
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
                try {
                    await sendSegmentedPush(targetSegment, title, message, {
                        id,
                        type: type || 'toast',
                        actionUrl: actionUrl || ''
                    });
                } catch (pushErr) {
                    console.error('Push notification failed for broadcast, but notification was saved:', pushErr);
                }
            }
        } else {
            redirect(getRedirectPath(formData, 'broadcast'));
        }

        revalidatePath('/admin');
        redirect(getRedirectPath(formData, 'broadcast'));
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Notification Action Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=content&section=broadcast&error=action_failed');
    }
}

export async function handleScoringConfigAction(formData: FormData) {
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
        revalidatePath('/feed');
        redirect(getRedirectPath(formData, 'social'));
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Scoring Config Action Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=social&section=config&error=config_failed');
    }
}

export async function handleGlobalEventAction(formData: FormData) {
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const action = String(formData.get('action') || '');
        const id = String(formData.get('id') || '').trim() || crypto.randomUUID();

        if (action === 'delete') {
            await db.delete(schema.globalEvents).where(eq(schema.globalEvents.id, id));
            revalidatePath('/admin');
            revalidatePath('/feed');
            redirect(getRedirectPath(formData, 'events'));
        }

        const name = String(formData.get('name') || '').trim();
        const multiplier = Number(formData.get('multiplier') || 1);
        const startRaw = String(formData.get('startDate') || '');
        const endRaw = String(formData.get('endDate') || '');
        const isActive = formData.get('isActive') === 'true' ? 1 : 0;
        const sendPush = formData.get('sendPush') === 'true';

        if (!name || !Number.isFinite(multiplier) || multiplier <= 0 || !startRaw || !endRaw) {
            console.error('Validation failed for Global Event');
            revalidatePath('/admin');
            redirect(getRedirectPath(formData, 'events'));
        }

        const startDate = new Date(startRaw);
        const endDate = new Date(endRaw);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
            console.error('Invalid dates for Global Event');
            revalidatePath('/admin');
            redirect(getRedirectPath(formData, 'events'));
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
            try {
                await sendSegmentedPush(
                    'all',
                    '¡Evento Global Activo!',
                    `${name} · multiplicador x${multiplier.toFixed(2)} en todo tu puntaje.`,
                    { type: 'system', actionUrl: 'irontrain://social' }
                );
                await db.update(schema.globalEvents).set({ pushSent: 1, updatedAt: new Date() }).where(eq(schema.globalEvents.id, id));
            } catch (pushErr) {
                console.error('Push notification failed for global event, but database was updated:', pushErr);
            }
        }

        revalidatePath('/admin');
        revalidatePath('/feed');
        redirect(getRedirectPath(formData, 'events'));
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Global Event Action Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=content&section=events&error=action_failed');
    }
}

export async function handleMarketplaceEntityAction(formData: FormData) {
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const table = formData.get('table') as 'exercises' | 'categories' | 'badges';
        const action = String(formData.get('action') || '');
        const id = String(formData.get('id') || '').trim() || crypto.randomUUID();

        if (action === 'delete') {
            if (table === 'exercises') await db.delete(schema.exercises).where(eq(schema.exercises.id, id));
            if (table === 'categories') await db.delete(schema.categories).where(eq(schema.categories.id, id));
            if (table === 'badges') await db.delete(schema.badges).where(eq(schema.badges.id, id));
            revalidatePath('/admin');
            revalidatePath('/feed');
            redirect(getRedirectPath(formData, 'marketplace'));
        }

        if (action === 'save') {
            if (table === 'categories') {
                const name = String(formData.get('name') || '').trim();
                const color = String(formData.get('color') || '').trim();
                const sortOrder = Number(formData.get('sortOrder') || 0);

                if (!name) throw new Error('REQUIRED_FIELD_MISSING: name');

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
                const name = String(formData.get('name') || '').trim();
                const color = String(formData.get('color') || '').trim();
                const icon = String(formData.get('icon') || '').trim();
                const groupName = String(formData.get('groupName') || '').trim();

                if (!name || !color) throw new Error('REQUIRED_FIELDS_MISSING: name/color');

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
                const name = String(formData.get('name') || '').trim();
                const type = String(formData.get('type') || 'weight_reps');
                const categoryId = String(formData.get('categoryId') || '').trim();
                const notes = String(formData.get('notes') || '').trim();
                const defaultIncrement = Number(formData.get('defaultIncrement') || 2.5);
                const badgeIds = formData.getAll('badgeIds') as string[];

                if (!name || !categoryId) throw new Error('REQUIRED_FIELDS_MISSING: name/category');

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
                        if (!bId) continue;
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
        } else {
            redirect(getRedirectPath(formData, 'marketplace'));
        }

        revalidatePath('/admin');
        revalidatePath('/feed');
        redirect(getRedirectPath(formData, 'marketplace'));
    } catch (error: any) {
        if (error.message === 'NEXT_REDIRECT') throw error;
        console.error('Marketplace Entity Action Error:', error);
        revalidatePath('/admin');
        redirect('/admin?tab=marketplace&section=exercises&error=action_failed');
    }
}
