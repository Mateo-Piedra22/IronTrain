'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { getAuthenticatedAdmin, getRedirectPath } from './shared';

export async function handleRoutineAction(formData: FormData) {
    let redirectPath = '';
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const id = String(formData.get('id') || '').trim();
        const intent = String(formData.get('intent') || '').trim();
        const currentModerated = formData.get('currentModerated') === '1';
        const message = String(formData.get('message') || '').trim();

        if (!id) throw new Error('MISSING_ROUTINE_ID');

        if (intent === 'toggle-moderation') {
            const newStatus = currentModerated ? 0 : 1;
            await db.update(schema.routines)
                .set({
                    isModerated: newStatus,
                    moderationMessage: newStatus === 1 ? (message || 'Contenido ocultado por incumplir las normas de la comunidad.') : null,
                    ...(newStatus === 1 ? { isPublic: 0 } : {}),
                    updatedAt: new Date()
                })
                .where(eq(schema.routines.id, id));
        } else if (intent === 'purge') {
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
        revalidatePath('/feed');
        redirectPath = await getRedirectPath(formData, 'social');
    } catch (error: any) {
        console.error('Routine Moderation Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=social&section=moderation&error=routine_failed';
    }
    if (redirectPath) redirect(redirectPath);
}
