import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useDataReload } from '@/src/hooks/useDataReload';
import { useTheme } from '@/src/hooks/useTheme';
import { backupService } from '@/src/services/BackupService';
import { ChangelogService } from '@/src/services/ChangelogService';
import { AppConfig, configService, NotificationPreferences } from '@/src/services/ConfigService';
import { dbService } from '@/src/services/DatabaseService';
import { NameNormalizationService } from '@/src/services/NameNormalizationService';
import { updateService } from '@/src/services/UpdateService';
import { useUpdateStore } from '@/src/store/updateStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { AlertTriangle, BarChart3, Bell, Calculator, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, CloudLightning, Database, Disc, Download, LogOut, Megaphone, MessageSquare, RefreshCw, Ruler, Shield, Smartphone, Timer, Trash2, User, Vibrate, Volume2, Zap } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { notificationPermissionsService } from '../src/services/NotificationPermissionsService';
import { syncScheduler } from '../src/services/SyncSchedulerService';
import { syncService } from '../src/services/SyncService';
import { useAuthStore } from '../src/store/authStore';
import { confirm } from '../src/store/confirmStore';

export default function SettingsScreen() {
    const auth = useAuthStore();
    const router = useRouter();
    const { themeMode, setThemeMode } = useTheme();
    const colors = useColors();

    const s = useMemo(() => StyleSheet.create({
        backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, elevation: 2, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
        pageTitle: { color: colors.text, fontWeight: '900', fontSize: 24, letterSpacing: -1 },
        pageSub: { color: colors.primary.DEFAULT, fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
        sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28, marginBottom: 10 },
        sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.primary.DEFAULT },
        sectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
        card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden', elevation: 2, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
        cardInnerPadded: { padding: 16 },
        settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
        settingRowBorder: { borderBottomWidth: 1.5, borderBottomColor: colors.border },
        settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 },
        settingIconCircle: { width: 36, height: 36, borderRadius: 12, backgroundColor: withAlpha(colors.primary.DEFAULT, '12'), justifyContent: 'center', alignItems: 'center' },
        settingLabel: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
        settingSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
        roundLabel: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
        stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        stepperBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceLighter, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', elevation: 1 },
        stepperBtnText: { fontSize: 18, fontWeight: '700', color: colors.text, lineHeight: 20 },
        stepperValue: { fontSize: 14, fontWeight: '800', color: colors.text, minWidth: 40, textAlign: 'center' },
        chipGroup: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
        chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surfaceLighter, elevation: 1, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
        chipActive: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT, elevation: 2 },
        chipText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
        chipTextActive: { color: colors.onPrimary },
        dayChip: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceLighter, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', elevation: 1, shadowColor: ThemeFx.shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
        dayChipActive: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT, elevation: 2, shadowColor: colors.primary.DEFAULT, shadowOpacity: 0.25, shadowRadius: 4 },
        dayChipText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
        dayChipTextActive: { color: colors.onPrimary },
        updateBtn: { flex: 1, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center', elevation: 1 },
        updateBtnText: { fontSize: 14, fontWeight: '800', color: colors.text },
        updateBtnPrimary: { flex: 1, backgroundColor: colors.primary.DEFAULT, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 3 },
        updateBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: colors.onPrimary },
        footer: { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 32, marginBottom: 20 },
    }), [colors]);

    const ns = useMemo(() => StyleSheet.create({
        groupRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
        groupLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 },
        groupIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: withAlpha(colors.primary.DEFAULT, '12'), justifyContent: 'center', alignItems: 'center' },
        groupTitle: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
        groupSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
        badge: { backgroundColor: withAlpha(colors.primary.DEFAULT, '18'), borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
        badgeText: { fontSize: 10, fontWeight: '800', color: colors.primary.DEFAULT },
        subGroup: { backgroundColor: colors.surfaceLighter, borderTopWidth: 1.5, borderTopColor: colors.border, paddingLeft: 20 },
        subRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16, gap: 10 },
        subRowBorder: { borderBottomWidth: 1.5, borderBottomColor: colors.border },
        subDot: { width: 7, height: 7, borderRadius: 4 },
        subLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.text },
    }), [colors]);
    const installedVersion = ChangelogService.getAppVersion();
    const [footerDate, setFooterDate] = useState<string | null>(null);
    const [units, setUnits] = useState('kg');
    const [defaultTimer, setDefaultTimer] = useState(90);
    const [autoRestOnComplete, setAutoRestOnComplete] = useState(true);
    const [hapticEnabled, setHapticEnabled] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [systemNotificationsEnabled, setSystemNotificationsEnabled] = useState(true);
    const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
        inApp: { enabled: true, restTimer: true, workoutStatus: true, updates: true, intervalTimer: true, personalRecord: true, social: true, kudos: true },
        system: { enabled: true, restTimer: true, workoutPersistent: true, inactivityReminder: true, workoutComplete: true, intervalTimer: true, updateAvailable: true, appUpdated: true, streakReminder: true, personalRecord: true, social: true, kudos: true },
        sounds: { restTimer: true, intervalTimer: true, workoutComplete: true, countdown: true },
    });
    const [expandedNotifGroup, setExpandedNotifGroup] = useState<string | null>(null);
    const [analyticsRange, setAnalyticsRange] = useState<7 | 30 | 90 | 365>(30);
    const [barKg, setBarKg] = useState(20);
    const [barLbs, setBarLbs] = useState(45);
    const [preferFewerPlates, setPreferFewerPlates] = useState(true);
    const [roundKg, setRoundKg] = useState(2.5);
    const [roundLbs, setRoundLbs] = useState(5);
    const [rmFormula, setRmFormula] = useState<AppConfig['calculatorsDefault1RMFormula']>('epley');
    const [trainingDays, setTrainingDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);

    const updateStatus = useUpdateStore((state) => state.status);
    const installedVersionStr = useUpdateStore((state) => state.installedVersion);
    const latestVersion = useUpdateStore((state) => state.latestVersion);
    const releaseDate = useUpdateStore((state) => state.releaseDate);
    const updateError = useUpdateStore((state) => state.error);
    const downloadUrl = useUpdateStore((state) => state.downloadUrl);
    const notesUrl = useUpdateStore((state) => state.notesUrl);
    const lastChecked = useUpdateStore((state) => state.lastChecked);

    const updateInfo = { installedVersion: installedVersionStr, latestVersion, date: releaseDate, error: updateError, downloadUrl, notesUrl, lastChecked };

    useDataReload(() => {
        loadSettings();
    }, ['SETTINGS_UPDATED']);

    const formatNormalizationPreview = (preview: Awaited<ReturnType<typeof NameNormalizationService.previewTitleCaseNormalization>>): string => {
        const formatSamples = (rows: ReadonlyArray<{ before: string; after: string }>) => {
            if (rows.length === 0) return '';
            return rows
                .slice(0, 4)
                .map((r) => `- "${r.before}" -> "${r.after}"`)
                .join('\n');
        };

        const blocks: string[] = [];
        blocks.push(`Ejercicios: ${preview.exercises.count}`);
        if (preview.exercises.samples.length > 0) blocks.push(`Ejemplos:\n${formatSamples(preview.exercises.samples)}`);
        blocks.push('');

        blocks.push(`Categorías: ${preview.categories.count}`);
        if (preview.categories.samples.length > 0) blocks.push(`Ejemplos:\n${formatSamples(preview.categories.samples)}`);
        blocks.push('');

        blocks.push(`Badges: ${preview.badges.count}`);
        if (preview.badges.samples.length > 0) blocks.push(`Ejemplos:\n${formatSamples(preview.badges.samples)}`);
        blocks.push('');

        blocks.push(`Rutinas: ${preview.routines.count}`);
        if (preview.routines.samples.length > 0) blocks.push(`Ejemplos:\n${formatSamples(preview.routines.samples)}`);
        blocks.push('');

        blocks.push(`Días de rutina: ${preview.routineDays.count}`);
        if (preview.routineDays.samples.length > 0) blocks.push(`Ejemplos:\n${formatSamples(preview.routineDays.samples)}`);

        return blocks.join('\n');
    };

    const handleNormalizeNames = async () => {
        try {
            notify.info('Analizando...', 'Buscando nombres para normalizar.');
            const preview = await NameNormalizationService.previewTitleCaseNormalization(4);

            if (preview.total === 0) {
                notify.success('Listo', 'No hay nombres para normalizar.');
                return;
            }

            confirm.custom({
                title: 'Normalizar nombres (Title Case)',
                message: `Se aplicará Title Case a registros existentes.\n\nTotal de cambios: ${preview.total}\n\n${formatNormalizationPreview(preview)}\n\n¿Querés aplicar esta limpieza ahora?`,
                variant: 'warning',
                buttons: [
                    { label: 'Cancelar', variant: 'ghost', onPress: confirm.hide },
                    {
                        label: 'Aplicar',
                        variant: 'solid',
                        onPress: async () => {
                            confirm.hide();
                            try {
                                notify.info('Aplicando...', 'Actualizando nombres existentes.');
                                await NameNormalizationService.applyTitleCaseNormalization();
                                notify.success('Éxito', 'Normalización completada.');
                            } catch (e: any) {
                                notify.error('Error', e?.message || 'No se pudo completar la normalización.');
                            }
                        }
                    },
                ]
            });
        } catch (e: any) {
            notify.error('Error', e?.message || 'No se pudo preparar la normalización.');
        }
    };

    useEffect(() => { loadSettings(); }, []);

    useEffect(() => {
        const resolveFooterDate = async () => {
            const installedRelease = await ChangelogService.getInstalledRelease();
            const latestRelease = await ChangelogService.getLatestRelease();
            const candidateDate = installedRelease?.date ?? latestRelease?.date ?? null;
            const normalizedDate = typeof candidateDate === 'string' && candidateDate.trim().toLowerCase() === 'unreleased'
                ? null
                : candidateDate;
            setFooterDate(typeof normalizedDate === 'string' ? normalizedDate : null);
        };

        resolveFooterDate();
    }, []);

    const loadSettings = async () => {
        await configService.init();
        setUnits(configService.get('weightUnit'));
        setDefaultTimer(configService.get('defaultRestTimer'));
        setAutoRestOnComplete(configService.get('autoStartRestTimerOnSetComplete'));
        setHapticEnabled(configService.get('hapticFeedbackEnabled'));
        setSoundEnabled(configService.get('soundFeedbackEnabled'));
        setSystemNotificationsEnabled(configService.get('systemNotificationsEnabled'));
        setNotifPrefs(configService.get('notificationPreferences'));
        setAnalyticsRange(configService.get('analyticsDefaultRangeDays'));
        setBarKg(configService.get('plateCalculatorDefaultBarWeightKg'));
        setBarLbs(configService.get('plateCalculatorDefaultBarWeightLbs'));
        setPreferFewerPlates(configService.get('plateCalculatorPreferFewerPlates'));
        setRoundKg(configService.get('calculatorsRoundingKg'));
        setRoundLbs(configService.get('calculatorsRoundingLbs'));
        setRmFormula(configService.get('calculatorsDefault1RMFormula'));

        const rawDays = await configService.get('training_days');
        setTrainingDays(Array.isArray(rawDays) ? rawDays : [1, 2, 3, 4, 5, 6]);
    };

    const checkUpdates = async () => { await updateService.checkForUpdate(); };

    const saveSetting = async <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
        await configService.set(key, value);
        if (key === 'weightUnit') setUnits(value as any);
        if (key === 'defaultRestTimer') setDefaultTimer(value as any);
        if (key === 'autoStartRestTimerOnSetComplete') setAutoRestOnComplete(value as any);
        if (key === 'hapticFeedbackEnabled') setHapticEnabled(value as any);
        if (key === 'soundFeedbackEnabled') setSoundEnabled(value as any);
        if (key === 'systemNotificationsEnabled') setSystemNotificationsEnabled(value as any);
        if (key === 'notificationPreferences') setNotifPrefs(value as any);
        if (key === 'analyticsDefaultRangeDays') setAnalyticsRange(value as any);
        if (key === 'plateCalculatorDefaultBarWeightKg') setBarKg(value as any);
        if (key === 'plateCalculatorDefaultBarWeightLbs') setBarLbs(value as any);
        if (key === 'plateCalculatorPreferFewerPlates') setPreferFewerPlates(value as any);
        if (key === 'calculatorsRoundingKg') setRoundKg(value as any);
        if (key === 'calculatorsRoundingLbs') setRoundLbs(value as any);
        if (key === 'calculatorsDefault1RMFormula') setRmFormula(value as any);
        if (key === 'training_days') {
            const newDays = value as number[];
            setTrainingDays(newDays);
            const { useSettingsStore } = await import('../src/store/useSettingsStore');
            await useSettingsStore.getState().setTrainingDays(newDays);
        }
    };

    const handleBackup = async () => {
        try {
            const result = await backupService.exportData();
            if (result.shared) { notify.success('Copia de seguridad', 'El backup ha sido exportado.'); }
            else { notify.info('Backup local', 'El archivo fue creado pero no se guardó/compartió externamente.'); }
        } catch (e: any) { notify.error('Error al exportar', e?.message || 'No se pudo crear el archivo de respaldo.'); }
    };

    const handleDownloadBackup = async () => {
        try {
            await backupService.downloadData();
            notify.success('Backup descargado', 'El archivo JSON fue guardado correctamente.');
        } catch (e: any) {
            notify.error('Error al descargar', e?.message || 'No se pudo descargar el backup.');
        }
    };

    const handleCloudSnapshot = async () => {
        try {
            notify.info('Verificando estado...', 'Comprobando registros en la nube y en el dispositivo.');

            confirm.custom({
                title: 'Verificando estado...',
                message: 'Consultando registros locales y en la nube.',
                variant: 'info',
                buttons: [
                    {
                        label: 'Cancelar',
                        variant: 'ghost',
                        onPress: confirm.hide,
                    },
                ],
            });

            const token = useAuthStore.getState().token;
            if (!token) {
                confirm.hide();
                notify.error('Sync no disponible', 'Iniciá sesión para usar la sincronización.');
                return;
            }

            const getDiag = async () => {
                return await Promise.race([
                    syncService.getDiagnostics(),
                    new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error('Tiempo de espera agotado')), 15000);
                    }),
                ]);
            };

            const diag = await getDiag();
            const { local, remote, queue } = diag;

            confirm.hide();

            const contextLine = local.hasData && remote.hasData
                ? 'Tenes datos en ambas partes.'
                : (local.hasData && !remote.hasData)
                    ? 'La nube parece vacía.'
                    : (!local.hasData && remote.hasData)
                        ? 'Este dispositivo parece vacío.'
                        : 'No hay datos detectados en ninguna parte.';

            const formatMergedDetail = () => {
                const order = [
                    'categories', 'exercises', 'badges', 'exercise_badges',
                    'routines', 'routine_days', 'routine_exercises',
                    'workouts', 'workout_sets', 'user_exercise_prs',
                    'measurements', 'goals', 'body_metrics',
                    'plate_inventory', 'settings', 'user_profiles',
                    'score_events', 'kudos', 'activity_feed', 'changelog_reactions'
                ];
                const labels: Record<string, string> = {
                    categories: 'Categorías',
                    exercises: 'Ejercicios',
                    badges: 'Equipamiento',
                    exercise_badges: 'Posición / Equipo',
                    routines: 'Rutinas',
                    routine_days: 'Días de Rutina',
                    routine_exercises: 'Ejercicios en Rutina',
                    workouts: 'Entrenamientos',
                    workout_sets: 'Series',
                    user_exercise_prs: 'Récords Personales',
                    measurements: 'Mediciones',
                    goals: 'Objetivos',
                    body_metrics: 'Métricas Corporales',
                    plate_inventory: 'Inventario de Discos',
                    settings: 'Ajustes',
                    user_profiles: 'Perfiles',
                    score_events: 'Eventos de Puntos',
                    kudos: 'Kudos/Likes',
                    activity_feed: 'Muro Social',
                    changelog_reactions: 'Reacciones'
                };

                const lines: string[] = [];
                for (const k of order) {
                    const l = Number(local.counts?.[k]?.active || 0);
                    const r = Number(remote.counts?.[k]?.active || 0);
                    if (l === 0 && r === 0) continue;
                    lines.push(`**${labels[k] || k}**: Cel ${l} vs Nube ${r}`);
                }
                return lines.length > 0 ? `\n\n**Comparativa por tabla (activos):**\n${lines.join('\n')}` : '';
            };

            const openConflictModal = (nextDiag: typeof diag) => {
                const { local, remote, queue } = nextDiag;

                const contextLine = local.hasData && remote.hasData
                    ? 'Tenes datos en ambas partes.'
                    : (local.hasData && !remote.hasData)
                        ? 'La nube parece vacía.'
                        : (!local.hasData && remote.hasData)
                            ? 'Este dispositivo parece vacío.'
                            : 'No hay datos detectados en ninguna parte.';

                const formatMergedDetail = () => {
                    const order = [
                        'categories', 'exercises', 'badges', 'exercise_badges',
                        'routines', 'routine_days', 'routine_exercises',
                        'workouts', 'workout_sets', 'user_exercise_prs',
                        'measurements', 'goals', 'body_metrics',
                        'plate_inventory', 'settings', 'user_profiles',
                        'score_events', 'kudos', 'activity_feed', 'changelog_reactions'
                    ];
                    const labels: Record<string, string> = {
                        categories: 'Categorías',
                        exercises: 'Ejercicios',
                        badges: 'Equipamiento',
                        exercise_badges: 'Posición / Equipo',
                        routines: 'Rutinas',
                        routine_days: 'Días de Rutina',
                        routine_exercises: 'Ejercicios en Rutina',
                        workouts: 'Entrenamientos',
                        workout_sets: 'Series',
                        user_exercise_prs: 'Récords Personales',
                        measurements: 'Mediciones',
                        goals: 'Objetivos',
                        body_metrics: 'Métricas Corporales',
                        plate_inventory: 'Inventario de Discos',
                        settings: 'Ajustes',
                        user_profiles: 'Perfiles',
                        score_events: 'Eventos de Puntos',
                        kudos: 'Kudos/Likes',
                        activity_feed: 'Muro Social',
                        changelog_reactions: 'Reacciones'
                    };

                    const lines: string[] = [];
                    for (const k of order) {
                        const l = Number(local.counts?.[k]?.active || 0);
                        const r = Number(remote.counts?.[k]?.active || 0);
                        if (l === 0 && r === 0) continue;
                        lines.push(`**${labels[k] || k}**: Cel ${l} vs Nube ${r}`);
                    }
                    return lines.length > 0 ? `\n\n**Comparativa por tabla (activos):**\n${lines.join('\n')}` : '';
                };

                confirm.custom({
                    title: 'Resolución de Conflictos',
                    message: `${contextLine}\n\n**Resumen Global:**\n**Celular**: ${Number(local.recordCount)} registros\n**Nube Neon**: ${Number(remote.recordCount)} registros${formatMergedDetail()}\n\n**Estado de la Cola de Sync:**\n**Pendientes**: ${queue.pending}\n**Fallidos**: ${queue.failed}\n**Procesando**: ${queue.processing}\n**Total**: ${queue.totalOutstanding}\n\n¿Qué querés hacer?`,
                    variant: 'warning',
                    buttons: [
                        {
                            label: 'Cancelar',
                            variant: 'ghost',
                            onPress: confirm.hide
                        },
                        {
                            label: 'Sincronizar (Mezclar)',
                            variant: 'outline',
                            onPress: async () => {
                                confirm.hide();
                                try {
                                    notify.info('Sincronizando...', 'Fusionando datos local-nube sin perder métricas.');
                                    syncScheduler.init();
                                    await syncService.syncBidirectional({ forcePull: true });
                                    await configService.reload();
                                    await loadSettings();
                                    const { useSettingsStore } = await import('../src/store/useSettingsStore');
                                    await useSettingsStore.getState().loadSettings();
                                    notify.success('Éxito', 'Sincronización híbrida completa.');
                                    const next = await getDiag();
                                    openConflictModal(next);
                                } catch (e: any) {
                                    notify.error('Error', e?.message || 'No se pudo sincronizar.');
                                }
                            }
                        },
                        {
                            label: 'Nube -> Celular',
                            variant: 'outline',
                            onPress: async () => {
                                confirm.hide();
                                try {
                                    notify.info('Cargando...', 'Descargando Snapshot de la Nube...');
                                    await syncService.pullCloudSnapshot();
                                    await configService.reload();
                                    await loadSettings();
                                    const { useSettingsStore } = await import('../src/store/useSettingsStore');
                                    await useSettingsStore.getState().loadSettings();
                                    notify.success('Éxito', 'Celular actualizado con los datos de la nube.');
                                    const next = await getDiag();
                                    openConflictModal(next);
                                } catch (e: any) {
                                    notify.error('Error', e?.message || 'No se pudo descargar el snapshot.');
                                }
                            }
                        },
                        {
                            label: 'Celular -> Nube',
                            variant: 'solid',
                            onPress: async () => {
                                confirm.hide();
                                try {
                                    notify.info('Cargando...', 'Subiendo Snapshot a la Nube...');
                                    await syncService.pushLocalSnapshot();
                                    notify.success('Éxito', 'Nube actualizada con los datos de tu celular.');
                                    const next = await getDiag();
                                    openConflictModal(next);
                                } catch (e: any) {
                                    notify.error('Error', e?.message || 'No se pudo subir el snapshot.');
                                }
                            }
                        }
                    ]
                });
            };

            openConflictModal(diag);
        } catch (error: any) {
            confirm.hide();
            notify.error('Fallo en Reconocimiento', error?.message || 'Error conectando con los servidores Neon. Revisa tu conexión.');
        }
    };

    const handleRestore = async () => {
        confirm.destructive(
            'Restaurar backup',
            'Esto reemplazará tus datos actuales. ¿Continuar?',
            async () => {
                try {
                    const success = await backupService.importData({ mode: 'overwrite' });
                    if (success) notify.success('Restauración completada', 'Los datos se importaron. Reinicia la app.');
                } catch (e: any) { notify.error('Fallo en restauración', e?.message || 'Incompatibilidad de base de datos.'); }
            },
            'Restaurar'
        );
    };

    const handleResetDB = () => {
        confirm.destructive(
            'Restablecer de fábrica',
            'Se borrarán TODOS tus datos locales. Esta acción no se puede deshacer. Luego se restaurará el catálogo base (categorías/ejercicios) y se cerrará la sesión para evitar que la nube repueble los datos automáticamente.',
            async () => {
                try {
                    await dbService.factoryReset();
                    await configService.reset();
                    await useAuthStore.getState().logout();
                    await loadSettings();
                    notify.success('Reinicio de fábrica', 'Los datos locales fueron limpiados. Iniciá sesión para volver a sincronizar con Neon.');
                } catch (e: any) { notify.error('Fallo de formateo', e?.message || 'No se pudo completar el restablecimiento.'); }
            },
            'BORRAR TODO'
        );
    };

    const handleFullAccountWipe = () => {
        if (!auth.token) {
            notify.error('No autenticado', 'Debes estar logueado para vaciar la nube. Si solo quieres borrar los datos de este celular, usa "Restablecer de fábrica".');
            return;
        }

        confirm.destructive(
            'Vaciar Cuenta Completa',
            '⚠️ **ESTO ES DEFINITIVO** ⚠️\n\nEste proceso borrará TODOS tus datos tanto en este dispositivo como en la Nube Neon.\n\nSe eliminarán historial, rutinas, mediciones, fuerza y personalizaciones. No se puede revertir.',
            async () => {
                confirm.destructive(
                    'Confirmación final',
                    'Para confirmar, presioná el botón. Se borrará la nube y el celular simultáneamente y se cerrará tu sesión.',
                    async () => {
                        try {
                            notify.info('Borrando...', 'Limpiando datos de cuenta en todas partes.');
                            await syncService.wipeAllUserData();
                            await dbService.factoryReset();
                            await configService.reset();
                            await auth.logout();
                            await loadSettings();
                            notify.success('Éxito', 'Cuenta vaciada. Ya podés empezar de cero.');
                        } catch (e: any) {
                            notify.error('Error de borrado', e?.message || 'No se pudo completar el wipe total.');
                        }
                    },
                    'VACIAR TODO'
                );
            },
            'CONTINUAR'
        );
    };

    // ─── Notification Preferences Helper ─────────────────────────────────────
    const updateNotifPref = async <G extends keyof NotificationPreferences>(
        group: G,
        key: keyof NotificationPreferences[G],
        value: boolean,
    ) => {
        const updated = { ...notifPrefs, [group]: { ...notifPrefs[group], [key]: value } };
        setNotifPrefs(updated);
        await configService.set('notificationPreferences', updated);
    };

    // ─── Notification Group Header (Accordion) ──────────────────────────────
    const NotifGroupHeader = ({ icon: Icon, title, subtitle, enabled, onToggle, expanded, onExpand, activeCount, totalCount, borderBottom = true }: {
        icon: any; title: string; subtitle: string; enabled: boolean;
        onToggle: (v: boolean) => void; expanded: boolean; onExpand: () => void;
        activeCount: number; totalCount: number; borderBottom?: boolean;
    }) => (
        <View style={[ns.groupRow, borderBottom && s.settingRowBorder]}>
            <TouchableOpacity onPress={onExpand} style={ns.groupLeft} activeOpacity={0.6}>
                <View style={[ns.groupIcon, !enabled && { opacity: 0.35 }]}>
                    <Icon size={15} color={colors.primary.DEFAULT} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[ns.groupTitle, !enabled && { color: colors.textMuted }]}>{title}</Text>
                        {enabled && (
                            <View style={ns.badge}>
                                <Text style={ns.badgeText}>{activeCount}/{totalCount}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={ns.groupSub}>{subtitle}</Text>
                </View>
                {enabled && (expanded ? <ChevronUp size={14} color={colors.textMuted} /> : <ChevronDown size={14} color={colors.textMuted} />)}
            </TouchableOpacity>
            <Switch value={enabled} onValueChange={onToggle} trackColor={{ true: colors.primary.DEFAULT }} style={{ marginLeft: 8 }} />
        </View>
    );

    const NotifSubToggle = ({ label, enabled, onToggle, last = false }: {
        label: string; enabled: boolean; onToggle: (v: boolean) => void; last?: boolean;
    }) => (
        <View style={[ns.subRow, !last && ns.subRowBorder]}>
            <View style={[ns.subDot, { backgroundColor: enabled ? colors.primary.DEFAULT : colors.border }]} />
            <Text style={[ns.subLabel, !enabled && { color: colors.textMuted }]}>{label}</Text>
            <Switch value={enabled} onValueChange={onToggle} trackColor={{ true: colors.primary.DEFAULT }} style={{ transform: [{ scale: 0.8 }] }} />
        </View>
    );

    const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
        <View style={s.sectionHeader}>
            <View style={s.sectionAccent} />
            <Icon size={14} color={colors.primary.DEFAULT} />
            <Text style={s.sectionTitle}>{title}</Text>
        </View>
    );

    const SettingRow = ({ icon: Icon, title, subtitle, children, borderBottom = true }: { icon: any; title: string; subtitle?: string; children: React.ReactNode; borderBottom?: boolean }) => (
        <View style={[s.settingRow, borderBottom && s.settingRowBorder]}>
            <View style={s.settingLeft}>
                <View style={s.settingIconCircle}>
                    <Icon size={16} color={colors.primary.DEFAULT} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.settingLabel}>{title}</Text>
                    {subtitle && <Text style={s.settingSubtitle}>{subtitle}</Text>}
                </View>
            </View>
            {children}
        </View>
    );

    const Stepper = ({ value, label, onMinus, onPlus }: { value: string; label?: string; onMinus: () => void; onPlus: () => void }) => (
        <View style={s.stepperRow}>
            <TouchableOpacity onPress={onMinus} style={s.stepperBtn} accessibilityRole="button" accessibilityLabel={`Reducir ${label || ''}`}>
                <Text style={s.stepperBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.stepperValue}>{value}</Text>
            <TouchableOpacity onPress={onPlus} style={s.stepperBtn} accessibilityRole="button" accessibilityLabel={`Aumentar ${label || ''}`}>
                <Text style={s.stepperBtnText}>+</Text>
            </TouchableOpacity>
        </View>
    );

    const ChipGroup = ({ options, selected, onSelect }: { options: { id: string; label: string }[]; selected: string; onSelect: (id: string) => void }) => (
        <View style={s.chipGroup}>
            {options.map((o) => (
                <TouchableOpacity
                    key={o.id}
                    onPress={() => onSelect(o.id)}
                    style={[s.chip, selected === o.id && s.chipActive]}
                    accessibilityRole="button"
                    accessibilityLabel={`Seleccionar ${o.label}`}
                >
                    <Text style={[s.chipText, selected === o.id && s.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <SafeAreaWrapper style={{ backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 }}>
                <View style={{ marginBottom: 24, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
                        <ChevronLeft size={20} color={colors.text} />
                    </TouchableOpacity>
                    <View>
                        <Text style={s.pageTitle}>Ajustes</Text>
                        <Text style={s.pageSub}>Configuración y preferencias</Text>
                    </View>
                </View>

                {/* Cuenta (Auth) */}
                <SectionHeader icon={User} title="Cuenta" />
                <View style={[s.card, { paddingVertical: 16, paddingHorizontal: 16, marginBottom: 24 }]}>
                    {auth.user ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Conectado</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{auth.user.email || 'Miembro de IronTrain'}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    confirm.ask('Cerrar Sesión', '¿Estás seguro que deseas cerrar sesión? Tus datos locales no se borrarán, pero dejarás de sincronizarte.', async () => {
                                        await auth.logout();
                                        notify.success('Sesión cerrada', 'Te has desconectado correctamente.');
                                    }, 'Cerrar Sesión');
                                }}
                                style={{ backgroundColor: withAlpha(colors.red, '15'), paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                            >
                                <LogOut size={16} color={colors.red} />
                                <Text style={{ color: colors.red, fontWeight: '800', fontSize: 14 }}>Salir</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'column', gap: 12 }}>
                            <Text style={{ color: colors.textMuted, fontSize: 14, lineHeight: 20 }}>
                                Inicia sesión para habilitar la sincronización en la nube y proteger tus rutinas. Tus datos locales actuales se mantendrán intactos.
                            </Text>
                            <TouchableOpacity
                                onPress={async () => {
                                    await auth.login();
                                }}
                                disabled={auth.isLoading}
                                style={{
                                    backgroundColor: colors.primary.DEFAULT, width: '100%', paddingVertical: 14, borderRadius: 12,
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    opacity: auth.isLoading ? 0.7 : 1
                                }}
                            >
                                <User size={18} color={colors.onPrimary} />
                                <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 15 }}>
                                    {auth.isLoading ? 'Conectando...' : 'Iniciar Sesión (vía Web)'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* General */}
                <SectionHeader icon={Zap} title="Preferencias generales" />
                <View style={s.card}>
                    <SettingRow icon={Disc} title="Unidades de peso">
                        <ChipGroup
                            options={[{ id: 'kg', label: 'KG' }, { id: 'lbs', label: 'LBS' }]}
                            selected={units}
                            onSelect={(id) => saveSetting('weightUnit', id as any)}
                        />
                    </SettingRow>
                    <SettingRow icon={Smartphone} title="Apariencia" subtitle="Tema de la aplicación.">
                        <ChipGroup
                            options={[
                                { id: 'light', label: 'Claro' },
                                { id: 'dark', label: 'Oscuro' },
                                { id: 'system', label: 'Auto' }
                            ]}
                            selected={themeMode}
                            onSelect={(id) => setThemeMode(id as any)}
                        />
                    </SettingRow>
                    <SettingRow icon={Timer} title="Descanso por defecto">
                        <Stepper value={`${defaultTimer}s`} label="descanso" onMinus={() => saveSetting('defaultRestTimer', Math.max(0, defaultTimer - 30))} onPlus={() => saveSetting('defaultRestTimer', defaultTimer + 30)} />
                    </SettingRow>
                    <SettingRow icon={Clock} title="Auto rest al completar serie" subtitle="Inicia el timer automáticamente.">
                        <Switch value={autoRestOnComplete} onValueChange={(v) => saveSetting('autoStartRestTimerOnSetComplete', v)} trackColor={{ true: colors.primary.DEFAULT }} />
                    </SettingRow>

                    <View style={[s.cardInnerPadded, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><CalendarDays size={16} color={colors.primary.DEFAULT} /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.settingLabel}>Días de entrenamiento</Text>
                                <Text style={s.settingSubtitle}>Afecta el cálculo de rachas. Los días de descanso no rompen tu racha.</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 14, justifyContent: 'center' }}>
                            {[
                                { id: 1, label: 'L' }, { id: 2, label: 'M' }, { id: 3, label: 'X' },
                                { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' },
                                { id: 0, label: 'D' }
                            ].map(day => {
                                const isSelected = trainingDays.includes(day.id);
                                return (
                                    <TouchableOpacity
                                        key={day.id}
                                        onPress={() => {
                                            const newDays = isSelected ? trainingDays.filter(d => d !== day.id) : [...trainingDays, day.id].sort();
                                            saveSetting('training_days', newDays);
                                        }}
                                        style={[s.dayChip, isSelected && s.dayChipActive]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[s.dayChipText, isSelected && s.dayChipTextActive]}>{day.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 10, fontWeight: '600' }}>
                            {trainingDays.length} de 7 días seleccionados
                        </Text>
                    </View>

                    <SettingRow icon={Vibrate} title="Vibración" subtitle="Retroalimentación háptica." borderBottom={false}>
                        <Switch value={hapticEnabled} onValueChange={(v) => saveSetting('hapticFeedbackEnabled', v)} trackColor={{ true: colors.primary.DEFAULT }} />
                    </SettingRow>
                </View>

                {/* ─── Notifications & Sounds ─────────────────────────────── */}
                <SectionHeader icon={Bell} title="Notificaciones y sonidos" />
                <View style={s.card}>
                    {/* ── In-App Notifications Group ── */}
                    <NotifGroupHeader
                        icon={Megaphone}
                        title="Notificaciones In-App"
                        subtitle="Toasts y banners dentro de la app"
                        enabled={notifPrefs.inApp.enabled}
                        onToggle={(v) => updateNotifPref('inApp', 'enabled', v)}
                        expanded={expandedNotifGroup === 'inApp'}
                        onExpand={() => setExpandedNotifGroup(expandedNotifGroup === 'inApp' ? null : 'inApp')}
                        activeCount={Object.values(notifPrefs.inApp).filter(v => v === true).length - (notifPrefs.inApp.enabled ? 1 : 0)}
                        totalCount={7}
                        borderBottom
                    />
                    {expandedNotifGroup === 'inApp' && notifPrefs.inApp.enabled && (
                        <View style={ns.subGroup}>
                            <NotifSubToggle label="Rest timer" enabled={notifPrefs.inApp.restTimer} onToggle={(v) => updateNotifPref('inApp', 'restTimer', v)} />
                            <NotifSubToggle label="Estado del entrenamiento" enabled={notifPrefs.inApp.workoutStatus} onToggle={(v) => updateNotifPref('inApp', 'workoutStatus', v)} />
                            <NotifSubToggle label="Actualizaciones" enabled={notifPrefs.inApp.updates} onToggle={(v) => updateNotifPref('inApp', 'updates', v)} />
                            <NotifSubToggle label="Nuevos Récords (PR)" enabled={notifPrefs.inApp.personalRecord} onToggle={(v) => updateNotifPref('inApp', 'personalRecord', v)} />
                            <NotifSubToggle label="Actividad Social" enabled={notifPrefs.inApp.social} onToggle={(v) => updateNotifPref('inApp', 'social', v)} />
                            <NotifSubToggle label="Kudos recibidos" enabled={notifPrefs.inApp.kudos} onToggle={(v) => updateNotifPref('inApp', 'kudos', v)} />
                            <NotifSubToggle label="Interval timer" enabled={notifPrefs.inApp.intervalTimer} onToggle={(v) => updateNotifPref('inApp', 'intervalTimer', v)} last />
                        </View>
                    )}

                    {/* ── System Notifications Group ── */}
                    <NotifGroupHeader
                        icon={Smartphone}
                        title="Notificaciones del Sistema"
                        subtitle="Alerts nativas de Android / iOS"
                        enabled={notifPrefs.system.enabled}
                        onToggle={(v) => {
                            updateNotifPref('system', 'enabled', v);
                            saveSetting('systemNotificationsEnabled', v);
                            if (v) notificationPermissionsService.requestPermission();
                        }}
                        expanded={expandedNotifGroup === 'system'}
                        onExpand={() => setExpandedNotifGroup(expandedNotifGroup === 'system' ? null : 'system')}
                        activeCount={Object.values(notifPrefs.system).filter(v => v === true).length - (notifPrefs.system.enabled ? 1 : 0)}
                        totalCount={11}
                        borderBottom
                    />
                    {expandedNotifGroup === 'system' && notifPrefs.system.enabled && (
                        <View style={ns.subGroup}>
                            <NotifSubToggle label="Rest timer" enabled={notifPrefs.system.restTimer} onToggle={(v) => updateNotifPref('system', 'restTimer', v)} />
                            <NotifSubToggle label="Entrenamiento activo" enabled={notifPrefs.system.workoutPersistent} onToggle={(v) => updateNotifPref('system', 'workoutPersistent', v)} />
                            <NotifSubToggle label="Recordatorio inactividad" enabled={notifPrefs.system.inactivityReminder} onToggle={(v) => updateNotifPref('system', 'inactivityReminder', v)} />
                            <NotifSubToggle label="Entrenamiento completado" enabled={notifPrefs.system.workoutComplete} onToggle={(v) => updateNotifPref('system', 'workoutComplete', v)} />
                            <NotifSubToggle label="Interval timer" enabled={notifPrefs.system.intervalTimer} onToggle={(v) => updateNotifPref('system', 'intervalTimer', v)} />
                            <NotifSubToggle label="Actualización disponible" enabled={notifPrefs.system.updateAvailable} onToggle={(v) => updateNotifPref('system', 'updateAvailable', v)} />
                            <NotifSubToggle label="App actualizada" enabled={notifPrefs.system.appUpdated} onToggle={(v) => updateNotifPref('system', 'appUpdated', v)} />
                            <NotifSubToggle label="Nuevos Récords (PR)" enabled={notifPrefs.system.personalRecord} onToggle={(v) => updateNotifPref('system', 'personalRecord', v)} />
                            <NotifSubToggle label="Actividad Social" enabled={notifPrefs.system.social} onToggle={(v) => updateNotifPref('system', 'social', v)} />
                            <NotifSubToggle label="Kudos recibidos" enabled={notifPrefs.system.kudos} onToggle={(v) => updateNotifPref('system', 'kudos', v)} />
                            <NotifSubToggle label="Recordatorio de racha" enabled={notifPrefs.system.streakReminder} onToggle={(v) => updateNotifPref('system', 'streakReminder', v)} />

                        </View>
                    )}

                    {/* ── Sounds Group ── */}
                    <NotifGroupHeader
                        icon={Volume2}
                        title="Efectos de sonido"
                        subtitle="Tonos al completar acciones"
                        enabled={soundEnabled}
                        onToggle={(v) => saveSetting('soundFeedbackEnabled', v)}
                        expanded={expandedNotifGroup === 'sounds'}
                        onExpand={() => setExpandedNotifGroup(expandedNotifGroup === 'sounds' ? null : 'sounds')}
                        activeCount={Object.values(notifPrefs.sounds).filter(v => v === true).length}
                        totalCount={4}
                        borderBottom={false}
                    />
                    {expandedNotifGroup === 'sounds' && soundEnabled && (
                        <View style={ns.subGroup}>
                            <NotifSubToggle label="Rest timer" enabled={notifPrefs.sounds.restTimer} onToggle={(v) => updateNotifPref('sounds', 'restTimer', v)} />
                            <NotifSubToggle label="Interval timer" enabled={notifPrefs.sounds.intervalTimer} onToggle={(v) => updateNotifPref('sounds', 'intervalTimer', v)} />
                            <NotifSubToggle label="Entrenamiento completado" enabled={notifPrefs.sounds.workoutComplete} onToggle={(v) => updateNotifPref('sounds', 'workoutComplete', v)} />
                            <NotifSubToggle label="Cuenta regresiva" enabled={notifPrefs.sounds.countdown} onToggle={(v) => updateNotifPref('sounds', 'countdown', v)} last />
                        </View>
                    )}
                </View>

                {/* Analytics */}
                <SectionHeader icon={BarChart3} title="Análisis" />
                <View style={s.card}>
                    <View style={s.cardInnerPadded}>
                        <Text style={s.settingLabel}>Rango por defecto</Text>
                        <View style={{ marginTop: 10 }}>
                            <ChipGroup
                                options={[{ id: '7', label: '7D' }, { id: '30', label: '30D' }, { id: '90', label: '90D' }, { id: '365', label: '1Y' }]}
                                selected={String(analyticsRange)}
                                onSelect={(id) => saveSetting('analyticsDefaultRangeDays', Number(id) as any)}
                            />
                        </View>
                    </View>
                </View>

                {/* Calculators */}
                <SectionHeader icon={Calculator} title="Calculadoras" />
                <View style={s.card}>
                    <View style={[s.cardInnerPadded, s.settingRowBorder]}>
                        <Text style={s.settingLabel}>Fórmula 1RM por defecto</Text>
                        <View style={{ marginTop: 10 }}>
                            <ChipGroup
                                options={[{ id: 'epley', label: 'Epley' }, { id: 'brzycki', label: 'Brzycki' }, { id: 'lombardi', label: 'Lombardi' }]}
                                selected={rmFormula}
                                onSelect={(id) => saveSetting('calculatorsDefault1RMFormula', id as any)}
                            />
                        </View>
                    </View>
                    <View style={s.cardInnerPadded}>
                        <Text style={s.settingLabel}>Redondeo</Text>
                        <Text style={[s.settingSubtitle, { marginBottom: 12 }]}>Se usa en porcentajes y warm-up.</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={s.roundLabel}>KG</Text>
                            <Stepper value={String(roundKg)} label="redondeo kg" onMinus={() => saveSetting('calculatorsRoundingKg', Math.max(0.25, roundKg - 0.25) as any)} onPlus={() => saveSetting('calculatorsRoundingKg', roundKg + 0.25 as any)} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.roundLabel}>LBS</Text>
                            <Stepper value={String(roundLbs)} label="redondeo lbs" onMinus={() => saveSetting('calculatorsRoundingLbs', Math.max(0.5, roundLbs - 0.5) as any)} onPlus={() => saveSetting('calculatorsRoundingLbs', roundLbs + 0.5 as any)} />
                        </View>
                    </View>
                </View>

                {/* Tools & Data */}
                <SectionHeader icon={Database} title="Herramientas y datos" />
                <View style={s.card}>
                    <TouchableOpacity onPress={() => router.push('/tools/plate-calculator' as any)} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><Disc size={16} color={colors.primary.DEFAULT} /></View>
                            <Text style={s.settingLabel}>Inventario de discos</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/body' as any)} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><Ruler size={16} color={colors.primary.DEFAULT} /></View>
                            <Text style={s.settingLabel}>Evolución Física</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleNormalizeNames} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><RefreshCw size={16} color={colors.primary.DEFAULT} /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.settingLabel}>Normalizar nombres (Title Case)</Text>
                                <Text style={s.settingSubtitle}>Corrige nombres viejos (ejercicios, categorías, badges y rutinas).</Text>
                            </View>
                        </View>
                        <ChevronRight size={16} color={colors.textMuted} />
                    </TouchableOpacity>

                    <View style={[s.cardInnerPadded, s.settingRowBorder]}>
                        <Text style={s.settingLabel}>Barra por defecto</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
                            <Text style={s.roundLabel}>KG</Text>
                            <Stepper value={String(barKg)} label="barra kg" onMinus={() => saveSetting('plateCalculatorDefaultBarWeightKg', Math.max(0, barKg - 1) as any)} onPlus={() => saveSetting('plateCalculatorDefaultBarWeightKg', barKg + 1 as any)} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={s.roundLabel}>LBS</Text>
                            <Stepper value={String(barLbs)} label="barra lbs" onMinus={() => saveSetting('plateCalculatorDefaultBarWeightLbs', Math.max(0, barLbs - 1) as any)} onPlus={() => saveSetting('plateCalculatorDefaultBarWeightLbs', barLbs + 1 as any)} />
                        </View>
                    </View>

                    <SettingRow icon={Disc} title="Preferir menos discos" subtitle="Prioriza armados más rápidos.">
                        <Switch value={preferFewerPlates} onValueChange={(v) => saveSetting('plateCalculatorPreferFewerPlates', v)} trackColor={{ true: colors.primary.DEFAULT }} />
                    </SettingRow>

                    <TouchableOpacity onPress={handleBackup} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><Disc size={16} color={colors.primary.DEFAULT} /></View>
                            <Text style={s.settingLabel}>Exportar backup (JSON)</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleDownloadBackup} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><Download size={16} color={colors.primary.DEFAULT} /></View>
                            <Text style={s.settingLabel}>Descargar backup (JSON)</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleCloudSnapshot} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: withAlpha(colors.blue, '15') }]}><CloudLightning size={16} color={colors.blue} /></View>
                            <Text style={[s.settingLabel, { color: colors.blue }]}>Forzar Sync a Nube Neon</Text>
                        </View>
                        <ChevronRight size={16} color={colors.blue} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleRestore} style={s.settingRow}>
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: withAlpha(colors.red, '15') }]}><RefreshCw size={16} color={colors.red} /></View>
                            <Text style={[s.settingLabel, { color: colors.red }]}>Restaurar backup</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <SectionHeader icon={Shield} title="Zona de riesgo" />
                <View style={[s.card, { borderColor: withAlpha(colors.red, '30'), marginBottom: 24 }]}>
                    <TouchableOpacity onPress={handleResetDB} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: withAlpha(colors.red, '15') }]}><Trash2 size={16} color={colors.red} /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.settingLabel, { color: colors.red }]}>Restablecer de fábrica</Text>
                                <Text style={s.settingSubtitle}>Borra todos los datos locales.</Text>
                            </View>
                        </View>
                        <ChevronRight size={16} color={colors.red} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleFullAccountWipe} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: withAlpha(colors.red, '20') }]}><AlertTriangle size={16} color={colors.red} /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.settingLabel, { color: colors.red }]}>Vaciar cuenta (Local + Nube)</Text>
                                <Text style={s.settingSubtitle}>Borrado total e irreversible en todas partes.</Text>
                            </View>
                        </View>
                        <ChevronRight size={16} color={colors.red} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => Linking.openURL('https://irontrain.app/delete-account')}
                        style={s.settingRow}
                    >
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: withAlpha(colors.red, '10') }]}><User size={16} color={colors.red} /></View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.settingLabel, { color: colors.red }]}>Eliminar Cuenta IronTrain</Text>
                                <Text style={s.settingSubtitle}>Solicitar la eliminación definitiva de tu cuenta y datos personales.</Text>
                            </View>
                        </View>
                        <ChevronRight size={16} color={colors.red} />
                    </TouchableOpacity>
                </View>

                {/* Help & Support */}
                <SectionHeader icon={Shield} title="Soporte" />
                <View style={[s.card, { marginBottom: 24 }]}>
                    <TouchableOpacity
                        onPress={() => Linking.openURL('https://irontrain.app/help')}
                        style={s.settingRow}
                    >
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><MessageSquare size={16} color={colors.primary.DEFAULT} /></View>
                            <Text style={s.settingLabel}>Centro de Ayuda</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Community and Feedback */}
                <SectionHeader icon={MessageSquare} title="Comunidad y Feedback" />
                <View style={[s.card, { marginBottom: 24 }]}>
                    <TouchableOpacity onPress={() => router.push('/feedback' as any)} style={s.settingRow}>
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: withAlpha(colors.primary.DEFAULT, '15') }]}>
                                <MessageSquare size={16} color={colors.primary.DEFAULT} />
                            </View>
                            <Text style={s.settingLabel}>Enviar Feedback y Reportes</Text>
                        </View>
                        <ChevronRight size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                {/* Updates */}
                <SectionHeader icon={Download} title="Actualizaciones" />
                <View style={s.card}>
                    <View style={[s.cardInnerPadded, s.settingRowBorder]}>
                        <Text style={s.settingLabel}>Estado</Text>
                        {updateStatus === 'idle' || updateStatus === 'error' ? (
                            <Text style={s.settingSubtitle}>{updateStatus === 'error' && updateInfo.error ? `Error: ${updateInfo.error}` : `Instalada: v${updateInfo.installedVersion}`}</Text>
                        ) : updateStatus === 'checking' ? (
                            <Text style={s.settingSubtitle}>Buscando actualizaciones...</Text>
                        ) : updateStatus === 'up_to_date' ? (
                            <Text style={s.settingSubtitle}>Estás al día (v{updateInfo.installedVersion}).</Text>
                        ) : (
                            <Text style={s.settingSubtitle}>{updateStatus === 'update_pending' ? 'Actualización detectada' : 'Actualización disponible'}: v{updateInfo.latestVersion}{updateInfo.date ? ` · ${updateInfo.date}` : ''}</Text>
                        )}
                        {updateInfo.lastChecked && (
                            <Text style={[s.settingSubtitle, { fontSize: 10, marginTop: 4 }]}>Última comprobación: {new Date(updateInfo.lastChecked).toLocaleTimeString()}</Text>
                        )}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
                        <TouchableOpacity
                            onPress={checkUpdates}
                            disabled={updateStatus === 'checking'}
                            style={[s.updateBtn, updateStatus === 'checking' && { opacity: 0.5 }]}
                            accessibilityRole="button"
                            accessibilityLabel="Buscar actualizaciones"
                        >
                            <Text style={s.updateBtnText}>{updateStatus === 'checking' ? 'Buscando...' : 'Buscar'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={async () => {
                                if (updateStatus !== 'update_available' && updateStatus !== 'update_pending') return;
                                const url = updateInfo.downloadUrl ?? updateInfo.notesUrl;
                                if (!url) { notify.error('Descarga cancelada', 'No hay enlace de descarga disponible.'); return; }
                                try { await Linking.openURL(url); } catch (err: any) { notify.error('Actualización fallida', err?.message || 'No se pudo abrir el enlace.'); }
                            }}
                            disabled={updateStatus !== 'update_available' && updateStatus !== 'update_pending'}
                            style={[s.updateBtnPrimary, (updateStatus !== 'update_available' && updateStatus !== 'update_pending') && { opacity: 0.5 }]}
                            accessibilityRole="button"
                            accessibilityLabel="Abrir descarga"
                        >
                            <Download size={16} color={colors.onPrimary} />
                            <Text style={s.updateBtnPrimaryText}>{updateStatus === 'update_pending' ? 'Ver notas' : 'Descargar'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={s.footer}>IronTrain v{installedVersion}{footerDate ? ` · ${footerDate}` : ''}</Text>
            </ScrollView>
        </SafeAreaWrapper>
    );
}

