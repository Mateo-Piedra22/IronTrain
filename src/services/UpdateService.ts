import Constants from 'expo-constants';

type UpdateFeed = {
    latest?: {
        version: string;
        date?: string | null;
        downloadUrl?: string;
        notesUrl?: string;
        minSupportedVersion?: string;
    };
    downloadsPageUrl?: string;
};

export type UpdateCheckResult =
    | { status: 'disabled' }
    | { status: 'error'; message: string }
    | { status: 'up_to_date'; installedVersion: string }
    | {
        status: 'update_available';
        installedVersion: string;
        latestVersion: string;
        date: string | null;
        downloadUrl: string | null;
        notesUrl: string | null;
        downloadsPageUrl: string | null;
    };

function semverKey(version: string): { major: number; minor: number; patch: number } | null {
    const m = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function compareSemver(a: string, b: string): number {
    const ka = semverKey(a);
    const kb = semverKey(b);
    if (!ka || !kb) return 0;
    if (ka.major !== kb.major) return ka.major - kb.major;
    if (ka.minor !== kb.minor) return ka.minor - kb.minor;
    return ka.patch - kb.patch;
}

function safeString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    return v.length > 0 ? v : null;
}

export class UpdateService {
    static getFeedUrl(): string | null {
        const url = (Constants.expoConfig as any)?.extra?.updateFeedUrl;
        return safeString(url);
    }

    static async checkForUpdate(): Promise<UpdateCheckResult> {
        const feedUrl = this.getFeedUrl();
        if (!feedUrl) return { status: 'disabled' };

        const installedVersion = String((Constants.expoConfig as any)?.version ?? '0.0.0');

        try {
            const res = await fetch(feedUrl, { method: 'GET' });
            if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
            const data = (await res.json()) as UpdateFeed;

            const latest = data?.latest;
            const latestVersion = safeString(latest?.version);
            if (!latestVersion) return { status: 'error', message: 'Feed inválido' };

            if (compareSemver(latestVersion, installedVersion) <= 0) {
                return { status: 'up_to_date', installedVersion };
            }

            return {
                status: 'update_available',
                installedVersion,
                latestVersion,
                date: safeString(latest?.date) ?? null,
                downloadUrl: safeString(latest?.downloadUrl),
                notesUrl: safeString(latest?.notesUrl),
                downloadsPageUrl: safeString(data?.downloadsPageUrl),
            };
        } catch (e) {
            return { status: 'error', message: (e as any)?.message ? String((e as any).message) : 'Error de red' };
        }
    }
}

