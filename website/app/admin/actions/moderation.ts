'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
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
