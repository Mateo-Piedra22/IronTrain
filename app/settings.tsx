import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useColorScheme } from '@/components/useColorScheme';
import { backupService } from '@/src/services/BackupService';
import { ChangelogService } from '@/src/services/ChangelogService';
import { AppConfig, configService } from '@/src/services/ConfigService';
import { dbService } from '@/src/services/DatabaseService';
import { UpdateCheckResult, UpdateService } from '@/src/services/UpdateService';
import { Colors } from '@/src/theme';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Database, Disc, Download, Timer, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
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
    const [analyticsRange, setAnalyticsRange] = useState<7 | 30 | 90 | 365>(30);
    const [barKg, setBarKg] = useState(20);
    const [barLbs, setBarLbs] = useState(45);
    const [preferFewerPlates, setPreferFewerPlates] = useState(true);
    const [roundKg, setRoundKg] = useState(2.5);
    const [roundLbs, setRoundLbs] = useState(5);
    const [rmFormula, setRmFormula] = useState<AppConfig['calculatorsDefault1RMFormula']>('epley');
    const [updateStatus, setUpdateStatus] = useState<UpdateCheckResult>({ status: 'disabled' });
    const [checkingUpdate, setCheckingUpdate] = useState(false);

    useEffect(() => {
        loadSettings();
        checkUpdates();
    }, []);

    const loadSettings = async () => {
        await configService.init();
        setUnits(configService.get('weightUnit'));
        setDefaultTimer(configService.get('defaultRestTimer'));
        setAutoRestOnComplete(configService.get('autoStartRestTimerOnSetComplete'));
        setAnalyticsRange(configService.get('analyticsDefaultRangeDays'));
        setBarKg(configService.get('plateCalculatorDefaultBarWeightKg'));
        setBarLbs(configService.get('plateCalculatorDefaultBarWeightLbs'));
        setPreferFewerPlates(configService.get('plateCalculatorPreferFewerPlates'));
        setRoundKg(configService.get('calculatorsRoundingKg'));
        setRoundLbs(configService.get('calculatorsRoundingLbs'));
        setRmFormula(configService.get('calculatorsDefault1RMFormula'));
    };

    const checkUpdates = async () => {
        setCheckingUpdate(true);
        try {
            const result = await UpdateService.checkForUpdate();
            setUpdateStatus(result);
        } finally {
            setCheckingUpdate(false);
        }
    };

    const saveSetting = async <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
        await configService.set(key, value);
        if (key === 'weightUnit') setUnits(value as any);
        if (key === 'defaultRestTimer') setDefaultTimer(value as any);
        if (key === 'autoStartRestTimerOnSetComplete') setAutoRestOnComplete(value as any);
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
            Alert.alert(
                'Listo',
                result.shared ? 'Backup exportado.' : 'Backup creado (no se pudo abrir el compartir automáticamente).'
            );
        } catch (e) {
            Alert.alert('Error', 'No se pudo crear el backup.');
        }
    };

    const handleRestore = async () => {
        Alert.alert(
            'Restaurar backup',
            'Esto reemplazará tus datos actuales. ¿Continuar?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Restaurar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await backupService.importData({ mode: 'overwrite' });
                            if (success) Alert.alert('Listo', 'Datos restaurados. Reinicia la app.');
                        } catch (e) {
                            Alert.alert('Error', 'No se pudo restaurar el backup.');
                        }
                    }
                }
            ]
        );
    };

    const handleResetDB = () => {
        Alert.alert(
            'Restablecer de fábrica',
            'Se borrarán TODOS tus datos. Esta acción no se puede deshacer.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'BORRAR TODO',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await dbService.factoryReset();
                            await configService.reset();
                            await loadSettings();
                            Alert.alert('Listo', 'Datos eliminados. La app quedó como nueva.');
                        } catch (e) {
                            Alert.alert('Error', 'No se pudo completar el restablecimiento.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaWrapper className="bg-iron-900" edges={['left', 'right']}>
            <Stack.Screen options={{ title: 'Ajustes', headerTitleStyle: { color: Colors.iron[950] }, headerStyle: { backgroundColor: Colors.iron[900] }, headerTintColor: Colors.primary.DEFAULT }} />

            <ScrollView className="flex-1 px-4">
                {/* ... existing content ... */}
                <Text className="text-iron-950 font-bold uppercase mt-6 mb-2 text-xs">Preferencias generales</Text>

                <View className="bg-surface rounded-xl overflow-hidden border border-iron-700 elevation-1">
                    <View className="flex-row items-center justify-between p-4 border-b border-iron-200">
                        <View className="flex-row items-center gap-3">
                            <Disc size={20} color={Colors.primary.DEFAULT} />
                            <Text className="text-iron-950 font-semibold">Unidades de peso</Text>
                        </View>
                        <View className="flex-row items-center gap-2 bg-iron-100 rounded-lg p-1 border border-iron-200">
                            <TouchableOpacity
                                onPress={() => saveSetting('weightUnit', 'kg')}
                                className={`px-3 py-1 rounded ${units === 'kg' ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                            >
                                <Text className={`font-bold ${units === 'kg' ? 'text-primary' : 'text-iron-500'}`}>KG</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => saveSetting('weightUnit', 'lbs')}
                                className={`px-3 py-1 rounded ${units === 'lbs' ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                            >
                                <Text className={`font-bold ${units === 'lbs' ? 'text-primary' : 'text-iron-500'}`}>LBS</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center gap-3">
                            <Timer size={20} color={Colors.primary.DEFAULT} />
                            <Text className="text-iron-950 font-semibold">Descanso por defecto</Text>
                        </View>
                        <View className="flex-row items-center">
                            <TouchableOpacity 
                                onPress={() => saveSetting('defaultRestTimer', Math.max(0, defaultTimer - 30))}
                                className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center mr-2"
                                accessibilityRole="button"
                                accessibilityLabel="Reducir tiempo de descanso"
                            >
                                <Text className="font-bold">-</Text>
                            </TouchableOpacity>
                            <Text className="text-iron-950 mr-2 font-bold w-8 text-center">{defaultTimer}s</Text>
                            <TouchableOpacity 
                                onPress={() => saveSetting('defaultRestTimer', defaultTimer + 30)}
                                className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center"
                                accessibilityRole="button"
                                accessibilityLabel="Aumentar tiempo de descanso"
                            >
                                <Text className="font-bold">+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between p-4 border-t border-iron-200">
                        <View className="flex-row items-center gap-3">
                            <Timer size={20} color={Colors.primary.DEFAULT} />
                            <View>
                                <Text className="text-iron-950 font-semibold">Auto rest al completar serie</Text>
                                <Text className="text-iron-500 text-xs">Inicia el timer automáticamente al marcar completed.</Text>
                            </View>
                        </View>
                        <Switch
                            value={autoRestOnComplete}
                            onValueChange={(v) => saveSetting('autoStartRestTimerOnSetComplete', v)}
                            accessibilityLabel="Activar o desactivar auto descanso"
                        />
                    </View>
                </View>

                <Text className="text-iron-950 font-bold uppercase mt-8 mb-2 text-xs">Análisis</Text>
                <View className="bg-surface rounded-xl overflow-hidden border border-iron-700 elevation-1">
                    <View className="p-4">
                        <Text className="text-iron-950 font-semibold mb-3">Rango por defecto</Text>
                        <View className="flex-row gap-2">
                            {[7, 30, 90, 365].map((d) => (
                                <TouchableOpacity
                                    key={d}
                                    onPress={() => saveSetting('analyticsDefaultRangeDays', d as any)}
                                    className={`px-3 py-2 rounded-full border ${analyticsRange === d ? 'bg-primary border-primary' : 'bg-white border-iron-200'}`}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Seleccionar rango ${d} días`}
                                >
                                    <Text className={`font-bold ${analyticsRange === d ? 'text-white' : 'text-iron-950'}`}>{d}D</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>

                <Text className="text-iron-950 font-bold uppercase mt-8 mb-2 text-xs">Calculadoras</Text>
                <View className="bg-surface rounded-xl overflow-hidden border border-iron-700 elevation-1">
                    <View className="p-4 border-b border-iron-200">
                        <Text className="text-iron-950 font-semibold mb-3">Fórmula 1RM por defecto</Text>
                        <View className="flex-row gap-2">
                            {([
                                { id: 'epley', label: 'Epley' },
                                { id: 'brzycki', label: 'Brzycki' },
                                { id: 'lombardi', label: 'Lombardi' }
                            ] as const).map((f) => (
                                <TouchableOpacity
                                    key={f.id}
                                    onPress={() => saveSetting('calculatorsDefault1RMFormula', f.id)}
                                    className={`flex-1 px-3 py-2 rounded-lg border ${rmFormula === f.id ? 'bg-primary border-primary' : 'bg-white border-iron-200'}`}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Seleccionar fórmula ${f.label}`}
                                >
                                    <Text className={`text-center font-bold ${rmFormula === f.id ? 'text-white' : 'text-iron-950'}`}>{f.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View className="p-4">
                        <Text className="text-iron-950 font-semibold mb-2">Redondeo</Text>
                        <Text className="text-iron-500 text-xs mb-3">Se usa en porcentajes y warm-up.</Text>
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-iron-950 font-bold">KG</Text>
                            <View className="flex-row items-center">
                                <TouchableOpacity
                                    onPress={() => saveSetting('calculatorsRoundingKg', Math.max(0.25, roundKg - 0.25) as any)}
                                    className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center mr-2"
                                    accessibilityRole="button"
                                    accessibilityLabel="Reducir redondeo kg"
                                >
                                    <Text className="font-bold">-</Text>
                                </TouchableOpacity>
                                <Text className="text-iron-950 mr-2 font-bold w-12 text-center">{roundKg}</Text>
                                <TouchableOpacity
                                    onPress={() => saveSetting('calculatorsRoundingKg', roundKg + 0.25 as any)}
                                    className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center"
                                    accessibilityRole="button"
                                    accessibilityLabel="Aumentar redondeo kg"
                                >
                                    <Text className="font-bold">+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="flex-row items-center justify-between">
                            <Text className="text-iron-950 font-bold">LBS</Text>
                            <View className="flex-row items-center">
                                <TouchableOpacity
                                    onPress={() => saveSetting('calculatorsRoundingLbs', Math.max(0.5, roundLbs - 0.5) as any)}
                                    className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center mr-2"
                                    accessibilityRole="button"
                                    accessibilityLabel="Reducir redondeo lbs"
                                >
                                    <Text className="font-bold">-</Text>
                                </TouchableOpacity>
                                <Text className="text-iron-950 mr-2 font-bold w-12 text-center">{roundLbs}</Text>
                                <TouchableOpacity
                                    onPress={() => saveSetting('calculatorsRoundingLbs', roundLbs + 0.5 as any)}
                                    className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center"
                                    accessibilityRole="button"
                                    accessibilityLabel="Aumentar redondeo lbs"
                                >
                                    <Text className="font-bold">+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                <Text className="text-iron-950 font-bold uppercase mt-8 mb-2 text-xs">Herramientas y datos</Text>
                <View className="bg-surface rounded-xl overflow-hidden border border-iron-700 elevation-1">
                    <TouchableOpacity onPress={() => router.push('/tools/plate-calculator' as any)} className="flex-row items-center justify-between p-4 border-b border-iron-200">
                        <View className="flex-row items-center gap-3">
                            <Disc size={20} color={Colors.primary.DEFAULT} />
                            <Text className="text-iron-950 font-semibold">Inventario de discos</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>

                    <View className="p-4 border-b border-iron-200">
                        <Text className="text-iron-950 font-semibold mb-3">Barra por defecto</Text>
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-iron-950 font-bold">20kg</Text>
                            <View className="flex-row items-center">
                                <TouchableOpacity
                                    onPress={() => saveSetting('plateCalculatorDefaultBarWeightKg', Math.max(0, barKg - 1) as any)}
                                    className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center mr-2"
                                    accessibilityRole="button"
                                    accessibilityLabel="Reducir barra kg"
                                >
                                    <Text className="font-bold">-</Text>
                                </TouchableOpacity>
                                <Text className="text-iron-950 mr-2 font-bold w-12 text-center">{barKg}</Text>
                                <TouchableOpacity
                                    onPress={() => saveSetting('plateCalculatorDefaultBarWeightKg', barKg + 1 as any)}
                                    className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center"
                                    accessibilityRole="button"
                                    accessibilityLabel="Aumentar barra kg"
                                >
                                    <Text className="font-bold">+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="flex-row items-center justify-between">
                            <Text className="text-iron-950 font-bold">45lbs</Text>
                            <View className="flex-row items-center">
                                <TouchableOpacity
                                    onPress={() => saveSetting('plateCalculatorDefaultBarWeightLbs', Math.max(0, barLbs - 1) as any)}
                                    className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center mr-2"
                                    accessibilityRole="button"
                                    accessibilityLabel="Reducir barra lbs"
                                >
                                    <Text className="font-bold">-</Text>
                                </TouchableOpacity>
                                <Text className="text-iron-950 mr-2 font-bold w-12 text-center">{barLbs}</Text>
                                <TouchableOpacity
                                    onPress={() => saveSetting('plateCalculatorDefaultBarWeightLbs', barLbs + 1 as any)}
                                    className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center"
                                    accessibilityRole="button"
                                    accessibilityLabel="Aumentar barra lbs"
                                >
                                    <Text className="font-bold">+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between p-4 border-b border-iron-200">
                        <View className="flex-row items-center gap-3">
                            <Disc size={20} color={Colors.primary.DEFAULT} />
                            <View>
                                <Text className="text-iron-950 font-semibold">Preferir menos discos</Text>
                                <Text className="text-iron-500 text-xs">Prioriza armados más rápidos.</Text>
                            </View>
                        </View>
                        <Switch
                            value={preferFewerPlates}
                            onValueChange={(v) => saveSetting('plateCalculatorPreferFewerPlates', v)}
                            accessibilityLabel="Alternar preferencia de menos discos"
                        />
                    </View>

                    <TouchableOpacity onPress={handleBackup} className="flex-row items-center justify-between p-4 border-b border-iron-200">
                        <View className="flex-row items-center gap-3">
                            <Database size={20} color={Colors.primary.DEFAULT} />
                            <Text className="text-iron-950 font-semibold">Exportar backup (JSON)</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleRestore} className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center gap-3">
                            <Database size={20} color={Colors.red} />
                            <Text className="text-iron-950 font-semibold">Restaurar backup</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>
                </View>

                <Text className="text-iron-950 font-bold uppercase mt-8 mb-2 text-xs">Zona de riesgo</Text>
                <View className="bg-surface rounded-xl overflow-hidden border border-red-200 elevation-1">
                    <TouchableOpacity onPress={handleResetDB} className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center gap-3">
                            <Trash2 size={20} color={Colors.red} />
                            <Text className="text-red-600 font-semibold">Restablecer de fábrica</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.red} />
                    </TouchableOpacity>
                </View>

                <Text className="text-iron-950 font-bold uppercase mt-8 mb-2 text-xs">Actualizaciones</Text>
                <View className="bg-surface rounded-xl overflow-hidden border border-iron-700 elevation-1">
                    <View className="p-4 border-b border-iron-200">
                        <Text className="text-iron-950 font-semibold">Estado</Text>
                        {updateStatus.status === 'disabled' ? (
                            <Text className="text-iron-500 text-xs mt-1">Configura `extra.updateFeedUrl` para habilitar comprobación.</Text>
                        ) : updateStatus.status === 'error' ? (
                            <Text className="text-iron-500 text-xs mt-1">No se pudo comprobar: {updateStatus.message}</Text>
                        ) : updateStatus.status === 'up_to_date' ? (
                            <Text className="text-iron-500 text-xs mt-1">Estás al día (v{updateStatus.installedVersion}).</Text>
                        ) : updateStatus.status === 'update_pending' ? (
                            <Text className="text-iron-500 text-xs mt-1">
                                Update pendiente: v{updateStatus.latestVersion}
                                {updateStatus.date ? ` · ${updateStatus.date}` : ''}
                                {' · APK aún no está listo.'}
                            </Text>
                        ) : (
                            <Text className="text-iron-500 text-xs mt-1">
                                Actualización disponible: v{updateStatus.latestVersion}
                                {updateStatus.date ? ` · ${updateStatus.date}` : ''}
                            </Text>
                        )}
                    </View>

                    <View className="p-4 flex-row gap-3">
                        <View className="flex-1">
                            <TouchableOpacity
                                onPress={checkUpdates}
                                disabled={checkingUpdate || updateStatus.status === 'disabled'}
                                className={`bg-white border border-iron-200 rounded-xl p-4 items-center ${checkingUpdate || updateStatus.status === 'disabled' ? 'opacity-60' : ''}`}
                                accessibilityRole="button"
                                accessibilityLabel="Buscar actualizaciones"
                            >
                                <Text className="text-iron-950 font-bold">{checkingUpdate ? 'Buscando...' : 'Buscar'}</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-1">
                            <TouchableOpacity
                                onPress={async () => {
                                    if (updateStatus.status !== 'update_available' && updateStatus.status !== 'update_pending') return;
                                    const url =
                                        updateStatus.status === 'update_available'
                                            ? (updateStatus.downloadUrl ?? updateStatus.downloadsPageUrl ?? updateStatus.notesUrl)
                                            : (updateStatus.downloadsPageUrl ?? updateStatus.notesUrl);
                                    if (!url) {
                                        Alert.alert('Sin enlace', 'No hay enlace de descarga configurado.');
                                        return;
                                    }
                                    try {
                                        await Linking.openURL(url);
                                    } catch {
                                        Alert.alert('Error', 'No se pudo abrir el enlace.');
                                    }
                                }}
                                disabled={updateStatus.status !== 'update_available' && updateStatus.status !== 'update_pending'}
                                className={`bg-primary rounded-xl p-4 flex-row items-center justify-center gap-2 ${updateStatus.status !== 'update_available' && updateStatus.status !== 'update_pending' ? 'opacity-60' : ''}`}
                                accessibilityRole="button"
                                accessibilityLabel="Abrir descarga"
                            >
                                <Download size={18} color="white" />
                                <Text className="text-white font-bold">{updateStatus.status === 'update_pending' ? 'Ver descargas' : 'Descargar'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <Text className="text-center text-iron-500 mt-10 mb-10">
                    IronTrain v{installedVersion}{footerDate ? ` · ${footerDate}` : ''}
                </Text>
            </ScrollView>
        </SafeAreaWrapper>
    );
}
