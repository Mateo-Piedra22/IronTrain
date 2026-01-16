import { Colors } from '@/src/theme';
import { UnitService } from '@/src/services/UnitService';
import { ExerciseType, WorkoutSet } from '@/src/types/db';
import { formatTimeSeconds, parseFlexibleTimeToSeconds } from '@/src/utils/time';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { IronButton } from './IronButton';
import { IronInput } from './IronInput';

interface ExerciseGrouperProps {
    exerciseName: string;
    exerciseType: ExerciseType;
    sets: WorkoutSet[];
    onAddSet: () => void;
    onUpdateSet: (id: string, data: Partial<WorkoutSet>) => void;
    onDeleteSet: (id: string) => void;
    unitSystem: 'metric' | 'imperial';
}

export function ExerciseGrouper({
    exerciseName,
    exerciseType = 'weight_reps',
    sets,
    onAddSet,
    onUpdateSet,
    onDeleteSet,
    unitSystem
}: ExerciseGrouperProps) {

    const [commentModalVisible, setCommentModalVisible] = useState(false);
    const [currentSetId, setCurrentSetId] = useState<string | null>(null);
    const [currentComment, setCurrentComment] = useState('');

    const distanceUnitLabel = unitSystem === 'metric' ? 'km' : 'mi';
    const displayDistance = useMemo(() => {
        return (meters: number) => unitSystem === 'metric' ? (meters / 1000) : (meters / 1609.34);
    }, [unitSystem]);
    const toMeters = useMemo(() => {
        return (d: number) => unitSystem === 'metric' ? (d * 1000) : (d * 1609.34);
    }, [unitSystem]);
    const displayWeight = useMemo(() => {
        return (kg: number) => unitSystem === 'metric' ? kg : UnitService.kgToLbs(kg);
    }, [unitSystem]);
    const toKg = useMemo(() => {
        return (w: number) => unitSystem === 'metric' ? w : UnitService.lbsToKg(w);
    }, [unitSystem]);

    type Draft = { distance: string; time: string; weight: string; reps: string };
    const [drafts, setDrafts] = useState<Record<string, Draft>>({});

    useEffect(() => {
        setDrafts((prev) => {
            const next = { ...prev };
            for (const s of sets) {
                if (next[s.id]) continue;
                next[s.id] = {
                    distance: s.distance != null ? String(Math.round(displayDistance(s.distance) * 100) / 100) : '',
                    time: s.time != null ? formatTimeSeconds(s.time) : '',
                    weight: s.weight != null ? String(Math.round(displayWeight(s.weight) * 100) / 100) : '',
                    reps: s.reps != null ? String(s.reps) : '',
                };
            }
            return next;
        });
    }, [sets, displayDistance, displayWeight]);

    const handleToggleComplete = (set: WorkoutSet) => {
        onUpdateSet(set.id, { completed: set.completed ? 0 : 1 });
    };

    const openComment = (set: WorkoutSet) => {
        setCurrentSetId(set.id);
        setCurrentComment(set.notes || '');
        setCommentModalVisible(true);
    };

    const saveComment = () => {
        if (currentSetId !== null) {
            onUpdateSet(currentSetId, { notes: currentComment });
        }
        setCommentModalVisible(false);
    };

    const isDistTime = exerciseType === 'distance_time';
    const isWeightOnly = exerciseType === 'weight_only';
    const isRepsOnly = exerciseType === 'reps_only';

    const renderHeader = () => {
        if (isDistTime) {
            return (
                <View className="flex-row bg-slate-700/50 p-2 border-b border-border">
                    <Text className="text-textMuted text-xs w-8 text-center">#</Text>
                    <Text className="text-textMuted text-xs flex-1 text-center">{distanceUnitLabel}</Text>
                    <Text className="text-textMuted text-xs flex-1 text-center">Tiempo</Text>
                    <Text className="text-textMuted text-xs w-16 text-center">Acciones</Text>
                </View>
            );
        }
        return (
            <View className="flex-row bg-slate-700/50 p-2 border-b border-border">
                <Text className="text-textMuted text-xs w-8 text-center">#</Text>
                <Text className="text-textMuted text-xs flex-1 text-center">{unitSystem === 'metric' ? 'kg' : 'lb'}</Text>
                <Text className="text-textMuted text-xs flex-1 text-center">Reps</Text>
                <Text className="text-textMuted text-xs w-16 text-center">Acciones</Text>
            </View>
        );
    };

    return (
        <View className="mb-4 flex-row">
            {/* Superset Line Indicator - Visual decoration */}
            <View className="w-1 bg-primary rounded-full mr-3 opacity-50" />

            <View className="flex-1">
                <View className="flex-row justify-between items-center mb-2 bg-surface p-2 rounded-lg border border-border">
                    <Text className="text-iron-950 text-lg font-bold flex-1">{exerciseName}</Text>
                    <IronButton label="Añadir serie" size="sm" onPress={onAddSet} />
                </View>

                <View className="bg-surface rounded-lg border border-border overflow-hidden">
                    {renderHeader()}

                    {sets.map((set, index) => (
                        <View key={set.id}>
                            <View className={`flex-row items-center p-2 border-b border-border/50 ${set.completed ? 'bg-primary/10' : ''}`}>
                                <Text className="text-textMuted w-8 text-center font-mono">{index + 1}</Text>

                                {isDistTime ? (
                                    <>
                                        <View className="flex-1 px-1">
                                            <IronInput
                                                placeholder="0.0"
                                                value={drafts[set.id]?.distance ?? ''}
                                                onChangeText={(val) => setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), distance: val } }))}
                                                onBlur={() => {
                                                    const raw = (drafts[set.id]?.distance ?? '').trim();
                                                    if (!raw) {
                                                        onUpdateSet(set.id, { distance: null as any });
                                                        return;
                                                    }
                                                    const n = Number(raw);
                                                    if (!Number.isFinite(n) || n < 0) {
                                                        Alert.alert('Distancia inválida', `Usa un número válido en ${distanceUnitLabel}.`);
                                                        return;
                                                    }
                                                    const meters = toMeters(n);
                                                    onUpdateSet(set.id, { distance: Math.round(meters) });
                                                    setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), distance: String(Math.round(n * 100) / 100) } }));
                                                }}
                                                keyboardType="numeric"
                                                className="h-8 text-center"
                                            />
                                        </View>
                                        <View className="flex-1 px-1">
                                            <IronInput
                                                placeholder="mm:ss ó 10m"
                                                value={drafts[set.id]?.time ?? ''}
                                                onChangeText={(val) => setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), time: val } }))}
                                                onBlur={() => {
                                                    const raw = (drafts[set.id]?.time ?? '').trim();
                                                    const parsed = parseFlexibleTimeToSeconds(raw);
                                                    if (!raw) {
                                                        onUpdateSet(set.id, { time: null as any });
                                                        return;
                                                    }
                                                    if (!parsed.ok || parsed.seconds == null) {
                                                        Alert.alert('Tiempo inválido', 'Usa mm:ss, hh:mm:ss o sufijos: 90s, 10m, 1h.');
                                                        return;
                                                    }
                                                    onUpdateSet(set.id, { time: parsed.seconds });
                                                    setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), time: formatTimeSeconds(parsed.seconds) } }));
                                                }}
                                                keyboardType="default"
                                                className="h-8 text-center"
                                            />
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        <View className="flex-1 px-1">
                                            {!isRepsOnly && (
                                                <IronInput
                                                    placeholder="-"
                                                    value={drafts[set.id]?.weight ?? ''}
                                                    onChangeText={(val) => setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), weight: val } }))}
                                                    onBlur={() => {
                                                        const raw = (drafts[set.id]?.weight ?? '').trim();
                                                        if (!raw) {
                                                            onUpdateSet(set.id, { weight: null as any });
                                                            return;
                                                        }
                                                        const n = Number(raw);
                                                        if (!Number.isFinite(n) || n < 0) {
                                                            Alert.alert('Peso inválido', 'Usa un número válido (>= 0).');
                                                            return;
                                                        }
                                                        const kg = toKg(n);
                                                        onUpdateSet(set.id, { weight: Math.round(kg * 100) / 100 });
                                                        setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), weight: String(Math.round(n * 100) / 100) } }));
                                                    }}
                                                    keyboardType="numeric"
                                                    className="h-8 text-center"
                                                />
                                            )}
                                        </View>
                                        <View className="flex-1 px-1">
                                            {!isWeightOnly && (
                                                <IronInput
                                                    placeholder="-"
                                                    value={drafts[set.id]?.reps ?? ''}
                                                    onChangeText={(val) => setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), reps: val } }))}
                                                    onBlur={() => {
                                                        const raw = (drafts[set.id]?.reps ?? '').trim();
                                                        if (!raw) {
                                                            onUpdateSet(set.id, { reps: null as any });
                                                            return;
                                                        }
                                                        const n = Number(raw);
                                                        if (!Number.isFinite(n) || n < 0) {
                                                            Alert.alert('Reps inválidas', 'Usa un entero >= 0.');
                                                            return;
                                                        }
                                                        onUpdateSet(set.id, { reps: Math.floor(n) });
                                                        setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), reps: String(Math.floor(n)) } }));
                                                    }}
                                                    keyboardType="numeric"
                                                    className="h-8 text-center"
                                                />
                                            )}
                                        </View>
                                    </>
                                )}

                                <View className="w-16 items-center flex-row justify-center gap-1">
                                    <Pressable onPress={() => openComment(set)}>
                                        <Ionicons name="chatbubble-outline" size={16} color={set.notes ? Colors.primary.dark : Colors.iron[600]} />
                                    </Pressable>
                                    <Pressable onPress={() => handleToggleComplete(set)}>
                                        <Ionicons
                                            name={set.completed ? "checkmark-circle" : "ellipse-outline"}
                                            size={22}
                                            color={set.completed ? Colors.green : Colors.iron[600]}
                                        />
                                    </Pressable>
                                    <Pressable onPress={() => Alert.alert('Eliminar', '¿Eliminar serie?', [{ text: 'Cancelar' }, { text: 'Eliminar', style: 'destructive', onPress: () => onDeleteSet(set.id) }])}>
                                        <Ionicons name="close" size={16} color={Colors.red} />
                                    </Pressable>
                                </View>
                            </View>
                            {/* Inline Comment Display if exists */}
                            {set.notes ? (
                                <Text className="text-textMuted text-xs px-2 pb-1 italic border-b border-border/30">
                                    "{set.notes}"
                                </Text>
                            ) : null}
                        </View>
                    ))}
                </View>
            </View>

            <Modal visible={commentModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-iron-950/80 justify-center px-6">
                    <View className="bg-surface p-4 rounded-xl border border-border">
                        <Text className="text-iron-950 font-bold mb-2">Nota de la serie</Text>
                        <TextInput
                            className="bg-background text-iron-950 p-3 rounded-lg border border-border mb-4 h-24"
                            textAlignVertical="top"
                            multiline
                            value={currentComment}
                            onChangeText={setCurrentComment}
                            placeholder="Ej: RPE 8, se sintió pesado..."
                            placeholderTextColor={Colors.iron[500]}
                        />
                        <View className="flex-row justify-end gap-2">
                            <IronButton label="Cancelar" variant="outline" size="sm" onPress={() => setCommentModalVisible(false)} />
                            <IronButton label="Guardar" size="sm" onPress={saveComment} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
