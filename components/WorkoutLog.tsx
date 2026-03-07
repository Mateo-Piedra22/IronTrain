import { dbService } from '@/src/services/DatabaseService';
import { workoutService } from '@/src/services/WorkoutService';
import { Colors, ThemeFx } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BookOpen, Copy, Dumbbell, GripVertical, Trash2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { Swipeable } from 'react-native-gesture-handler';
import { confirm } from '../src/store/confirmStore';
import type { ExerciseType } from '../src/types/db';
import { WorkoutSet } from '../src/types/db';
import { ExerciseSummary } from './ExerciseSummary';

interface WorkoutLogProps {
    sets: (WorkoutSet & { exercise_name: string; category_color: string; exercise_type: ExerciseType; badges?: any[] })[];
    onExercisePress: (exerciseId: string, exerciseName: string) => void;

    onRefresh: () => void;
    workoutId: string;
    onCopyPress?: () => void;
    onLoadRoutinePress?: () => void;
}

interface GroupedExercise {
    exercise_id: string;
    exercise_name: string;
    category_color: string;
    exercise_type: ExerciseType;
    badges: any[];
    sets: WorkoutSet[];
}


export function WorkoutLog({ sets, onExercisePress, onRefresh, workoutId, onCopyPress, onLoadRoutinePress }: WorkoutLogProps) {
    const [localGroups, setLocalGroups] = useState<GroupedExercise[]>([]);

    const grouped = useMemo(() => {
        const groups: Record<string, GroupedExercise> = {};
        const orderedGroups: GroupedExercise[] = [];
        sets.forEach((set) => {
            if (!groups[set.exercise_id]) {
                const group: GroupedExercise = {
                    exercise_id: set.exercise_id,
                    exercise_name: set.exercise_name,
                    category_color: set.category_color,
                    exercise_type: set.exercise_type,
                    badges: (set as any).badges || [],
                    sets: []
                };

                groups[set.exercise_id] = group;
                orderedGroups.push(group);
            }
            groups[set.exercise_id].sets.push(set);
        });
        return orderedGroups;
    }, [sets]);

    useEffect(() => { setLocalGroups(grouped); }, [grouped]);

    const handleReorder = async (data: GroupedExercise[]) => {
        const snapshot = localGroups;
        setLocalGroups(data);
        const newOrderIds = data.map((g) => g.exercise_id);
        try {
            await workoutService.reorderExercises(workoutId, newOrderIds);
        } catch (e: any) {
            setLocalGroups(snapshot);
            notify.error('Error de red', e?.message || 'No se pudo reordenar. Intenta de nuevo.');
        }
    };

    const handleDeleteExercise = (exerciseId: string, exerciseName: string) => {
        confirm.destructive(
            'Eliminar ejercicio',
            `¿Quitar ${exerciseName} y todas sus series?`,
            async () => {
                try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    await dbService.run('DELETE FROM workout_sets WHERE workout_id = ? AND exercise_id = ?', [workoutId, exerciseId]);
                    onRefresh();
                    notify.success('Ejercicio eliminado', `${exerciseName} fue quitado de tu entrenamiento.`);
                } catch (e: any) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    notify.error('Error al eliminar', e?.message || 'No se pudo eliminar el ejercicio.');
                }
            },
            'Eliminar'
        );
    };

    if (localGroups.length === 0) {
        return (
            <View style={ss.empty}>
                <Dumbbell size={48} color={Colors.iron[300]} />
                <Text style={ss.emptyTitle}>Todavía no registraste ejercicios.</Text>
                <Text style={ss.emptySub}>Tocá "+" para agregar uno.</Text>
                {(onCopyPress || onLoadRoutinePress) && (
                    <>
                        <View style={{ width: 40, marginVertical: 16, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: Colors.iron[300] }} />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {onLoadRoutinePress && (
                                <TouchableOpacity
                                    onPress={onLoadRoutinePress}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', gap: 6,
                                        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
                                        backgroundColor: Colors.surface, borderWidth: 1,
                                        borderColor: Colors.iron[300], borderStyle: 'dashed',
                                    }}
                                >
                                    <BookOpen size={12} color={Colors.iron[400]} />
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.iron[500], textTransform: 'uppercase' }}>
                                        Cargar Rutina
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {onCopyPress && (
                                <TouchableOpacity
                                    onPress={onCopyPress}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', gap: 6,
                                        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
                                        backgroundColor: Colors.surface, borderWidth: 1,
                                        borderColor: Colors.iron[300], borderStyle: 'dashed',
                                    }}
                                >
                                    <Copy size={12} color={Colors.iron[400]} />
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.iron[500], textTransform: 'uppercase' }}>
                                        Copiar historial
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </>
                )}
            </View>
        );
    }

    const renderItem = ({ item: group, drag, isActive }: RenderItemParams<GroupedExercise>) => {
        const renderRightActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
            const scale = dragX.interpolate({ inputRange: [-100, -50, 0], outputRange: [1, 0.5, 0], extrapolate: 'clamp' });
            return (
                <View style={ss.swipeRight}>
                    <Animated.View style={{ transform: [{ scale }], width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingLeft: 20 }}>
                        <TouchableOpacity
                            onPress={() => handleDeleteExercise(group.exercise_id, group.exercise_name)}
                            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                            accessibilityRole="button" accessibilityLabel={`Eliminar ${group.exercise_name}`}
                        >
                            <Trash2 size={22} color={Colors.white} />
                            <Text style={ss.swipeLabel}>ELIMINAR</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            );
        };

        const renderLeftActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
            const scale = dragX.interpolate({ inputRange: [0, 50, 100], outputRange: [0, 0.8, 1], extrapolate: 'clamp' });
            return (
                <View style={ss.swipeLeft}>
                    <Animated.View style={{ transform: [{ scale }], width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingRight: 20 }}>
                        <TouchableOpacity
                            onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); drag(); }}
                            delayLongPress={180} disabled={isActive}
                            style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                            accessibilityRole="button" accessibilityLabel={`Mantener para reordenar ${group.exercise_name}`}
                        >
                            <GripVertical size={20} color={Colors.white} />
                            <Text style={ss.swipeLabel}>ORDENAR</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            );
        };

        return (
            <ScaleDecorator>
                <View style={{ marginBottom: 10 }}>
                    <Swipeable
                        renderRightActions={renderRightActions}
                        renderLeftActions={renderLeftActions}
                        overshootRight={false} overshootLeft={false}
                        containerStyle={{ overflow: 'visible' }}
                        rightThreshold={40} leftThreshold={40}
                    >
                        <ExerciseSummary
                            exerciseName={group.exercise_name}
                            exerciseType={group.exercise_type}
                            sets={group.sets}
                            badges={group.badges}
                            categoryColor={group.category_color}
                            onPress={() => onExercisePress(group.exercise_id, group.exercise_name)}
                            disabled={isActive}
                        />

                    </Swipeable>
                </View>
            </ScaleDecorator>
        );
    };

    return (
        <View style={ss.container}>
            <LinearGradient colors={[Colors.iron[900], 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, zIndex: 1 }} pointerEvents="none" />
            <DraggableFlatList
                data={localGroups}
                onDragEnd={({ data }) => handleReorder(data)}
                keyExtractor={(item) => item.exercise_id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 100 }}
                ListFooterComponent={
                    <View style={{ paddingTop: 4 }}>
                        {/* Dotted separator */}
                        <View style={{ marginHorizontal: 24, marginBottom: 16, borderBottomWidth: 1, borderStyle: 'dashed', borderBottomColor: Colors.iron[300] }} />
                        {/* Action buttons (Copy/Load) */}
                        {(onCopyPress || onLoadRoutinePress) && (
                            <View style={{ alignItems: 'center', paddingBottom: 96, flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                                {onLoadRoutinePress && (
                                    <TouchableOpacity
                                        onPress={onLoadRoutinePress}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 6,
                                            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
                                            backgroundColor: Colors.surface, borderWidth: 1,
                                            borderColor: Colors.iron[300], borderStyle: 'dashed',
                                        }}
                                    >
                                        <BookOpen size={12} color={Colors.iron[400]} />
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.iron[500], textTransform: 'uppercase' }}>
                                            Cargar Rutina
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {onCopyPress && (
                                    <TouchableOpacity
                                        onPress={onCopyPress}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 6,
                                            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100,
                                            backgroundColor: Colors.surface, borderWidth: 1,
                                            borderColor: Colors.iron[300], borderStyle: 'dashed',
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel="Copiar ejercicios desde otro día"
                                    >
                                        <Copy size={12} color={Colors.iron[400]} />
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.iron[500], textTransform: 'uppercase' }}>
                                            Copiar historial
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                }
                activationDistance={20}
            />
            <LinearGradient colors={['transparent', Colors.iron[900]]} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, zIndex: 1 }} pointerEvents="none" />
        </View>
    );
}

const ss = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16, paddingTop: 8, position: 'relative' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyTitle: { color: Colors.iron[400], textAlign: 'center', fontSize: 16, marginTop: 16, fontWeight: '700' },
    emptySub: { color: Colors.iron[400], textAlign: 'center', marginTop: 8, fontSize: 13 },
    swipeRight: { justifyContent: 'center', alignItems: 'flex-end', borderTopRightRadius: 14, borderBottomRightRadius: 14, marginVertical: 1, marginLeft: -20, width: 96, backgroundColor: Colors.red, shadowColor: ThemeFx.shadowColor, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    swipeLeft: { justifyContent: 'center', alignItems: 'flex-start', width: 96, borderTopLeftRadius: 14, borderBottomLeftRadius: 14, marginVertical: 1, marginRight: -20, backgroundColor: Colors.primary.dark, shadowColor: ThemeFx.shadowColor, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    swipeLabel: { color: Colors.white, fontSize: 9, fontWeight: '900', marginTop: 4, letterSpacing: 0.5 },
});
