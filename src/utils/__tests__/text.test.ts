import { capitalizeWords, matchesKeywordAndQuery, normalizeSearchText, tokenizeSearchQuery } from '../text';

describe('text utils (search)', () => {
    describe('normalizeSearchText', () => {
        it('trims, lowercases, collapses whitespace and removes diacritics', () => {
            expect(normalizeSearchText('  Árbol   DE   NAVIDAD  ')).toBe('arbol de navidad');
        });

        it('returns empty string for empty input', () => {
            expect(normalizeSearchText('   ')).toBe('');
        });
    });

    describe('tokenizeSearchQuery', () => {
        it('splits into tokens after normalization', () => {
            expect(tokenizeSearchQuery('  Press   Banca  ')).toEqual(['press', 'banca']);
        });

        it('returns [] for empty query', () => {
            expect(tokenizeSearchQuery('')).toEqual([]);
        });
    });

    describe('matchesKeywordAndQuery', () => {
        it('returns true when query is empty', () => {
            expect(matchesKeywordAndQuery('', ['Pecho'])).toBe(true);
        });

        it('uses keyword AND semantics across fields', () => {
            expect(matchesKeywordAndQuery('press banca', ['Press', 'Banca Plano'])).toBe(true);
            expect(matchesKeywordAndQuery('press banca', ['Press', 'Plano'])).toBe(false);
        });

        it('is accent-insensitive and case-insensitive', () => {
            expect(matchesKeywordAndQuery('sentadilla', ['Sentadílla frontal'])).toBe(true);
        });

        it('returns false when all fields are empty and query has tokens', () => {
            expect(matchesKeywordAndQuery('a', ['', undefined, null])).toBe(false);
        });
    });

    describe('capitalizeWords', () => {
        it('applies Title Case and keeps Spanish stop-words lowercase when not first', () => {
            expect(capitalizeWords('press de banca plano')).toBe('Press de Banca Plano');
            expect(capitalizeWords('de la cruz')).toBe('De la Cruz');
        });

        it('preserves existing acronyms written in uppercase', () => {
            expect(capitalizeWords('RPE en EMOM')).toBe('RPE en EMOM');
        });

        it('handles hyphenated tokens', () => {
            expect(capitalizeWords('press-banca inclinado')).toBe('Press-Banca Inclinado');
        });
    });
});
