import { Colors } from '@/src/theme';
import * as Haptics from 'expo-haptics';
import { ArrowDownCircle, Check, CirclePause, Copy, Dumbbell, Flame, MessageSquare, RefreshCw, Skull, Trash2, Trophy } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
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

export const SET_TYPE_CONFIG: { key: string; label: string; shortLabel: string; Icon: any; bg: string; text: string }[] = [
    { key: 'normal', label: 'Serie Normal', shortLabel: 'SERIE', Icon: Dumbbell, bg: Colors.iron[200], text: Colors.iron[500] },
    { key: 'warmup', label: 'Calentamiento', shortLabel: 'CALENT', Icon: Flame, bg: '#fef3c7', text: '#92400e' },
    { key: 'failure', label: 'Al Fallo', shortLabel: 'FALLO', Icon: Skull, bg: '#fee2e2', text: '#991b1b' },
    { key: 'drop', label: 'Drop Set', shortLabel: 'DROP', Icon: ArrowDownCircle, bg: '#f3e8ff', text: '#6d28d9' },
    { key: 'myo_reps', label: 'Myo-Reps', shortLabel: 'MYO', Icon: RefreshCw, bg: '#dbeafe', text: '#1e40af' },
    { key: 'rest_pause', label: 'Rest-Pause', shortLabel: 'R-P', Icon: CirclePause, bg: '#d1fae5', text: '#065f46' },
    { key: 'pr', label: 'Récord Personal', shortLabel: 'PR', Icon: Trophy, bg: Colors.primary.DEFAULT + '15', text: Colors.primary.DEFAULT },
];

export const TYPE_COLORS: Record<string, { bg: string; text: string }> = Object.fromEntries(
    SET_TYPE_CONFIG.map(c => [c.key, { bg: c.bg, text: c.text }])
);

