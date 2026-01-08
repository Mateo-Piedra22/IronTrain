import { ExerciseList } from '@/components/ExerciseList';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExercisesScreen() {
    const router = useRouter();

    return (
        <SafeAreaView className="flex-1 bg-iron-950" edges={['top']}>
            <View className="flex-1 px-4">
                <ExerciseList
                    onSelect={(id) => router.push(`/exercises/${id}` as any)}
                />
            </View>
        </SafeAreaView>
    );
}

