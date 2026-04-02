import {
    resolveThemeTokensFromSelection,
    sanitizeThemeDraftList,
    ThemeDraft,
    validateThemeDraftInput,
} from '../../theme-engine';

describe('theme-engine phase 1', () => {
    const draftBase: ThemeDraft = {
        id: 'draft-1',
        name: 'Nord Core',
        lightPatch: {
            primary: { DEFAULT: '#112233' },
            background: '#F2F4F6',
            text: '#1C2430',
        },
        darkPatch: {
            primary: { DEFAULT: '#FF7766' },
            background: '#1A2029',
            text: '#F8FAFC',
        },
        createdAt: 1700000000000,
        updatedAt: 1700000005000,
    };

    test('validateThemeDraftInput rejects invalid payload', () => {
        const result = validateThemeDraftInput({
            name: '  ',
            lightPatch: {},
            darkPatch: {},
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    test('sanitizeThemeDraftList drops invalid entries and duplicates', () => {
        const sanitized = sanitizeThemeDraftList([
            draftBase,
            { ...draftBase, id: 'draft-1' },
            { ...draftBase, id: 'draft-2', lightPatch: { primary: { DEFAULT: 'INVALID' } } },
            null,
            { id: '', name: 'bad' },
        ]);

        expect(sanitized).toHaveLength(1);
        expect(sanitized[0].id).toBe('draft-1');
    });

    test('resolveThemeTokensFromSelection resolves core when no draft selected', () => {
        const tokens = resolveThemeTokensFromSelection(
            {
                mode: 'light',
                activeSubthemeIdLight: null,
                activeSubthemeIdDark: null,
            },
            'light',
            [draftBase]
        );

        expect(tokens.variant).toBe('core');
        expect(tokens.id).toBe('core-light');
    });

    test('resolveThemeTokensFromSelection applies selected draft by effective mode', () => {
        const tokensDark = resolveThemeTokensFromSelection(
            {
                mode: 'system',
                activeSubthemeIdLight: 'draft-1',
                activeSubthemeIdDark: 'draft-1',
            },
            'dark',
            [draftBase]
        );

        expect(tokensDark.variant).toBe('custom');
        expect(tokensDark.label).toBe('Nord Core');
        expect(tokensDark.colors.primary.DEFAULT).toBe('#FF7766');
        expect(tokensDark.colors.background).toBe('#1A2029');
    });
});
