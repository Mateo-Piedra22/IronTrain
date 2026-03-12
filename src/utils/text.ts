export function normalizeSearchText(input: string): string {
    const trimmed = (input ?? '').trim();
    if (trimmed.length === 0) return '';

    return trimmed
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

export function tokenizeSearchQuery(query: string): string[] {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];
    return normalized.split(' ').filter(Boolean);
}

export type SearchableField = string | null | undefined;

export function matchesKeywordAndQuery(query: string, fields: readonly SearchableField[]): boolean {
    const tokens = tokenizeSearchQuery(query);
    if (tokens.length === 0) return true;

    const haystack = normalizeSearchText(fields.filter((f): f is string => typeof f === 'string' && f.trim().length > 0).join(' '));
    if (!haystack) return false;

    return tokens.every((t) => haystack.includes(t));
}

const SPANISH_STOP_WORDS = new Set([
    'a',
    'al',
    'con',
    'de',
    'del',
    'e',
    'el',
    'en',
    'la',
    'las',
    'los',
    'o',
    'para',
    'por',
    'sin',
    'u',
    'y',
]);

function isAllUppercaseWord(word: string): boolean {
    const letters = word.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
    if (letters.length < 2) return false;
    return letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

function titleCaseToken(token: string): string {
    if (!token) return token;
    const first = token.charAt(0);
    const rest = token.slice(1);
    return `${first.toUpperCase()}${rest.toLowerCase()}`;
}

function splitPunctuation(token: string): { prefix: string; core: string; suffix: string } {
    const prefixMatch = token.match(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/);
    const suffixMatch = token.match(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+$/);

    const prefix = prefixMatch?.[0] ?? '';
    const suffix = suffixMatch?.[0] ?? '';
    const core = token.slice(prefix.length, token.length - suffix.length);
    return { prefix, core, suffix };
}

/**
 * Title-cases a user-facing label with Spanish stop-word handling.
 * - Collapses whitespace
 * - Keeps stop-words lowercase unless they are the first word
 * - Preserves acronyms already written in uppercase (e.g. RPE, EMOM)
 */
export function capitalizeWords(input: string): string {
    const normalizedSpace = (input ?? '').trim().replace(/\s+/g, ' ');
    if (!normalizedSpace) return '';

    const words = normalizedSpace.split(' ');

    return words
        .map((raw, idx) => {
            const word = raw.trim();
            if (!word) return '';

            const { prefix, core, suffix } = splitPunctuation(word);
            if (!core) return word;

            if (isAllUppercaseWord(core)) {
                return `${prefix}${core}${suffix}`;
            }

            const lowerCore = core.toLowerCase();
            if (idx !== 0 && SPANISH_STOP_WORDS.has(lowerCore)) {
                return `${prefix}${lowerCore}${suffix}`;
            }

            if (core.includes('-')) {
                const cased = core
                    .split('-')
                    .map((part) => (part ? titleCaseToken(part) : part))
                    .join('-');
                return `${prefix}${cased}${suffix}`;
            }

            return `${prefix}${titleCaseToken(core)}${suffix}`;
        })
        .filter(Boolean)
        .join(' ');
}
