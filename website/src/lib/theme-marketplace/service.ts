import { db } from '@/db';
import * as schema from '@/db/schema';
import { and, eq, inArray, isNull, or, sql, SQL } from 'drizzle-orm';
import { z } from 'zod';

const themeVisibilitySchema = z.enum(['private', 'friends', 'public']);
const themeStatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected', 'suspended']);

const hexColorSchema = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);

const themePatchSchema = z.object({
    iron: z.record(z.string(), hexColorSchema).optional(),
    primary: z.object({
        DEFAULT: hexColorSchema.optional(),
        light: hexColorSchema.optional(),
        dark: hexColorSchema.optional(),
    }).optional(),
    logoPrimary: hexColorSchema.optional(),
    logoAccent: hexColorSchema.optional(),
    onPrimary: hexColorSchema.optional(),
    white: hexColorSchema.optional(),
    black: hexColorSchema.optional(),
    blue: hexColorSchema.optional(),
    red: hexColorSchema.optional(),
    green: hexColorSchema.optional(),
    yellow: hexColorSchema.optional(),
    background: hexColorSchema.optional(),
    surface: hexColorSchema.optional(),
    surfaceLighter: hexColorSchema.optional(),
    text: hexColorSchema.optional(),
    textMuted: hexColorSchema.optional(),
    border: hexColorSchema.optional(),
}).strict();

export const themePackPayloadSchema = z.object({
    schemaVersion: z.literal(1),
    base: z.object({
        light: z.literal('core-light'),
        dark: z.literal('core-dark'),
    }),
    lightPatch: themePatchSchema.optional(),
    darkPatch: themePatchSchema.optional(),
    preview: z.object({
        hero: hexColorSchema.optional(),
        surface: hexColorSchema.optional(),
        text: hexColorSchema.optional(),
    }).optional(),
    meta: z.object({
        name: z.string().trim().min(1).max(80).optional(),
        description: z.string().trim().max(240).optional(),
        tags: z.array(z.string().trim().min(1).max(24)).max(8).optional(),
    }).optional(),
}).strict();

export const createThemePackSchema = z.object({
    name: z.string().trim().min(3).max(80),
    description: z.string().trim().max(240).optional(),
    tags: z.array(z.string().trim().min(1).max(24)).max(8).optional().default([]),
    supportsLight: z.boolean().default(true),
    supportsDark: z.boolean().default(true),
    visibility: themeVisibilitySchema.default('private'),
    payload: themePackPayloadSchema,
});

export const createThemeVersionSchema = z.object({
    payload: themePackPayloadSchema,
    changelog: z.string().trim().max(300).optional(),
});

type ThemePatchInput = z.infer<typeof themePatchSchema> | undefined;
type ThemePayloadInput = z.infer<typeof themePackPayloadSchema>;

function normalizeLogoPatch(patch: ThemePatchInput, mode: 'light' | 'dark'): ThemePatchInput {
    if (!patch) return patch;

    const primary = patch.primary ?? {};
    const normalized: z.infer<typeof themePatchSchema> = { ...patch };

    if (!normalized.logoPrimary) {
        normalized.logoPrimary =
            patch.text ??
            (mode === 'dark' ? primary.light : primary.dark) ??
            primary.DEFAULT;
    }

    if (!normalized.logoAccent) {
        normalized.logoAccent =
            (mode === 'dark' ? primary.light : primary.dark) ??
            primary.DEFAULT ??
            normalized.logoPrimary;
    }

    return normalized;
}

export function normalizeThemePayloadLogos(payload: ThemePayloadInput): ThemePayloadInput {
    return {
        ...payload,
        lightPatch: normalizeLogoPatch(payload.lightPatch, 'light'),
        darkPatch: normalizeLogoPatch(payload.darkPatch, 'dark'),
    };
}

export const installThemePackSchema = z.object({
    appliedLight: z.boolean().default(false),
    appliedDark: z.boolean().default(false),
});

export const rateThemePackSchema = z.object({
    rating: z.number().int().min(1).max(5),
    review: z.string().trim().max(800).optional(),
});

export const createThemeFeedbackSchema = z.object({
    kind: z.enum(['issue', 'suggestion', 'praise']),
    message: z.string().trim().min(3).max(1000),
});

export const createThemeReportSchema = z.object({
    reason: z.enum(['nsfw', 'hate', 'spam', 'impersonation', 'malware', 'other']),
    details: z.string().trim().max(1000).optional(),
});

const querySchema = z.object({
    scope: z.enum(['public', 'owned', 'friends']).default('public'),
    mode: z.enum(['light', 'dark', 'both']).default('both'),
    sort: z.enum(['trending', 'new', 'top']).default('trending'),
    source: z.enum(['all', 'system', 'community']).default('all'),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(50).default(20),
    q: z.string().trim().max(80).optional(),
});

export type ThemeListQuery = z.infer<typeof querySchema>;

export function parseThemeListQuery(url: URL): ThemeListQuery {
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');

    return querySchema.parse({
        scope: url.searchParams.get('scope') ?? 'public',
        mode: url.searchParams.get('mode') ?? 'both',
        sort: url.searchParams.get('sort') ?? 'trending',
        source: url.searchParams.get('source') ?? 'all',
        page,
        pageSize,
        q: url.searchParams.get('q') ?? undefined,
    });
}

export function normalizeTags(raw: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const tag of raw) {
        const cleaned = tag.trim().toLowerCase();
        if (!cleaned) continue;
        if (seen.has(cleaned)) continue;
        seen.add(cleaned);
        output.push(cleaned);
    }

    return output.slice(0, 8);
}

