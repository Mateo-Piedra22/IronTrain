import { AudioPlayer, createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';
import { configService } from './ConfigService';

// Pre-loaded require calls (evaluated at bundle time, not runtime)
const SOUND_SOURCES = {
    timer_complete: require('../../assets/sounds/timer_complete.mp3'),
    countdown_tick: require('../../assets/sounds/countdown_tick.mp3'),
    workout_complete: require('../../assets/sounds/workout_complete.mp3'),
    phase_work: require('../../assets/sounds/phase_work.mp3'),
    phase_rest: require('../../assets/sounds/phase_rest.mp3'),
} as const;

type SoundKey = keyof typeof SOUND_SOURCES;

const SOUND_VOLUMES: Record<SoundKey, number> = {
    timer_complete: 0.8,
    countdown_tick: 0.5,
    workout_complete: 1.0,
    phase_work: 0.7,
    phase_rest: 0.6,
};

const SOUND_MIN_INTERVAL_MS: Record<SoundKey, number> = {
    timer_complete: 700,
    countdown_tick: 300,
    workout_complete: 1200,
    phase_work: 700,
    phase_rest: 700,
};

const HAPTIC_MIN_INTERVAL_MS: Record<'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection', number> = {
    light: 120,
    medium: 150,
    heavy: 200,
    success: 350,
    warning: 350,
    error: 350,
    selection: 100,
};

/**
 * Centralized feedback service for haptic and sound effects.
 * All feedback is gated by user preferences (hapticFeedbackEnabled, soundFeedbackEnabled).
 * Sound assets are lazy-loaded and cached for performance.
 */
class FeedbackServiceImpl {
    private soundCache: Map<SoundKey, AudioPlayer> = new Map();
    private audioConfigured = false;
    private lastSoundAt: Partial<Record<SoundKey, number>> = {};
    private lastHapticAt: Partial<Record<'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection', number>> = {};

    // ─── Audio Configuration ──────────────────────────────────────────────────
    private async ensureAudioConfig(): Promise<void> {
        if (this.audioConfigured) return;
        try {
            if (__DEV__ && Platform.OS === 'android') {
                try {
                    await setIsAudioActiveAsync(true);
                } catch (e) {
                    logger.captureException(e, { scope: 'FeedbackService.ensureAudioConfig', message: 'setIsAudioActiveAsync(true) failed' });
                }
            }

            await setAudioModeAsync({
                playsInSilentMode: true,
                shouldPlayInBackground: false,
                interruptionMode: 'mixWithOthers',
            });
            this.audioConfigured = true;
        } catch {
            // Audio config failure is non-critical; sounds will simply not play
        }
    }

    // ─── Sound Playback ───────────────────────────────────────────────────────
    private async playSound(soundKey: SoundKey): Promise<void> {
        if (!configService.get('soundFeedbackEnabled')) return;

        const now = Date.now();
        const minIntervalMs = SOUND_MIN_INTERVAL_MS[soundKey] ?? 200;
        const previous = this.lastSoundAt[soundKey] ?? 0;
        if (now - previous < minIntervalMs) return;
        this.lastSoundAt[soundKey] = now;

        await this.ensureAudioConfig();

        try {
            const cached = this.soundCache.get(soundKey);
            if (cached) {
                try {
                    await cached.seekTo(0);
                    cached.play();
                    return;
                } catch {
                    this.soundCache.delete(soundKey);
                }
            }

            const source = SOUND_SOURCES[soundKey];
            const volume = SOUND_VOLUMES[soundKey];

            const player = createAudioPlayer(source, {
                keepAudioSessionActive: false,
            });
            player.volume = volume;
            player.loop = false;
            player.play();
            this.soundCache.set(soundKey, player);
        } catch {
            // Sound playback is non-critical; never crash the app for audio failure
        }
    }

    // ─── Haptic Feedback ──────────────────────────────────────────────────────
    private async haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'): Promise<void> {
        if (!configService.get('hapticFeedbackEnabled')) return;

        const now = Date.now();
        const minIntervalMs = HAPTIC_MIN_INTERVAL_MS[type] ?? 100;
        const previous = this.lastHapticAt[type] ?? 0;
        if (now - previous < minIntervalMs) return;
        this.lastHapticAt[type] = now;

        try {
            switch (type) {
                case 'light':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    break;
                case 'medium':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    break;
                case 'heavy':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    break;
                case 'success':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    break;
                case 'warning':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    break;
                case 'error':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    break;
                case 'selection':
                    await Haptics.selectionAsync();
                    break;
            }
        } catch {
            // Haptic failure is non-critical (e.g., device doesn't support haptics)
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC API — Context-aware feedback methods
    // ═══════════════════════════════════════════════════════════════════════════

    /** Light haptic for button presses, selections, stepper changes */
    async buttonPress(): Promise<void> {
        await this.haptic('light');
    }

    /** Selection haptic for date picks, list item selections */
    async selection(): Promise<void> {
        await this.haptic('selection');
    }

    /** Heavy haptic + tick sound for countdown (last 3 seconds) */
    async countdown(): Promise<void> {
        await this.haptic('heavy');
        const prefs = configService.get('notificationPreferences');
        if (prefs?.sounds?.countdown) this.playSound('countdown_tick');
    }

    /** Success haptic + sound when interval timer phase changes */
    async phaseChange(nextPhase: 'work' | 'rest'): Promise<void> {
        const prefs = configService.get('notificationPreferences');
        if (nextPhase === 'work') {
            await this.haptic('success');
            if (prefs?.sounds?.intervalTimer) this.playSound('phase_work');
        } else {
            await this.haptic('medium');
            if (prefs?.sounds?.intervalTimer) this.playSound('phase_rest');
        }
    }

    /** Major success haptic + victory sound for workout/interval timer completion */
    async workoutFinished(): Promise<void> {
        await this.haptic('success');
        const prefs = configService.get('notificationPreferences');
        if (prefs?.sounds?.intervalTimer) this.playSound('workout_complete');
    }

    /** Timer/rest timer completion feedback */
    async timerComplete(): Promise<void> {
        await this.haptic('success');
        const prefs = configService.get('notificationPreferences');
        if (prefs?.sounds?.restTimer) this.playSound('timer_complete');
    }

    /** Rest timer expired feedback (matches timerStore behavior) */
    async restTimerExpired(): Promise<void> {
        await this.haptic('warning');
        const prefs = configService.get('notificationPreferences');
        if (prefs?.sounds?.restTimer) this.playSound('timer_complete');
    }

    /** Day completed feedback */
    async dayCompleted(): Promise<void> {
        await this.haptic('success');
        const prefs = configService.get('notificationPreferences');
        if (prefs?.sounds?.workoutComplete) this.playSound('workout_complete');
    }

    /** Set completed / marked as done */
    async setCompleted(): Promise<void> {
        await this.haptic('medium');
    }

    /** Error feedback */
    async errorFeedback(): Promise<void> {
        await this.haptic('error');
    }

    /** Warning feedback */
    async warningFeedback(): Promise<void> {
        await this.haptic('warning');
    }

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    async dispose(): Promise<void> {
        for (const [, player] of this.soundCache) {
            try {
                player.remove();
            } catch {
                // Ignore cleanup errors
            }
        }
        this.soundCache.clear();
        this.audioConfigured = false;
        this.lastSoundAt = {};
        this.lastHapticAt = {};
    }
}

export const feedbackService = new FeedbackServiceImpl();

declare const module: {
    hot?: {
        dispose: (cb: () => void) => void;
    };
};

if (__DEV__ && Platform.OS === 'android' && typeof module !== 'undefined' && module?.hot?.dispose) {
    module.hot.dispose(() => {
        void (async () => {
            try {
                await setIsAudioActiveAsync(false);
            } catch (e) {
                logger.captureException(e, { scope: 'FeedbackService.hmrDispose', message: 'setIsAudioActiveAsync(false) failed' });
            }

            await feedbackService.dispose();
        })().catch((e) => {
            logger.captureException(e, { scope: 'FeedbackService.hmrDispose' });
        });
    });
}
