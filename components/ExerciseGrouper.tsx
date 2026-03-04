import { UnitService } from '@/src/services/UnitService';
import { Colors } from '@/src/theme';
import { ExerciseType, WorkoutSet } from '@/src/types/db';
import { formatTimeSeconds, parseFlexibleTimeToSeconds } from '@/src/utils/time';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirm } from '../src/store/confirmStore';
import { IronButton } from './IronButton';
import { IronInput } from './IronInput';
import { SET_TYPE_CONFIG } from './SetRow';

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
        const cols = isDistTime
            ? [distanceUnitLabel, 'Tiempo']
            : [unitSystem === 'metric' ? 'kg' : 'lb', 'Reps'];
        return (
            <View style={ss.tableHeader}>
                <Text style={[ss.headerCell, { width: 32 }]}>#</Text>
                <Text style={[ss.headerCell, { flex: 1 }]}>{cols[0]}</Text>
                <Text style={[ss.headerCell, { flex: 1 }]}>{cols[1]}</Text>
                <Text style={[ss.headerCell, { width: 64 }]}>Acciones</Text>
            </View>
        );
    };

    return (
        <View style={ss.container}>
            {/* Superset accent bar */}
            <View style={ss.accentBar} />

            <View style={{ flex: 1 }}>
                <View style={ss.exerciseHeader}>
                    <Text style={ss.exerciseName} numberOfLines={1}>{exerciseName}</Text>
                    <IronButton label="Añadir serie" size="sm" onPress={onAddSet} />
                </View>

                <View style={ss.tableCard}>
                    {renderHeader()}

                    {sets.map((set, index) => (
                        <View key={set.id}>
                            <View style={[ss.setRow, set.completed ? ss.setRowCompleted : null, (() => { const cfg = SET_TYPE_CONFIG.find(c => c.key === (set.type || 'normal')); return (set.type && set.type !== 'normal' && cfg) ? { backgroundColor: cfg.bg + '40' } : null; })()]}>
                                {(() => {
                                    const t = set.type || 'normal';
                                    const cfg = SET_TYPE_CONFIG.find(c => c.key === t) || SET_TYPE_CONFIG[0];
                                    const isNormal = t === 'normal';
                                    return (
                                        <Text style={[ss.indexCell, !isNormal && { color: cfg.text, fontWeight: '900', fontSize: 8 }]}>
                                            {isNormal ? index + 1 : cfg.shortLabel}
                                        </Text>
                                    );
                                })()}

                                {isDistTime ? (
                                    <>
                                        <View style={ss.inputCell}>
                                            <IronInput
                                                placeholder="0.0"
                                                value={drafts[set.id]?.distance ?? ''}
                                                onChangeText={(val) => setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), distance: val } }))}
                                                onBlur={() => {
                                                    const raw = (drafts[set.id]?.distance ?? '').trim();
                                                    if (!raw) { onUpdateSet(set.id, { distance: null as any }); return; }
                                                    const n = Number(raw);
                                                    if (!Number.isFinite(n) || n < 0) { confirm.warning('Distancia inválida', `Usa un número válido en ${distanceUnitLabel}.`); return; }
                                                    const meters = toMeters(n);
                                                    onUpdateSet(set.id, { distance: Math.round(meters) });
                                                    setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), distance: String(Math.round(n * 100) / 100) } }));
                                                }}
                                                keyboardType="numeric"
                                                style={{ height: 32, textAlign: 'center' }}
                                            />
                                        </View>
                                        <View style={ss.inputCell}>
                                            <IronInput
                                                placeholder="mm:ss ó 10m"
                                                value={drafts[set.id]?.time ?? ''}
                                                onChangeText={(val) => setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), time: val } }))}
                                                onBlur={() => {
                                                    const raw = (drafts[set.id]?.time ?? '').trim();
                                                    const parsed = parseFlexibleTimeToSeconds(raw);
                                                    if (!raw) { onUpdateSet(set.id, { time: null as any }); return; }
                                                    if (!parsed.ok || parsed.seconds == null) { confirm.warning('Tiempo inválido', 'Usa mm:ss, hh:mm:ss o sufijos: 90s, 10m, 1h.'); return; }
                                                    onUpdateSet(set.id, { time: parsed.seconds! });
                                                    setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), time: formatTimeSeconds(parsed.seconds!) } }));
                                                }}
                                                keyboardType="default"
                                                style={{ height: 32, textAlign: 'center' }}
                                            />
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        <View style={ss.inputCell}>
                                            {!isRepsOnly && (
                                                <IronInput
                                                    placeholder="-"
                                                    value={drafts[set.id]?.weight ?? ''}
                                                    onChangeText={(val) => setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), weight: val } }))}
                                                    onBlur={() => {
                                                        const raw = (drafts[set.id]?.weight ?? '').trim();
                                                        if (!raw) { onUpdateSet(set.id, { weight: null as any }); return; }
                                                        const n = Number(raw);
                                                        if (!Number.isFinite(n) || n < 0) { confirm.warning('Peso inválido', 'Usa un número válido (>= 0).'); return; }
                                                        const kg = toKg(n);
                                                        onUpdateSet(set.id, { weight: Math.round(kg * 100) / 100 });
                                                        setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), weight: String(Math.round(n * 100) / 100) } }));
                                                    }}
                                                    keyboardType="numeric"
                                                    style={{ height: 32, textAlign: 'center' }}
                                                />
                                            )}
                                        </View>
                                        <View style={ss.inputCell}>
                                            {!isWeightOnly && (
                                                <IronInput
                                                    placeholder="-"
                                                    value={drafts[set.id]?.reps ?? ''}
                                                    onChangeText={(val) => setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), reps: val } }))}
                                                    onBlur={() => {
                                                        const raw = (drafts[set.id]?.reps ?? '').trim();
                                                        if (!raw) { onUpdateSet(set.id, { reps: null as any }); return; }
                                                        const n = Number(raw);
                                                        if (!Number.isFinite(n) || n < 0) { confirm.warning('Reps inválidas', 'Usa un entero >= 0.'); return; }
                                                        onUpdateSet(set.id, { reps: Math.floor(n) });
                                                        setDrafts((prev) => ({ ...prev, [set.id]: { ...(prev[set.id] || { distance: '', time: '', weight: '', reps: '' }), reps: String(Math.floor(n)) } }));
                                                    }}
                                                    keyboardType="numeric"
                                                    style={{ height: 32, textAlign: 'center' }}
                                                />
                                            )}
                                        </View>
                                    </>
                                )}

                                <View style={ss.actionsCell}>
                                    <Pressable onPress={() => openComment(set)} hitSlop={6}>
                                        <Ionicons name="chatbubble-outline" size={15} color={set.notes ? Colors.primary.dark : Colors.iron[400]} />
                                    </Pressable>
                                    <Pressable onPress={() => handleToggleComplete(set)} hitSlop={6}>
                                        <Ionicons
                                            name={set.completed ? "checkmark-circle" : "ellipse-outline"}
                                            size={20}
                                            color={set.completed ? Colors.green : Colors.iron[400]}
                                        />
                                    </Pressable>
                                    <Pressable onPress={() => confirm.destructive('Eliminar', '¿Eliminar serie?', () => onDeleteSet(set.id), 'Eliminar')} hitSlop={6}>
                                        <Ionicons name="close" size={15} color={Colors.red} />
                                    </Pressable>
                                </View>
                            </View>
                            {set.notes ? (
                                <Text style={ss.noteText}>
                                    "{set.notes}"
                                </Text>
                            ) : null}
                        </View>
                    ))}
                </View>
            </View>

            {/* Comment Modal */}
            <Modal visible={commentModalVisible} transparent animationType="fade">
                <View style={ss.modalOverlay}>
                    <View style={ss.modalSheet}>
                        <Text style={ss.modalTitle}>Nota de la serie</Text>
                        <TextInput
                            style={ss.modalInput}
                            textAlignVertical="top"
                            multiline
                            value={currentComment}
                            onChangeText={setCurrentComment}
                            placeholder="Ej: RPE 8, se sintió pesado..."
                            placeholderTextColor={Colors.iron[400]}
                        />
                        <View style={ss.modalActions}>
                            <IronButton label="Cancelar" variant="outline" size="sm" onPress={() => setCommentModalVisible(false)} />
                            <IronButton label="Guardar" size="sm" onPress={saveComment} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const ss = StyleSheet.create({
    container: { marginBottom: 16, flexDirection: 'row' },
    accentBar: { width: 4, backgroundColor: Colors.primary.DEFAULT, borderRadius: 3, marginRight: 12, opacity: 0.4 },
    exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, backgroundColor: Colors.surface, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.iron[700] },
    exerciseName: { color: Colors.iron[950], fontSize: 16, fontWeight: '800', flex: 1 },
    tableCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[700], overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: Colors.iron[100], padding: 8, borderBottomWidth: 1, borderBottomColor: Colors.iron[200] },
    headerCell: { color: Colors.iron[400], fontSize: 10, textAlign: 'center', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    setRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderBottomWidth: 1, borderBottomColor: Colors.iron[200] },
    setRowCompleted: { backgroundColor: Colors.primary.DEFAULT + '08' },
    indexCell: { color: Colors.iron[400], width: 32, textAlign: 'center', fontWeight: '700', fontSize: 12 },
    inputCell: { flex: 1, paddingHorizontal: 4 },
    actionsCell: { width: 64, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
    noteText: { color: Colors.iron[400], fontSize: 11, paddingHorizontal: 10, paddingBottom: 6, fontStyle: 'italic', borderBottomWidth: 1, borderBottomColor: Colors.iron[200] },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
    modalSheet: { backgroundColor: Colors.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.iron[700] },
    modalTitle: { color: Colors.iron[950], fontWeight: '900', marginBottom: 12, fontSize: 15 },
    modalInput: { backgroundColor: Colors.iron[100], color: Colors.iron[950], padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.iron[200], marginBottom: 16, height: 96 },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
});