export function SetRow({ set, index, normalIndex, onUpdate, onDelete, onCopy, exerciseType = 'weight_reps', disabled }: SetRowProps) {
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
                        <Trash2 size={22} color="white" />
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
                        <Copy size={22} color="white" />
                        <Text style={ss.swipeLabel}>COPIAR</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    };

    const inputStyle = (completed: boolean) => ({
        fontSize: 24,
        fontWeight: '800' as const,
        textAlign: 'center' as const,
        width: '100%' as any,
        padding: 8,
        borderRadius: 10,
        color: completed ? Colors.primary.DEFAULT : Colors.iron[950],
        backgroundColor: completed ? Colors.primary.DEFAULT + '08' : Colors.iron[200],
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
                    (set.type || 'normal') !== 'normal' && { borderColor: typeColor.text + '25' },
                ]}>
                    {/* Type accent bar for non-normal */}
                    {(set.type || 'normal') !== 'normal' && (
                        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: typeColor.text, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, zIndex: 1 }} />
                    )}

                    {/* Header */}
                    <View style={[
                        ss.header,
                        isCompleted ? ss.headerCompleted : ss.headerDefault,
                        (set.type || 'normal') !== 'normal' && !isCompleted && { backgroundColor: typeColor.bg, borderBottomColor: typeColor.text + '15' },
                    ]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => { if (!disabled) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowTypePicker(true); } }}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 5,
                                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
                                    backgroundColor: typeColor.bg, borderWidth: 1, borderColor: typeColor.text + '30',
                                }}
                            >
                                <currentConfig.Icon size={11} color={typeColor.text} />
                                <Text style={{ fontSize: 11, fontWeight: '900', color: typeColor.text, letterSpacing: 0.3 }}>
                                    {typeLabel}
                                </Text>
                                <Text style={{ fontSize: 8, color: typeColor.text, opacity: 0.5 }}>▼</Text>
                            </TouchableOpacity>
                            {set.previous_weight != null && (
                                <Text style={{ fontSize: 10, color: Colors.iron[400], fontWeight: '500' }}>
                                    ANT: {normalize(toDisplayWeight(set.previous_weight))}{unit} x {set.previous_reps}
                                </Text>
                            )}
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.iron[200], borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 }}>
                            <Text style={{ fontSize: 9, color: Colors.iron[400], fontWeight: '800', marginRight: 4 }}>RPE</Text>
                            <TextInput
                                value={rpe}
                                onChangeText={setRpe}
                                onBlur={handleBlur}
                                keyboardType="numeric"
                                placeholder="-"
                                placeholderTextColor={Colors.iron[400]}
                                style={{ padding: 0, fontSize: 12, fontWeight: '800', color: Colors.iron[700], textAlign: 'center', width: 22, height: 16 }}
                                maxLength={3}
                            />
                        </View>
                    </View>

                    {/* Main Content */}
                    <View style={ss.body}>
                        {exerciseType === 'distance_time' ? (
                            <>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <TextInput value={distanceKm} onChangeText={setDistanceKm} onBlur={handleBlur} keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.iron[300]} style={inputStyle(isCompleted)} editable={!disabled} selectTextOnFocus />
                                    <Text style={ss.inputLabel}>KM</Text>
                                </View>
                                <Text style={ss.separator}>/</Text>
                                <View style={{ flex: 1, alignItems: 'center' }}>
                                    <TextInput value={timeText} onChangeText={setTimeText} onBlur={handleBlur} keyboardType="default" placeholder="mm:ss ó 10m" placeholderTextColor={Colors.iron[300]} style={inputStyle(isCompleted)} editable={!disabled} selectTextOnFocus />
                                    <Text style={ss.inputLabel}>MM:SS</Text>
                                </View>
                            </>
                        ) : (
                            <>
                                {(exerciseType === 'weight_reps' || exerciseType === 'weight_only') && (
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <TextInput value={weight} onChangeText={setWeight} onBlur={handleBlur} keyboardType="numeric" placeholder={set.previous_weight != null ? normalize(toDisplayWeight(set.previous_weight)).toString() : "0"} placeholderTextColor={Colors.iron[300]} style={inputStyle(isCompleted)} editable={!disabled} selectTextOnFocus />
                                        <Text style={ss.inputLabel}>{unit.toUpperCase()}</Text>
                                    </View>
                                )}
                                {exerciseType === 'weight_reps' && <Text style={ss.separator}>X</Text>}
                                {(exerciseType === 'weight_reps' || exerciseType === 'reps_only') && (
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <TextInput value={reps} onChangeText={setReps} onBlur={handleBlur} keyboardType="numeric" placeholder={set.previous_reps?.toString() || "0"} placeholderTextColor={Colors.iron[300]} style={inputStyle(isCompleted)} editable={!disabled} selectTextOnFocus />
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
                                <Check size={22} color={isCompleted ? 'white' : Colors.iron[400]} strokeWidth={3} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setShowNotes(!showNotes)} style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <MessageSquare size={15} color={notes ? Colors.primary.DEFAULT : Colors.iron[300]} fill={notes ? Colors.primary.DEFAULT : 'none'} />
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
                                placeholderTextColor={Colors.iron[400]}
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
                                    style={[ss.pickerRow, isSelected && { backgroundColor: cfg.bg, borderColor: cfg.text + '40' }]}
                                >
                                    <View style={[ss.pickerIconCircle, { backgroundColor: cfg.text + '15' }]}>
                                        <cfg.Icon size={16} color={cfg.text} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[ss.pickerLabel, isSelected && { color: cfg.text, fontWeight: '900' }]}>{cfg.label}</Text>
                                    </View>
                                    {isSelected && <View style={[ss.pickerCheck, { backgroundColor: cfg.text }]}>
                                        <Check size={12} color="#fff" />
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

const ss = StyleSheet.create({
    card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
    cardDefault: { borderColor: Colors.iron[300], backgroundColor: Colors.surface },
    cardCompleted: { borderColor: Colors.primary.DEFAULT, backgroundColor: '#fffbf7' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
    headerDefault: { backgroundColor: Colors.iron[200], borderBottomColor: Colors.iron[200] },
    headerCompleted: { backgroundColor: Colors.primary.DEFAULT + '08', borderBottomColor: Colors.primary.DEFAULT + '20' },
    body: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
    separator: { color: Colors.iron[300], fontWeight: '900', fontSize: 20 },
    inputLabel: { fontSize: 9, color: Colors.iron[400], fontWeight: '800', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    checkBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    checkBtnActive: { backgroundColor: Colors.primary.DEFAULT, shadowColor: Colors.primary.DEFAULT, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 },
    checkBtnInactive: { backgroundColor: Colors.iron[200], borderWidth: 1, borderColor: Colors.iron[300] },
    notesInput: { fontSize: 13, backgroundColor: '#fef9f0', color: Colors.iron[700], padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#fef3c720' },
    swipeDelete: { justifyContent: 'center', alignItems: 'flex-end', borderTopRightRadius: 14, borderBottomRightRadius: 14, marginLeft: -16, width: 96, backgroundColor: '#ef4444' },
    swipeCopy: { justifyContent: 'center', alignItems: 'flex-start', width: 96, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, marginRight: -16, backgroundColor: Colors.primary.dark },
    swipeLabel: { color: '#fff', fontSize: 9, fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 32 },
    pickerContainer: { backgroundColor: Colors.surface, borderRadius: 20, padding: 20, width: '100%', maxWidth: 340, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 10 },
    pickerTitle: { fontSize: 16, fontWeight: '900', color: Colors.iron[950], marginBottom: 14, letterSpacing: -0.3 },
    pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', marginBottom: 4, gap: 12 },
    pickerIconCircle: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    pickerLabel: { fontSize: 14, fontWeight: '700', color: Colors.iron[950] },
    pickerCheck: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
