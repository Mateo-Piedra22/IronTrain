import { Colors } from '@/src/theme';
import * as Haptics from 'expo-haptics';
import { Check, Copy, MessageSquare, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Animated, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    }, [set.previous_weight]);

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
            <View className="justify-center items-end bg-red-600 rounded-r-xl my-1 ml-[-20px] w-24">
                <Animated.View style={{ transform: [{ scale }], opacity, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingLeft: 20 }}>
                    <TouchableOpacity
                        onPress={() => {
                            if (isCompleted) {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                                Alert.alert(
                                    "Set Locked 🔒",
                                    "This set is marked as completed. Please uncheck it first to delete.",
                                    [{ text: "Understood", style: "default" }]
                                );
                                return;
                            }
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            onDelete(set.id);
                        }}
                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Trash2 size={28} color="white" />
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
            <View className="justify-center items-start bg-primary w-24 rounded-l-xl my-1 mr-[-20px]">
                <Animated.View style={{ transform: [{ scale }], width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', paddingRight: 20 }}>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (onCopy) onCopy(set.id);
                        }}
                        style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Copy size={28} color="white" />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    };

    return (
        <Swipeable renderRightActions={renderRightActions} renderLeftActions={renderLeftActions} containerStyle={{ overflow: 'visible' }}>
            <View className={`mb-3 rounded-xl border shadow-sm overflow-hidden ${isCompleted
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
                                {set.type === 'normal' ? `SET ${index + 1}` : set.type}
                            </Text>
                        </View>
                        {set.previous_weight && (
                            <Text className="text-[10px] text-iron-400 font-medium">
                                PREV: {set.previous_weight}kg x {set.previous_reps}
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
                    {/* Weight Input */}
                    <View className="flex-1 items-center">
                        <TextInput
                            value={weight}
                            onChangeText={setWeight}
                            onBlur={handleBlur}
                            keyboardType="numeric"
                            placeholder={set.previous_weight?.toString() || "0"}
                            placeholderTextColor={Colors.iron[300]}
                            // Removed /50 opacity variants. Used solid colors.
                            className={`text-2xl font-bold text-center w-full p-2 rounded-lg ${isCompleted ? 'text-primary bg-primary/5' : 'text-iron-950 bg-iron-100'
                                }`}
                            selectTextOnFocus
                        />
                        <Text className="text-[10px] text-iron-400 font-bold mt-1 uppercase">KG</Text>
                    </View>

                    <Text className="text-iron-300 font-black text-xl">X</Text>

                    {/* Reps Input */}
                    <View className="flex-1 items-center">
                        <TextInput
                            value={reps}
                            onChangeText={setReps}
                            onBlur={handleBlur}
                            keyboardType="numeric"
                            placeholder={set.previous_reps?.toString() || "0"}
                            placeholderTextColor={Colors.iron[300]}
                            className={`text-2xl font-bold text-center w-full p-2 rounded-lg ${isCompleted ? 'text-primary bg-primary/5' : 'text-iron-950 bg-iron-100'
                                }`}
                            selectTextOnFocus
                        />
                        <Text className="text-[10px] text-iron-400 font-bold mt-1 uppercase">REPS</Text>
                    </View>

                    {/* Action Buttons */}
                    <View className="flex-col gap-2 ml-2">
                        <TouchableOpacity
                            onPress={() => {
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
                            placeholder="Add notes..."
                            placeholderTextColor={Colors.iron[400]}
                            className="text-sm bg-yellow-50 text-iron-700 p-2 rounded-lg border border-yellow-100/50"
                        />
                    </View>
                )}

            </View>
        </Swipeable>
    );
}
