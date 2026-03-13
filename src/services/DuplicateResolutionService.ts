import { logger } from '../utils/logger';
import { normalizeSearchText } from '../utils/text';
import { dataEventService } from './DataEventService';
import { dbService } from './DatabaseService';

export type DuplicateEntityType = 'category' | 'badge' | 'exercise';

export type DuplicateCandidate = {
    id: string;
    name: string;
    origin_id?: string | null;
    group_name?: string | null;
    category_id?: string;
    type?: string;
    badge_ids?: string[];
};

export type DuplicateGroup = {
    type: DuplicateEntityType;
    key: string;
    label: string;
    candidates: DuplicateCandidate[];
};

export type DuplicateScanResult = {
    hard: DuplicateGroup[];
};

export type DuplicateScanAllResult = {
    hard: DuplicateGroup[];
    soft: DuplicateGroup[];
};

function norm(s: string): string {
    return normalizeSearchText(String(s ?? ''));
}

function looseKey(input: string): string {
    const normalized = normalizeSearchText(String(input ?? ''));
    if (!normalized) return '';
    const cleaned = normalized
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return '';
    const stop = new Set(['a', 'al', 'con', 'de', 'del', 'e', 'el', 'en', 'la', 'las', 'los', 'o', 'para', 'por', 'sin', 'u', 'y']);
    const tokens = cleaned
        .split(' ')
        .map((t) => t.trim())
        .filter(Boolean)
        .filter((t) => !stop.has(t));
    if (tokens.length === 0) return '';
    tokens.sort();
    return tokens.join(' ');
}

function sortCandidates(c: DuplicateCandidate[]): DuplicateCandidate[] {
    return [...c].sort((a, b) => {
        const ao = String(a.origin_id ?? '');
        const bo = String(b.origin_id ?? '');
        if (ao !== bo) return bo.localeCompare(ao);
        return a.id.localeCompare(b.id);
    });
}

