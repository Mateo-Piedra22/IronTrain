import { backupService } from '@/src/services/BackupService';
import { Colors } from '@/src/theme';
import { useRouter } from 'expo-router';
import { Calculator, ChevronRight, CircleDot, Database, Ruler, Settings, Wrench } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { confirm, useConfirmStore } from '../../src/store/confirmStore';

interface AnalysisToolsProps {
    setCalcVisible: (v: boolean, tab?: 'oneRm' | 'warmup' | 'power') => void;
}

const tools = [
    { id: 'oneRm', icon: Calculator, label: 'Calculadora 1RM', subtitle: 'Estima tu repetición máxima' },
    { id: 'plates', icon: CircleDot, label: 'Calculadora de Discos', subtitle: 'Planifica tu barra' },
    { id: 'body', icon: Ruler, label: 'Evolución Física', subtitle: 'Medidas y seguimiento corporal' },
    { id: 'settings', icon: Settings, label: 'Ajustes', subtitle: 'Configuración de la app' },
    { id: 'backup', icon: Database, label: 'Datos (Backup)', subtitle: 'Exportar y restaurar' },
] as const;

export function AnalysisTools({ setCalcVisible }: AnalysisToolsProps) {
    const router = useRouter();

    const handleBackup = () => {
        const hide = useConfirmStore.getState().hide;
        confirm.custom({
            title: 'Tus datos',
            message: 'Exporta o restaura tu backup.',
            variant: 'info',
            buttons: [
                { label: 'Cancelar', onPress: hide, variant: 'ghost' },
                {
                    label: 'Exportar',
                    variant: 'solid',
                    onPress: async () => {
                        hide();
                        try {
                            await backupService.exportData();
                        } catch (e) {
                            confirm.error('Error', 'Falló la exportación.');
                        }
                    }
                },
                {
                    label: 'Restaurar',
                    destructive: true,
                    onPress: async () => {
                        hide();
                        try {
                            const success = await backupService.importData({ mode: 'overwrite' });
                            if (success) confirm.success('Listo', 'Datos restaurados. Reinicia la app.');
                        } catch (e) {
                            confirm.error('Error', 'Falló la restauración.');
                        }
                    }
                },
            ],
        });
    };

    const handlePress = (id: string) => {
        switch (id) {
            case 'oneRm':
                setCalcVisible(true, 'oneRm');
                break;
            case 'plates':
                router.push('/tools/plate-calculator' as any);
                break;
            case 'body':
                router.push('/body' as any);
                break;
            case 'settings':
                router.push('/settings' as any);
                break;
            case 'backup':
                handleBackup();
                break;
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.toolsGrid}>
                <View style={[styles.header, { paddingHorizontal: 16, paddingTop: 14 }]}>
                    <View style={styles.headerAccent} />
                    <Wrench size={16} color={Colors.iron[950]} />
                    <Text style={styles.headerTitle}>Herramientas</Text>
                </View>

                {tools.map((tool, idx) => {
                    const IconComponent = tool.icon;
                    return (
                        <Pressable
                            key={tool.id}
                            style={[styles.toolCard, idx < tools.length - 1 && styles.toolCardBorder]}
                            onPress={() => handlePress(tool.id)}
                            android_ripple={{ color: Colors.iron[300] }}
                        >
                            <View style={styles.toolIconCircle}>
                                <IconComponent size={18} color={Colors.primary.DEFAULT} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.toolLabel}>{tool.label}</Text>
                                <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
                            </View>
                            <ChevronRight size={16} color={Colors.iron[400]} />
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 32,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
    },
    headerAccent: {
        width: 3,
        height: 18,
        borderRadius: 2,
        backgroundColor: Colors.primary.DEFAULT,
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.3,
    },
    toolsGrid: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        overflow: 'hidden',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    toolCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 14,
    },
    toolCardBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[200],
    },
    toolIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: Colors.primary.DEFAULT + '12',
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.iron[950],
    },
    toolSubtitle: {
        fontSize: 11,
        fontWeight: '500',
        color: Colors.iron[400],
        marginTop: 2,
    },
});
