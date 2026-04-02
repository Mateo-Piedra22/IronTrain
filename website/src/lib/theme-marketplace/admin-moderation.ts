import { db } from '@/db';
import * as schema from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export type ThemeModerationAction = 'approve' | 'reject' | 'suspend' | 'restore';

export type ApplyThemeModerationInput = {
    themePackId: string;
    action: ThemeModerationAction;
    moderationMessage?: string | null;
};

export type ApplyThemeModerationResult = {
    id: string;
    slug: string;
    ownerId: string;
    previousStatus: string;
    status: string;
    moderationMessage: string | null;
    resolvedReports: number;
    updatedAt: Date;
};

const nextStatusByAction: Record<ThemeModerationAction, string> = {
    approve: 'approved',
    reject: 'rejected',
    suspend: 'suspended',
    restore: 'approved',
};

function resolveModerationMessage(input: ApplyThemeModerationInput): string | null {
    const cleaned = (input.moderationMessage ?? '').trim();

    if (input.action === 'approve' || input.action === 'restore') {
        return null;
    }

    if (cleaned.length > 0) {
        return cleaned.slice(0, 280);
    }

    if (input.action === 'reject') {
        return 'Este tema fue rechazado por moderación. Revisa las normas y vuelve a enviar una versión corregida.';
    }

    return 'Este tema fue suspendido por moderación. Contacta al equipo si consideras que se trata de un error.';
}

export async function applyThemeModerationAction(input: ApplyThemeModerationInput): Promise<ApplyThemeModerationResult> {
    const now = new Date();

    return db.transaction(async (tx: any) => {
        const [pack] = await tx
            .select()
            .from(schema.themePacks)
            .where(
                and(
                    eq(schema.themePacks.id, input.themePackId),
                    isNull(schema.themePacks.deletedAt),
                ),
            )
            .limit(1);

        if (!pack) {
            throw new Error('THEME_PACK_NOT_FOUND');
        }

        const nextStatus = nextStatusByAction[input.action];
        const moderationMessage = resolveModerationMessage(input);

        await tx
            .update(schema.themePacks)
            .set({
                status: nextStatus,
                moderationMessage,
                updatedAt: now,
            })
            .where(eq(schema.themePacks.id, input.themePackId));

        const reportStatus = input.action === 'reject' || input.action === 'suspend' ? 'resolved' : 'dismissed';

        const resolvedReports = await tx
            .update(schema.themePackReports)
            .set({
                status: reportStatus,
                updatedAt: now,
            })
            .where(
                and(
                    eq(schema.themePackReports.themePackId, input.themePackId),
                    eq(schema.themePackReports.status, 'open'),
                ),
            )
            .returning({ id: schema.themePackReports.id });

        return {
            id: pack.id,
            slug: pack.slug,
            ownerId: pack.ownerId,
            previousStatus: pack.status,
            status: nextStatus,
            moderationMessage,
            resolvedReports: resolvedReports.length,
            updatedAt: now,
        };
    });
}
