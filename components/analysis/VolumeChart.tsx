import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { Colors } from '@/src/theme';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface VolumeChartProps {
    data: { value: number; sets?: number; label: string; frontColor?: string; dateMs?: number }[];
    bucket: 'day' | 'week' | 'month';
}

export function VolumeChart({ data, bucket }: VolumeChartProps) {
    const screenWidth = Dimensions.get('window').width;
    const [metric, setMetric] = useState<'volume' | 'sets'>('volume');
    const [tooltipData, setTooltipData] = useState<{ value: number; metricType: 'volume' | 'sets'; date: string } | null>(null);

    // Memoize chart data to strictly control re-renders and references
    const chartData = useMemo(() => {
        return data.map((item) => {
            const v = metric === 'volume' ? item.value : (item.sets ?? 0);
            return {
                ...item,
                value: v,
                frontColor: Colors.primary.DEFAULT,
                gradientColor: Colors.primary.light,
                onPress: () => {
                    Haptics.selectionAsync();
                    setTooltipData({
                        value: v,
                        metricType: metric,
                        date: item.label
                    });
                },
                dateLabel: item.dateMs ? format(item.dateMs, bucket === 'month' ? 'MMM yyyy' : 'd MMM', { locale: es }) : item.label
            };
        });
    }, [data, bucket, metric]);

    const maxValue = useMemo(() => {
        if (!data || data.length === 0) return 100;
        const max = Math.max(...data.map(d => metric === 'volume' ? (d.value ?? 0) : (d.sets ?? 0)));
        return isFinite(max) ? max : 100;
    }, [data, metric]);

    if (!data || data.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Carga Acumulada</Text>
                        <Text style={styles.subtitle}>Volumen y series por período</Text>
                    </View>
                </View>
                <EmptyChartPlaceholder
                    title="Sin carga registrada"
                    message="Completa entrenamientos con peso y repeticiones para ver tu carga acumulada."
                    height={220}
                />
            </View>
        );
    }

    const noOfSections = 4;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Carga Acumulada</Text>
                    <View style={styles.tabContainer}>
                        <Text
                            onPress={() => { Haptics.selectionAsync(); setMetric('volume'); setTooltipData(null); }}
                            style={[styles.tabBtn, metric === 'volume' && styles.tabBtnActive]}
                        >
                            Volumen
                        </Text>
                        <Text
                            onPress={() => { Haptics.selectionAsync(); setMetric('sets'); setTooltipData(null); }}
                            style={[styles.tabBtn, metric === 'sets' && styles.tabBtnActive]}
                        >
                            Series
                        </Text>
                    </View>
                </View>
                {tooltipData && (
                    <View style={styles.tooltip}>
                        <Text style={styles.tooltipValue}>
                            {Math.round(tooltipData.value).toLocaleString()}{tooltipData.metricType === 'volume' ? ' kg' : ' series'}
                        </Text>
                        <Text style={styles.tooltipDate}>
                            {tooltipData.date}
                        </Text>
                    </View>
                )}
            </View>

            <BarChart
                data={chartData}
                barWidth={bucket === 'day' ? 14 : bucket === 'month' ? 24 : 18}
                spacing={bucket === 'day' ? 6 : bucket === 'month' ? 16 : 10}
                roundedTop
                roundedBottom
                hideRules={false}
                rulesColor={Colors.iron[200]}
                rulesType="solid"
                xAxisThickness={1}
                xAxisColor={Colors.iron[200]}
                yAxisThickness={0}
                yAxisTextStyle={{ color: Colors.iron[400], fontSize: 10, fontWeight: '600' }}
                xAxisLabelTextStyle={{ color: Colors.iron[400], fontSize: 10, fontWeight: '600' }}
                noOfSections={noOfSections}
                maxValue={maxValue * 1.1}
                width={screenWidth - 64}
                height={220}
                isAnimated
                animationDuration={400}
                frontColor={Colors.primary.DEFAULT}
                yAxisLabelSuffix={metric === 'volume' ? 'k' : ''}
                formatYLabel={(label) => metric === 'volume' ? (parseInt(label) >= 1000 ? (parseInt(label) / 1000).toFixed(0) : label) : label}
                yAxisLabelWidth={50}
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
        fontSize: 17,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        color: Colors.iron[500],
        marginTop: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.iron[800],
        alignSelf: 'flex-start',
        borderRadius: 8,
        padding: 4,
        marginTop: 8,
        marginBottom: 8,
    },
    tabBtn: {
        fontSize: 12,
        color: Colors.iron[400],
        fontWeight: 'bold',
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderRadius: 6,
        overflow: 'hidden'
    },
    tabBtnActive: {
        backgroundColor: Colors.iron[700],
        color: Colors.iron[100],
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
