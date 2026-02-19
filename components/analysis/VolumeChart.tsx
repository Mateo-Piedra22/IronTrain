import { Colors } from '@/src/theme';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface VolumeChartProps {
    data: { value: number; label: string; frontColor?: string; dateMs?: number }[];
    bucket: 'day' | 'week' | 'month';
}

export function VolumeChart({ data, bucket }: VolumeChartProps) {
    const screenWidth = Dimensions.get('window').width;
    const [tooltipData, setTooltipData] = useState<{ value: number; date: string } | null>(null);

    // Memoize chart data to strictly control re-renders and references
    const chartData = useMemo(() => {
        return data.map((item) => ({
            ...item,
            frontColor: Colors.primary.DEFAULT,
            gradientColor: Colors.primary.light,
            onPress: () => {
                Haptics.selectionAsync();
                setTooltipData({
                    value: item.value,
                    date: item.label
                });
            },
            dateLabel: item.dateMs ? format(item.dateMs, bucket === 'month' ? 'MMM yyyy' : 'd MMM', { locale: es }) : item.label
        }));
    }, [data, bucket]);

    const maxValue = useMemo(() => {
        if (!data || data.length === 0) return 100;
        const max = Math.max(...data.map(d => d.value ?? 0));
        return isFinite(max) ? max : 100;
    }, [data]);

    if (!data || data.length === 0) {
        return (
            <View style={styles.containerEmpty}>
                <Text style={styles.textEmpty}>Sin datos para mostrar</Text>
            </View>
        );
    }

    const noOfSections = 4;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Volumen de Carga</Text>
                    <Text style={styles.subtitle}>
                        Total acumulado (Series × Reps × Peso)
                    </Text>
                </View>
                {tooltipData && (
                    <View style={styles.tooltip}>
                        <Text style={styles.tooltipValue}>
                            {Math.round(tooltipData.value).toLocaleString()} kg
                        </Text>
                        <Text style={styles.tooltipDate}>
                            {tooltipData.date}
                        </Text>
                    </View>
                )}
            </View>

            <BarChart
                data={chartData}
                barWidth={bucket === 'day' ? 12 : 24}
                spacing={bucket === 'day' ? 4 : 12}
                roundedTop
                roundedBottom
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color: Colors.iron[500], fontSize: 10 }}
                xAxisLabelTextStyle={{ color: Colors.iron[500], fontSize: 10 }}
                noOfSections={noOfSections}
                maxValue={maxValue * 1.1}
                width={screenWidth - 64} // consistent fixed width
                height={220}
                isAnimated
                animationDuration={400}
            />

            <Text style={styles.footer}>
                {bucket === 'day' ? 'Últimos días' : bucket === 'week' ? 'Semanas' : 'Meses'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.surface,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    containerEmpty: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        height: 256,
    },
    textEmpty: {
        color: Colors.iron[500],
        fontWeight: 'bold',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.primary.DEFAULT,
    },
    subtitle: {
        fontSize: 12,
        color: Colors.iron[500],
        marginTop: 4,
    },
    tooltip: {
        alignItems: 'flex-end',
        backgroundColor: Colors.iron[200],
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 4,
    },
    tooltipValue: {
        color: Colors.iron[950],
        fontWeight: '900',
        fontSize: 14,
    },
    tooltipDate: {
        color: Colors.iron[500],
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    footer: {
        textAlign: 'center',
        color: Colors.iron[500],
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: 8,
    }
});
