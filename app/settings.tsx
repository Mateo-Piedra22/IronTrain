import { IronButton } from '@/components/IronButton';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useColorScheme } from '@/components/useColorScheme';
import { backupService } from '@/src/services/BackupService';
import { configService } from '@/src/services/ConfigService';
import { dbService } from '@/src/services/DatabaseService';
import { Colors } from '@/src/theme';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Database, Disc, Timer, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const [units, setUnits] = useState('kg');
    const [defaultTimer, setDefaultTimer] = useState(90);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        await configService.init();
        setUnits(configService.get('weightUnit'));
        setDefaultTimer(configService.get('defaultRestTimer'));
    };

    const saveSetting = async (key: 'weightUnit' | 'defaultRestTimer', value: any) => {
        await configService.set(key, value);
        if (key === 'weightUnit') setUnits(value);
        if (key === 'defaultRestTimer') setDefaultTimer(value);
    };

    const handleBackup = async () => {
        try {
            await backupService.exportData();
            Alert.alert('Success', 'Backup created successfully');
        } catch (e) {
            Alert.alert('Error', 'Backup failed');
        }
    };

    const handleRestore = async () => {
        Alert.alert(
            'Restore Data',
            'This will overwrite current data. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Restore',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await backupService.importData();
                            if (success) Alert.alert('Success', 'Data restored. Please restart app.');
                        } catch (e) {
                            Alert.alert('Error', 'Restore failed');
                        }
                    }
                }
            ]
        );
    };

    const handleResetDB = () => {
        Alert.alert(
            'Factory Reset',
            'Delete ALL workouts and history? This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'DELETE EVERYTHING',
                    style: 'destructive',
                    onPress: async () => {
                        // Nuke logic
                        await dbService.run("DELETE FROM workouts");
                        await dbService.run("DELETE FROM workout_sets");
                        Alert.alert('Reset', 'Database cleared.');
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaWrapper className="bg-iron-900" edges={['left', 'right']}>
            <Stack.Screen options={{ title: 'Settings', headerTitleStyle: { color: Colors.iron[950] }, headerStyle: { backgroundColor: Colors.iron[900] }, headerTintColor: Colors.primary.DEFAULT }} />

            <ScrollView className="flex-1 px-4">
                {/* ... existing content ... */}
                <Text className="text-iron-950 font-bold uppercase mt-6 mb-2 text-xs">General Preferences</Text>

                <View className="bg-surface rounded-xl overflow-hidden border border-iron-700 elevation-1">
                    <View className="flex-row items-center justify-between p-4 border-b border-iron-200">
                        <View className="flex-row items-center gap-3">
                            <Disc size={20} color={Colors.primary.DEFAULT} />
                            <Text className="text-iron-950 font-semibold">Weight Units</Text>
                        </View>
                        <View className="flex-row items-center gap-2 bg-iron-100 rounded-lg p-1 border border-iron-200">
                            <TouchableOpacity
                                onPress={() => saveSetting('weightUnit', 'kg')}
                                className={`px-3 py-1 rounded ${units === 'kg' ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                            >
                                <Text className={`font-bold ${units === 'kg' ? 'text-primary' : 'text-iron-500'}`}>KG</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => saveSetting('weightUnit', 'lbs')}
                                className={`px-3 py-1 rounded ${units === 'lbs' ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                            >
                                <Text className={`font-bold ${units === 'lbs' ? 'text-primary' : 'text-iron-500'}`}>LBS</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center gap-3">
                            <Timer size={20} color={Colors.primary.DEFAULT} />
                            <Text className="text-iron-950 font-semibold">Default Rest Timer</Text>
                        </View>
                        <View className="flex-row items-center">
                            <TouchableOpacity 
                                onPress={() => saveSetting('defaultRestTimer', Math.max(0, defaultTimer - 30))}
                                className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center mr-2"
                            >
                                <Text className="font-bold">-</Text>
                            </TouchableOpacity>
                            <Text className="text-iron-950 mr-2 font-bold w-8 text-center">{defaultTimer}s</Text>
                            <TouchableOpacity 
                                onPress={() => saveSetting('defaultRestTimer', defaultTimer + 30)}
                                className="w-8 h-8 bg-iron-200 rounded-full items-center justify-center"
                            >
                                <Text className="font-bold">+</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <Text className="text-iron-950 font-bold uppercase mt-8 mb-2 text-xs">Tools & Data</Text>
                <View className="bg-surface rounded-xl overflow-hidden border border-iron-700 elevation-1">
                    <TouchableOpacity onPress={() => router.push('/tools/plate-calculator' as any)} className="flex-row items-center justify-between p-4 border-b border-iron-200">
                        <View className="flex-row items-center gap-3">
                            <Disc size={20} color={Colors.primary.DEFAULT} />
                            <Text className="text-iron-950 font-semibold">Plate Inventory</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleBackup} className="flex-row items-center justify-between p-4 border-b border-iron-200">
                        <View className="flex-row items-center gap-3">
                            <Database size={20} color={Colors.primary.DEFAULT} />
                            <Text className="text-iron-950 font-semibold">Backup Data (JSON)</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleRestore} className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center gap-3">
                            <Database size={20} color={Colors.red} />
                            <Text className="text-iron-950 font-semibold">Restore Backup</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>
                </View>

                <Text className="text-iron-950 font-bold uppercase mt-8 mb-2 text-xs">Danger Zone</Text>
                <View className="bg-surface rounded-xl overflow-hidden border border-red-200 elevation-1">
                    <TouchableOpacity onPress={handleResetDB} className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center gap-3">
                            <Trash2 size={20} color={Colors.red} />
                            <Text className="text-red-600 font-semibold">Factory Reset</Text>
                        </View>
                        <ChevronRight size={16} color={Colors.red} />
                    </TouchableOpacity>
                </View>

                <Text className="text-center text-iron-500 mt-10 mb-10">IronTrain v1.0.0 (Build 2026)</Text>
            </ScrollView>
        </SafeAreaWrapper>
    );
}
