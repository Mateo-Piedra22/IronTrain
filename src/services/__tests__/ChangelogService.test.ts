import { ChangelogService } from '../ChangelogService';

jest.mock('../BroadcastFeedService', () => ({
  BroadcastFeedService: {
    getFeed: jest.fn().mockResolvedValue({
      items: [
        {
          id: '1',
          kind: 'changelog',
          title: 'Version 1.0.0',
          body: '- Initial release\n- Bug fixes',
          targeting: { version: '1.0.0' },
          createdAt: '2026-03-20T12:00:00Z',
          lifecycle: { isActive: true },
          engagement: { reactionCount: 0, userReacted: false }
        }
      ]
    })
  }
}));

describe('ChangelogService', () => {
  it('should load releases from generated changelog json', async () => {
    const releases = await ChangelogService.getReleases();
    expect(Array.isArray(releases)).toBe(true);
    expect(releases.length).toBeGreaterThan(0);
    expect(typeof releases[0].version).toBe('string');
    expect(Array.isArray(releases[0].items)).toBe(true);
  });
});
