import { ThemeFx, withAlpha } from '@/src/theme';
import * as Haptics from 'expo-haptics';
import { ArrowDownCircle, Check, CirclePause, Copy, Dumbbell, Flame, MessageSquare, RefreshCw, Skull, Trash2, Trophy } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useColors } from '../src/hooks/useColors';
import { configService } from '../src/services/ConfigService';
import { UnitService } from '../src/services/UnitService';
import { confirm } from '../src/store/confirmStore';
import { ExerciseType, WorkoutSet } from '../src/types/db';
import { formatTimeSeconds, parseFlexibleTimeToSeconds } from '../src/utils/time';

interface SetRowProps {
    set: WorkoutSet;
    index: number;
    normalIndex?: number;
    onUpdate: (id: string, updates: Partial<WorkoutSet>) => void;
    onDelete: (id: string) => void;
    onCopy?: (id: string) => void;
    exerciseType?: ExerciseType;
    disabled?: boolean;
}

export type SetTypeConfigItem = {
    key: string;
    label: string;
    shortLabel: string;
    Icon: any;
};

export interface SetTypeConfigItemWithColors extends SetTypeConfigItem {
    bg: string;
    text: string;
}

export const SET_TYPES: SetTypeConfigItem[] = [
    { key: 'normal', label: 'Serie Normal', shortLabel: 'SERIE', Icon: Dumbbell },
    { key: 'warmup', label: 'Calentamiento', shortLabel: 'CALENT', Icon: Flame },
    { key: 'failure', label: 'Al Fallo', shortLabel: 'FALLO', Icon: Skull },
    { key: 'drop', label: 'Drop Set', shortLabel: 'DROP', Icon: ArrowDownCircle },
    { key: 'myo_reps', label: 'Myo-Reps', shortLabel: 'MYO', Icon: RefreshCw },
    { key: 'rest_pause', label: 'Rest-Pause', shortLabel: 'R-P', Icon: CirclePause },
    { key: 'pr', label: 'Récord Personal', shortLabel: 'PR', Icon: Trophy },
];

export function useSetTypeConfig() {
    const colors = useColors();
    return useMemo(() => {
        const configs: SetTypeConfigItemWithColors[] = SET_TYPES.map(c => {
            let styling = { bg: colors.surfaceLighter, text: colors.textMuted };
            if (c.key === 'warmup') styling = { bg: withAlpha(colors.yellow, '35'), text: colors.textMuted };
            else if (c.key === 'failure') styling = { bg: withAlpha(colors.red, '20'), text: colors.red };
            else if (c.key === 'drop') styling = { bg: withAlpha(colors.primary.light, '30'), text: colors.primary.dark };
            else if (c.key === 'myo_reps') styling = { bg: withAlpha(colors.blue, '25'), text: colors.blue };
            else if (c.key === 'rest_pause') styling = { bg: withAlpha(colors.green, '25'), text: colors.green };
            else if (c.key === 'pr') styling = { bg: withAlpha(colors.primary.DEFAULT, '15'), text: colors.primary.DEFAULT };
            return { ...c, ...styling };
        });

        const typeColors = Object.fromEntries(
            configs.map(c => [c.key, { bg: c.bg, text: c.text }])
        );

        return { configs, typeColors };
    }, [colors]);
}

