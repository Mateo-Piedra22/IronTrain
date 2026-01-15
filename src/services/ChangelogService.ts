import Constants from 'expo-constants';

export type ChangelogRelease = {
    version: string;
    date: string | null;
    unreleased?: boolean;
    items: string[];
};

type ChangelogPayload = {
    generatedAt: string;
    source: string;
    releases: ChangelogRelease[];
};

let cached: ChangelogPayload | null = null;

function load(): ChangelogPayload {
    if (cached) return cached;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const data = require('../changelog.generated.json') as ChangelogPayload;
    cached = data;
    return data;
}

export class ChangelogService {
    private static isUnreleased(r: ChangelogRelease): boolean {
        if (r.unreleased === true) return true;
        const d = r.date;
        return typeof d === 'string' && d.trim().toLowerCase() === 'unreleased';
    }

    static reload(): void {
        cached = null;
    }

    static getAppVersion(): string {
        const v = (Constants.expoConfig as any)?.version;
        return typeof v === 'string' && v.length > 0 ? v : '0.0.0';
    }

    static getAllReleases(): ChangelogRelease[] {
        return load().releases || [];
    }

    static getReleases(options: { includeUnreleased?: boolean } = {}): ChangelogRelease[] {
        const includeUnreleased = options.includeUnreleased === true;
        const all = this.getAllReleases();
        if (includeUnreleased) return all;
        return all.filter((r) => r.date !== null && !this.isUnreleased(r));
    }

    static getLatestRelease(): ChangelogRelease | null {
        const released = this.getReleases();
        return released.length > 0 ? released[0] : null;
    }

    static getInstalledRelease(): ChangelogRelease | null {
        const v = this.getAppVersion();
        return this.getAllReleases().find((r) => String(r.version).trim() === String(v).trim()) ?? null;
    }
}
