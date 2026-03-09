import { backupService } from '@/src/services/BackupService';
import { withAlpha } from '@/src/theme';
import { useRouter } from 'expo-router';
import { Calculator, ChevronRight, CircleDot, Database, Ruler, Settings, Wrench } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../src/hooks/useColors';
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
    const colors = useColors();
    const styles = useMemo(() => StyleSheet.create({
        container: {
            paddingBottom: 32,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
        },
        headerAccent: {
            width: 4,
            height: 20,
            borderRadius: 2,
            backgroundColor: colors.primary.DEFAULT,
        },
        headerTitle: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.iron[950],
            letterSpacing: -0.3,
        },
        toolsGrid: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
            overflow: 'hidden',
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.06,
            shadowRadius: 16,
            elevation: 4,
        },
        toolCard: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 18,
            gap: 16,
        },
        toolCardBorder: {
            borderBottomWidth: 1.5,
            borderBottomColor: colors.iron[100],
        },
        toolIconCircle: {
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
            justifyContent: 'center',
            alignItems: 'center',
        },
        toolLabel: {
            fontSize: 16,
            fontWeight: '900',
            color: colors.iron[950],
        },
        toolSubtitle: {
            fontSize: 12,
            fontWeight: '600',
            color: colors.iron[500],
            marginTop: 2,
        },
    }), [colors]);
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
                    <Wrench size={16} color={colors.iron[950]} />
                    <Text style={styles.headerTitle}>Herramientas</Text>
                </View>

                {tools.map((tool, idx) => {
                    const IconComponent = tool.icon;
                    return (
                        <Pressable
                            key={tool.id}
                            style={[styles.toolCard, idx < tools.length - 1 && styles.toolCardBorder]}
                            onPress={() => handlePress(tool.id)}
                            android_ripple={{ color: colors.iron[300] }}
                        >
                            <View style={styles.toolIconCircle}>
                                <IconComponent size={18} color={colors.primary.DEFAULT} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.toolLabel}>{tool.label}</Text>
                                <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
                            </View>
                            <ChevronRight size={16} color={colors.iron[400]} />
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}