export class DuplicateResolutionService {
    static async scanAllDuplicates(): Promise<DuplicateScanAllResult> {
        try {
            const [cats, badges, exercises, badgeRows] = await Promise.all([
                dbService.getAll<{ id: string; name: string; origin_id?: string | null }>(
                    "SELECT id, name, origin_id FROM categories WHERE deleted_at IS NULL"
                ),
                dbService.getAll<{ id: string; name: string; origin_id?: string | null; group_name?: string | null }>(
                    "SELECT id, name, origin_id, group_name FROM badges WHERE deleted_at IS NULL"
                ),
                dbService.getAll<{ id: string; name: string; origin_id?: string | null; category_id: string; type: string }>(
                    "SELECT id, name, origin_id, category_id, type FROM exercises WHERE deleted_at IS NULL"
                ),
                dbService.getAll<{ exercise_id: string; badge_id: string }>(
                    'SELECT exercise_id, badge_id FROM exercise_badges WHERE deleted_at IS NULL'
                ),
            ]);

            const badgeByExercise = new Map<string, string[]>();
            for (const r of badgeRows ?? []) {
                if (!badgeByExercise.has(r.exercise_id)) badgeByExercise.set(r.exercise_id, []);
                badgeByExercise.get(r.exercise_id)!.push(r.badge_id);
            }
            for (const [k, v] of badgeByExercise.entries()) {
                v.sort();
                badgeByExercise.set(k, v);
            }

            const hard: DuplicateGroup[] = [];
            const soft: DuplicateGroup[] = [];

            // --- Categories ---
            const hardCatMap = new Map<string, DuplicateCandidate[]>();
            const looseCatMap = new Map<string, DuplicateCandidate[]>();
            for (const c of cats ?? []) {
                const strict = norm(c.name);
                if (strict) {
                    if (!hardCatMap.has(strict)) hardCatMap.set(strict, []);
                    hardCatMap.get(strict)!.push({ id: c.id, name: c.name, origin_id: c.origin_id ?? null });
                }
                const looseK = looseKey(c.name);
                if (looseK) {
                    if (!looseCatMap.has(looseK)) looseCatMap.set(looseK, []);
                    looseCatMap.get(looseK)!.push({ id: c.id, name: c.name, origin_id: c.origin_id ?? null });
                }
            }
            for (const [k, list] of hardCatMap.entries()) {
                if (list.length < 2) continue;
                hard.push({ type: 'category', key: `category:${k}`, label: list[0].name, candidates: sortCandidates(list) });
            }
            const hardCatKeys = new Set(hard.map((g) => g.key));
            for (const [k, list] of looseCatMap.entries()) {
                if (list.length < 2) continue;
                const strictKey = `category:${norm(list[0].name)}`;
                if (hardCatKeys.has(strictKey)) continue;
                soft.push({ type: 'category', key: `soft:category:${k}`, label: list[0].name, candidates: sortCandidates(list) });
            }

            // --- Badges ---
            const hardBadgeMap = new Map<string, DuplicateCandidate[]>();
            const looseBadgeMap = new Map<string, DuplicateCandidate[]>();
            for (const b of badges ?? []) {
                if (!norm(b.name)) continue;
                const strict = `${norm(b.group_name ?? '')}#${norm(b.name)}`;
                if (!hardBadgeMap.has(strict)) hardBadgeMap.set(strict, []);
                hardBadgeMap.get(strict)!.push({ id: b.id, name: b.name, origin_id: b.origin_id ?? null, group_name: b.group_name ?? null });

                const looseG = looseKey(b.group_name ?? '');
                const looseN = looseKey(b.name);
                const loose = `${looseG}#${looseN}`;
                if (looseG && looseN) {
                    if (!looseBadgeMap.has(loose)) looseBadgeMap.set(loose, []);
                    looseBadgeMap.get(loose)!.push({ id: b.id, name: b.name, origin_id: b.origin_id ?? null, group_name: b.group_name ?? null });
                }
            }
            for (const [k, list] of hardBadgeMap.entries()) {
                if (list.length < 2) continue;
                hard.push({ type: 'badge', key: `badge:${k}`, label: list[0].name, candidates: sortCandidates(list) });
            }
            const hardBadgeKeys = new Set(hard.map((g) => g.key));
            for (const [k, list] of looseBadgeMap.entries()) {
                if (list.length < 2) continue;
                const strictKey = `badge:${norm(list[0].group_name ?? '')}#${norm(list[0].name)}`;
                if (hardBadgeKeys.has(strictKey)) continue;
                soft.push({ type: 'badge', key: `soft:badge:${k}`, label: list[0].name, candidates: sortCandidates(list) });
            }

            // --- Exercises ---
            const hardExMap = new Map<string, DuplicateCandidate[]>();
            const looseExMap = new Map<string, DuplicateCandidate[]>();
            for (const e of exercises ?? []) {
                if (!norm(e.name)) continue;
                const badgesSig = (badgeByExercise.get(e.id) ?? []).join('|');
                const strict = `${e.category_id}#${norm(e.name)}#${e.type}#${badgesSig}`;
                if (!hardExMap.has(strict)) hardExMap.set(strict, []);
                hardExMap.get(strict)!.push({
                    id: e.id,
                    name: e.name,
                    origin_id: e.origin_id ?? null,
                    category_id: e.category_id,
                    type: e.type,
                    badge_ids: badgeByExercise.get(e.id) ?? [],
                });

                const looseN = looseKey(e.name);
                const loose = `${e.category_id}#${looseN}#${e.type}#${badgesSig}`;
                if (looseN) {
                    if (!looseExMap.has(loose)) looseExMap.set(loose, []);
                    looseExMap.get(loose)!.push({
                        id: e.id,
                        name: e.name,
                        origin_id: e.origin_id ?? null,
                        category_id: e.category_id,
                        type: e.type,
                        badge_ids: badgeByExercise.get(e.id) ?? [],
                    });
                }
            }
            for (const [k, list] of hardExMap.entries()) {
                if (list.length < 2) continue;
                hard.push({ type: 'exercise', key: `exercise:${k}`, label: list[0].name, candidates: sortCandidates(list) });
            }
            const hardExKeys = new Set(hard.map((g) => g.key));
            for (const [k, list] of looseExMap.entries()) {
                if (list.length < 2) continue;
                const strictKey = `exercise:${list[0].category_id}#${norm(list[0].name)}#${list[0].type}#${(list[0].badge_ids ?? []).join('|')}`;
                if (hardExKeys.has(strictKey)) continue;
                soft.push({ type: 'exercise', key: `soft:exercise:${k}`, label: list[0].name, candidates: sortCandidates(list) });
            }

            hard.sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
            soft.sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
            return { hard, soft };
        } catch (e) {
            logger.captureException(e, { scope: 'DuplicateResolutionService.scanAllDuplicates' });
            return { hard: [], soft: [] };
        }
    }