export function SetRow({ set, index, normalIndex, onUpdate, onDelete, onCopy, exerciseType = 'weight_reps', disabled }: SetRowProps) {
    const colors = useColors();
    const { configs: SET_TYPE_CONFIG, typeColors: TYPE_COLORS } = useSetTypeConfig();

    const ss = useMemo(() => StyleSheet.create({
        card: { borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' },
        cardDefault: { borderColor: colors.border, backgroundColor: colors.surface },
        cardCompleted: { borderColor: colors.primary.DEFAULT, backgroundColor: withAlpha(colors.primary.DEFAULT, '03') },
        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1.5 },
        headerDefault: { backgroundColor: colors.surfaceLighter, borderBottomColor: colors.border },
        headerCompleted: { backgroundColor: withAlpha(colors.primary.DEFAULT, '08'), borderBottomColor: withAlpha(colors.primary.DEFAULT, '20') },
        body: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
        separator: { color: colors.border, fontWeight: '900', fontSize: 24, marginHorizontal: -4 },
        inputLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '800', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
        checkBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
        checkBtnActive: { backgroundColor: colors.primary.DEFAULT, shadowColor: colors.primary.DEFAULT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
        checkBtnInactive: { backgroundColor: colors.surfaceLighter, borderWidth: 1.5, borderColor: colors.border },
        notesInput: { fontSize: 14, backgroundColor: withAlpha(colors.yellow, '08'), color: colors.text, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: withAlpha(colors.yellow, '20'), fontWeight: '500' },
        swipeDelete: { justifyContent: 'center', alignItems: 'flex-end', borderTopRightRadius: 16, borderBottomRightRadius: 16, marginLeft: -16, width: 96, backgroundColor: colors.red },
        swipeCopy: { justifyContent: 'center', alignItems: 'flex-start', width: 96, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, marginRight: -16, backgroundColor: colors.primary.dark },
        swipeLabel: { color: colors.white, fontSize: 10, fontWeight: '900', marginTop: 4, letterSpacing: 0.6 },
        pickerOverlay: { flex: 1, backgroundColor: ThemeFx.backdrop, justifyContent: 'center', alignItems: 'center', padding: 24 },
        pickerContainer: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, shadowColor: colors.black, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.25, shadowRadius: 32, elevation: 12, borderWidth: 1.5, borderColor: colors.border },
        pickerTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 18, letterSpacing: -0.5 },
        pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: withAlpha(colors.black, '00'), marginBottom: 6, gap: 14 },
        pickerIconCircle: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
        pickerLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
        pickerCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    }), [colors]);
    const unit = configService.get('weightUnit');
    const toDisplayWeight = (kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue);
    const toKg = (displayValue: number) => unit === 'kg' ? displayValue : UnitService.lbsToKg(displayValue);
    const normalize = (n: number) => (Math.round(n * 100) / 100);
    const [showTypePicker, setShowTypePicker] = useState(false);

    const currentConfig = SET_TYPE_CONFIG.find(c => c.key === (set.type || 'normal')) || SET_TYPE_CONFIG[0];
    const displayNumber = (set.type || 'normal') === 'normal' ? (normalIndex ?? index) + 1 : null;
    const typeLabel = displayNumber !== null ? `${displayNumber}` : currentConfig.shortLabel;

    const selectType = (key: string) => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onUpdate(set.id, { type: key as WorkoutSet['type'] });
        setShowTypePicker(false);
    };

    const formatTimeInput = formatTimeSeconds;

    const [weight, setWeight] = useState(set.weight != null ? normalize(toDisplayWeight(set.weight)).toString() : '');
    const [reps, setReps] = useState(set.reps?.toString() || '');
    const [distanceKm, setDistanceKm] = useState(set.distance != null ? normalize((set.distance ?? 0) / 1000).toString() : '');
    const [timeText, setTimeText] = useState(set.time != null ? formatTimeInput(set.time ?? 0) : '');
    const [rpe, setRpe] = useState(set.rpe?.toString() || '');
    const [notes, setNotes] = useState(set.notes || '');
    const [showNotes, setShowNotes] = useState(!!set.notes);

    function parseTimeToSeconds(text: string): number | null {
        const r = parseFlexibleTimeToSeconds(text);
        if (!r.ok) return null;
        return r.seconds;
    }

    useEffect(() => {
        if (set.weight != null) {
            setWeight(normalize(toDisplayWeight(set.weight)).toString());
            return;
        }
        if (!set.weight && set.previous_weight) {
            setWeight(normalize(toDisplayWeight(set.previous_weight)).toString());
        }
    }, [set.weight, set.previous_weight, unit]);

    useEffect(() => {
        if (set.distance != null) {
            setDistanceKm(normalize((set.distance ?? 0) / 1000).toString());
        }
        if (set.time != null) {
            setTimeText(formatTimeInput(set.time ?? 0));
        }
    }, [set.distance, set.time]);

    const handleComplete = () => {
        if (disabled) {
            confirm.info('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        const w = weight ? parseFloat(weight) : undefined;
        const dKm = distanceKm ? parseFloat(distanceKm) : undefined;
        const t = parseTimeToSeconds(timeText);
        if (exerciseType === 'distance_time' && timeText.trim() && t == null) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            confirm.warning('Tiempo inválido', 'Usa mm:ss, hh:mm:ss o sufijos: 90s, 10m, 1h.');
            return;
        }
        onUpdate(set.id, {
            completed: set.completed ? 0 : 1,
            weight: (exerciseType === 'weight_reps' || exerciseType === 'weight_only') && w != null && Number.isFinite(w) ? toKg(w) : undefined,
            reps: (exerciseType === 'weight_reps' || exerciseType === 'reps_only') ? (reps ? parseInt(reps) : undefined) : undefined,
            distance: exerciseType === 'distance_time' && dKm != null && Number.isFinite(dKm) ? Math.max(0, dKm) * 1000 : undefined,
            time: exerciseType === 'distance_time' ? t ?? undefined : undefined,
            rpe: rpe ? parseFloat(rpe) : undefined,
            notes: notes
        });
    };

    const handleBlur = () => {
        if (disabled) return;
        const w = weight ? parseFloat(weight) : undefined;
        const dKm = distanceKm ? parseFloat(distanceKm) : undefined;
        const t = parseTimeToSeconds(timeText);
        if (exerciseType === 'distance_time' && timeText.trim() && t == null) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            confirm.warning('Tiempo inválido', 'Usa mm:ss, hh:mm:ss o sufijos: 90s, 10m, 1h.');
            return;
        }
        onUpdate(set.id, {
            weight: (exerciseType === 'weight_reps' || exerciseType === 'weight_only') && w != null && Number.isFinite(w) ? toKg(w) : undefined,
            reps: (exerciseType === 'weight_reps' || exerciseType === 'reps_only') ? (reps ? parseInt(reps) : undefined) : undefined,
            distance: exerciseType === 'distance_time' && dKm != null && Number.isFinite(dKm) ? Math.max(0, dKm) * 1000 : undefined,
            time: exerciseType === 'distance_time' ? t ?? undefined : undefined,
            rpe: rpe ? parseFloat(rpe) : undefined,
            notes: notes
        });
    };

    const isCompleted = set.completed === 1;
    const canSwipe = !disabled;
    const typeColor = TYPE_COLORS[set.type || 'normal'] || TYPE_COLORS.normal;

    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const scale = dragX.interpolate({ inputRange: [-100, -50, 0], outputRange: [1.2, 0.8, 0], extrapolate: 'clamp' });
        const opacity = dragX.interpolate({ inputRange: [-100, -20, 0], outputRange: [1, 0, 0], extrapolate: 'clamp' });

        return (
            <View style={ss.swipeDelete}>
                <Animated.View style={{ transform: [{ scale }], opacity, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingLeft: 16 }}>
                    <TouchableOpacity
                        onPress={() => {
                            if (disabled) { confirm.info('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.'); return; }
                            if (isCompleted) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); confirm.info('Serie bloqueada', 'Esta serie está marcada como completada. Desmárcala para poder eliminarla.'); return; }
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            onDelete(set.id);
                        }}
                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                        accessibilityRole="button" accessibilityLabel={`Eliminar serie ${index + 1}`}
                    >
                        <Trash2 size={22} color={colors.white} />
                        <Text style={ss.swipeLabel}>BORRAR</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    };

    const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const scale = dragX.interpolate({ inputRange: [0, 50, 100], outputRange: [0, 0.8, 1.2], extrapolate: 'clamp' });

        return (
            <View style={ss.swipeCopy}>
                <Animated.View style={{ transform: [{ scale }], width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingRight: 16 }}>
                    <TouchableOpacity
                        onPress={() => {
                            if (disabled) { confirm.info('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.'); return; }
                            if (!onCopy) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); confirm.error('No disponible', 'No se pudo copiar esta serie.'); return; }
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onCopy(set.id);
                        }}
                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                        accessibilityRole="button" accessibilityLabel={`Copiar serie ${index + 1}`}
                    >
                        <Copy size={22} color={colors.white} />
                        <Text style={ss.swipeLabel}>COPIAR</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    };

    const inputStyle = (completed: boolean) => ({
        fontSize: 24,
        fontWeight: '900' as const,
        textAlign: 'center' as const,
        width: '100%' as any,
        padding: 10,
        borderRadius: 12,
        color: completed ? colors.primary.DEFAULT : colors.text,
        backgroundColor: completed ? withAlpha(colors.primary.DEFAULT, '08') : colors.surfaceLighter,
        borderWidth: 1.5,
        borderColor: completed ? withAlpha(colors.primary.DEFAULT, '20') : colors.border,
    });

    return (
        <View style={{ marginBottom: 10 }}>
            <Swipeable
                renderRightActions={canSwipe ? renderRightActions : undefined}
                renderLeftActions={canSwipe ? renderLeftActions : undefined}
                containerStyle={{ overflow: 'visible' }}
                leftThreshold={40}
                rightThreshold={40}
            >
                <View style={[
                    ss.card,
                    isCompleted ? ss.cardCompleted : ss.cardDefault,
                    (set.type || 'normal') !== 'normal' && { borderColor: withAlpha(typeColor.text, '25') },
                ]}>
                    {/* Type accent bar for non-normal */}
                    {(set.type || 'normal') !== 'normal' && (
                        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: typeColor.text, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, zIndex: 1 }} />
                    )}

                    {/* Header */}
                    <View style={[
                        ss.header,
                        isCompleted ? ss.headerCompleted : ss.headerDefault,
                        (set.type || 'normal') !== 'normal' && !isCompleted && { backgroundColor: typeColor.bg, borderBottomColor: withAlpha(typeColor.text, '15') },
                    ]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowTypePicker(true); } }}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 5,
                                    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
                                    backgroundColor: typeColor.bg, borderWidth: 1.5, borderColor: withAlpha(typeColor.text, '30'),
                                }}
                            >
                                <currentConfig.Icon size={11} color={typeColor.text} />
                                <Text style={{ fontSize: 11, fontWeight: '900', color: typeColor.text, letterSpacing: 0.3 }}>
                                    {typeLabel}
                                </Text>
                                <Text style={{ fontSize: 8, color: typeColor.text, opacity: 0.5 }}>▼</Text>
                            </TouchableOpacity>
                            {set.previous_weight != null && (
                                <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '500' }}>
                                    ANT: {normalize(toDisplayWeight(set.previous_weight))}{unit} x {set.previous_reps}
                                </Text>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceLighter, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                            <Text style={{ fontSize: 10, color: colors.textMuted, fontWeight: '800', marginRight: 6 }}>RPE</Text>
                            <TextInput
                                value={rpe}
                                onChangeText={setRpe}
                                onBlur={handleBlur}
                                keyboardType="numeric"
                                placeholder="-"
                                placeholderTextColor={colors.textMuted}
                                style={{ padding: 0, fontSize: 13, fontWeight: '900', color: colors.text, textAlign: 'center', width: 24, height: 18 }}
                                maxLength={3}
                            />
                        </View>
                    </View>

                    {/* Main Content */}
                    <View style={ss.body}>
                        {exerciseType === 'distance_time' ? (
                            <>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <TextInput value={distanceKm} onChangeText={setDistanceKm} onBlur={handleBlur} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} style={inputStyle(isCompleted)} editable={!disabled} selectTextOnFocus />
                                    <Text style={ss.inputLabel}>KM</Text>
                                </View>
                                <Text style={ss.separator}>/</Text>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <TextInput value={timeText} onChangeText={setTimeText} onBlur={handleBlur} keyboardType="default" placeholder="mm:ss ó 10m" placeholderTextColor={colors.textMuted} style={inputStyle(isCompleted)} editable={!disabled} selectTextOnFocus />
                                    <Text style={ss.inputLabel}>MM:SS</Text>
                                </View>
                            </>
                        ) : (
                            <>
                                {(exerciseType === 'weight_reps' || exerciseType === 'weight_only') && (
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <TextInput value={weight} onChangeText={setWeight} onBlur={handleBlur} keyboardType="numeric" placeholder={set.previous_weight != null ? normalize(toDisplayWeight(set.previous_weight)).toString() : "0"} placeholderTextColor={colors.textMuted} style={inputStyle(isCompleted)} editable={!disabled} selectTextOnFocus />
                                        <Text style={ss.inputLabel}>{unit.toUpperCase()}</Text>
                                    </View>
                                )}
                                {exerciseType === 'weight_reps' && <Text style={ss.separator}>X</Text>}
                                {(exerciseType === 'weight_reps' || exerciseType === 'reps_only') && (
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <TextInput value={reps} onChangeText={setReps} onBlur={handleBlur} keyboardType="numeric" placeholder={set.previous_reps?.toString() || "0"} placeholderTextColor={colors.textMuted} style={inputStyle(isCompleted)} editable={!disabled} selectTextOnFocus />
                                        <Text style={ss.inputLabel}>REPS</Text>
                                    </View>
                                )}
                            </>
                        )}

                        {/* Action Buttons */}
                        <View style={{ gap: 8, marginLeft: 8 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    if (disabled) { confirm.info('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.'); return; }
                                    if (isCompleted) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } else { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
                                    handleComplete();
                                }}
                                style={[ss.checkBtn, isCompleted ? ss.checkBtnActive : ss.checkBtnInactive]}
                                accessibilityRole="button"
                            >
                                <Check size={22} color={isCompleted ? colors.onPrimary : colors.textMuted} strokeWidth={3} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setShowNotes(!showNotes)} style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <MessageSquare size={15} color={notes ? colors.primary.DEFAULT : colors.border} fill={notes ? colors.primary.DEFAULT : 'none'} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Notes */}
                    {showNotes && (
                        <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                            <TextInput
                                value={notes}
                                onChangeText={setNotes}
                                onBlur={handleBlur}
                                placeholder="Agregar notas..."
                                placeholderTextColor={colors.textMuted}
                                style={ss.notesInput}
                                editable={!disabled}
                            />
                        </View>
                    )}
                </View>
            </Swipeable>

            {/* Type Picker Popup */}
            <Modal visible={showTypePicker} transparent animationType="fade" onRequestClose={() => setShowTypePicker(false)}>
                <Pressable style={ss.pickerOverlay} onPress={() => setShowTypePicker(false)}>
                    <View style={ss.pickerContainer}>
                        <Text style={ss.pickerTitle}>Tipo de Serie</Text>
                        {SET_TYPE_CONFIG.map((cfg) => {
                            const isSelected = (set.type || 'normal') === cfg.key;
                            return (
                                <Pressable
                                    key={cfg.key}
                                    onPress={() => selectType(cfg.key)}
                                    style={[ss.pickerRow, isSelected && { backgroundColor: cfg.bg, borderColor: withAlpha(cfg.text, '40') }]}
                                >
                                    <View style={[ss.pickerIconCircle, { backgroundColor: withAlpha(cfg.text, '15') }]}>
                                        <cfg.Icon size={16} color={cfg.text} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[ss.pickerLabel, isSelected && { color: cfg.text, fontWeight: '900' }]}>{cfg.label}</Text>
                                    </View>
                                    {isSelected && <View style={[ss.pickerCheck, { backgroundColor: cfg.text }]}>
                                        <Check size={12} color={colors.white} />
                                    </View>}
                                </Pressable>
                            );
                        })}
                    </View>
                </Pressable>
            </Modal>
        </View >
    );
}


