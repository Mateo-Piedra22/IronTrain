import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useColorScheme } from '@/components/useColorScheme';
import { backupService } from '@/src/services/BackupService';
import { ChangelogService } from '@/src/services/ChangelogService';
import { AppConfig, configService, NotificationPreferences } from '@/src/services/ConfigService';
import { dbService } from '@/src/services/DatabaseService';
import { updateService } from '@/src/services/UpdateService';
import { useUpdateStore } from '@/src/store/updateStore';
import { Colors } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { BarChart3, Bell, Calculator, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, CloudLightning, Database, Disc, Download, LogOut, Megaphone, MessageSquare, RefreshCw, Ruler, Shield, Smartphone, Timer, Trash2, User, Vibrate, Volume2, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { syncService } from '../src/services/SyncService';
import { useAuthStore } from '../src/store/authStore';
import { confirm } from '../src/store/confirmStore';

export default function SettingsScreen() {
    const auth = useAuthStore();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const installedVersion = ChangelogService.getAppVersion();
    const installedRelease = ChangelogService.getInstalledRelease();
    const candidateDate = installedRelease?.date ?? ChangelogService.getLatestRelease()?.date ?? null;
    const footerDate = typeof candidateDate === 'string' && candidateDate.trim().toLowerCase() === 'unreleased'
        ? null
        : candidateDate;
    const [units, setUnits] = useState('kg');
    const [defaultTimer, setDefaultTimer] = useState(90);
    const [autoRestOnComplete, setAutoRestOnComplete] = useState(true);
    const [hapticEnabled, setHapticEnabled] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [systemNotificationsEnabled, setSystemNotificationsEnabled] = useState(true);
    const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
        inApp: { enabled: true, restTimer: true, workoutStatus: true, updates: true, intervalTimer: true },
        system: { enabled: true, restTimer: true, workoutPersistent: true, inactivityReminder: true, workoutComplete: true, intervalTimer: true, updateAvailable: true, appUpdated: true, streakReminder: true },
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

    useEffect(() => { loadSettings(); }, []);

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

        const rawDays = await configService.get('training_days' as keyof AppConfig); // Fallback until typed
        if (rawDays) {
            try { setTrainingDays(typeof rawDays === 'string' ? JSON.parse(rawDays) : rawDays); }
            catch (e) { /* ignore */ }
        }
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
            const diag = await syncService.getDiagnostics();
            const { local, remote, queue } = diag;

            if (local.hasData && remote.hasData) {
                confirm.custom({
                    title: 'Resolución de Conflictos',
                    message: `Tenes datos completos en ambas partes:\nCelular: ${local.recordCount} registros.\nNube Neon: ${remote.recordCount} registros.\n\nCola de Sync en el celular (pendiente de subir):\nPendientes: ${queue.pending}\nFallidos: ${queue.failed}\nProcesando: ${queue.processing}\nTotal: ${queue.totalOutstanding}\n\n¿Qué base de datos querés utilizar como fuente de verdad?`,
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
                                    await syncService.syncBidirectional({ forcePull: true });
                                    notify.success('Éxito', 'Sincronización híbrida completa.');
                                } catch (e) { notify.error('Error'); }
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
                                    notify.success('Éxito', 'Celular actualizado con los datos de la nube.');
                                } catch (e) { notify.error('Error'); }
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
                                } catch (e) { notify.error('Error'); }
                            }
                        }
                    ]
                });
            } else if (local.hasData && !remote.hasData) {
                notify.info('Subiendo (Zero-Trust)...', 'La nube está vacía, forzando subida de datos locales...');
                await syncService.pushLocalSnapshot();
                notify.success('Copia Creada', 'Tus datos ahora están respaldados en la nube Neon.');
            } else if (!local.hasData && remote.hasData) {
                notify.info('Recuperando...', 'Recuperando tu historial completo desde la nube...');
                await syncService.pullCloudSnapshot();
                notify.success('Recuperación Exitosa', 'Toda tu cuenta ha resucitado en este dispositivo.');
            } else {
                notify.info('Cuenta Nueva', 'No hay métricas en el celular ni en la nube para procesar todavía.');
            }
        } catch (error: any) {
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
            'Se borrarán TODOS tus datos. Esta acción no se puede deshacer.',
            async () => {
                try {
                    await dbService.factoryReset();
                    await configService.reset();
                    await loadSettings();
                    notify.success('Reinicio de fábrica', 'Los datos fueron limpiados. La app quedó como nueva.');
                } catch (e: any) { notify.error('Fallo de formateo', e?.message || 'No se pudo completar el restablecimiento.'); }
            },
            'BORRAR TODO'
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
                    <Icon size={15} color={Colors.primary.DEFAULT} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[ns.groupTitle, !enabled && { color: Colors.iron[400] }]}>{title}</Text>
                        {enabled && (
                            <View style={ns.badge}>
                                <Text style={ns.badgeText}>{activeCount}/{totalCount}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={ns.groupSub}>{subtitle}</Text>
                </View>
                {enabled && (expanded ? <ChevronUp size={14} color={Colors.iron[400]} /> : <ChevronDown size={14} color={Colors.iron[400]} />)}
            </TouchableOpacity>
            <Switch value={enabled} onValueChange={onToggle} trackColor={{ true: Colors.primary.DEFAULT }} style={{ marginLeft: 8 }} />
        </View>
    );

    // ─── Notification Sub-Toggle ─────────────────────────────────────────────
    const NotifSubToggle = ({ label, enabled, onToggle, last = false }: {
        label: string; enabled: boolean; onToggle: (v: boolean) => void; last?: boolean;
    }) => (
        <View style={[ns.subRow, !last && ns.subRowBorder]}>
            <View style={[ns.subDot, { backgroundColor: enabled ? Colors.primary.DEFAULT : Colors.iron[300] }]} />
            <Text style={[ns.subLabel, !enabled && { color: Colors.iron[400] }]}>{label}</Text>
            <Switch value={enabled} onValueChange={onToggle} trackColor={{ true: Colors.primary.DEFAULT }} style={{ transform: [{ scale: 0.8 }] }} />
        </View>
    );

    const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
        <View style={s.sectionHeader}>
            <View style={s.sectionAccent} />
            <Icon size={14} color={Colors.primary.DEFAULT} />
            <Text style={s.sectionTitle}>{title}</Text>
        </View>
    );

    const SettingRow = ({ icon: Icon, title, subtitle, children, borderBottom = true }: { icon: any; title: string; subtitle?: string; children: React.ReactNode; borderBottom?: boolean }) => (
        <View style={[s.settingRow, borderBottom && s.settingRowBorder]}>
            <View style={s.settingLeft}>
                <View style={s.settingIconCircle}>
                    <Icon size={16} color={Colors.primary.DEFAULT} />
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
        <SafeAreaWrapper style={{ backgroundColor: Colors.iron[900] }} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 16 }}>
                <View style={{ marginBottom: 24, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
                        <ChevronLeft size={20} color={Colors.iron[950]} />
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
                                <Text style={{ color: Colors.iron[950], fontWeight: '800', fontSize: 16 }}>Conectado</Text>
                                <Text style={{ color: Colors.iron[500], fontSize: 13, marginTop: 4 }}>{auth.user.email || 'Miembro de IronTrain'}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => {
                                    confirm.ask('Cerrar Sesión', '¿Estás seguro que deseas cerrar sesión? Tus datos locales no se borrarán, pero dejarás de sincronizarte.', async () => {
                                        await auth.logout();
                                        notify.success('Sesión cerrada', 'Te has desconectado correctamente.');
                                    }, 'Cerrar Sesión');
                                }}
                                style={{ backgroundColor: '#ef444415', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                            >
                                <LogOut size={16} color="#ef4444" />
                                <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 14 }}>Salir</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'column', gap: 12 }}>
                            <Text style={{ color: Colors.iron[600], fontSize: 14, lineHeight: 20 }}>
                                Inicia sesión para habilitar la sincronización en la nube y proteger tus rutinas. Tus datos locales actuales se mantendrán intactos.
                            </Text>
                            <TouchableOpacity
                                onPress={async () => {
                                    await auth.login();
                                }}
                                disabled={auth.isLoading}
                                style={{
                                    backgroundColor: Colors.primary.DEFAULT, width: '100%', paddingVertical: 14, borderRadius: 12,
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    opacity: auth.isLoading ? 0.7 : 1
                                }}
                            >
                                <User size={18} color="white" />
                                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
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
                    <SettingRow icon={Timer} title="Descanso por defecto">
                        <Stepper value={`${defaultTimer}s`} label="descanso" onMinus={() => saveSetting('defaultRestTimer', Math.max(0, defaultTimer - 30))} onPlus={() => saveSetting('defaultRestTimer', defaultTimer + 30)} />
                    </SettingRow>
                    <SettingRow icon={Clock} title="Auto rest al completar serie" subtitle="Inicia el timer automáticamente.">
                        <Switch value={autoRestOnComplete} onValueChange={(v) => saveSetting('autoStartRestTimerOnSetComplete', v)} trackColor={{ true: Colors.primary.DEFAULT }} />
                    </SettingRow>

                    <View style={[s.cardInnerPadded, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><CalendarDays size={16} color={Colors.primary.DEFAULT} /></View>
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
                                        onPress={async () => {
                                            const newDays = isSelected ? trainingDays.filter(d => d !== day.id) : [...trainingDays, day.id].sort();
                                            setTrainingDays(newDays);
                                            await configService.set('training_days' as keyof AppConfig, JSON.stringify(newDays) as any);
                                            import('../src/store/useSettingsStore').then(({ useSettingsStore }) => {
                                                useSettingsStore.getState().setTrainingDays(newDays);
                                            });
                                        }}
                                        style={[s.dayChip, isSelected && s.dayChipActive]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[s.dayChipText, isSelected && s.dayChipTextActive]}>{day.label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={{ fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 10, fontWeight: '600' }}>
                            {trainingDays.length} de 7 días seleccionados
                        </Text>
                    </View>

                    <SettingRow icon={Vibrate} title="Vibración" subtitle="Retroalimentación háptica." borderBottom={false}>
                        <Switch value={hapticEnabled} onValueChange={(v) => saveSetting('hapticFeedbackEnabled', v)} trackColor={{ true: Colors.primary.DEFAULT }} />
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
                        totalCount={4}
                        borderBottom
                    />
                    {expandedNotifGroup === 'inApp' && notifPrefs.inApp.enabled && (
                        <View style={ns.subGroup}>
                            <NotifSubToggle label="Rest timer" enabled={notifPrefs.inApp.restTimer} onToggle={(v) => updateNotifPref('inApp', 'restTimer', v)} />
                            <NotifSubToggle label="Estado del entrenamiento" enabled={notifPrefs.inApp.workoutStatus} onToggle={(v) => updateNotifPref('inApp', 'workoutStatus', v)} />
                            <NotifSubToggle label="Actualizaciones" enabled={notifPrefs.inApp.updates} onToggle={(v) => updateNotifPref('inApp', 'updates', v)} />
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
                        }}
                        expanded={expandedNotifGroup === 'system'}
                        onExpand={() => setExpandedNotifGroup(expandedNotifGroup === 'system' ? null : 'system')}
                        activeCount={Object.values(notifPrefs.system).filter(v => v === true).length - (notifPrefs.system.enabled ? 1 : 0)}
                        totalCount={8}
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
                            <NotifSubToggle label="Recordatorio de racha" enabled={notifPrefs.system.streakReminder} onToggle={(v) => updateNotifPref('system', 'streakReminder', v)} last />
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
                            <View style={s.settingIconCircle}><Disc size={16} color={Colors.primary.DEFAULT} /></View>
                            <Text style={s.settingLabel}>Inventario de discos</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/body' as any)} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><Ruler size={16} color={Colors.primary.DEFAULT} /></View>
                            <Text style={s.settingLabel}>Evolución Física</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
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
                        <Switch value={preferFewerPlates} onValueChange={(v) => saveSetting('plateCalculatorPreferFewerPlates', v)} trackColor={{ true: Colors.primary.DEFAULT }} />
                    </SettingRow>

                    <TouchableOpacity onPress={handleBackup} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><Database size={16} color={Colors.primary.DEFAULT} /></View>
                            <Text style={s.settingLabel}>Exportar backup (JSON)</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleDownloadBackup} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={s.settingIconCircle}><Download size={16} color={Colors.primary.DEFAULT} /></View>
                            <Text style={s.settingLabel}>Descargar backup (JSON)</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleCloudSnapshot} style={[s.settingRow, s.settingRowBorder]}>
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: '#3b82f615' }]}><CloudLightning size={16} color="#3b82f6" /></View>
                            <Text style={[s.settingLabel, { color: '#3b82f6' }]}>Forzar Sync a Nube Neon</Text>
                        </View>
                        <ChevronRight size={16} color="#3b82f6" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleRestore} style={s.settingRow}>
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: '#ef444415' }]}><RefreshCw size={16} color="#ef4444" /></View>
                            <Text style={[s.settingLabel, { color: '#ef4444' }]}>Restaurar backup</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <SectionHeader icon={Shield} title="Zona de riesgo" />
                <View style={[s.card, { borderColor: '#ef444430', marginBottom: 24 }]}>
                    <TouchableOpacity onPress={handleResetDB} style={s.settingRow}>
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: '#ef444415' }]}><Trash2 size={16} color="#ef4444" /></View>
                            <Text style={[s.settingLabel, { color: '#ef4444' }]}>Restablecer de fábrica</Text>
                        </View>
                        <ChevronRight size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>

                {/* Community and Feedback */}
                <SectionHeader icon={MessageSquare} title="Comunidad y Feedback" />
                <View style={[s.card, { marginBottom: 24 }]}>
                    <TouchableOpacity onPress={() => router.push('/feedback' as any)} style={s.settingRow}>
                        <View style={s.settingLeft}>
                            <View style={[s.settingIconCircle, { backgroundColor: `${Colors.primary.DEFAULT}15` }]}>
                                <MessageSquare size={16} color={Colors.primary.DEFAULT} />
                            </View>
                            <Text style={s.settingLabel}>Enviar Feedback y Reportes</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
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
                            <Download size={16} color="white" />
                            <Text style={s.updateBtnPrimaryText}>{updateStatus === 'update_pending' ? 'Ver notas' : 'Descargar'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <Text style={s.footer}>IronTrain v{installedVersion}{footerDate ? ` · ${footerDate}` : ''}</Text>
            </ScrollView>
        </SafeAreaWrapper>
    );
}

