import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useColors } from '../../src/hooks/useColors';

interface VolumeChartProps {
    data: { value: number; sets?: number; label: string; frontColor?: string; dateMs?: number }[];
    bucket: 'day' | 'week' | 'month';
}

export function VolumeChart({ data, bucket }: VolumeChartProps) {
    const colors = useColors();
    const styles = useMemo(() => StyleSheet.create({
        container: {
            backgroundColor: colors.surface,
            padding: 20,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.05,
            shadowRadius: 15,
            elevation: 4,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 20,
        },
        headerInfo: {
            flex: 1
        },
        title: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.iron[950],
            letterSpacing: -0.3,
        },
        subtitle: {
            fontSize: 13,
            color: colors.iron[500],
            fontWeight: '600',
            marginTop: 4,
        },
        tabContainer: {
            flexDirection: 'row',
            backgroundColor: colors.iron[100],
            alignSelf: 'flex-start',
            borderRadius: 12,
            padding: 4,
            marginTop: 12,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
        },
        tabBtn: {
            fontSize: 13,
            color: colors.iron[600],
            fontWeight: '900',
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 10,
            overflow: 'hidden'
        },
        tabBtnActive: {
            backgroundColor: colors.surface,
            color: colors.primary.DEFAULT,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 2,
        },
        tooltip: {
            alignItems: 'flex-end',
            backgroundColor: colors.iron[100],
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.iron[200],
        },
        tooltipValue: {
            color: colors.iron[950],
            fontWeight: '900',
            fontSize: 15,
        },
        tooltipDate: {
            color: colors.iron[500],
            fontSize: 11,
            fontWeight: '800',
            textTransform: 'uppercase',
            marginTop: 2,
        },
        footerContainer: {
            marginTop: 16,
            paddingTop: 12,
            borderTopWidth: 1.5,
            borderTopColor: colors.iron[100],
            alignItems: 'center'
        },
        footer: {
            color: colors.iron[400],
            fontSize: 11,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1.5,
        }
    }), [colors]);
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
                frontColor: colors.primary.DEFAULT,
                gradientColor: colors.primary.light,
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
    }, [data, bucket, metric, colors]);

    const maxValue = useMemo(() => {
        if (!data || data.length === 0) return 100;
        const max = Math.max(...data.map(d => metric === 'volume' ? (d.value ?? 0) : (d.sets ?? 0)));
        return isFinite(max) ? max : 100;
    }, [data, metric]);

    if (!data || data.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerInfo}>
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
                <View style={styles.headerInfo}>
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
                rulesColor={colors.iron[100]}
                rulesType="solid"
                xAxisThickness={1.5}
                xAxisColor={colors.iron[200]}
                yAxisThickness={0}
                yAxisTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '900' }}
                xAxisLabelTextStyle={{ color: colors.iron[400], fontSize: 10, fontWeight: '900' }}
                noOfSections={noOfSections}
                maxValue={maxValue * 1.1}
                width={screenWidth - 80}
                height={220}
                isAnimated
                animationDuration={400}
                frontColor={colors.primary.DEFAULT}
                yAxisLabelSuffix={metric === 'volume' ? 'k' : ''}
                formatYLabel={(label) => metric === 'volume' ? (parseInt(label) >= 1000 ? (parseInt(label) / 1000).toFixed(0) : label) : label}
                yAxisLabelWidth={45}
            />

            <View style={styles.footerContainer}>
                <Text style={styles.footer}>
                    {bucket === 'day' ? 'Últimos días' : bucket === 'week' ? 'Semanas' : 'Meses'}
                </Text>
            </View>
        </View>
    );
}


