import crypto from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { logger } from './logger';

type CheckoutExercisesResult = {
    adopted: number;
    skipped: number;
    errors: string[];
};

/**
 * Enterprise-grade Marketplace Resolver
 * Handles transactional adoption of exercises from official catalog to user library
 * Zero-Trust: Protects existing user customizations while aligning with the official catalog.
 */
export class MarketplaceResolver {
    private static createCheckoutResult(): CheckoutExercisesResult {
        return {
            adopted: 0,
            skipped: 0,
            errors: [],
        };
    }

    /**
     * Adopts a list of exercises into a user's local library.
     * Implements 3-tier resolution logic for deduplication and deep-sync.
     */
    static async checkoutExercises(userId: string, masterIds: string[]): Promise<CheckoutExercisesResult> {
        if (masterIds.length === 0) {
            return this.createCheckoutResult();
        }

        return await db.transaction(async (tx: any) => {
            const results = this.createCheckoutResult();

            // 1. Fetch official master exercises
            const officialExercises = await tx.select()
                .from(schema.exercises)
                .where(
                    and(
                        eq(schema.exercises.isSystem, 1),
                        inArray(schema.exercises.id, masterIds)
                    )
                );

            if (officialExercises.length === 0) {
                return results;
            }

            // 2. Pre-fetch user state to minimize roundtrips
            const userCategories = await tx.select().from(schema.categories).where(eq(schema.categories.userId, userId));
            const userBadges = await tx.select().from(schema.badges).where(eq(schema.badges.userId, userId));
            const userExercises = await tx.select().from(schema.exercises).where(eq(schema.exercises.userId, userId));

            for (const master of officialExercises) {
                try {
                    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

                    // Tier 1: Hard Link Check (Already has it via originId)
                    const existing = userExercises.find((e: any) => e.originId === master.id);
                    if (existing) {
                        results.skipped++;
                        continue;
                    }

                    // Tier 2: Semantic name match (Deduplication)
                    const masterNameNorm = norm(master.name);
                    const nameMatch = userExercises.find((e: any) => norm(e.name) === masterNameNorm);

                    let targetExId: string;

                    if (nameMatch) {
                        // Officialize by linking originId but PRESERVE user metadata (e.g. custom names, notes)
                        targetExId = nameMatch.id;
                        await tx.update(schema.exercises)
                            .set({
                                originId: master.id,
                                updatedAt: new Date()
                                // Note: We do NOT overwrite 'type' or 'defaultIncrement' if user already has it customized
                            })
                            .where(eq(schema.exercises.id, targetExId));

                        // We skip deep-sync of badges for EXISTING exercises to respect user's manual muscle assignments
                        // (Unless specifically requested by a 'reset to official' tool in the future)
                    } else {
                        // Tier 3: Clone/Adopt as New
                        targetExId = `ex_${crypto.randomUUID()}`;

                        // Resolve Category
                        const masterCategory = (await tx.select()
                            .from(schema.categories)
                            .where(eq(schema.categories.id, master.categoryId))
                            .limit(1))[0];

                        let localCategoryId = '';
                        if (masterCategory) {
                            const matchedCat = await this.resolveCategory(masterCategory, userCategories, userId, tx);
                            localCategoryId = matchedCat.id;
                        } else {
                            localCategoryId = 'uncategorized';
                        }

                        await tx.insert(schema.exercises).values({
                            id: targetExId,
                            name: master.name,
                            type: master.type,
                            userId: userId,
                            categoryId: localCategoryId,
                            notes: master.notes,
                            defaultIncrement: master.defaultIncrement,
                            isSystem: 0,
                            originId: master.id,
                            updatedAt: new Date(),
                        });

                        // Link Badges (Muscle Groups) for NEW adoptions
                        const masterBadgesMap = await tx.select()
                            .from(schema.exerciseBadges)
                            .where(eq(schema.exerciseBadges.exerciseId, master.id));

                        for (const mb of masterBadgesMap) {
                            const b = (await tx.select().from(schema.badges).where(eq(schema.badges.id, mb.badgeId)).limit(1))[0];
                            if (b) {
                                const resolvedBadge = await this.resolveBadge(b, userBadges, userId, tx);
                                if (resolvedBadge) {
                                    await tx.insert(schema.exerciseBadges).values({
                                        id: `eb_${crypto.randomUUID()}`,
                                        exerciseId: targetExId,
                                        badgeId: resolvedBadge.id,
                                        userId: userId,
                                        isSystem: 0,
                                        updatedAt: new Date()
                                    });
                                }
                            }
                        }
                    }

                    results.adopted++;
                } catch (err: any) {
                    logger.captureException(err, {
                        scope: 'MarketplaceResolver.checkoutExercises',
                        masterId: master.id,
                        masterName: master.name,
                        userId
                    });
                    results.errors.push(master.name);
                }
            }

            return results;
        });
    }

    private static async resolveCategory(master: any, userCats: any[], userId: string, tx: any) {
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const masterNorm = norm(master.name);

        // Link existing or Semantic match
        let match = userCats.find((c: any) => c.originId === master.id || norm(c.name) === masterNorm);

        if (match) {
            // Officialize: Align originId but DO NOT touch user's custom color/name
            if (match.originId !== master.id) {
                await tx.update(schema.categories)
                    .set({ originId: master.id, updatedAt: new Date() })
                    .where(eq(schema.categories.id, match.id));
                match.originId = master.id;
            }
            return match;
        }

        // Clone/Adopt New
        const newCatId = `cat_${crypto.randomUUID()}`;
        const newCat = {
            id: newCatId,
            name: master.name,
            color: master.color,
            sortOrder: master.sortOrder,
            isSystem: 0,
            originId: master.id,
            userId: userId,
            updatedAt: new Date(),
        };
        await tx.insert(schema.categories).values(newCat);
        userCats.push(newCat as any);
        return newCat;
    }

    private static async resolveBadge(master: any, userBadges: any[], userId: string, tx: any) {
        const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const masterNorm = norm(master.name);

        // Link existing or Semantic match
        let match = userBadges.find((b: any) => b.originId === master.id || norm(b.name) === masterNorm);

        if (match) {
            // Officialize: Align originId but DO NOT touch user's custom icon/color
            if (match.originId !== master.id) {
                await tx.update(schema.badges)
                    .set({ originId: master.id, updatedAt: new Date() })
                    .where(eq(schema.badges.id, match.id));
                match.originId = master.id;
            }
            return match;
        }

        // Clone/Adopt New
        const newBadgeId = `badge_${crypto.randomUUID()}`;
        const newBadge = {
            id: newBadgeId,
            name: master.name,
            color: master.color,
            icon: master.icon,
            groupName: master.groupName,
            isSystem: 0,
            originId: master.id,
            userId: userId,
            updatedAt: new Date(),
        };
        await tx.insert(schema.badges).values(newBadge);
        userBadges.push(newBadge as any);
        return newBadge;
    }
}
