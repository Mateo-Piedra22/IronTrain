import { CategoryManager } from '@/components/CategoryManager';
import { ExerciseList } from '@/components/ExerciseList';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function LibraryScreen() {
    const router = useRouter();
    const [mode, setMode] = useState<'exercises' | 'categories'>('exercises');

    return (
        <SafeAreaWrapper className="bg-iron-950">
            {/* Custom Tab Segment */}
            <View className="px-4 py-3">
                <View className="flex-row bg-iron-900 p-1 rounded-xl border border-iron-800">
                    <TouchableOpacity
                        onPress={() => setMode('exercises')}
                        className={`flex-1 py-2 rounded-lg items-center ${mode === 'exercises' ? 'bg-iron-800' : 'bg-transparent'}`}
                    >
                        <Text className={`font-bold ${mode === 'exercises' ? 'text-primary' : 'text-iron-500'}`}>Exercises</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setMode('categories')}
                        className={`flex-1 py-2 rounded-lg items-center ${mode === 'categories' ? 'bg-iron-800' : 'bg-transparent'}`}
                    >
                        <Text className={`font-bold ${mode === 'categories' ? 'text-primary' : 'text-iron-500'}`}>Categories</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {mode === 'exercises' ? (
                <View className="flex-1 px-4">
                    {/* Pass navigation explicitly to allow management */}
                    <ExerciseList />
                </View>
            ) : (
                <View className="flex-1 px-4">
                    <CategoryManager />
                </View>
            )}
        </SafeAreaWrapper>
    );
}