const s = StyleSheet.create({
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.iron[300], elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    pageTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 24, letterSpacing: -1 },
    pageSub: { color: Colors.primary.DEFAULT, fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28, marginBottom: 10 },
    sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: Colors.primary.DEFAULT },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.iron[500], textTransform: 'uppercase', letterSpacing: 1 },
    card: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[300], overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    cardInnerPadded: { padding: 16 },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    settingRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.iron[200] },
    settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 12 },
    settingIconCircle: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.primary.DEFAULT + '12', justifyContent: 'center', alignItems: 'center' },
    settingLabel: { fontSize: 15, fontWeight: '800', color: Colors.iron[950], letterSpacing: -0.2 },
    settingSubtitle: { fontSize: 12, color: Colors.iron[500], marginTop: 2, lineHeight: 16 },
    roundLabel: { fontSize: 13, fontWeight: '800', color: Colors.iron[500] },
    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepperBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.iron[300], justifyContent: 'center', alignItems: 'center', elevation: 1 },
    stepperBtnText: { fontSize: 18, fontWeight: '700', color: Colors.iron[950], lineHeight: 20 },
    stepperValue: { fontSize: 14, fontWeight: '800', color: Colors.iron[950], minWidth: 40, textAlign: 'center' },
    chipGroup: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: Colors.iron[300], backgroundColor: Colors.surface, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    chipActive: { backgroundColor: Colors.primary.DEFAULT, borderColor: Colors.primary.DEFAULT, elevation: 2 },
    chipText: { fontSize: 13, fontWeight: '800', color: Colors.iron[600] },
    chipTextActive: { color: '#fff' },
    dayChip: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.iron[300], alignItems: 'center', justifyContent: 'center', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    dayChipActive: { backgroundColor: Colors.primary.DEFAULT, borderColor: Colors.primary.DEFAULT, elevation: 2, shadowColor: Colors.primary.DEFAULT, shadowOpacity: 0.25, shadowRadius: 4 },
    dayChipText: { fontSize: 14, fontWeight: '800', color: Colors.iron[500] },
    dayChipTextActive: { color: '#fff' },
    updateBtn: { flex: 1, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.iron[300], borderRadius: 14, paddingVertical: 14, alignItems: 'center', elevation: 1 },
    updateBtnText: { fontSize: 14, fontWeight: '800', color: Colors.iron[950] },
    updateBtnPrimary: { flex: 1, backgroundColor: Colors.primary.DEFAULT, borderRadius: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 3 },
    updateBtnPrimaryText: { fontSize: 14, fontWeight: '800', color: '#fff' },
    footer: { textAlign: 'center', color: Colors.iron[400], fontSize: 12, marginTop: 32, marginBottom: 20 },
});

const ns = StyleSheet.create({
    groupRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16,
    },
    groupLeft: {
        flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8,
    },
    groupIcon: {
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: Colors.primary.DEFAULT + '12',
        justifyContent: 'center', alignItems: 'center',
    },
    groupTitle: {
        fontSize: 14, fontWeight: '800', color: Colors.iron[950], letterSpacing: -0.2,
    },
    groupSub: {
        fontSize: 11, color: Colors.iron[500], marginTop: 1,
    },
    badge: {
        backgroundColor: Colors.primary.DEFAULT + '18',
        borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    },
    badgeText: {
        fontSize: 10, fontWeight: '800', color: Colors.primary.DEFAULT,
    },
    subGroup: {
        backgroundColor: Colors.iron[900],
        borderTopWidth: 1, borderTopColor: Colors.iron[300],
        paddingLeft: 20,
    },
    subRow: {
        flexDirection: 'row', alignItems: 'center', paddingVertical: 11,
        paddingHorizontal: 16, gap: 10,
    },
    subRowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.iron[300],
    },
    subDot: {
        width: 7, height: 7, borderRadius: 4,
    },
    subLabel: {
        flex: 1, fontSize: 13, fontWeight: '700', color: Colors.iron[950],
    },
});
