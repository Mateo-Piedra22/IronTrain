const mockConfigStore = new Map<string, unknown>();

jest.mock('../ConfigService', () => ({
    configService: {
        getThemeSetting: jest.fn((key: string, fallback: unknown) => mockConfigStore.get(key) ?? fallback),
        setThemeSetting: jest.fn(async (key: string, value: unknown) => {
            mockConfigStore.set(key, value);
        }),
    },
}));

jest.mock('../SocialService', () => {
    class MockSocialApiError extends Error {
        status: number;

        constructor(message: string, status: number) {
            super(message);
            this.status = status;
        }
    }

    return {
        SocialService: {
            installMarketplaceTheme: jest.fn(),
        },
        SocialApiError: MockSocialApiError,
    };
});

jest.mock('../../utils/analytics', () => ({
    capture: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
    logger: {
        captureException: jest.fn(),
    },
}));

import { configService } from '../ConfigService';
import { SocialService } from '../SocialService';
import { ThemeInstallTrackingService } from '../ThemeInstallTrackingService';

describe('ThemeInstallTrackingService', () => {
    const queueKey = 'theme_install_queue_v1';

    beforeEach(() => {
        mockConfigStore.clear();
        jest.clearAllMocks();
    });

    it('reports install immediately when API call succeeds', async () => {
        (SocialService.installMarketplaceTheme as jest.Mock).mockResolvedValue({ success: true });

        await ThemeInstallTrackingService.reportInstall('theme_ok', {
            appliedLight: true,
            appliedDark: false,
            source: 'test',
        });

        expect(SocialService.installMarketplaceTheme).toHaveBeenCalledWith('theme_ok', {
            appliedLight: true,
            appliedDark: false,
        });
        expect(configService.setThemeSetting).not.toHaveBeenCalledWith(queueKey, expect.anything());
    });

    it('queues failed install and flushes it later', async () => {
        (SocialService.installMarketplaceTheme as jest.Mock)
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({ success: true });

        await ThemeInstallTrackingService.reportInstall('theme_retry', {
            appliedLight: false,
            appliedDark: true,
            source: 'test',
        });

        const queued = configService.getThemeSetting<Array<{ themeId: string }>>(queueKey, []);
        expect(Array.isArray(queued)).toBe(true);
        expect(queued[0]?.themeId).toBe('theme_retry');

        await ThemeInstallTrackingService.flushPending();

        const afterFlush = configService.getThemeSetting<Array<unknown>>(queueKey, []);
        expect(Array.isArray(afterFlush)).toBe(true);
        expect(afterFlush.length).toBe(0);
    });
});
