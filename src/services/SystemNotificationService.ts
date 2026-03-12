import notifee, {
    AndroidCategory,
    AndroidImportance,
    AndroidVisibility,
    TimestampTrigger,
    TriggerType
} from '@notifee/react-native';
import { Colors } from '../theme';
import { logger } from '../utils/logger';
import { configService, NotificationPreferences } from './ConfigService';
import { notificationPermissionsService } from './NotificationPermissionsService';

// ─── Channel IDs ─────────────────────────────────────────────────────────────
const CHANNELS = {
    WORKOUT_ACTIVE: 'workout-active',
    WORKOUT_EVENTS: 'workout-events',
    REMINDERS: 'reminders',
    REST_TIMER: 'rest-timer',
    INTERVAL_TIMER: 'itimer-channel',
    UPDATES: 'updates',
    STREAK: 'streak-reminders',
} as const;

// ─── Notification IDs ────────────────────────────────────────────────────────
const NOTIFICATION_IDS = {
    PERSISTENT_WORKOUT: 'persistent-workout-timer',
    INACTIVITY_REMINDER: 'inactivity-reminder',
    CONGRATULATION: 'workout-congratulation',
    REST_TIMER: 'rest-timer-system',
    INTERVAL_TIMER: 'itimer-id',
    UPDATE_AVAILABLE: 'update-available',
    APP_UPDATED: 'app-updated',
    STREAK_REMINDER: 'streak-daily-reminder',
} as const;

/** Hour of day (0-23) at which to fire the daily streak reminder */
const STREAK_REMINDER_HOUR = 20; // 8 PM

// ─── Inactivity timeout (2.5 hours) ─────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 2.5 * 60 * 60 * 1000;

/**
 * Manages all OS-level (system) notifications for IronTrain.
 *
 * Notifications:
 * 1. Persistent Workout — Ongoing while workout is active
 * 2. Inactivity Reminder — Fires after 2.5h of no interaction
 * 3. Congratulation — On workout completion
 * 4. Rest Timer — When rest timer finishes (complement timerStore)
 * 5. Interval Timer — Persistent while interval timer runs
 * 6. Update Available — When a new version is detected
 * 7. App Updated — On first launch after version change
 *
 * All gated by `systemNotificationsEnabled` master toggle + individual pref + OS permission.
 */
class SystemNotificationServiceImpl {
    private channelsCreated = false;

    // ─── Channel Setup ───────────────────────────────────────────────────────
    async ensureChannels(): Promise<void> {
        if (this.channelsCreated) return;
        try {
            await notifee.createChannel({
                id: CHANNELS.WORKOUT_ACTIVE,
                name: 'Entrenamiento Activo',
                description: 'Notificación persistente durante el entrenamiento',
                importance: AndroidImportance.HIGH,
                visibility: AndroidVisibility.PUBLIC,
            });
            await notifee.createChannel({
                id: CHANNELS.WORKOUT_EVENTS,
                name: 'Eventos de Entrenamiento',
                description: 'Felicitaciones y resumen al completar',
                importance: AndroidImportance.HIGH,
                sound: 'default',
            });
            await notifee.createChannel({
                id: CHANNELS.REMINDERS,
                name: 'Recordatorios',
                description: 'Recordatorios por inactividad prolongada',
                importance: AndroidImportance.DEFAULT,
                sound: 'default',
            });
            await notifee.createChannel({
                id: CHANNELS.REST_TIMER,
                name: 'Temporizador de Descanso',
                description: 'Alerta al finalizar el descanso entre series',
                importance: AndroidImportance.HIGH,
                sound: 'default',
            });
            await notifee.createChannel({
                id: CHANNELS.INTERVAL_TIMER,
                name: 'Modo Intervalos',
                description: 'Progreso y alertas durante entrenamiento por intervalos',
                importance: AndroidImportance.HIGH,
                visibility: AndroidVisibility.PUBLIC,
                sound: 'default', // Crucial for phase changes
            });

            // iOS Categories
            await notifee.setNotificationCategories([
                { id: 'workout-persistent', actions: [] },
                { id: 'rest-timer', actions: [] },
                { id: 'interval-timer', actions: [] },
                { id: 'streak-reminder', actions: [] },
            ]);
            await notifee.createChannel({
                id: CHANNELS.UPDATES,
                name: 'Actualizaciones',
                description: 'Notificaciones sobre nuevas versiones',
                importance: AndroidImportance.DEFAULT,
                sound: 'default',
            });
            await notifee.createChannel({
                id: CHANNELS.STREAK,
                name: 'Recordatorios de Racha',
                description: 'Recordatorio diario para mantener tu racha',
                importance: AndroidImportance.HIGH,
                sound: 'default',
            });
            this.channelsCreated = true;
        } catch (e) {
            logger.captureException(e, { scope: 'SystemNotificationService.ensureChannels', message: 'Failed to create notification channels' });
        }
    }

