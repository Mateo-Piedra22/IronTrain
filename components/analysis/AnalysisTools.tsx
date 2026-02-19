import { backupService } from '@/src/services/BackupService';
import { Colors } from '@/src/theme';
import { useRouter } from 'expo-router';
import { LucideCalculator, LucideCircleDot, LucideDatabase, LucideSettings } from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

interface AnalysisToolsProps {
    setCalcVisible: (v: boolean, tab?: 'oneRm' | 'warmup' | 'plates' | 'power') => void;
}

export function AnalysisTools({ setCalcVisible }: AnalysisToolsProps) {
    const router = useRouter();

    const handleBackup = () => {
        Alert.alert(
            'Tus datos',
            'Exporta o restaura tu backup.',
            [
                {
                    text: 'Exportar backup (JSON)',
                    onPress: async () => {
                        try {
                            await backupService.exportData();
                        } catch (e) {
                            Alert.alert('Error', 'Falló la exportación.');
                        }
                    }
                },
                {
                    text: 'Restaurar backup (JSON)',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const success = await backupService.importData({ mode: 'overwrite' });
                            if (success) Alert.alert('Listo', 'Datos restaurados. Reinicia la app.');
                        } catch (e) {
                            Alert.alert('Error', 'Falló la restauración.');
                        }
                    }
                },
                { text: 'Cancelar', style: 'cancel' }
            ]
        );
    };

    return (
        <View className="gap-4 pb-8">
            <Pressable className="bg-surface p-4 rounded-xl border border-iron-700 flex-row gap-4 items-center" onPress={() => setCalcVisible(true, 'oneRm')}>
                <LucideCalculator color={Colors.primary.DEFAULT} size={24} />
                <Text className="font-bold text-lg text-iron-950">Calculadoras 1RM</Text>
            </Pressable>
            <Pressable className="bg-surface p-4 rounded-xl border border-iron-700 flex-row gap-4 items-center" onPress={() => setCalcVisible(true, 'plates')}>
                <LucideCircleDot color={Colors.primary.DEFAULT} size={24} />
                <Text className="font-bold text-lg text-iron-950">Calculadora de Discos</Text>
            </Pressable>
            <Pressable className="bg-surface p-4 rounded-xl border border-iron-700 flex-row gap-4 items-center" onPress={() => router.push('/settings' as any)}>
                <LucideSettings color={Colors.primary.DEFAULT} size={24} />
                <Text className="font-bold text-lg text-iron-950">Ajustes</Text>
            </Pressable>
            <Pressable
                className="bg-surface p-4 rounded-xl border border-iron-700 flex-row gap-4 items-center"
                onPress={handleBackup}
            >
                <LucideDatabase color={Colors.primary.DEFAULT} size={24} />
                <Text className="font-bold text-lg text-iron-950">Datos (Backup)</Text>
            </Pressable>
        </View>
    );
}
