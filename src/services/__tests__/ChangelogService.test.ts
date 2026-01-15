import { ChangelogService } from '../ChangelogService';

describe('ChangelogService', () => {
  it('should load releases from generated changelog json', () => {
    const releases = ChangelogService.getReleases();
    expect(Array.isArray(releases)).toBe(true);
    expect(releases.length).toBeGreaterThan(0);
    expect(typeof releases[0].version).toBe('string');
    expect(Array.isArray(releases[0].items)).toBe(true);
  });
});

