import { AppNotificationService } from '../AppNotificationService';
import { BroadcastFeedService } from '../BroadcastFeedService';
import { configService } from '../ConfigService';

jest.mock('../BroadcastFeedService', () => ({
    BroadcastFeedService: {
        getFeed: jest.fn(),
    },
}));

jest.mock('../ConfigService', () => ({
    configService: {
        get: jest.fn(),
        set: jest.fn(),
    },
}));

jest.mock('../../store/authStore', () => ({
    useAuthStore: {
        getState: jest.fn(() => ({ token: 'mock-token', user: { id: 'mock-user' } })),
    },
}));

jest.mock('../../utils/logger', () => ({
    logger: {
        captureException: jest.fn(),
    },
}));

// Mock fetch
global.fetch = jest.fn();

describe('AppNotificationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should get active notifications filtered by announcement kind', async () => {
        const mockFeed = {
            items: [
                {
                    id: '1',
                    kind: 'announcement',
                    title: 'Title 1',
                    body: 'Message 1',
                    uiType: 'toast',
                    displayMode: 'once',
                    priority: 1,
                    engagement: { reactionCount: 1, userReacted: false },
                    createdAt: new Date().toISOString()
                },
                {
                    id: '2',
                    kind: 'other',
                    title: 'Title 2',
                }
            ]
        };
        (BroadcastFeedService.getFeed as jest.Mock).mockResolvedValue(mockFeed);

        const notifications = await AppNotificationService.getActiveNotifications();
        expect(notifications).toHaveLength(1);
        expect(notifications[0].id).toBe('1');
        expect(notifications[0].title).toBe('Title 1');
    });

    it('should mark a notification as seen and log to backend', async () => {
        (configService.get as jest.Mock).mockResolvedValue('[]');
        await AppNotificationService.markAsSeen('test-id');

        expect(configService.set).toHaveBeenCalledWith('seen_notifications', JSON.stringify(['test-id']));
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/notifications/log'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ id: 'test-id', action: 'seen' })
            })
        );
    });

    it('should correctly identity if a notification has been seen', async () => {
        (configService.get as jest.Mock).mockResolvedValue('["seen-1", "seen-2"]');

        expect(await AppNotificationService.isSeen('seen-1')).toBe(true);
        expect(await AppNotificationService.isSeen('not-seen')).toBe(false);
    });

    it('should register a push token with metadata', async () => {
        await AppNotificationService.registerPushToken('token-123', { platform: 'ios' });

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/notifications/register-token'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ pushToken: 'token-123', platform: 'ios' })
            })
        );
    });

    it('should unregister push token', async () => {
        await AppNotificationService.unregisterPushToken();

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/notifications/register-token'),
            expect.objectContaining({
                method: 'DELETE',
            })
        );
    });

    it('should toggle notification reaction', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({ action: 'added' }),
        });

        const result = await AppNotificationService.toggleReaction('notif-1');
        expect(result).toBe('added');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/notifications/react'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ notificationId: 'notif-1' })
            })
        );
    });

    it('should return error on reaction failure', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false
        });

        const result = await AppNotificationService.toggleReaction('notif-1');
        expect(result).toBe('error');
    });
});
