import { normalizeSearchText } from './text';

export type DuplicatePreview = {
    title: string;
    subtitle?: string;
};

export type ExerciseDuplicateCandidate = {
    id: string;
    name: string;
    category_id: string;
    type: string;
    badge_ids: readonly string[];
    category_name?: string;
};

export type ExerciseDuplicateInput = {
    id?: string;
    name: string;
    category_id: string;
    type: string;
    badge_ids: readonly string[];
};

function normalizeBadgeIds(ids: readonly string[]): string[] {
    return Array.from(new Set(ids)).filter(Boolean).sort();
}

function sameString(a: string, b: string): boolean {
    return normalizeSearchText(a) === normalizeSearchText(b);
}

function sameBadgeSet(a: readonly string[], b: readonly string[]): boolean {
    const aa = normalizeBadgeIds(a);
    const bb = normalizeBadgeIds(b);
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) {
        if (aa[i] !== bb[i]) return false;
    }
    return true;
}

export function findExerciseDuplicates(
    input: ExerciseDuplicateInput,
    existing: readonly ExerciseDuplicateCandidate[],
    limit: number = 3
): ExerciseDuplicateCandidate[] {
    const matches = existing.filter((e) => {
        if (input.id && e.id === input.id) return false;
        if (!sameString(e.name, input.name)) return false;
        if (e.category_id !== input.category_id) return false;
        if (e.type !== input.type) return false;
        if (!sameBadgeSet(e.badge_ids ?? [], input.badge_ids ?? [])) return false;
        return true;
    });

    return matches.slice(0, Math.max(0, limit));
}

export function findNameDuplicates<T extends { id: string; name: string }>(
    input: { id?: string; name: string },
    existing: readonly T[],
    limit: number = 3
): T[] {
    const matches = existing.filter((e) => {
        if (input.id && e.id === input.id) return false;
        return sameString(e.name, input.name);
    });

    return matches.slice(0, Math.max(0, limit));
}

export function findBadgeDuplicates<T extends { id: string; name: string; group_name?: string | null }>(
    input: { id?: string; name: string; group_name?: string | null },
    existing: readonly T[],
    limit: number = 3
): T[] {
    const matches = existing.filter((b) => {
        if (input.id && b.id === input.id) return false;
        if (!sameString(b.name, input.name)) return false;
        const a = input.group_name ?? '';
        const c = b.group_name ?? '';
        return normalizeSearchText(a) === normalizeSearchText(c);
    });

    return matches.slice(0, Math.max(0, limit));
}

export function buildDuplicateMessage(intro: string, previews: readonly DuplicatePreview[]): string {
    const lines: string[] = [intro];
    if (previews.length > 0) {
        lines.push('');
        lines.push('Coincidencias:');
        for (const p of previews) {
            lines.push(`- ${p.title}${p.subtitle ? ` (${p.subtitle})` : ''}`);
        }
    }
    return lines.join('\n');
}
