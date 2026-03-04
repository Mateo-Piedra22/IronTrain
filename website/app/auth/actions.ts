'use server';

import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import * as schema from '../../src/db/schema';
import { auth } from '../../src/lib/auth/server';

/**
 * Creates a user profile in our database after the user has been 
 * successfully authenticated by Neon Auth.
 */
export async function createProfileAfterSignUp(username: string, displayName: string) {
    try {
        const { data } = await auth.getSession();
        if (!data?.user?.id) return { error: 'No autenticado' };

        const cleanUsername = username.trim().toLowerCase();

        // Safety redundancy check
        const existing = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.username, cleanUsername));
        if (existing.length > 0) return { error: 'El usuario ya existe' };

        // Blacklist check
        const blacklist = ['admin', 'irontrain', 'motiona', 'put', 'mierd', 'fuck', 'shit', 'bitch', 'conch', 'verg', 'pij', 'bolud', 'pelotud', 'trol', 'sex', 'porn'];
        if (blacklist.some(b => cleanUsername.includes(b))) return { error: 'Nombre no permitido' };

        await db.insert(schema.userProfiles).values({
            id: data.user.id,
            username: cleanUsername,
            displayName: displayName.trim(),
            isPublic: 1,
            updatedAt: new Date()
        });

        return { success: true };
    } catch (err: any) {
        console.error('Error creating profile:', err);
        return { error: 'Error al guardar el perfil' };
    }
}
