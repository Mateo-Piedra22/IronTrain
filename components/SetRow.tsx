import { Colors } from '@/src/theme';
import * as Haptics from 'expo-haptics';
import { Check, Copy, MessageSquare, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Animated, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { configService } from '../src/services/ConfigService';
import { UnitService } from '../src/services/UnitService';
import { ExerciseType, WorkoutSet } from '../src/types/db';
import { formatTimeSeconds, parseFlexibleTimeToSeconds } from '../src/utils/time';

interface SetRowProps {
    set: WorkoutSet;
    index: number;
    onUpdate: (id: string, updates: Partial<WorkoutSet>) => void;
    onDelete: (id: string) => void;
    onCopy?: (id: string) => void;
    exerciseType?: ExerciseType;
    disabled?: boolean;
}

export function SetRow({ set, index, onUpdate, onDelete, onCopy, exerciseType = 'weight_reps', disabled }: SetRowProps) {
    const unit = configService.get('weightUnit');
    const toDisplayWeight = (kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue);
    const toKg = (displayValue: number) => unit === 'kg' ? displayValue : UnitService.lbsToKg(displayValue);
    const normalize = (n: number) => (Math.round(n * 100) / 100);
    const typeLabel =
        set.type === 'normal'
            ? `SERIE ${index + 1}`
            : set.type === 'warmup'
                ? 'CALENT'
                : set.type === 'failure'
                    ? 'FALLO'
                    : set.type === 'drop'
                        ? 'DROP'
                        : 'PR';

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

    // Ghost Logic
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
            Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
            return;
        }
        const w = weight ? parseFloat(weight) : undefined;
        const dKm = distanceKm ? parseFloat(distanceKm) : undefined;
        const t = parseTimeToSeconds(timeText);
        if (exerciseType === 'distance_time' && timeText.trim() && t == null) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Tiempo inválido', 'Usa mm:ss, hh:mm:ss o sufijos: 90s, 10m, 1h.');
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
            Alert.alert('Tiempo inválido', 'Usa mm:ss, hh:mm:ss o sufijos: 90s, 10m, 1h.');
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

    // --- ANIMATION LOGIC FOR SWIPE ---
    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        // We use scale to "unveil" the icon without moving it
        const scale = dragX.interpolate({
            inputRange: [-100, -50, 0],
            outputRange: [1.2, 0.8, 0],
            extrapolate: 'clamp',
        });

        const opacity = dragX.interpolate({
            inputRange: [-100, -20, 0],
            outputRange: [1, 0, 0],
            extrapolate: 'clamp',
        });

        return (
            <View className="justify-center items-end rounded-r-xl ml-[-16px] w-24" style={{ backgroundColor: Colors.red }}>
                <Animated.View style={{ transform: [{ scale }], opacity, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingLeft: 16 }}>
                    <TouchableOpacity
                        onPress={() => {
                            if (disabled) {
                                Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
                                return;
                            }
                            if (isCompleted) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                Alert.alert(
                                    "Serie bloqueada",
                                    "Esta serie está marcada como completada. Desmárcala para poder eliminarla.",
                                    [{ text: "Entendido", style: "default" }]
                                );
                                return;
                            }
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            onDelete(set.id);
                        }}
                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar serie ${index + 1}`}
                    >
                        <Trash2 size={24} color="white" />
                        <Text className="text-white text-[10px] font-bold mt-1">BORRAR</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    };

    const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const scale = dragX.interpolate({
            inputRange: [0, 50, 100],
            outputRange: [0, 0.8, 1.2],
            extrapolate: 'clamp',
        });

        return (
            <View className="justify-center items-start w-24 rounded-l-xl mr-[-16px]" style={{ backgroundColor: Colors.primary.dark }}>
                <Animated.View style={{ transform: [{ scale }], width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingRight: 16 }}>
                    <TouchableOpacity
                        onPress={() => {
                            if (disabled) {
                                Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
                                return;
                            }
                            if (!onCopy) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                Alert.alert('No disponible', 'No se pudo copiar esta serie.');
                                return;
                            }
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onCopy(set.id);
                        }}
                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                        accessibilityRole="button"
                        accessibilityLabel={`Copiar serie ${index + 1}`}
                    >
                        <Copy size={24} color="white" />
                        <Text className="text-white text-[10px] font-bold mt-1">COPIAR</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    };

    return (
        <View className="mb-3">
            <Swipeable
                renderRightActions={canSwipe ? renderRightActions : undefined}
                renderLeftActions={canSwipe ? renderLeftActions : undefined}
                containerStyle={{ overflow: 'visible' }}
                leftThreshold={40}
                rightThreshold={40}
            >
                <View className={`rounded-xl border shadow-sm overflow-hidden ${isCompleted
                    ? 'border-primary bg-[#fffbf7]' // Solid Cream/Coffee-tinted background, no transparency but clear differentiation
                    : 'border-iron-200 bg-iron-800'
                    }`}>

                    {/* Header */}
                    <View className={`flex-row items-center justify-between px-3 py-2 border-b ${isCompleted ? 'bg-primary/5 border-primary/20' : 'bg-iron-200 border-iron-100'
                        }`}>
                        <View className="flex-row items-center gap-2">
                            <View className={`px-2 py-0.5 rounded-md ${set.type === 'warmup' ? 'bg-yellow-100' :
                                set.type === 'failure' ? 'bg-red-100' :
                                    set.type === 'drop' ? 'bg-purple-100' : 'bg-iron-200'
                                }`}>
                                <Text className={`text-[10px] font-bold uppercase ${set.type === 'warmup' ? 'text-yellow-700' :
                                    set.type === 'failure' ? 'text-red-700' :
                                        set.type === 'drop' ? 'text-purple-700' : 'text-iron-600'
                                    }`}>
                                    {typeLabel}
                                </Text>
                            </View>
                            {set.previous_weight && (
                                <Text className="text-[10px] text-iron-400 font-medium">
                                    ANT: {normalize(toDisplayWeight(set.previous_weight))}{unit} x {set.previous_reps}
                                </Text>
                            )}
                        </View>

                        <View className="flex-row items-center bg-iron-100 rounded px-1.5 py-0.5">
                            <Text className="text-[9px] text-iron-500 font-bold mr-1">RPE</Text>
                            <TextInput
                                value={rpe}
                                onChangeText={setRpe}
                                onBlur={handleBlur}
                                keyboardType="numeric"
                                placeholder="-"
                                placeholderTextColor={Colors.iron[400]}
                                className="p-0 text-xs font-bold text-iron-700 text-center w-6 h-4"
                                maxLength={3}
                            />
                        </View>
                    </View>

                {/* Main Content */}
                <View className="flex-row items-center p-3 gap-3">
                    {exerciseType === 'distance_time' ? (
                        <>
                            <View className="flex-1 items-center">
                                <TextInput
                                    value={distanceKm}
                                    onChangeText={setDistanceKm}
                                    onBlur={handleBlur}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor={Colors.iron[300]}
                                    className={`text-2xl font-bold text-center w-full p-2 rounded-lg ${isCompleted ? 'text-primary bg-primary/5' : 'text-iron-950 bg-iron-100'}`}
                                    editable={!disabled}
                                    selectTextOnFocus
                                />
                                <Text className="text-[10px] text-iron-400 font-bold mt-1 uppercase">KM</Text>
                            </View>

                            <Text className="text-iron-300 font-black text-xl">/</Text>

                            <View className="flex-1 items-center">
                                <TextInput
                                    value={timeText}
                                    onChangeText={setTimeText}
                                    onBlur={handleBlur}
                                    keyboardType="default"
                                    placeholder="mm:ss ó 10m"
                                    placeholderTextColor={Colors.iron[300]}
                                    className={`text-2xl font-bold text-center w-full p-2 rounded-lg ${isCompleted ? 'text-primary bg-primary/5' : 'text-iron-950 bg-iron-100'}`}
                                    editable={!disabled}
                                    selectTextOnFocus
                                />
                                <Text className="text-[10px] text-iron-400 font-bold mt-1 uppercase">MM:SS</Text>
                            </View>
                        </>
                    ) : (
                        <>
                            {(exerciseType === 'weight_reps' || exerciseType === 'weight_only') && (
                                <View className="flex-1 items-center">
                                    <TextInput
                                        value={weight}
                                        onChangeText={setWeight}
                                        onBlur={handleBlur}
                                        keyboardType="numeric"
                                        placeholder={set.previous_weight != null ? normalize(toDisplayWeight(set.previous_weight)).toString() : "0"}
                                        placeholderTextColor={Colors.iron[300]}
                                        className={`text-2xl font-bold text-center w-full p-2 rounded-lg ${isCompleted ? 'text-primary bg-primary/5' : 'text-iron-950 bg-iron-100'}`}
                                        editable={!disabled}
                                        selectTextOnFocus
                                    />
                                    <Text className="text-[10px] text-iron-400 font-bold mt-1 uppercase">{unit.toUpperCase()}</Text>
                                </View>
                            )}

                            {exerciseType === 'weight_reps' && (
                                <Text className="text-iron-300 font-black text-xl">X</Text>
                            )}

                            {(exerciseType === 'weight_reps' || exerciseType === 'reps_only') && (
                                <View className="flex-1 items-center">
                                    <TextInput
                                        value={reps}
                                        onChangeText={setReps}
                                        onBlur={handleBlur}
                                        keyboardType="numeric"
                                        placeholder={set.previous_reps?.toString() || "0"}
                                        placeholderTextColor={Colors.iron[300]}
                                        className={`text-2xl font-bold text-center w-full p-2 rounded-lg ${isCompleted ? 'text-primary bg-primary/5' : 'text-iron-950 bg-iron-100'}`}
                                        editable={!disabled}
                                        selectTextOnFocus
                                    />
                                    <Text className="text-[10px] text-iron-400 font-bold mt-1 uppercase">REPS</Text>
                                </View>
                            )}
                        </>
                    )}

                    {/* Action Buttons */}
                    <View className="flex-col gap-2 ml-2">
                        <TouchableOpacity
                            onPress={() => {
                                if (disabled) {
                                    Alert.alert('Entrenamiento finalizado', 'Este entrenamiento está finalizado y no se puede editar.');
                                    return;
                                }
                                if (isCompleted) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                } else {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }
                                handleComplete();
                            }}
                            className={`w-12 h-12 rounded-xl items-center justify-center shadow-sm ${isCompleted ? 'bg-primary border border-primary' : 'bg-iron-200 border border-iron-200'
                                }`}
                        >
                            <Check size={24} color={isCompleted ? 'white' : Colors.iron[400]} strokeWidth={3} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowNotes(!showNotes)}
                            className="items-center justify-center"
                        >
                            <MessageSquare
                                size={16}
                                color={notes ? Colors.primary.DEFAULT : Colors.iron[300]}
                                fill={notes ? Colors.primary.DEFAULT : 'none'}
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Notes Input */}
                {showNotes && (
                    <View className="px-3 pb-3 pt-0">
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            onBlur={handleBlur}
                            placeholder="Agregar notas..."
                            placeholderTextColor={Colors.iron[400]}
                            className="text-sm bg-yellow-50 text-iron-700 p-2 rounded-lg border border-yellow-100/50"
                            editable={!disabled}
                        />
                    </View>
                )}

                </View>
            </Swipeable>
        </View>
    );
}
