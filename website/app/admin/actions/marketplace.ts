'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { getAuthenticatedAdmin, getRedirectPath } from './shared';

export async function handleMarketplaceEntityAction(formData: FormData) {
    let redirectPath = '';
    try {
        const adminId = await getAuthenticatedAdmin();
        if (!adminId) throw new Error('UNAUTHORIZED_ADMIN_ACCESS');

        const table = formData.get('table') as 'exercises' | 'categories' | 'badges';
        const intent = String(formData.get('intent') || '');
        const id = String(formData.get('id') || '').trim() || randomUUID();

        if (intent === 'delete') {
            if (id) {
                if (table === 'exercises') {
                    await db.delete(schema.exerciseBadges).where(eq(schema.exerciseBadges.exerciseId, id));
                    await db.delete(schema.userExercisePrs).where(eq(schema.userExercisePrs.exerciseId, id));
                    await db.delete(schema.exercises).where(eq(schema.exercises.id, id));
                }
                if (table === 'categories') {
                    const exList = await db.select({ id: schema.exercises.id }).from(schema.exercises).where(eq(schema.exercises.categoryId, id));
                    for (const ex of exList) {
                        await db.delete(schema.exerciseBadges).where(eq(schema.exerciseBadges.exerciseId, ex.id));
                        await db.delete(schema.userExercisePrs).where(eq(schema.userExercisePrs.exerciseId, ex.id));
                        await db.delete(schema.exercises).where(eq(schema.exercises.id, ex.id));
                    }
                    await db.delete(schema.categories).where(eq(schema.categories.id, id));
                }
                if (table === 'badges') {
                    await db.delete(schema.exerciseBadges).where(eq(schema.exerciseBadges.badgeId, id));
                    await db.delete(schema.badges).where(eq(schema.badges.id, id));
                }
            }
            redirectPath = await getRedirectPath(formData, 'marketplace');
        } else if (intent === 'save') {
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

                    await tx.delete(schema.exerciseBadges).where(eq(schema.exerciseBadges.exerciseId, id));
                    for (const bId of badgeIds) {
                        if (!bId) continue;
                        await tx.insert(schema.exerciseBadges).values({
                            id: `eb_${randomUUID()}`,
                            exerciseId: id,
                            badgeId: bId,
                            isSystem: 1,
                            userId: adminId,
                            updatedAt: new Date()
                        });
                    }
                });
            }
            redirectPath = await getRedirectPath(formData, 'marketplace');
        }
        revalidatePath('/admin');
        revalidatePath('/feed');
    } catch (error: any) {
        console.error('Marketplace Entity Action Error:', error);
        revalidatePath('/admin');
        redirectPath = '/admin?tab=marketplace&section=exercises&error=action_failed';
    }
    if (redirectPath) redirect(redirectPath);
}
