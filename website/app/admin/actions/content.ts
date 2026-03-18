'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { syncChangelogToDatabase } from '../../../src/lib/changelog-db-sync';
import { sendSegmentedPush } from '../../../src/lib/firebase-admin';
import { changelogSchema, globalEventSchema, notificationSchema } from './schemas';
import { getAuthenticatedAdmin, getRedirectPath } from './shared';

export async function handleChangelogAction(formData: FormData) {
    let redirectPath = '';
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const intent = String(formData.get('intent') || '');
        const id = String(formData.get('id') || '').trim() || randomUUID();

        if (intent === 'delete') {
            await db.delete(schema.changelogReactions).where(eq(schema.changelogReactions.changelogId, id));
            await db.delete(schema.changelogs).where(eq(schema.changelogs.id, id));
            redirectPath = getRedirectPath(formData, 'changelog');
        } else if (intent === 'save') {
            const rawItems = String(formData.get('items') || '').trim();
            const items = rawItems.split('\n').map(i => i.trim()).filter(i => i.length > 0);

            const validated = changelogSchema.parse({
                id,
                version: String(formData.get('version') || '').trim(),
                title: String(formData.get('title') || 'Update'), // Added fallback for schema
                content: rawItems,
                type: (formData.get('type') as any) || 'minor',
                is_published: formData.get('isUnreleased') !== 'true',
                items: items
            });

            const isUnreleased = formData.get('isUnreleased') === 'true' ? 1 : 0;
            const [existing] = await db.select().from(schema.changelogs).where(eq(schema.changelogs.id, id)).limit(1);
            const becomingReleased = isUnreleased === 0 && (!existing || existing.isUnreleased === 1);

            await db.insert(schema.changelogs)
                .values({
                    id,
                    version: validated.version,
                    items: items,
                    isUnreleased,
                    date: new Date(),
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: schema.changelogs.id,
                    set: {
                        version: validated.version,
                        items: items,
                        isUnreleased,
                        updatedAt: new Date(),
                    }
                });

            if (becomingReleased) {
                await sendSegmentedPush('all', 'Nueva Versión Disponible', `Actualización v${validated.version} lista. Entra para ver qué hay de nuevo.`, {
                    type: 'system',
                    actionUrl: 'irontrain://changelog'
                });
            }
            redirectPath = getRedirectPath(formData, 'changelog');
        }
        revalidatePath('/admin');
    } catch (error: any) {
        console.error('Changelog Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=changelog&error=action_failed';
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleNotificationAction(formData: FormData) {
    let redirectPath = '';
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const intent = String(formData.get('intent') || '');
        const id = String(formData.get('id') || '').trim() || randomUUID();

        if (intent === 'delete') {
            await db.delete(schema.notificationLogs).where(eq(schema.notificationLogs.notificationId, id));
            await db.delete(schema.notificationReactions).where(eq(schema.notificationReactions.notificationId, id));
            await db.delete(schema.adminNotifications).where(eq(schema.adminNotifications.id, id));
            redirectPath = getRedirectPath(formData, 'broadcast');
        } else if (intent === 'save') {
            const actionUrl = formData.get('actionUrl') as string;
            const validated = notificationSchema.parse({
                id,
                title: String(formData.get('title') || '').trim(),
                body: String(formData.get('message') || '').trim(),
                type: (formData.get('type') as any) || 'broadcast',
                priority: (formData.get('priority') as any) || 'medium',
                is_active: formData.get('isActive') === 'true'
            });

            const displayMode = String(formData.get('displayMode') || 'once');
            const targetVersion = formData.get('targetVersion') as string;
            const targetPlatform = formData.get('targetPlatform') as string;
            const targetSegment = String(formData.get('targetSegment') || 'all');
            const metadata = actionUrl ? { actionUrl } : null;

            await db.insert(schema.adminNotifications)
                .values({
                    id,
                    title: validated.title,
                    message: validated.body,
                    type: validated.type,
                    priority: validated.priority,
                    displayMode,
                    targetVersion: targetVersion || null,
                    targetPlatform: targetPlatform || 'all',
                    targetSegment,
                    metadata,
                    isActive: validated.is_active ? 1 : 0,
                    updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                    target: schema.adminNotifications.id,
                    set: {
                        title: validated.title,
                        message: validated.body,
                        type: validated.type,
                        priority: validated.priority,
                        displayMode,
                        targetVersion: targetVersion || null,
                        targetPlatform: targetPlatform || 'all',
                        targetSegment,
                        metadata,
                        isActive: validated.is_active ? 1 : 0,
                        updatedAt: new Date(),
                    }
                });

            if (validated.is_active) {
                await sendSegmentedPush(targetSegment, validated.title, validated.body, {
                    id,
                    type: validated.type,
                    actionUrl: actionUrl || ''
                });
            }
            redirectPath = getRedirectPath(formData, 'broadcast');
        }
        revalidatePath('/admin');
    } catch (error: any) {
        console.error('Notification Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=broadcast&error=action_failed';
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleGlobalEventAction(formData: FormData) {
    let redirectPath = '';
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const intent = String(formData.get('intent') || '');
        const id = String(formData.get('id') || '').trim() || randomUUID();

        if (intent === 'delete') {
            await db.delete(schema.globalEvents).where(eq(schema.globalEvents.id, id));
            revalidatePath('/admin');
            revalidatePath('/feed');
            redirectPath = getRedirectPath(formData, 'events');
        } else if (intent === 'save') {
            const validated = globalEventSchema.parse({
                id,
                name: String(formData.get('name') || '').trim(),
                multiplier: Number(formData.get('multiplier') || 1),
                starts_at: String(formData.get('startDate') || ''),
                ends_at: String(formData.get('endDate') || ''),
                is_active: formData.get('isActive') === 'true'
            });

            const sendPush = formData.get('sendPush') === 'true';
            const startDate = new Date(validated.starts_at);
            const endDate = new Date(validated.ends_at);

            if (endDate <= startDate) throw new Error('INVALID_DATE_RANGE');

            await db.insert(schema.globalEvents).values({
                id,
                name: validated.name,
                multiplier: validated.multiplier,
                startDate,
                endDate,
                isActive: validated.is_active ? 1 : 0,
                pushSent: 0,
                updatedAt: new Date(),
                createdBy: adminId,
            }).onConflictDoUpdate({
                target: schema.globalEvents.id,
                set: {
                    name: validated.name,
                    multiplier: validated.multiplier,
                    startDate,
                    endDate,
                    isActive: validated.is_active ? 1 : 0,
                    updatedAt: new Date(),
                }
            });

            if (validated.is_active && sendPush) {
                await sendSegmentedPush(
                    'all',
                    '¡Evento Global Activo!',
                    `${validated.name} · multiplicador x${validated.multiplier.toFixed(2)} en todo tu puntaje.`,
                    { type: 'system', actionUrl: 'irontrain://social' }
                );
                await db.update(schema.globalEvents).set({ pushSent: 1, updatedAt: new Date() }).where(eq(schema.globalEvents.id, id));
            }

            revalidatePath('/admin');
            revalidatePath('/feed');
            redirectPath = getRedirectPath(formData, 'events');
        }
    } catch (error: any) {
        console.error('Global Event Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=events&error=action_failed';
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleChangelogPublishAction(formData: FormData) {
    let redirectPath = '';
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const id = String(formData.get('id') || '').trim();
        if (!id) throw new Error('MISSING_CHANGELOG_ID');

        const [changelog] = await db.select().from(schema.changelogs).where(eq(schema.changelogs.id, id)).limit(1);
        if (!changelog) throw new Error('CHANGELOG_NOT_FOUND');

        await db.update(schema.changelogs)
            .set({ isUnreleased: 0, updatedAt: new Date() })
            .where(eq(schema.changelogs.id, id));

        await sendSegmentedPush('all', 'Nueva Versión Disponible', `Actualización v${changelog.version} lista. Entra para ver qué hay de nuevo.`, {
            type: 'system',
            actionUrl: 'irontrain://changelog'
        });

        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=changelog&success=published';
    } catch (error: any) {
        console.error('Changelog Publish Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=changelog&error=publish_failed';
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleGlobalEventDeriveAnnouncementAction(formData: FormData) {
    let redirectPath = '';
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const id = String(formData.get('id') || '').trim();
        if (!id) throw new Error('MISSING_EVENT_ID');

        const [event] = await db.select().from(schema.globalEvents).where(eq(schema.globalEvents.id, id)).limit(1);
        if (!event) throw new Error('EVENT_NOT_FOUND');

        const notifId = `broadcast_${randomUUID()}`;
        await db.insert(schema.adminNotifications).values({
            id: notifId,
            title: '¡Evento Global Activo!',
            message: `${event.name} · multiplicador x${Number(event.multiplier).toFixed(2)} en todo tu puntaje.`,
            type: 'toast',
            priority: 'high',
            displayMode: 'once',
            targetPlatform: 'all',
            targetSegment: 'all',
            metadata: { actionUrl: 'irontrain://social' },
            isActive: 1,
            updatedAt: new Date(),
        });

        await sendSegmentedPush(
            'all',
            '¡Evento Global Activo!',
            `${event.name} · multiplicador x${Number(event.multiplier).toFixed(2)} en todo tu puntaje.`,
            { type: 'system', actionUrl: 'irontrain://social' }
        );

        revalidatePath('/admin');
        redirectPath = `/admin?tab=content&section=broadcast&editNotifId=${notifId}&success=derived`;
    } catch (error: any) {
        console.error('Global Event Derive Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=events&error=derive_failed';
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleChangelogSyncAction() {
    let redirectPath = '';
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
        redirectPath = `/admin?tab=content&section=changelog&${query.toString()}`;
    } catch (error: any) {
        console.error('Changelog Sync Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=changelog&error=sync_failed';
    }
    if (redirectPath) redirect(redirectPath);
}
