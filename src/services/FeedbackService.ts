import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
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

/**
 * Centralized feedback service for haptic and sound effects.
 * All feedback is gated by user preferences (hapticFeedbackEnabled, soundFeedbackEnabled).
 * Sound assets are lazy-loaded and cached for performance.
 */
class FeedbackServiceImpl {
    private soundCache: Map<SoundKey, Audio.Sound> = new Map();
    private audioConfigured = false;

    // ─── Audio Configuration ──────────────────────────────────────────────────
    private async ensureAudioConfig(): Promise<void> {
        if (this.audioConfigured) return;
        try {
            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
            });
            this.audioConfigured = true;
        } catch {
            // Audio config failure is non-critical; sounds will simply not play
        }
    }

    // ─── Sound Playback ───────────────────────────────────────────────────────
    private async playSound(soundKey: SoundKey): Promise<void> {
        if (!configService.get('soundFeedbackEnabled')) return;

        await this.ensureAudioConfig();

        try {
            const cached = this.soundCache.get(soundKey);
            if (cached) {
                try {
                    const status = await cached.getStatusAsync();
                    if (status.isLoaded) {
                        await cached.setPositionAsync(0);
                        await cached.playAsync();
                        return;
                    }
                } catch {
                    this.soundCache.delete(soundKey);
                }
            }

            const source = SOUND_SOURCES[soundKey];
            const volume = SOUND_VOLUMES[soundKey];

            const { sound } = await Audio.Sound.createAsync(
                source,
                { volume, shouldPlay: true }
            );
            this.soundCache.set(soundKey, sound);
        } catch {
            // Sound playback is non-critical; never crash the app for audio failure
        }
    }

    // ─── Haptic Feedback ──────────────────────────────────────────────────────
    private async haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'): Promise<void> {
        if (!configService.get('hapticFeedbackEnabled')) return;

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
        this.playSound('countdown_tick');
    }

    /** Success haptic + sound when interval timer phase changes */
    async phaseChange(nextPhase: 'work' | 'rest'): Promise<void> {
        if (nextPhase === 'work') {
            await this.haptic('success');
            this.playSound('phase_work');
        } else {
            await this.haptic('medium');
            this.playSound('phase_rest');
        }
    }

    /** Major success haptic + victory sound for workout/interval timer completion */
    async workoutFinished(): Promise<void> {
        await this.haptic('success');
        this.playSound('workout_complete');
    }

    /** Timer/rest timer completion feedback */
    async timerComplete(): Promise<void> {
        await this.haptic('success');
        this.playSound('timer_complete');
    }

    /** Rest timer expired feedback (matches timerStore behavior) */
    async restTimerExpired(): Promise<void> {
        await this.haptic('warning');
        this.playSound('timer_complete');
    }

    /** Day completed feedback */
    async dayCompleted(): Promise<void> {
        await this.haptic('success');
        this.playSound('workout_complete');
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
        for (const [, sound] of this.soundCache) {
            try {
                await sound.unloadAsync();
            } catch {
                // Ignore cleanup errors
            }
        }
        this.soundCache.clear();
    }
}

export const feedbackService = new FeedbackServiceImpl();