    // ─── Permission & Config Gates ───────────────────────────────────────────
    private async canNotify(): Promise<boolean> {
        try {
            if (!configService.get('systemNotificationsEnabled')) return false;
            const prefs = this.getPrefs();
            if (!prefs.system.enabled) return false;
            return await notificationPermissionsService.checkPermission();
        } catch (e) {
            logger.captureException(e, { scope: 'SystemNotificationService.canNotify', message: 'Failed to check notification gates' });
            return false;
        }
    }

    private async canNotifyType(type: keyof NotificationPreferences['system']): Promise<boolean> {
        try {
            if (type === 'enabled') return await this.canNotify();
            if (!(await this.canNotify())) return false;
            const prefs = this.getPrefs();
            return prefs.system[type] ?? true;
        } catch (e) {
            logger.captureException(e, { scope: 'SystemNotificationService.canNotifyType', message: 'Failed to check notification gates for type' });
            return false;
        }
    }

    private getPrefs(): NotificationPreferences {
        return configService.get('notificationPreferences');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. PERSISTENT WORKOUT NOTIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    async showPersistentWorkout(params: {
        elapsedSeconds: number;
        completedSets: number;
        totalExercises: number;
        isPaused: boolean;
    }, force = false): Promise<void> {
        if (!force && !(await this.canNotifyType('workoutPersistent'))) return;
        await this.ensureChannels();

        const { elapsedSeconds, completedSets, totalExercises, isPaused } = params;
        const timeStr = this.formatDuration(elapsedSeconds);
        const statusEmoji = isPaused ? '⏸️' : '💪';

        try {
            await notifee.displayNotification({
                id: NOTIFICATION_IDS.PERSISTENT_WORKOUT,
                title: `${statusEmoji} Entrenamiento ${isPaused ? 'Pausado' : 'Activo'}`,
                body: `⏱ ${timeStr}  ·  ${completedSets} series  ·  ${totalExercises} ejercicios`,
                android: {
                    channelId: CHANNELS.WORKOUT_ACTIVE,
                    asForegroundService: true,
                    foregroundServiceTypes: [1], // DATA_SYNC = 1
                    category: AndroidCategory.PROGRESS,
                    pressAction: { id: 'default' },
                    timestamp: Date.now() - elapsedSeconds * 1000,
                    showTimestamp: true,
                    chronometerDirection: 'up',
                    showChronometer: !isPaused,
                    onlyAlertOnce: true,
                },
                ios: {
                    categoryId: 'workout-active',
                    foregroundPresentationOptions: {
                        badge: true,
                        sound: false,
                        banner: true,
                        list: true,
                    }
                },
            });
        } catch (e) {
            logger.captureException(e, { scope: 'SystemNotificationService.showPersistentWorkout', message: 'Error showing persistent workout notification' });
        }
    }

    async dismissPersistentWorkout(): Promise<void> {
        try { await notifee.cancelNotification(NOTIFICATION_IDS.PERSISTENT_WORKOUT); } catch { /* */ }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. INACTIVITY REMINDER
    // ═══════════════════════════════════════════════════════════════════════════

    async scheduleInactivityReminder(elapsedSeconds: number, force = false): Promise<void> {
        if (!force && !(await this.canNotifyType('inactivityReminder'))) return;
        await this.ensureChannels();
        await this.cancelInactivityReminder();

        const triggerTimestamp = Date.now() + INACTIVITY_TIMEOUT_MS;
        const hours = Math.floor(elapsedSeconds / 3600);
        const mins = Math.floor((elapsedSeconds % 3600) / 60);
        const timeStr = hours > 0 ? `${hours}h ${mins}min` : `${mins} minutos`;

        try {
            const trigger: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: triggerTimestamp };
            await notifee.createTriggerNotification({
                id: NOTIFICATION_IDS.INACTIVITY_REMINDER,
                title: '🏋️ ¿Sigues entrenando?',
                body: `Tu entrenamiento lleva ${timeStr}. ¿Todo bien?`,
                android: { channelId: CHANNELS.REMINDERS, pressAction: { id: 'default' }, autoCancel: true },
                ios: { sound: 'default' },
            }, trigger);
        } catch { /* non-critical */ }
    }

    async cancelInactivityReminder(): Promise<void> {
        try { await notifee.cancelNotification(NOTIFICATION_IDS.INACTIVITY_REMINDER); } catch { /* */ }
    }

    recordInteraction(): void {
        // Reschedule inactivity reminder is handled by caller
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. CONGRATULATION NOTIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    async showCongratulation(params: {
        durationSeconds: number;
        completedSets: number;
        totalExercises: number;
    }, force = false): Promise<void> {
        if (!force && !(await this.canNotifyType('workoutComplete'))) return;
        await this.ensureChannels();

        const { durationSeconds, completedSets, totalExercises } = params;
        const timeStr = this.formatDuration(durationSeconds);

        try {
            await notifee.displayNotification({
                id: NOTIFICATION_IDS.CONGRATULATION,
                title: '🎉 ¡Entrenamiento Completado!',
                body: `Duración: ${timeStr}  ·  ${completedSets} series  ·  ${totalExercises} ejercicios`,
                android: {
                    channelId: CHANNELS.WORKOUT_EVENTS,
                    pressAction: { id: 'default' },
                    autoCancel: true,
                    importance: AndroidImportance.HIGH,
                },
                ios: { sound: 'default' },
            });
        } catch { /* non-critical */ }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. REST TIMER NOTIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    async scheduleRestTimerNotification(endAtMs: number, force = false): Promise<void> {
        if (!force && !(await this.canNotifyType('restTimer'))) return;
        await this.ensureChannels();

        try {
            const trigger: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: endAtMs };
            await notifee.createTriggerNotification({
                id: NOTIFICATION_IDS.REST_TIMER,
                title: '⏰ ¡Descanso Terminado!',
                body: 'Es hora de tu próxima serie. ¡Vamos!',
                android: {
                    channelId: CHANNELS.REST_TIMER,
                    pressAction: { id: 'default' },
                    autoCancel: true,
                    importance: AndroidImportance.HIGH,
                },
                ios: { sound: 'default' },
            }, trigger);
        } catch { /* non-critical */ }
    }

    async cancelRestTimerNotification(): Promise<void> {
        try { await notifee.cancelNotification(NOTIFICATION_IDS.REST_TIMER); } catch { /* */ }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. INTERVAL TIMER PERSISTENT NOTIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    async showIntervalTimerNotification(params: {
        phase: string;
        currentRound: number;
        totalRounds: number;
        timeLeft: number;
        isPaused: boolean;
    }, force = false): Promise<void> {
        if (!force && !(await this.canNotifyType('intervalTimer'))) return;
        await this.ensureChannels();
        const { phase, currentRound, totalRounds, timeLeft, isPaused } = params;
        const phaseLabel = phase === 'work' ? '🔴 TRABAJO' : phase === 'rest' ? '🟢 DESCANSO' : (phase === 'prepare' ? '⏳ PREPARACIÓN' : '⏱ TIMER');
        const timeStr = this.formatDuration(timeLeft);
        const statusEmoji = isPaused ? '⏸️' : '💪';

        try {
            await notifee.displayNotification({
                id: NOTIFICATION_IDS.INTERVAL_TIMER,
                title: `${statusEmoji} ${phaseLabel}`,
                body: `Ronda ${currentRound}/${totalRounds}  ·  ${timeStr} restante`,
                android: {
                    channelId: CHANNELS.INTERVAL_TIMER,
                    asForegroundService: true,
                    foregroundServiceTypes: [1], // DATA_SYNC
                    category: AndroidCategory.PROGRESS,
                    autoCancel: false,
                    ongoing: true,
                    color: Colors.primary.DEFAULT,
                    pressAction: { id: 'default' },
                    onlyAlertOnce: true,
                    showChronometer: false,
                    importance: AndroidImportance.HIGH,
                },
                ios: {
                    categoryId: 'interval-timer',
                    foregroundPresentationOptions: {
                        badge: true,
                        sound: true,
                        banner: true,
                        list: true,
                    }
                },
            });
        } catch (e) {
            logger.captureException(e, { scope: 'SystemNotificationService.showIntervalTimerNotification', message: 'Error showing interval timer notification' });
        }
    }

    async dismissIntervalTimerNotification(): Promise<void> {
        try { await notifee.cancelNotification(NOTIFICATION_IDS.INTERVAL_TIMER); } catch { /* */ }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. UPDATE AVAILABLE NOTIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    async showUpdateAvailable(params: {
        latestVersion: string;
        releaseDate?: string | null;
    }, force = false): Promise<void> {
        if (!force && !(await this.canNotifyType('updateAvailable'))) return;
        await this.ensureChannels();

        const { latestVersion, releaseDate } = params;
        const dateStr = releaseDate ? ` · ${releaseDate}` : '';

        try {
            await notifee.displayNotification({
                id: NOTIFICATION_IDS.UPDATE_AVAILABLE,
                title: '🚀 Nueva versión disponible',
                body: `IronTrain v${latestVersion}${dateStr} — Tocá para actualizar`,
                android: {
                    channelId: CHANNELS.UPDATES,
                    pressAction: { id: 'default' },
                    autoCancel: true,
                },
                ios: { sound: 'default' },
            });
        } catch { /* non-critical */ }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. APP UPDATED NOTIFICATION
    // ═══════════════════════════════════════════════════════════════════════════

    async showAppUpdated(params: {
        newVersion: string;
    }, force = false): Promise<void> {
        if (!force && !(await this.canNotifyType('appUpdated'))) return;
        await this.ensureChannels();

        try {
            await notifee.displayNotification({
                id: NOTIFICATION_IDS.APP_UPDATED,
                title: '✅ IronTrain Actualizado',
                body: `Ya estás en la v${params.newVersion}. ¿Qué hay de nuevo? Tocá para ver.`,
                android: {
                    channelId: CHANNELS.UPDATES,
                    pressAction: { id: 'open-changelog' },
                    autoCancel: true,
                },
                ios: { sound: 'default' },
            });
        } catch { /* non-critical */ }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. DAILY STREAK REMINDER
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Schedules a daily notification at STREAK_REMINDER_HOUR (20:00) to remind
     * the user to train and maintain their streak.
     *
     * - If the user has already trained today, the message is congratulatory.
     * - If not, it encourages them to train before the day ends.
     * - Automatically reschedules itself for the next day.
     *
     * @param currentStreak - the user's current streak count
     * @param hasTrainedToday - whether the user has completed a workout today
     */
    async scheduleStreakReminder(currentStreak: number, hasTrainedToday: boolean): Promise<void> {
        if (!(await this.canNotifyType('streakReminder'))) return;
        await this.ensureChannels();
        await this.cancelStreakReminder();

        const now = new Date();
        const target = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            STREAK_REMINDER_HOUR,
            0,
            0
        );

        // If 20:00 today has passed, schedule for tomorrow
        if (target.getTime() <= now.getTime()) {
            target.setDate(target.getDate() + 1);
        }

        let title: string;
        let body: string;

        if (hasTrainedToday) {
            title = '🔥 ¡Racha intacta!';
            body = currentStreak > 1
                ? `Llevas ${currentStreak} días seguidos entrenando. ¡Seguí así!`
                : '¡Genial! Ya entrenaste hoy. Mañana sumás otro día.';
        } else {
            title = '🏋️ ¡No pierdas tu racha!';
            body = currentStreak > 0
                ? `Llevas ${currentStreak} días seguidos. ¡Entrená hoy para no perderla!`
                : '¡Hoy es buen día para empezar una nueva racha!';
        }

        try {
            const trigger: TimestampTrigger = {
                type: TriggerType.TIMESTAMP,
                timestamp: target.getTime(),
            };
            await notifee.createTriggerNotification(
                {
                    id: NOTIFICATION_IDS.STREAK_REMINDER,
                    title,
                    body,
                    android: {
                        channelId: CHANNELS.STREAK,
                        pressAction: { id: 'default' },
                        autoCancel: true,
                    },
                    ios: { sound: 'default' },
                },
                trigger
            );
        } catch { /* non-critical */ }
    }

    async cancelStreakReminder(): Promise<void> {
        try { await notifee.cancelNotification(NOTIFICATION_IDS.STREAK_REMINDER); } catch { /* */ }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. TESTING / DEBUG
    // ═══════════════════════════════════════════════════════════════════════════

    async testOne(type: keyof typeof NOTIFICATION_IDS): Promise<void> {
        await this.ensureChannels();
        switch (type) {
            case 'PERSISTENT_WORKOUT':
                await this.showPersistentWorkout({ elapsedSeconds: 3661, completedSets: 12, totalExercises: 5, isPaused: false }, true);
                break;
            case 'INACTIVITY_REMINDER':
                // For test, trigger in 5 seconds
                const trigger: TimestampTrigger = { type: TriggerType.TIMESTAMP, timestamp: Date.now() + 5000 };
                await notifee.createTriggerNotification({
                    id: NOTIFICATION_IDS.INACTIVITY_REMINDER,
                    title: '🧪 TEST: Inactividad',
                    body: 'Este es un test de recordatorio por inactividad (5s).',
                    android: { channelId: CHANNELS.REMINDERS, pressAction: { id: 'default' }, autoCancel: true },
                }, trigger);
                break;
            case 'CONGRATULATION':
                await this.showCongratulation({ durationSeconds: 3600, completedSets: 20, totalExercises: 8 }, true);
                break;
            case 'REST_TIMER':
                await this.scheduleRestTimerNotification(Date.now() + 3000, true);
                break;
            case 'INTERVAL_TIMER':
                await this.showIntervalTimerNotification({ phase: 'work', currentRound: 1, totalRounds: 8, timeLeft: 20, isPaused: false }, true);
                break;
            case 'UPDATE_AVAILABLE':
                await this.showUpdateAvailable({ latestVersion: '3.0.0-BETA' }, true);
                break;
            case 'APP_UPDATED':
                await this.showAppUpdated({ newVersion: '2.0.0' }, true);
                break;
            case 'STREAK_REMINDER':
                await notifee.displayNotification({
                    title: '🧪 TEST: Racha Diaria',
                    body: '¡Así se vería tu recordatorio de racha!',
                    android: {
                        channelId: CHANNELS.STREAK,
                        pressAction: { id: 'default' },
                    },
                    ios: { categoryId: 'streak-reminder' }
                });
                break;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. CLEANUP
    // ═══════════════════════════════════════════════════════════════════════════

    async cancelAll(): Promise<void> {
        try {
            await notifee.cancelAllNotifications();
        } catch { /* */ }
    }

    // ─── Utility ─────────────────────────────────────────────────────────────
    private formatDuration(totalSeconds: number): string {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
}

export const systemNotificationService = new SystemNotificationServiceImpl();
