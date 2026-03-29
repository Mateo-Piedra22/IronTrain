'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { syncChangelogToDatabase } from '../../../src/lib/changelog-db-sync';
import { sendSegmentedPush } from '../../../src/lib/firebase-admin';
import { changelogSchema, globalEventSchema } from './schemas';
import { getRedirectPath, requireAdminAction, writeAdminAuditLog } from './shared';

export async function handleChangelogAction(formData: FormData) {
    let redirectPath = '';
    let adminUserId: string | null = null;
    let adminRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    const intent = String(formData.get('intent') || '');
    const targetId = String(formData.get('id') || '').trim() || null;
    try {
        const admin = await requireAdminAction({ action: 'admin.content.changelog', requiredRole: 'editor' });
        const adminId = admin.userId;
        adminUserId = admin.userId;
        adminRole = admin.role;
        const id = String(formData.get('id') || '').trim() || randomUUID();

        if (intent === 'delete') {
            await db.delete(schema.changelogReactions).where(eq(schema.changelogReactions.changelogId, id));
            await db.delete(schema.changelogs).where(eq(schema.changelogs.id, id));
            redirectPath = await getRedirectPath(formData, 'changelog');
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

            const isUnreleased = formData.get('isUnreleased') === 'true';
            const [existing] = await db.select().from(schema.changelogs).where(eq(schema.changelogs.id, id)).limit(1);
            const becomingReleased = isUnreleased === false && (!existing || existing.isUnreleased === true);

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
            redirectPath = await getRedirectPath(formData, 'changelog');
        }
        revalidatePath('/admin');

        await writeAdminAuditLog({
            adminUserId: adminId,
            adminRole: admin.role,
            action: 'admin.content.changelog',
            status: 'success',
            targetType: 'changelog',
            targetId: id,
            metadata: { intent },
        });
    } catch (error: any) {
        console.error('Changelog Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=changelog&error=action_failed';
        if (adminUserId) {
            await writeAdminAuditLog({
                adminUserId,
                adminRole,
                action: 'admin.content.changelog',
                status: 'error',
                message: error?.message || 'unknown_error',
                targetType: 'changelog',
                targetId,
                metadata: { intent },
            });
        }
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleGlobalEventAction(formData: FormData) {
    let redirectPath = '';
    let adminUserId: string | null = null;
    let adminRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    const intent = String(formData.get('intent') || '');
    const targetId = String(formData.get('id') || '').trim() || null;
    try {
        const admin = await requireAdminAction({ action: 'admin.content.global-event', requiredRole: 'editor' });
        const adminId = admin.userId;
        adminUserId = admin.userId;
        adminRole = admin.role;

        const id = String(formData.get('id') || '').trim() || randomUUID();

        if (intent === 'delete') {
            await db.delete(schema.globalEvents).where(eq(schema.globalEvents.id, id));
            revalidatePath('/admin');
            revalidatePath('/feed');
            redirectPath = await getRedirectPath(formData, 'events');
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
                isActive: validated.is_active,
                pushSent: false,
                updatedAt: new Date(),
                createdBy: adminId,
            }).onConflictDoUpdate({
                target: schema.globalEvents.id,
                set: {
                    name: validated.name,
                    multiplier: validated.multiplier,
                    startDate,
                    endDate,
                    isActive: validated.is_active,
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
                await db.update(schema.globalEvents).set({ pushSent: true, updatedAt: new Date() }).where(eq(schema.globalEvents.id, id));
            }

            revalidatePath('/admin');
            revalidatePath('/feed');
            redirectPath = await getRedirectPath(formData, 'events');
        }

        await writeAdminAuditLog({
            adminUserId: admin.userId,
            adminRole: admin.role,
            action: 'admin.content.global-event',
            status: 'success',
            targetType: 'global_event',
            targetId: id,
            metadata: { intent },
        });
    } catch (error: any) {
        console.error('Global Event Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=events&error=action_failed';
        if (adminUserId) {
            await writeAdminAuditLog({
                adminUserId,
                adminRole,
                action: 'admin.content.global-event',
                status: 'error',
                message: error?.message || 'unknown_error',
                targetType: 'global_event',
                targetId,
                metadata: { intent },
            });
        }
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleChangelogPublishAction(formData: FormData) {
    let redirectPath = '';
    let adminUserId: string | null = null;
    let adminRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    const targetId = String(formData.get('id') || '').trim() || null;
    try {
        const admin = await requireAdminAction({ action: 'admin.content.publish-changelog', requiredRole: 'editor' });
        adminUserId = admin.userId;
        adminRole = admin.role;

        const id = String(formData.get('id') || '').trim();
        if (!id) throw new Error('MISSING_CHANGELOG_ID');

        const [changelog] = await db.select().from(schema.changelogs).where(eq(schema.changelogs.id, id)).limit(1);
        if (!changelog) throw new Error('CHANGELOG_NOT_FOUND');

        await db.update(schema.changelogs)
            .set({ isUnreleased: false, updatedAt: new Date() })
            .where(eq(schema.changelogs.id, id));

        await sendSegmentedPush('all', 'Nueva Versión Disponible', `Actualización v${changelog.version} lista. Entra para ver qué hay de nuevo.`, {
            type: 'system',
            actionUrl: 'irontrain://changelog'
        });

        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=changelog&success=published';

        await writeAdminAuditLog({
            adminUserId: admin.userId,
            adminRole: admin.role,
            action: 'admin.content.publish-changelog',
            status: 'success',
            targetType: 'changelog',
            targetId: id,
        });
    } catch (error: any) {
        console.error('Changelog Publish Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=changelog&error=publish_failed';
        if (adminUserId) {
            await writeAdminAuditLog({
                adminUserId,
                adminRole,
                action: 'admin.content.publish-changelog',
                status: 'error',
                message: error?.message || 'unknown_error',
                targetType: 'changelog',
                targetId,
            });
        }
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleGlobalEventDeriveAnnouncementAction(formData: FormData) {
    let redirectPath = '';
    let adminUserId: string | null = null;
    let adminRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    const targetId = String(formData.get('id') || '').trim() || null;
    try {
        const admin = await requireAdminAction({ action: 'admin.content.derive-event-announcement', requiredRole: 'editor' });
        adminUserId = admin.userId;
        adminRole = admin.role;

        const id = String(formData.get('id') || '').trim();
        if (!id) throw new Error('MISSING_EVENT_ID');

        const [event] = await db.select().from(schema.globalEvents).where(eq(schema.globalEvents.id, id)).limit(1);
        if (!event) throw new Error('EVENT_NOT_FOUND');

        await sendSegmentedPush(
            'all',
            '¡Evento Global Activo!',
            `${event.name} · multiplicador x${Number(event.multiplier).toFixed(2)} en todo tu puntaje.`,
            { type: 'system', actionUrl: 'irontrain://social' }
        );

        revalidatePath('/admin');
        redirectPath = `/admin?tab=content&section=broadcast&success=derived`;

        await writeAdminAuditLog({
            adminUserId: admin.userId,
            adminRole: admin.role,
            action: 'admin.content.derive-event-announcement',
            status: 'success',
            targetType: 'global_event',
            targetId: id,
        });
    } catch (error: any) {
        console.error('Global Event Derive Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=events&error=derive_failed';
        if (adminUserId) {
            await writeAdminAuditLog({
                adminUserId,
                adminRole,
                action: 'admin.content.derive-event-announcement',
                status: 'error',
                message: error?.message || 'unknown_error',
                targetType: 'global_event',
                targetId,
            });
        }
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleChangelogSyncAction() {
    let redirectPath = '';
    let adminUserId: string | null = null;
    let adminRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    try {
        const admin = await requireAdminAction({ action: 'admin.content.sync-changelog', requiredRole: 'editor' });
        adminUserId = admin.userId;
        adminRole = admin.role;

        const result = await syncChangelogToDatabase({ force: true, minIntervalMs: 0 });
        revalidatePath('/admin');

        const query = new URLSearchParams();
        query.set('changelogSyncStatus', result.reason);
        query.set('changelogUpserted', String(result.upsertedCount));
        query.set('changelogSource', String(result.sourceCount));
        query.set('changelogSyncedAt', result.syncedAt);
        redirectPath = `/admin?tab=content&section=changelog&${query.toString()}`;

        await writeAdminAuditLog({
            adminUserId: admin.userId,
            adminRole: admin.role,
            action: 'admin.content.sync-changelog',
            status: 'success',
            metadata: {
                reason: result.reason,
                upsertedCount: result.upsertedCount,
                sourceCount: result.sourceCount,
            },
        });
    } catch (error: any) {
        console.error('Changelog Sync Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=content&section=changelog&error=sync_failed';
        if (adminUserId) {
            await writeAdminAuditLog({
                adminUserId,
                adminRole,
                action: 'admin.content.sync-changelog',
                status: 'error',
                message: error?.message || 'unknown_error',
            });
        }
    }
    if (redirectPath) redirect(redirectPath);
}
