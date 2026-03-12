import { capitalizeWords } from '../utils/text';
import { dbService } from './DatabaseService';

export type NormalizationPreviewRow = Readonly<{
    id: string;
    before: string;
    after: string;
}>;

export type NameNormalizationPreview = Readonly<{
    exercises: { count: number; samples: NormalizationPreviewRow[] };
    categories: { count: number; samples: NormalizationPreviewRow[] };
    badges: { count: number; samples: NormalizationPreviewRow[] };
    routines: { count: number; samples: NormalizationPreviewRow[] };
    routineDays: { count: number; samples: NormalizationPreviewRow[] };
    total: number;
}>;

function isDifferent(a: string, b: string): boolean {
    return String(a) !== String(b);
}

function pickSamples(rows: NormalizationPreviewRow[], max: number): NormalizationPreviewRow[] {
    return rows.slice(0, Math.max(0, max));
}

export class NameNormalizationService {
    static async previewTitleCaseNormalization(sampleLimit: number = 4): Promise<NameNormalizationPreview> {
        const [exercises, categories, badges, routines, routineDays] = await Promise.all([
            dbService.getAll<{ id: string; name: string }>('SELECT id, name FROM exercises WHERE deleted_at IS NULL AND is_system = 0 ORDER BY name ASC'),
            dbService.getAll<{ id: string; name: string }>('SELECT id, name FROM categories WHERE deleted_at IS NULL AND is_system = 0 ORDER BY name ASC'),
            dbService.getAll<{ id: string; name: string }>('SELECT id, name FROM badges WHERE deleted_at IS NULL AND is_system = 0 ORDER BY name ASC'),
            dbService.getAll<{ id: string; name: string }>('SELECT id, name FROM routines WHERE deleted_at IS NULL ORDER BY name ASC'),
            dbService.getAll<{ id: string; name: string }>('SELECT id, name FROM routine_days WHERE deleted_at IS NULL ORDER BY name ASC'),
        ]);

        const exDiff = exercises
            .map((r) => ({ id: r.id, before: r.name, after: capitalizeWords(r.name) }))
            .filter((r) => isDifferent(r.before, r.after));
        const catDiff = categories
            .map((r) => ({ id: r.id, before: r.name, after: capitalizeWords(r.name) }))
            .filter((r) => isDifferent(r.before, r.after));
        const badgeDiff = badges
            .map((r) => ({ id: r.id, before: r.name, after: capitalizeWords(r.name) }))
            .filter((r) => isDifferent(r.before, r.after));
        const routineDiff = routines
            .map((r) => ({ id: r.id, before: r.name, after: capitalizeWords(r.name) }))
            .filter((r) => isDifferent(r.before, r.after));
        const routineDayDiff = routineDays
            .map((r) => ({ id: r.id, before: r.name, after: capitalizeWords(r.name) }))
            .filter((r) => isDifferent(r.before, r.after));

        const total = exDiff.length + catDiff.length + badgeDiff.length + routineDiff.length + routineDayDiff.length;

        return {
            exercises: { count: exDiff.length, samples: pickSamples(exDiff, sampleLimit) },
            categories: { count: catDiff.length, samples: pickSamples(catDiff, sampleLimit) },
            badges: { count: badgeDiff.length, samples: pickSamples(badgeDiff, sampleLimit) },
            routines: { count: routineDiff.length, samples: pickSamples(routineDiff, sampleLimit) },
            routineDays: { count: routineDayDiff.length, samples: pickSamples(routineDayDiff, sampleLimit) },
            total,
        };
    }

    static async applyTitleCaseNormalization(): Promise<NameNormalizationPreview> {
        const preview = await NameNormalizationService.previewTitleCaseNormalization(0);
        if (preview.total === 0) return preview;

        const now = Date.now();

        await dbService.withTransaction(async () => {
            const updateRows = async (
                table: 'exercises' | 'categories' | 'badges' | 'routines' | 'routine_days',
                rows: ReadonlyArray<NormalizationPreviewRow>,
                operation: 'UPDATE' = 'UPDATE'
            ) => {
                for (const r of rows) {
                    await dbService.run(`UPDATE ${table} SET name = ?, updated_at = ? WHERE id = ?`, [r.after, now, r.id]);
                    await dbService.queueSyncMutation(table, r.id, operation, { name: r.after, updated_at: now });
                }
            };

            const fetchDiff = async (sql: string): Promise<NormalizationPreviewRow[]> => {
                const rows = await dbService.getAll<{ id: string; name: string }>(sql);
                return rows
                    .map((r) => ({ id: r.id, before: r.name, after: capitalizeWords(r.name) }))
                    .filter((r) => isDifferent(r.before, r.after));
            };

            const [exDiff, catDiff, badgeDiff, routineDiff, routineDayDiff] = await Promise.all([
                fetchDiff('SELECT id, name FROM exercises WHERE deleted_at IS NULL AND is_system = 0'),
                fetchDiff('SELECT id, name FROM categories WHERE deleted_at IS NULL AND is_system = 0'),
                fetchDiff('SELECT id, name FROM badges WHERE deleted_at IS NULL AND is_system = 0'),
                fetchDiff('SELECT id, name FROM routines WHERE deleted_at IS NULL'),
                fetchDiff('SELECT id, name FROM routine_days WHERE deleted_at IS NULL'),
            ]);

            await updateRows('exercises', exDiff);
            await updateRows('categories', catDiff);
            await updateRows('badges', badgeDiff);
            await updateRows('routines', routineDiff);
            await updateRows('routine_days', routineDayDiff);
        });

        return await NameNormalizationService.previewTitleCaseNormalization(4);
    }
}
