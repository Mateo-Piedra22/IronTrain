import { CategoryManager } from '@/components/CategoryManager';
import { ExerciseList } from '@/components/ExerciseList';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

export default function LibraryScreen() {
    const [mode, setMode] = useState<'exercises' | 'categories'>('exercises');

    return (
        <SafeAreaWrapper className="bg-iron-900" edges={['top', 'left', 'right']}>
            {/* Custom Tab Segment */}
            <View className="px-4 mb-3 mt-3">
                <View className="flex-row bg-surface p-1 rounded-xl border border-iron-700 elevation-1">
                    <TouchableOpacity
                        onPress={() => setMode('exercises')}
                        className={`flex-1 py-2 rounded-lg items-center ${mode === 'exercises' ? 'bg-primary shadow-sm' : 'bg-transparent'}`}
                    >
                        <Text className={`font-bold ${mode === 'exercises' ? 'text-white' : 'text-iron-500'}`}>Exercises</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setMode('categories')}
                        className={`flex-1 py-2 rounded-lg items-center ${mode === 'categories' ? 'bg-primary shadow-sm' : 'bg-transparent'}`}
                    >
                        <Text className={`font-bold ${mode === 'categories' ? 'text-white' : 'text-iron-500'}`}>Categories</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {mode === 'exercises' ? (
                <View className="flex-1">
                    {/* Pass navigation explicitly to allow management */}
                    <ExerciseList />
                </View>
            ) : (
                <View className="flex-1">
                    <CategoryManager />
                </View>
            )}
        </SafeAreaWrapper>
    );
}