    static async scanHardDuplicates(): Promise<DuplicateScanResult> {
        try {
            const [cats, badges, exercises] = await Promise.all([
                dbService.getAll<{ id: string; name: string; origin_id?: string | null }>(
                    "SELECT id, name, origin_id FROM categories WHERE deleted_at IS NULL"
                ),
                dbService.getAll<{ id: string; name: string; origin_id?: string | null; group_name?: string | null }>(
                    "SELECT id, name, origin_id, group_name FROM badges WHERE deleted_at IS NULL"
                ),
                dbService.getAll<{ id: string; name: string; origin_id?: string | null; category_id: string; type: string }>(
                    "SELECT id, name, origin_id, category_id, type FROM exercises WHERE deleted_at IS NULL"
                ),
            ]);

            const hard: DuplicateGroup[] = [];

            const catMap = new Map<string, DuplicateCandidate[]>();
            for (const c of cats ?? []) {
                const k = norm(c.name);
                if (!k) continue;
                if (!catMap.has(k)) catMap.set(k, []);
                catMap.get(k)!.push({ id: c.id, name: c.name, origin_id: c.origin_id ?? null });
            }
            for (const [k, list] of catMap.entries()) {
                if (list.length < 2) continue;
                hard.push({
                    type: 'category',
                    key: `category:${k}`,
                    label: list[0].name,
                    candidates: sortCandidates(list),
                });
            }

            const badgeMap = new Map<string, DuplicateCandidate[]>();
            for (const b of badges ?? []) {
                const k = `${norm(b.group_name ?? '')}#${norm(b.name)}`;
                if (!norm(b.name)) continue;
                if (!badgeMap.has(k)) badgeMap.set(k, []);
                badgeMap.get(k)!.push({ id: b.id, name: b.name, origin_id: b.origin_id ?? null, group_name: b.group_name ?? null });
            }
            for (const [k, list] of badgeMap.entries()) {
                if (list.length < 2) continue;
                hard.push({
                    type: 'badge',
                    key: `badge:${k}`,
                    label: list[0].name,
                    candidates: sortCandidates(list),
                });
            }

            const badgeRows = await dbService.getAll<{ exercise_id: string; badge_id: string }>(
                'SELECT exercise_id, badge_id FROM exercise_badges WHERE deleted_at IS NULL'
            );
            const badgeByExercise = new Map<string, string[]>();
            for (const r of badgeRows ?? []) {
                if (!badgeByExercise.has(r.exercise_id)) badgeByExercise.set(r.exercise_id, []);
                badgeByExercise.get(r.exercise_id)!.push(r.badge_id);
            }
            for (const [k, v] of badgeByExercise.entries()) {
                v.sort();
                badgeByExercise.set(k, v);
            }

            const exMap = new Map<string, DuplicateCandidate[]>();
            for (const e of exercises ?? []) {
                const badgesSig = (badgeByExercise.get(e.id) ?? []).join('|');
                const k = `${e.category_id}#${norm(e.name)}#${e.type}#${badgesSig}`;
                if (!norm(e.name)) continue;
                if (!exMap.has(k)) exMap.set(k, []);
                exMap.get(k)!.push({
                    id: e.id,
                    name: e.name,
                    origin_id: e.origin_id ?? null,
                    category_id: e.category_id,
                    type: e.type,
                    badge_ids: badgeByExercise.get(e.id) ?? [],
                });
            }
            for (const [k, list] of exMap.entries()) {
                if (list.length < 2) continue;
                hard.push({
                    type: 'exercise',
                    key: `exercise:${k}`,
                    label: list[0].name,
                    candidates: sortCandidates(list),
                });
            }

            hard.sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
            return { hard };
        } catch (e) {
            logger.captureException(e, { scope: 'DuplicateResolutionService.scanHardDuplicates' });
            return { hard: [] };
        }
    }

