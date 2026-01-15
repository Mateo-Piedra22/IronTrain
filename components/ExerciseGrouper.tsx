import { Colors } from '@/src/theme';
import { WorkoutSet } from '@/src/types/db';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { IronButton } from './IronButton';
import { IronInput } from './IronInput';

interface ExerciseGrouperProps {
    exerciseName: string;
    exerciseType: string; // 'weight_reps' | 'distance_time' etc
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
                    <Text className="text-textMuted text-xs w-8 text-center">Set</Text>
                    <Text className="text-textMuted text-xs flex-1 text-center">{unitSystem === 'metric' ? 'km' : 'mi'}</Text>
                    <Text className="text-textMuted text-xs flex-1 text-center">Time (s)</Text>
                    <Text className="text-textMuted text-xs w-16 text-center">Actions</Text>
                </View>
            );
        }
        return (
            <View className="flex-row bg-slate-700/50 p-2 border-b border-border">
                <Text className="text-textMuted text-xs w-8 text-center">Set</Text>
                <Text className="text-textMuted text-xs flex-1 text-center">{unitSystem === 'metric' ? 'kg' : 'lbs'}</Text>
                <Text className="text-textMuted text-xs flex-1 text-center">Reps</Text>
                <Text className="text-textMuted text-xs w-16 text-center">Actions</Text>
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
                    <IronButton label="Add Set" size="sm" onPress={onAddSet} />
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
                                                value={set.distance?.toString() || ''}
                                                onChangeText={(val) => onUpdateSet(set.id, { distance: parseFloat(val) || 0 })}
                                                keyboardType="numeric"
                                                className="h-8 text-center"
                                            />
                                        </View>
                                        <View className="flex-1 px-1">
                                            <IronInput
                                                placeholder="00:00"
                                                value={set.time?.toString() || ''}
                                                onChangeText={(val) => onUpdateSet(set.id, { time: parseInt(val) || 0 })}
                                                keyboardType="numeric"
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
                                                    value={set.weight?.toString() || ''}
                                                    onChangeText={(val) => onUpdateSet(set.id, { weight: parseFloat(val) || 0 })}
                                                    keyboardType="numeric"
                                                    className="h-8 text-center"
                                                />
                                            )}
                                        </View>
                                        <View className="flex-1 px-1">
                                            {!isWeightOnly && (
                                                <IronInput
                                                    placeholder="-"
                                                    value={set.reps?.toString() || ''}
                                                    onChangeText={(val) => onUpdateSet(set.id, { reps: parseInt(val) || 0 })}
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
                                    <Pressable onPress={() => Alert.alert('Delete', 'Delete set?', [{ text: 'Cancel' }, { text: 'Del', onPress: () => onDeleteSet(set.id) }])}>
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
                        <Text className="text-iron-950 font-bold mb-2">Set Note</Text>
                        <TextInput
                            className="bg-background text-iron-950 p-3 rounded-lg border border-border mb-4 h-24"
                            textAlignVertical="top"
                            multiline
                            value={currentComment}
                            onChangeText={setCurrentComment}
                            placeholder="RPE 8, felt heavy..."
                            placeholderTextColor={Colors.iron[500]}
                        />
                        <View className="flex-row justify-end gap-2">
                            <IronButton label="Cancel" variant="outline" size="sm" onPress={() => setCommentModalVisible(false)} />
                            <IronButton label="Save" size="sm" onPress={saveComment} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
