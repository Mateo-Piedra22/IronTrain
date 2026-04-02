'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { applyThemeModerationAction, setThemePackSystemFlag, ThemeModerationAction } from '../../../src/lib/theme-marketplace/admin-moderation';
import { getRedirectPath, requireAdminAction, writeAdminAuditLog } from './shared';

export async function handleRoutineAction(formData: FormData) {
    let redirectPath = '';
    let adminUserId: string | null = null;
    let adminRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    const id = String(formData.get('id') || '').trim() || null;
    const intent = String(formData.get('intent') || '').trim();
    try {
        const admin = await requireAdminAction({ action: 'admin.moderation.routine', requiredRole: 'moderator' });
        adminUserId = admin.userId;
        adminRole = admin.role;

        const currentModerated = formData.get('currentModerated') === '1';
        const message = String(formData.get('message') || '').trim();

        if (!id) throw new Error('MISSING_ROUTINE_ID');

        if (intent === 'toggle-moderation') {
            const nextModerated = !currentModerated;
            await db.update(schema.routines)
                .set({
                    isModerated: nextModerated,
                    moderationMessage: nextModerated ? (message || 'Contenido ocultado por incumplir las normas de la comunidad.') : null,
                    ...(nextModerated ? { isPublic: false } : {}),
                    updatedAt: new Date()
                })
                .where(eq(schema.routines.id, id));
        } else if (intent === 'purge') {
            await db.update(schema.routines)
                .set({
                    deletedAt: new Date(),
                    isPublic: false,
                    isModerated: true,
                    moderationMessage: 'Esta rutina ha sido eliminada permanentemente por un administrador.',
                    updatedAt: new Date()
                })
                .where(eq(schema.routines.id, id));
        }

        revalidatePath('/admin');
        revalidatePath('/feed');
        redirectPath = await getRedirectPath(formData, 'social');

        await writeAdminAuditLog({
            adminUserId: admin.userId,
            adminRole: admin.role,
            action: 'admin.moderation.routine',
            status: 'success',
            targetType: 'routine',
            targetId: id,
            metadata: { intent },
        });
    } catch (error: any) {
        console.error('Routine Moderation Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=social&section=moderation&error=routine_failed';
        if (adminUserId) {
            await writeAdminAuditLog({
                adminUserId,
                adminRole,
                action: 'admin.moderation.routine',
                status: 'error',
                message: error?.message || 'unknown_error',
                targetType: 'routine',
                targetId: id,
                metadata: { intent },
            });
        }
    }
    if (redirectPath) redirect(redirectPath);
}

export async function handleThemeModerationAction(formData: FormData) {
    let redirectPath = '';
    let adminUserId: string | null = null;
    let adminRole: 'viewer' | 'editor' | 'moderator' | 'superadmin' = 'viewer';
    const themePackId = String(formData.get('themePackId') || '').trim() || null;
    const action = String(formData.get('intent') || '').trim();

    try {
        const admin = await requireAdminAction({ action: 'admin.moderation.theme-pack', requiredRole: 'moderator' });
        adminUserId = admin.userId;
        adminRole = admin.role;

        if (!themePackId) {
            throw new Error('MISSING_THEME_PACK_ID');
        }

        if (!['approve', 'reject', 'suspend', 'restore', 'mark-system', 'unmark-system'].includes(action)) {
            throw new Error('INVALID_THEME_MODERATION_ACTION');
        }

        const message = String(formData.get('message') || '').trim();

        let result: any;
        if (action === 'mark-system' || action === 'unmark-system') {
            result = await setThemePackSystemFlag({
                themePackId,
                isSystem: action === 'mark-system',
            });
        } else {
            result = await applyThemeModerationAction({
                themePackId,
                action: action as ThemeModerationAction,
                moderationMessage: message,
            });
        }

        revalidatePath('/admin');
        revalidatePath('/feed');

        redirectPath = await getRedirectPath(formData, 'themes-moderation');

        await writeAdminAuditLog({
            adminUserId: admin.userId,
            adminRole: admin.role,
            action: `admin.moderation.theme-pack.${action}`,
            status: 'success',
            targetType: 'theme_pack',
            targetId: themePackId,
            metadata: {
                previousStatus: result.previousStatus,
                nextStatus: result.status,
                resolvedReports: result.resolvedReports,
                isSystem: result.isSystem,
            },
        });
    } catch (error: any) {
        console.error('Theme Moderation Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=themes-moderation&error=theme_moderation_failed';

        if (adminUserId) {
            await writeAdminAuditLog({
                adminUserId,
                adminRole,
                action: `admin.moderation.theme-pack.${action || 'unknown'}`,
                status: 'error',
                message: error?.message || 'unknown_error',
                targetType: 'theme_pack',
                targetId: themePackId,
            });
        }
    }

    if (redirectPath) redirect(redirectPath);
}
