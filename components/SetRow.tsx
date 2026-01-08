import { Colors } from '@/src/theme';
import { Check, Copy, MessageSquare, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Animated, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { WorkoutSet } from '../src/types/db';

interface SetRowProps {
    set: WorkoutSet;
    index: number;
    onUpdate: (id: string, updates: Partial<WorkoutSet>) => void;
    onDelete: (id: string) => void;
    onCopy?: (id: string) => void;
}

export function SetRow({ set, index, onUpdate, onDelete, onCopy }: SetRowProps) {
    const [weight, setWeight] = useState(set.weight?.toString() || '');
    const [reps, setReps] = useState(set.reps?.toString() || '');
    const [rpe, setRpe] = useState(set.rpe?.toString() || '');
    const [notes, setNotes] = useState(set.notes || '');
    const [showNotes, setShowNotes] = useState(!!set.notes);

    // Ghost Logic
    useEffect(() => {
        if (!set.weight && set.previous_weight) {
            setWeight(set.previous_weight.toString());
        }
    }, [set.previous_weight]); // added dependency

    const handleComplete = () => {
        onUpdate(set.id, {
            completed: set.completed ? 0 : 1,
            weight: weight ? parseFloat(weight) : undefined,
            reps: reps ? parseInt(reps) : undefined,
            rpe: rpe ? parseFloat(rpe) : undefined,
            notes: notes
        });
    };

    const handleBlur = () => {
        onUpdate(set.id, {
            weight: weight ? parseFloat(weight) : undefined,
            reps: reps ? parseInt(reps) : undefined,
            rpe: rpe ? parseFloat(rpe) : undefined,
            notes: notes
        });
    };

    const isCompleted = set.completed === 1;

    const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const trans = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [0, 100],
            extrapolate: 'clamp',
        });

        return (
            <View className="justify-center items-end bg-red-600 w-24">
                <Animated.View style={{ transform: [{ translateX: trans }] }}>
                    <TouchableOpacity
                        onPress={() => {
                            import('expo-haptics').then(Haptics => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            });
                            onDelete(set.id);
                        }}
                        className="p-4 items-center justify-center h-full w-24"
                    >
                        <Trash2 size={24} color="white" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    };

    const renderLeftActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
        const trans = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [-100, 0],
            extrapolate: 'clamp',
        });

        return (
            <View className="justify-center items-start bg-blue-600 w-24">
                <Animated.View style={{ transform: [{ translateX: trans }] }}>
                    <TouchableOpacity
                        onPress={() => {
                            import('expo-haptics').then(Haptics => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            });
                            if (onCopy) onCopy(set.id);
                        }}
                        className="p-4 items-center justify-center h-full w-24"
                    >
                        <Copy size={24} color="white" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    };

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions}>
            <View className={`border-b border-iron-800 bg-iron-900 ${isCompleted ? 'bg-iron-800/50' : ''}`}>
                <View className="flex-row items-center justify-between py-2 px-2">
                    {/* Set Number / Type Indicator */}
                    <View className="w-8 items-center justify-center">
                        <View className={`w-6 h-6 rounded-full items-center justify-center ${set.type === 'warmup' ? 'bg-yellow-600' :
                            set.type === 'failure' ? 'bg-red-600' :
                                set.type === 'drop' ? 'bg-purple-600' : 'bg-iron-700'
                            }`}>
                            <Text className="text-xs text-white font-bold">{index + 1}</Text>
                        </View>
                    </View>

                    {/* Previous History (Ghost) - Small text */}
                    <View className="w-16 items-center">
                        <Text className="text-xs text-iron-500">
                            {set.previous_weight ? `${set.previous_weight}kg` : '-'}
                        </Text>
                        <Text className="text-xs text-iron-500">
                            {set.previous_reps ? `${set.previous_reps}r` : '-'}
                        </Text>
                        {set.previous_rpe && (
                            <Text className="text-[10px] text-yellow-500/70">
                                @{set.previous_rpe}
                            </Text>
                        )}
                    </View>

                    {/* KG Input */}
                    <View className="flex-1 px-2">
                        <TextInput
                            value={weight}
                            onChangeText={setWeight}
                            onBlur={handleBlur}
                            keyboardType="numeric"
                            placeholder={set.previous_weight?.toString() || "-"}
                            placeholderTextColor={Colors.iron[400]}
                            className={`bg-iron-800 text-white text-center py-2 rounded font-bold text-lg ${isCompleted ? 'text-iron-400' : ''}`}
                            selectTextOnFocus
                        />
                    </View>

                    {/* Reps Input */}
                    <View className="flex-1 px-2">
                        <TextInput
                            value={reps}
                            onChangeText={setReps}
                            onBlur={handleBlur}
                            keyboardType="numeric"
                            placeholder={set.previous_reps?.toString() || "-"}
                            placeholderTextColor={Colors.iron[400]}
                            className={`bg-iron-800 text-white text-center py-2 rounded font-bold text-lg ${isCompleted ? 'text-iron-400' : ''}`}
                            selectTextOnFocus
                        />
                    </View>

                    {/* RPE Input */}
                    <View className="w-14 px-1">
                        <TextInput
                            value={rpe}
                            onChangeText={setRpe}
                            onBlur={handleBlur}
                            keyboardType="numeric"
                            placeholder="RPE"
                            placeholderTextColor={Colors.iron[400]}
                            className={`bg-iron-800 text-yellow-500 text-center py-2 rounded font-bold text-xs ${isCompleted ? 'opacity-50' : ''}`}
                            selectTextOnFocus
                            maxLength={3}
                        />
                    </View>

                    {/* Notes Toggle */}
                    <TouchableOpacity
                        onPress={() => setShowNotes(!showNotes)}
                        className="p-2"
                    >
                        <MessageSquare size={20} color={notes ? Colors.primary.dark : Colors.iron[400]} />
                    </TouchableOpacity>

                    {/* Check Button */}
                    <TouchableOpacity
                        onPress={() => {
                            import('expo-haptics').then(Haptics => {
                                if (isCompleted) {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                } else {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                }
                            });
                            handleComplete();
                        }}
                        className={`w-10 h-10 items-center justify-center rounded-lg ml-2 ${isCompleted ? 'bg-primary' : 'bg-iron-700'
                            }`}
                    >
                        <Check size={20} color={isCompleted ? Colors.white : Colors.iron[400]} />
                    </TouchableOpacity>
                </View>

                {/* Notes Input */}
                {showNotes && (
                    <View className="px-12 pb-2">
                        <TextInput
                            value={notes}
                            onChangeText={setNotes}
                            onBlur={handleBlur}
                            placeholder="Add notes (e.g. high RPE, pain...)"
                            placeholderTextColor={Colors.iron[600]}
                            className="text-iron-300 text-sm bg-iron-950/50 p-2 rounded border border-iron-800"
                        />
                    </View>
                )}
            </View>
        </Swipeable>
    );
}