export function slugifyThemeName(name: string): string {
    const base = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return base || 'theme-pack';
}

export async function resolveUniqueThemeSlug(base: string): Promise<string> {
    const normalized = base.slice(0, 80);
    const existing = await db
        .select({ slug: schema.themePacks.slug })
        .from(schema.themePacks)
        .where(eq(schema.themePacks.slug, normalized))
        .limit(1);

    if (existing.length === 0) return normalized;

    for (let i = 2; i <= 9999; i += 1) {
        const candidate = `${normalized}-${i}`.slice(0, 90);
        const rows = await db
            .select({ slug: schema.themePacks.slug })
            .from(schema.themePacks)
            .where(eq(schema.themePacks.slug, candidate))
            .limit(1);

        if (rows.length === 0) return candidate;
    }

    return `${normalized}-${Date.now()}`;
}

export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
    const [outboundFriends, inboundFriends] = await Promise.all([
        db.select({ userId: schema.friendships.userId, friendId: schema.friendships.friendId })
            .from(schema.friendships)
            .where(and(eq(schema.friendships.userId, userId), eq(schema.friendships.status, 'accepted'), isNull(schema.friendships.deletedAt))),
        db.select({ userId: schema.friendships.userId, friendId: schema.friendships.friendId })
            .from(schema.friendships)
            .where(and(eq(schema.friendships.friendId, userId), eq(schema.friendships.status, 'accepted'), isNull(schema.friendships.deletedAt))),
    ]);

    const ids = new Set<string>();
    for (const row of outboundFriends) ids.add(row.friendId);
    for (const row of inboundFriends) ids.add(row.userId);

    return Array.from(ids);
}

export async function canReadThemePack(
    userId: string,
    pack: typeof schema.themePacks.$inferSelect,
): Promise<boolean> {
    if (pack.ownerId === userId) return true;
    if (pack.visibility === 'public' && pack.status === 'approved') return true;
    if (pack.visibility === 'friends' && pack.status === 'approved') {
        const friendIds = await getAcceptedFriendIds(userId);
        return friendIds.includes(pack.ownerId);
    }
    return false;
}

export async function refreshThemePackRatingAggregates(
    tx: any,
    themePackId: string,
    now = new Date(),
) {
    const [agg] = await tx
        .select({
            ratingAvg: sql<number>`coalesce(avg(${schema.themePackRatings.rating})::float, 0)`,
            ratingCount: sql<number>`count(*)::int`,
        })
        .from(schema.themePackRatings)
        .where(
            and(
                eq(schema.themePackRatings.themePackId, themePackId),
                isNull(schema.themePackRatings.deletedAt),
            ),
        );

    await tx
        .update(schema.themePacks)
        .set({
            ratingAvg: Number(agg?.ratingAvg ?? 0),
            ratingCount: Number(agg?.ratingCount ?? 0),
            updatedAt: now,
        })
        .where(eq(schema.themePacks.id, themePackId));

    return {
        ratingAvg: Number(agg?.ratingAvg ?? 0),
        ratingCount: Number(agg?.ratingCount ?? 0),
    };
}

export function buildThemeListFilters(userId: string, query: ThemeListQuery, friendIds: string[]): SQL<unknown>[] {
    const filters: SQL<unknown>[] = [isNull(schema.themePacks.deletedAt)];

    if (query.scope === 'owned') {
        filters.push(eq(schema.themePacks.ownerId, userId));
    } else if (query.scope === 'friends') {
        if (friendIds.length === 0) {
            filters.push(sql`false`);
        } else {
            filters.push(inArray(schema.themePacks.ownerId, friendIds));
            filters.push(inArray(schema.themePacks.visibility, ['friends', 'public']));
            filters.push(eq(schema.themePacks.status, 'approved'));
        }
    } else {
        filters.push(eq(schema.themePacks.visibility, 'public'));
        filters.push(eq(schema.themePacks.status, 'approved'));
    }

    if (query.mode === 'light') {
        filters.push(eq(schema.themePacks.supportsLight, true));
    } else if (query.mode === 'dark') {
        filters.push(eq(schema.themePacks.supportsDark, true));
    }

    if (query.source === 'system') {
        filters.push(eq(schema.themePacks.isSystem, true));
    } else if (query.source === 'community') {
        filters.push(eq(schema.themePacks.isSystem, false));
    }

    if (query.q) {
        const pattern = `%${query.q.toLowerCase()}%`;
        filters.push(or(
            sql`lower(${schema.themePacks.name}) like ${pattern}`,
            sql`lower(coalesce(${schema.themePacks.description}, '')) like ${pattern}`,
        ) as SQL<unknown>);
    }

    return filters;
}

export function mapThemePackSummary(row: typeof schema.themePacks.$inferSelect) {
    return {
        id: row.id,
        slug: row.slug,
        ownerId: row.ownerId,
        name: row.name,
        description: row.description,
        tags: Array.isArray(row.tags) ? row.tags : [],
        supportsLight: row.supportsLight,
        supportsDark: row.supportsDark,
        isSystem: row.isSystem,
        visibility: row.visibility,
        status: row.status,
        currentVersion: row.currentVersion,
        downloadsCount: row.downloadsCount,
        appliesCount: row.appliesCount,
        ratingAvg: row.ratingAvg,
        ratingCount: row.ratingCount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export const themePackStatusEnum = themeStatusSchema;
export const themePackVisibilityEnum = themeVisibilitySchema;
