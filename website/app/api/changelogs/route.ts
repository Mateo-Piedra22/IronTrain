import { desc } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../src/db';
import * as schema from '../../../src/db/schema';
import { compareSemverDesc, type ChangelogRelease } from '../../../src/lib/changelog';
import { syncChangelogToDatabase } from '../../../src/lib/changelog-db-sync';

export const revalidate = 60; // Cache for 1 minute
export const dynamic = 'force-dynamic';
type ApiRelease = ChangelogRelease & { id: string; metadata: unknown };

function toIsoSafe(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
}

export async function GET(request: NextRequest) {
    try {
        const includeUnreleasedParam = new URL(request.url).searchParams.get('includeUnreleased');
        const includeUnreleased = includeUnreleasedParam === '1' || includeUnreleasedParam === 'true';

        await syncChangelogToDatabase();

        const data = await db.select()
            .from(schema.changelogs)
            .orderBy(desc(schema.changelogs.date), desc(schema.changelogs.version));

        const releases = data.map((c) => ({
            id: c.id,
            version: c.version,
            date: toIsoSafe((c as any)?.date),
            items: (c.items as string[]) || [],
            unreleased: c.isUnreleased === true,
            metadata: (c.metadata as any) || null,
            reactionCount: c.reactionCount
        }))
            .filter((r) => includeUnreleased || r.unreleased !== true)
            .sort(compareSemverDesc);

        return NextResponse.json({
            generatedAt: new Date().toISOString(),
            source: 'database+docs-sync',
            releases
        });
    } catch (error) {
        console.error('Error fetching changelogs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
