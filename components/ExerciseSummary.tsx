import { configService } from '@/src/services/ConfigService';
import { Colors } from '@/src/theme';
import { ExerciseType, WorkoutSet } from '@/src/types/db';
import { ChevronRight, Trophy } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ExerciseSummaryProps {
    exerciseName: string;
    exerciseType: ExerciseType;
    sets: WorkoutSet[];
    categoryColor?: string;
    onPress: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
}

function formatTimeSeconds(seconds: number): string {
    const s = Math.max(0, Math.floor(seconds));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
}

function formatDistanceMeters(meters: number): string {
    const m = Math.max(0, meters);
    if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
    return `${Math.round(m)} m`;
}

function formatWeight(value: number, unit: 'kg' | 'lbs'): string {
    const v = Number.isFinite(value) ? value : 0;
    const u = unit === 'kg' ? 'kg' : 'lb';
    const decimals = v % 1 === 0 ? 0 : 1;
    return `${v.toFixed(decimals)} ${u}`;
}

function formatVolume(value: number, unit: 'kg' | 'lbs'): string {
    const v = Number.isFinite(value) ? value : 0;
    const u = unit === 'kg' ? 'kg' : 'lb';
    if (v >= 100000) return `${(v / 1000).toFixed(0)}k ${u}`;
    if (v >= 10000) return `${(v / 1000).toFixed(1)}k ${u}`;
    if (v >= 1000) return `${(v / 1000).toFixed(2)}k ${u}`;
    const decimals = v % 1 === 0 ? 0 : 1;
    return `${v.toFixed(decimals)} ${u}`;
}

export function ExerciseSummary({ exerciseName, exerciseType, sets, categoryColor = Colors.primary.dark, onPress, onLongPress, disabled }: ExerciseSummaryProps) {
    const unit = configService.get('weightUnit');
    const totalSets = sets.length;
    const completedSets = sets.filter((s) => s.completed === 1);
    const doneSets = completedSets.length;
    const relevant = doneSets > 0 ? completedSets : sets;

    const repsTotal = relevant.reduce((acc, s) => acc + (s.reps ?? 0), 0);
    const volume = relevant.reduce((acc, s) => acc + (s.weight ?? 0) * (s.reps ?? 0), 0);
    const distanceTotal = relevant.reduce((acc, s) => acc + (s.distance ?? 0), 0);
    const timeTotal = relevant.reduce((acc, s) => acc + (s.time ?? 0), 0);

    const bestSetByWeight = relevant.reduce<{ weight: number; reps: number } | null>((best, s) => {
        const w = s.weight ?? 0;
        const r = s.reps ?? 0;
        if (w <= 0) return best;
        if (!best) return { weight: w, reps: r };
        if (w > best.weight) return { weight: w, reps: r };
        return best;
    }, null);

    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${exerciseName}`}
            className={`flex-row items-center bg-surface p-4 rounded-xl border border-iron-700 elevation-1 active:opacity-80 active:bg-iron-200 ${disabled ? 'opacity-60' : ''}`}
        >
            <View className="w-1.5 self-stretch rounded-full mr-4" style={{ backgroundColor: categoryColor }} />

            <View className="flex-1">
                <Text className="text-iron-950 font-bold text-lg" numberOfLines={1}>{exerciseName}</Text>

                <View className="flex-row flex-wrap items-center mt-2">
                    <View className="bg-iron-900/50 px-2 py-1 rounded mr-2 mb-2">
                        <Text className="text-iron-600 text-[11px] font-bold">{doneSets}/{totalSets} series</Text>
                    </View>

                    {(exerciseType === 'weight_reps' || exerciseType === 'reps_only') && (
                        <View className="bg-iron-900/50 px-2 py-1 rounded mr-2 mb-2">
                            <Text className="text-iron-600 text-[11px] font-bold">{repsTotal} reps</Text>
                        </View>
                    )}

                    {(exerciseType === 'weight_reps' || exerciseType === 'weight_only') && volume > 0 && (
                        <View className="bg-iron-900/50 px-2 py-1 rounded mr-2 mb-2">
                            <Text className="text-iron-600 text-[11px] font-bold">Vol {formatVolume(volume, unit)}</Text>
                        </View>
                    )}

                    {exerciseType === 'distance_time' && (distanceTotal > 0 || timeTotal > 0) && (
                        <>
                            {distanceTotal > 0 && (
                                <View className="bg-iron-900/50 px-2 py-1 rounded mr-2 mb-2">
                                    <Text className="text-iron-600 text-[11px] font-bold">{formatDistanceMeters(distanceTotal)}</Text>
                                </View>
                            )}
                            {timeTotal > 0 && (
                                <View className="bg-iron-900/50 px-2 py-1 rounded mr-2 mb-2">
                                    <Text className="text-iron-600 text-[11px] font-bold">{formatTimeSeconds(timeTotal)}</Text>
                                </View>
                            )}
                        </>
                    )}
                </View>
            </View>

            {(exerciseType === 'weight_reps' || exerciseType === 'weight_only') && bestSetByWeight && (
                <View className="items-end mr-2">
                    <View className="flex-row items-center bg-iron-900/50 px-2 py-1 rounded">
                        <Trophy size={12} color={Colors.yellow} style={{ marginRight: 6 }} />
                        <Text className="text-yellow-600 text-[11px] font-bold">
                            {formatWeight(bestSetByWeight.weight, unit)}
                            {exerciseType === 'weight_reps' && bestSetByWeight.reps > 0 ? ` × ${bestSetByWeight.reps}` : ''}
                        </Text>
                    </View>
                </View>
            )}

            <ChevronRight size={20} color={Colors.iron[500]} />
        </TouchableOpacity>
    );
}