    static async mergeGroup(params: {
        group: DuplicateGroup;
        masterId: string;
        deleteIds: string[];
    }): Promise<void> {
        const { group, masterId, deleteIds } = params;
        if (!masterId || deleteIds.length === 0) return;
        if (deleteIds.includes(masterId)) return;

        const now = Date.now();

        await dbService.withTransaction(async () => {
            if (group.type === 'category') {
                for (const dupeId of deleteIds) {
                    const affected = await dbService.getAll<{ id: string }>('SELECT id FROM exercises WHERE category_id = ? AND deleted_at IS NULL', [dupeId]);
                    await dbService.run('UPDATE exercises SET category_id = ?, updated_at = ? WHERE category_id = ? AND deleted_at IS NULL', [masterId, now, dupeId]);
                    for (const r of affected ?? []) {
                        await dbService.queueSyncMutation('exercises', r.id, 'UPDATE', { category_id: masterId, updated_at: now });
                    }
                    await dbService.run('DELETE FROM categories WHERE id = ?', [dupeId]);
                    await dbService.queueSyncMutation('categories', dupeId, 'DELETE');
                }
                return;
            }

            if (group.type === 'badge') {
                for (const dupeId of deleteIds) {
                    const dupRows = await dbService.getAll<{ id: string; exercise_id: string }>(
                        'SELECT id, exercise_id FROM exercise_badges WHERE badge_id = ? AND deleted_at IS NULL',
                        [dupeId]
                    );
                    const existingMasterRows = await dbService.getAll<{ exercise_id: string }>(
                        'SELECT exercise_id FROM exercise_badges WHERE badge_id = ? AND deleted_at IS NULL',
                        [masterId]
                    );
                    const existingByExercise = new Set((existingMasterRows ?? []).map((r) => r.exercise_id));

                    for (const r of dupRows ?? []) {
                        if (existingByExercise.has(r.exercise_id)) {
                            await dbService.run('DELETE FROM exercise_badges WHERE id = ?', [r.id]);
                            await dbService.queueSyncMutation('exercise_badges', r.id, 'DELETE');
                        } else {
                            await dbService.run('UPDATE exercise_badges SET badge_id = ?, updated_at = ? WHERE id = ?', [masterId, now, r.id]);
                            await dbService.queueSyncMutation('exercise_badges', r.id, 'UPDATE', { badge_id: masterId, updated_at: now });
                        }
                    }
                    await dbService.run('DELETE FROM badges WHERE id = ?', [dupeId]);
                    await dbService.queueSyncMutation('badges', dupeId, 'DELETE');
                }
                return;
            }

            if (group.type === 'exercise') {
                for (const dupeId of deleteIds) {
                    const workoutSetIds = await dbService.getAll<{ id: string }>('SELECT id FROM workout_sets WHERE exercise_id = ? AND deleted_at IS NULL', [dupeId]);
                    await dbService.run('UPDATE workout_sets SET exercise_id = ?, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL', [masterId, now, dupeId]);
                    for (const r of workoutSetIds ?? []) {
                        await dbService.queueSyncMutation('workout_sets', r.id, 'UPDATE', { exercise_id: masterId, updated_at: now });
                    }

                    const routineExIds = await dbService.getAll<{ id: string }>('SELECT id FROM routine_exercises WHERE exercise_id = ? AND deleted_at IS NULL', [dupeId]);
                    await dbService.run('UPDATE routine_exercises SET exercise_id = ?, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL', [masterId, now, dupeId]);
                    for (const r of routineExIds ?? []) {
                        await dbService.queueSyncMutation('routine_exercises', r.id, 'UPDATE', { exercise_id: masterId, updated_at: now });
                    }

                    const prIds = await dbService.getAll<{ id: string }>('SELECT id FROM user_exercise_prs WHERE exercise_id = ? AND deleted_at IS NULL', [dupeId]);
                    await dbService.run('UPDATE user_exercise_prs SET exercise_id = ?, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL', [masterId, now, dupeId]);
                    for (const r of prIds ?? []) {
                        await dbService.queueSyncMutation('user_exercise_prs', r.id, 'UPDATE', { exercise_id: masterId, updated_at: now });
                    }

                    const masterBadges = await dbService.getAll<{ badge_id: string }>('SELECT badge_id FROM exercise_badges WHERE exercise_id = ?', [masterId]);
                    const masterBadgeIds = (masterBadges ?? []).map(b => b.badge_id);
                    if (masterBadgeIds.length > 0) {
                        const ph = masterBadgeIds.map(() => '?').join(',');
                        const toDelete = await dbService.getAll<{ id: string }>(
                            `SELECT id FROM exercise_badges WHERE exercise_id = ? AND badge_id IN (${ph})`,
                            [dupeId, ...masterBadgeIds]
                        );
                        await dbService.run(`DELETE FROM exercise_badges WHERE exercise_id = ? AND badge_id IN (${ph})`, [dupeId, ...masterBadgeIds]);
                        for (const r of toDelete ?? []) {
                            await dbService.queueSyncMutation('exercise_badges', r.id, 'DELETE');
                        }
                    }

                    const moveRows = await dbService.getAll<{ id: string }>('SELECT id FROM exercise_badges WHERE exercise_id = ? AND deleted_at IS NULL', [dupeId]);
                    await dbService.run('UPDATE exercise_badges SET exercise_id = ?, updated_at = ? WHERE exercise_id = ? AND deleted_at IS NULL', [masterId, now, dupeId]);
                    for (const r of moveRows ?? []) {
                        await dbService.queueSyncMutation('exercise_badges', r.id, 'UPDATE', { exercise_id: masterId, updated_at: now });
                    }

                    await dbService.run('DELETE FROM exercises WHERE id = ?', [dupeId]);
                    await dbService.queueSyncMutation('exercises', dupeId, 'DELETE');
                }
                return;
            }
        });

        dataEventService.emit('DATA_UPDATED');
    }
}
