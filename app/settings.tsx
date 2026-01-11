import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useColorScheme } from '@/components/useColorScheme';
import { backupService } from '@/src/services/BackupService';
import { dbService } from '@/src/services/DatabaseService';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Database, Disc, Timer, Trash2 } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function SettingsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const [units, setUnits] = useState('kg');
    const [defaultTimer, setDefaultTimer] = useState('90');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const u = await dbService.getFirst<{ value: string }>("SELECT value FROM settings WHERE key = 'units'");
            if (u) setUnits(u.value);

            const t = await dbService.getFirst<{ value: string }>("SELECT value FROM settings WHERE key = 'default_timer'");
            if (t) setDefaultTimer(t.value);
        } catch (e) {
            console.log('Error loading settings', e);
        }
    };

    const saveSetting = async (key: string, value: string) => {
        await dbService.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
        loadSettings();
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
        <SafeAreaWrapper className="bg-iron-950" edges={['top']}>
            <Stack.Screen options={{ title: 'Settings', headerTitleStyle: { color: 'white' }, headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: '#fb923c' }} />

            <ScrollView className="flex-1 px-4">
                {/* ... existing content ... */}
                <Text className="text-iron-500 font-bold uppercase mt-6 mb-2 text-xs">General Preferences</Text>

                <View className="bg-iron-900 rounded-xl overflow-hidden">
                    <View className="flex-row items-center justify-between p-4 border-b border-iron-800">
                        <View className="flex-row items-center gap-3">
                            <Disc size={20} color="#fb923c" />
                            <Text className="text-white font-semibold">Weight Units</Text>
                        </View>
                        <View className="flex-row items-center gap-2 bg-iron-950 rounded-lg p-1">
                            <TouchableOpacity
                                onPress={() => saveSetting('units', 'kg')}
                                className={`px-3 py-1 rounded ${units === 'kg' ? 'bg-primary' : 'bg-transparent'}`}
                            >
                                <Text className={`font-bold ${units === 'kg' ? 'text-white' : 'text-iron-500'}`}>KG</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => saveSetting('units', 'lbs')}
                                className={`px-3 py-1 rounded ${units === 'lbs' ? 'bg-primary' : 'bg-transparent'}`}
                            >
                                <Text className={`font-bold ${units === 'lbs' ? 'text-white' : 'text-iron-500'}`}>LBS</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center gap-3">
                            <Timer size={20} color="#fb923c" />
                            <Text className="text-white font-semibold">Default Rest Timer</Text>
                        </View>
                        <View className="flex-row items-center">
                            <Text className="text-iron-400 mr-2">{defaultTimer}s</Text>
                            <ChevronRight size={16} color="#64748b" />
                        </View>
                    </View>
                </View>

                <Text className="text-iron-500 font-bold uppercase mt-8 mb-2 text-xs">Tools & Data</Text>
                <View className="bg-iron-900 rounded-xl overflow-hidden">
                    <TouchableOpacity onPress={() => router.push('/tools/plate-calculator' as any)} className="flex-row items-center justify-between p-4 border-b border-iron-800">
                        <View className="flex-row items-center gap-3">
                            <Disc size={20} color="#fb923c" />
                            <Text className="text-white font-semibold">Plate Inventory</Text>
                        </View>
                        <ChevronRight size={16} color="#64748b" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleBackup} className="flex-row items-center justify-between p-4 border-b border-iron-800">
                        <View className="flex-row items-center gap-3">
                            <Database size={20} color="#fb923c" />
                            <Text className="text-white font-semibold">Backup Data (JSON)</Text>
                        </View>
                        <ChevronRight size={16} color="#64748b" />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleRestore} className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center gap-3">
                            <Database size={20} color="#ef4444" />
                            <Text className="text-white font-semibold">Restore Backup</Text>
                        </View>
                        <ChevronRight size={16} color="#64748b" />
                    </TouchableOpacity>
                </View>

                <Text className="text-iron-500 font-bold uppercase mt-8 mb-2 text-xs">Danger Zone</Text>
                <View className="bg-iron-900 rounded-xl overflow-hidden border border-red-900/50">
                    <TouchableOpacity onPress={handleResetDB} className="flex-row items-center justify-between p-4">
                        <View className="flex-row items-center gap-3">
                            <Trash2 size={20} color="#ef4444" />
                            <Text className="text-red-500 font-semibold">Factory Reset</Text>
                        </View>
                        <ChevronRight size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>

                <Text className="text-center text-iron-700 mt-10 mb-10">IronTrain v1.0.0 (Build 2026)</Text>
            </ScrollView>
        </SafeAreaWrapper>
    );
}
