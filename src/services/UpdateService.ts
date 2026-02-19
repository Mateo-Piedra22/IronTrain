import { useUpdateStore } from '@/src/store/updateStore';
import Constants from 'expo-constants';
import { AppState, AppStateStatus } from 'react-native';

// --- Types ---
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

// --- UpdateService Class ---
class UpdateServiceManager {
    private static instance: UpdateServiceManager;
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private retryTimeout: ReturnType<typeof setTimeout> | null = null;
    private currentAppState: AppStateStatus = AppState.currentState;
    private isChecking = false; // Prevent concurrent checks
    private retryCount = 0;
    private readonly MAX_RETRIES = 3;
    private readonly POLLING_INTERVAL = 1000 * 60 * 60; // 1 hour

    private constructor() {
        this.setupAppStateListener();
    }

    public static getInstance(): UpdateServiceManager {
        if (!UpdateServiceManager.instance) {
            UpdateServiceManager.instance = new UpdateServiceManager();
        }
        return UpdateServiceManager.instance;
    }

    // --- Public Methods ---

    /**
     * Initializes the update service.
     * Performs an immediate check and sets up periodic checks.
     */
    public async init() {
        const installedVersion = Constants.expoConfig?.version ?? '0.0.0';
        useUpdateStore.getState().setUpdateInfo({ installedVersion });

        // Initial check (immediate)
        await this.checkForUpdate();

        // Setup periodic polling check
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.checkInterval = setInterval(() => {
            if (this.currentAppState === 'active') { // Only check if active
                this.checkForUpdate();
            }
        }, this.POLLING_INTERVAL);
    }

    /**
     * Manually checks for updates. Resets retry count.
     */
    public async checkForUpdate() {
        if (this.isChecking) return;
        this.isChecking = true;
        this.retryCount = 0; // Reset retries on manual/new check

        useUpdateStore.getState().setStatus('checking');
        useUpdateStore.getState().setUpdateInfo({ error: null });

        try {
            await this.performCheck();
            useUpdateStore.getState().setUpdateInfo({ lastChecked: Date.now() });
        } catch (error) {
            // Errors handled inside performCheck (e.g., retries or final failure)
        } finally {
            this.isChecking = false;
        }
    }

    // --- Private Logic ---

    private setupAppStateListener() {
        AppState.addEventListener('change', (nextAppState) => {
            if (
                this.currentAppState.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // App has come to the foreground!
                console.log('App resumed: checking for updates...');
                // Small delay to ensure network is ready after suspend
                setTimeout(() => this.checkForUpdate(), 2000);
            }
            this.currentAppState = nextAppState;
        });
    }

    private async performCheck() {
        const feedUrl = (Constants.expoConfig?.extra as any)?.updateFeedUrl;
        if (!feedUrl) {
            console.warn('UpdateService: No updateFeedUrl configured.');
            useUpdateStore.getState().setStatus('idle'); // Or 'disabled'
            return;
        }

        try {
            const url = new URL(feedUrl);
            // Bust cache aggressively
            url.searchParams.append('t', Date.now().toString());

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = (await res.json()) as UpdateFeed;
            this.processFeed(data);

        } catch (e) {
            const errorMsg = (e as any)?.message ? String((e as any).message) : 'Network error';
            console.error(`Update check failed (Attempt ${this.retryCount + 1}/${this.MAX_RETRIES}):`, errorMsg);

            if (this.retryCount < this.MAX_RETRIES) {
                this.retryCount++;
                const backoff = Math.pow(2, this.retryCount) * 1000; // 2s, 4s, 8s...
                if (this.retryTimeout) clearTimeout(this.retryTimeout);
                this.retryTimeout = setTimeout(() => {
                    if (this.currentAppState === 'active') {
                        this.performCheck(); // Retry
                    } else {
                        this.isChecking = false; // Stop checking if backgrounded
                    }
                }, backoff);
            } else {
                useUpdateStore.getState().setStatus('error'); // Final failure state
                useUpdateStore.getState().setUpdateInfo({ error: errorMsg });
                // Don't set isChecking=false here, let the caller handle finally
            }
            // Rethrow to signal failure to caller if needed, but we handle state internally
            throw e;
        }
    }

    private processFeed(data: UpdateFeed) {
        const installedVersion = useUpdateStore.getState().installedVersion || '0.0.0';
        const latest = data?.latest;

        if (!latest || !latest.version) {
            throw new Error('Invalid feed format: missing version');
        }

        const remoteVersion = this.cleanVersion(latest.version);
        const minSupported = latest.minSupportedVersion ? this.cleanVersion(latest.minSupportedVersion) : null;
        const downloadUrl = latest.downloadUrl || null;
        const notesUrl = latest.notesUrl || null;
        const releaseDate = latest.date || null;
        const downloadsPageUrl = data.downloadsPageUrl || null;

        // Check strict blocking update first
        if (minSupported && this.compareVersions(installedVersion, minSupported) < 0) {
            useUpdateStore.getState().setUpdateInfo({
                latestVersion: remoteVersion,
                minSupportedVersion: minSupported,
                downloadUrl,
                notesUrl,
                releaseDate
            });
            useUpdateStore.getState().setStatus('deprecated'); // BLOCKING STATE
            return;
        }

        // Check regular update
        if (this.compareVersions(installedVersion, remoteVersion) < 0) {
            useUpdateStore.getState().setUpdateInfo({
                latestVersion: remoteVersion,
                minSupportedVersion: minSupported,
                downloadUrl,
                notesUrl,
                releaseDate
            });

            if (downloadUrl) {
                useUpdateStore.getState().setStatus('update_available');
            } else {
                useUpdateStore.getState().setStatus('update_pending'); // No direct APK yet
            }
        } else {
            useUpdateStore.getState().setStatus('up_to_date');
            useUpdateStore.getState().setUpdateInfo({
                latestVersion: remoteVersion,
                releaseDate
            });
        }
    }

    // --- Helper: Robust Version Comparison ---
    // Returns:
    // -1 if a < b
    //  0 if a == b
    //  1 if a > b
    private compareVersions(a: string, b: string): number {
        const pa = this.parseVersion(a);
        const pb = this.parseVersion(b);

        for (let i = 0; i < 3; i++) {
            if (pa[i] > pb[i]) return 1;
            if (pa[i] < pb[i]) return -1;
        }
        return 0;
    }

    private parseVersion(v: string): [number, number, number] {
        // Remove 'v' prefix and keep only numbers and dots until a non-numeric/dot char
        // e.g. "v1.3.4-beta" -> "1.3.4"
        const cleaned = v.replace(/^v/i, '').split('-')[0];
        const parts = cleaned.split('.').map(n => parseInt(n, 10));

        // Ensure we have at least 3 parts, pad with 0
        while (parts.length < 3) parts.push(0);

        // If any part is NaN, treat as 0 (fallback for malformed)
        return [
            isNaN(parts[0]) ? 0 : parts[0],
            isNaN(parts[1]) ? 0 : parts[1],
            isNaN(parts[2]) ? 0 : parts[2]
        ];
    }

    private cleanVersion(v: string): string {
        return v.trim();
    }
}

export const updateService = UpdateServiceManager.getInstance();
