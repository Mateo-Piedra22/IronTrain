import { ThemeImportError, ThemeImportService } from '../ThemeImportService';

describe('ThemeImportService', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        jest.restoreAllMocks();
        global.fetch = originalFetch;
    });

    it('resolves a valid shared theme payload', async () => {
        const mockJson = {
            success: true,
            data: {
                id: 'theme_123',
                slug: 'nord-iron',
                name: 'Nord Iron',
                description: 'Tema de prueba',
                tags: ['nord', 'iron'],
                supportsLight: true,
                supportsDark: true,
                version: 2,
                payload: {
                    schemaVersion: 1,
                    lightPatch: { primary: { DEFAULT: '#112233' } },
                    darkPatch: { primary: { DEFAULT: '#445566' } },
                },
            },
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => mockJson,
        } as any);

        const result = await ThemeImportService.fetchSharedThemeBySlug('nord-iron');

        expect(result.id).toBe('theme_123');
        expect(result.slug).toBe('nord-iron');
        expect(result.name).toBe('Nord Iron');
        expect(result.supportsLight).toBe(true);
        expect(result.supportsDark).toBe(true);
        expect(result.payload.lightPatch).toEqual({ primary: { DEFAULT: '#112233' } });
        expect(result.payload.darkPatch).toEqual({ primary: { DEFAULT: '#445566' } });
    });

    it('throws not_found error on 404', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
            headers: { get: () => null },
            json: async () => ({ error: 'not_found' }),
        } as any);

        await expect(ThemeImportService.fetchSharedThemeBySlug('missing-theme')).rejects.toMatchObject({
            name: 'ThemeImportError',
            code: 'not_found',
            status: 404,
        });
    });

    it('throws rate_limited error on 429', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 429,
            headers: { get: (key: string) => (key === 'Retry-After' ? '30' : null) },
            json: async () => ({ error: 'rate_limited' }),
        } as any);

        await expect(ThemeImportService.fetchSharedThemeBySlug('busy-theme')).rejects.toMatchObject({
            name: 'ThemeImportError',
            code: 'rate_limited',
            status: 429,
            retryAfterSeconds: 30,
        });
    });

    it('throws invalid_slug for empty slug', async () => {
        await expect(ThemeImportService.fetchSharedThemeBySlug('   ')).rejects.toMatchObject({
            name: 'ThemeImportError',
            code: 'invalid_slug',
        });
    });

    it('throws network_error when fetch fails', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

        try {
            await ThemeImportService.fetchSharedThemeBySlug('nord-iron');
            fail('Expected ThemeImportError');
        } catch (error) {
            expect(error).toBeInstanceOf(ThemeImportError);
            expect((error as ThemeImportError).code).toBe('network_error');
        }
    });

    it('throws when server payload has invalid identity fields', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => ({
                success: true,
                data: {
                    id: '',
                    slug: 'nord-iron',
                    name: 'Nord Iron',
                    supportsLight: true,
                    supportsDark: true,
                    payload: {},
                },
            }),
        } as any);

        await expect(ThemeImportService.fetchSharedThemeBySlug('nord-iron')).rejects.toMatchObject({
            name: 'ThemeImportError',
            message: expect.stringContaining('identidad válida'),
        });
    });

    it('throws when server payload has no supported modes', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: async () => ({
                success: true,
                data: {
                    id: 'theme_123',
                    slug: 'nord-iron',
                    name: 'Nord Iron',
                    supportsLight: false,
                    supportsDark: false,
                    payload: {},
                },
            }),
        } as any);

        await expect(ThemeImportService.fetchSharedThemeBySlug('nord-iron')).rejects.toMatchObject({
            name: 'ThemeImportError',
            message: expect.stringContaining('compatibilidad Light/Dark'),
        });
    });
});
