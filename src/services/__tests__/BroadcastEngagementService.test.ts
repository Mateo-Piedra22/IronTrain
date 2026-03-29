import { useAuthStore } from '../../store/authStore';
import { BroadcastEngagementService } from '../BroadcastEngagementService';

jest.mock('../../constants/Config', () => ({
    Config: {
        API_URL: 'https://api.irontrain.example.com',
    },
}));

jest.mock('../../store/authStore', () => ({
    useAuthStore: {
        getState: jest.fn(),
    },
}));

// Mock global.fetch
beforeEach(() => {
    global.fetch = jest.fn();
});

describe('BroadcastEngagementService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('toggleAnnouncementReaction', () => {
        it('should return error when not authenticated', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: null });

            const result = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');

            expect(result).toBe('error');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should send POST request to react endpoint', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'added' }),
            });

            const result = await BroadcastEngagementService.toggleAnnouncementReaction('notif-123');

            expect(result).toBe('added');
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.irontrain.example.com/api/notifications/react',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-token',
                    },
                    body: JSON.stringify({ notificationId: 'notif-123' }),
                })
            );
        });

        it('should return added when reaction is added', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'added' }),
            });

            const result = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');

            expect(result).toBe('added');
        });

        it('should return removed when reaction is removed', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'removed' }),
            });

            const result = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');

            expect(result).toBe('removed');
        });

        it('should return error when response is not ok', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
            });

            const result = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');

            expect(result).toBe('error');
        });

        it('should return error when response has invalid action', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'invalid' }),
            });

            const result = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');

            expect(result).toBe('error');
        });

        it('should return error when response has no action', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({}),
            });

            const result = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');

            expect(result).toBe('error');
        });

        it('should return error on network error', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            const result = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');

            expect(result).toBe('error');
        });

        it('should return error on JSON parse error', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => {
                    throw new Error('JSON parse error');
                },
            });

            const result = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');

            expect(result).toBe('error');
        });
    });

    describe('toggleChangelogReaction', () => {
        it('should return error when not authenticated', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: null });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('error');
            expect(global.fetch).not.toHaveBeenCalled();
        });

        it('should send POST request to changelog react endpoint', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'added' }),
            });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-123');

            expect(result).toBe('added');
            expect(global.fetch).toHaveBeenCalledWith(
                'https://api.irontrain.example.com/api/changelogs/changelog-123/react',
                expect.objectContaining({
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-token',
                    },
                    body: JSON.stringify({ type: 'kudos' }),
                })
            );
        });

        it('should URL encode changelog ID', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'added' }),
            });

            await BroadcastEngagementService.toggleChangelogReaction('changelog/with/slashes');

            const url = (global.fetch as jest.Mock).mock.calls[0][0];
            expect(url).toContain('changelog%2Fwith%2Fslashes');
        });

        it('should return added when reaction is added', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'added' }),
            });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('added');
        });

        it('should return removed when reaction is removed', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'removed' }),
            });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('removed');
        });

        it('should use status field when action is not present', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'added' }),
            });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('added');
        });

        it('should prefer action over status', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'removed', status: 'added' }),
            });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('removed');
        });

        it('should return error when response is not ok', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('error');
        });

        it('should return error when response has invalid action', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ action: 'invalid' }),
            });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('error');
        });

        it('should return error when response has invalid status', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ status: 'invalid' }),
            });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('error');
        });

        it('should return error on network error', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('error');
        });

        it('should return error on JSON parse error', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: async () => {
                    throw new Error('JSON parse error');
                },
            });

            const result = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(result).toBe('error');
        });
    });

    describe('Integration tests', () => {
        it('should handle multiple sequential reactions', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ action: 'added' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ action: 'removed' }),
                });

            const result1 = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');
            const result2 = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');

            expect(result1).toBe('added');
            expect(result2).toBe('removed');
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });

        it('should handle both announcement and changelog reactions', async () => {
            (useAuthStore.getState as jest.Mock).mockReturnValue({ token: 'test-token' });
            global.fetch = jest.fn()
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ action: 'added' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({ action: 'added' }),
                });

            const announcementResult = await BroadcastEngagementService.toggleAnnouncementReaction('notif-1');
            const changelogResult = await BroadcastEngagementService.toggleChangelogReaction('changelog-1');

            expect(announcementResult).toBe('added');
            expect(changelogResult).toBe('added');
        });
    });
});
