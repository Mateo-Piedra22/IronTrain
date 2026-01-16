import { configService } from '@/src/services/ConfigService';
import { UnitService } from '@/src/services/UnitService';
import { Colors } from '@/src/theme';
import { ExerciseType, WorkoutSet } from '@/src/types/db';
import { formatTimeSecondsCompact } from '@/src/utils/time';
import { ChevronRight, Trophy } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface ExerciseSummaryProps {
    exerciseName: string;
    exerciseType: ExerciseType;
    sets: WorkoutSet[];
    categoryColor?: string;
    onPress: () => void;
    disabled?: boolean;
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

export function ExerciseSummary({ exerciseName, exerciseType, sets, categoryColor = Colors.primary.dark, onPress, disabled }: ExerciseSummaryProps) {
    const unit = configService.get('weightUnit');
    const displayWeight = (kgValue: number) => unit === 'kg' ? kgValue : UnitService.kgToLbs(kgValue);
    const totalSets = sets.length;
    const completedSets = sets.filter((s) => s.completed === 1);
    const doneSets = completedSets.length;
    const relevant = doneSets > 0 ? completedSets : sets;

    const repsTotal = relevant.reduce((acc, s) => acc + (s.reps ?? 0), 0);
    const distanceTotal = relevant.reduce((acc, s) => acc + (s.distance ?? 0), 0);
    const timeTotal = relevant.reduce((acc, s) => acc + (s.time ?? 0), 0);

    const avgWeight = (() => {
        const weights = relevant.map((s) => s.weight ?? 0).filter((w) => w > 0);
        if (weights.length === 0) return null;
        const sum = weights.reduce((a, b) => a + b, 0);
        return sum / weights.length;
    })();

    const primaryStat =
        exerciseType === 'distance_time'
            ? `${distanceTotal > 0 ? formatDistanceMeters(distanceTotal) : ''}${distanceTotal > 0 && timeTotal > 0 ? ' • ' : ''}${timeTotal > 0 ? formatTimeSecondsCompact(timeTotal) : ''}`.trim()
            : (exerciseType === 'weight_reps' || exerciseType === 'reps_only')
                ? `${repsTotal} reps`
                : '';

    const secondaryStat =
        (exerciseType === 'weight_reps' || exerciseType === 'weight_only') && avgWeight != null
            ? `${formatWeight(displayWeight(avgWeight), unit)}`
            : '';

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
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${exerciseName}`}
            className={`flex-row items-center bg-surface px-4 py-4 rounded-xl border border-iron-700 elevation-1 active:opacity-80 active:bg-iron-200 ${disabled ? 'opacity-60' : ''}`}
        >
            <View className="w-1.5 self-stretch rounded-full mr-4" style={{ backgroundColor: categoryColor }} />

            <View className="flex-1">
                <Text className="text-iron-950 font-bold text-base" numberOfLines={1}>{exerciseName}</Text>

                <View className="flex-row items-center mt-1">
                    <Text className="text-iron-600 text-[12px] font-bold">{doneSets}/{totalSets} series</Text>
                    {primaryStat ? <Text className="text-iron-400 text-[12px] font-bold mx-2">•</Text> : null}
                    {primaryStat ? <Text className="text-iron-600 text-[12px] font-bold" numberOfLines={1}>{primaryStat}</Text> : null}
                    {secondaryStat ? <Text className="text-iron-400 text-[12px] font-bold mx-2">•</Text> : null}
                    {secondaryStat ? <Text className="text-iron-600 text-[12px] font-bold" numberOfLines={1}>{secondaryStat}</Text> : null}
                </View>
            </View>

            {(exerciseType === 'weight_reps' || exerciseType === 'weight_only') && bestSetByWeight && (
                <View className="items-end ml-3">
                    <View className="flex-row items-center bg-iron-900/50 px-2 py-1 rounded">
                        <Trophy size={12} color={Colors.yellow} style={{ marginRight: 6 }} />
                        <Text className="text-yellow-600 text-[11px] font-bold">
                            {formatWeight(displayWeight(bestSetByWeight.weight), unit)}
                            {exerciseType === 'weight_reps' && bestSetByWeight.reps > 0 ? ` × ${bestSetByWeight.reps}` : ''}
                        </Text>
                    </View>
                </View>
            )}

            <ChevronRight size={20} color={Colors.iron[500]} />
        </TouchableOpacity>
    );
}
