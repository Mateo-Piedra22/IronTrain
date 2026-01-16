jest.mock('expo-constants', () => ({
    expoConfig: {
        version: '1.2.0',
        extra: {
            updateFeedUrl: 'https://example.com/releases.json',
        },
    },
}));

import { UpdateService } from '../UpdateService';

describe('UpdateService', () => {
    beforeEach(() => {
        // @ts-expect-error - jest env
        global.fetch = jest.fn();
    });

    test('returns update_available when downloadUrl exists', async () => {
        // @ts-expect-error - jest env
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                latest: { version: '1.3.0', date: '2026-01-16', downloadUrl: 'https://example.com/app.apk', notesUrl: 'https://example.com/changelog' },
                downloadsPageUrl: 'https://example.com/downloads',
            }),
        });

        const res = await UpdateService.checkForUpdate();
        expect(res.status).toBe('update_available');
        if (res.status === 'update_available') {
            expect(res.latestVersion).toBe('1.3.0');
            expect(res.downloadUrl).toBe('https://example.com/app.apk');
        }
    });

    test('returns update_pending when newer version has no downloadUrl', async () => {
        // @ts-expect-error - jest env
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                latest: { version: '1.3.0', date: '2026-01-16', downloadUrl: null, notesUrl: 'https://example.com/changelog' },
                downloadsPageUrl: 'https://example.com/downloads',
            }),
        });

        const res = await UpdateService.checkForUpdate();
        expect(res.status).toBe('update_pending');
        if (res.status === 'update_pending') {
            expect(res.latestVersion).toBe('1.3.0');
        }
    });
});

