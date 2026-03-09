import { BarChart2 } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';

interface EmptyChartPlaceholderProps {
    title?: string;
    message?: string;
    height?: number;
}

/**
 * Structured empty state for chart areas.
 * Shows a professional placeholder with a subtle grid pattern
 * and an informative message encouraging the user to generate data.
 */
export function EmptyChartPlaceholder({
    title = 'Sin datos suficientes',
    message = 'Registra más entrenamientos para ver tu progreso aquí.',
    height = 200,
}: EmptyChartPlaceholderProps) {
    const colors = useColors();

    const ss = useMemo(() => StyleSheet.create({
        wrapper: {
            width: '100%',
            borderRadius: 16,
            backgroundColor: colors.iron[100],
            borderWidth: 1.5,
            borderColor: colors.iron[200],
            borderStyle: 'dashed',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
            position: 'relative',
        },
        gridOverlay: {
            ...StyleSheet.absoluteFillObject,
        },
        gridLine: {
            position: 'absolute',
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: colors.iron[300],
            opacity: 0.3,
        },
        contentBox: {
            alignItems: 'center',
            paddingHorizontal: 32,
            zIndex: 1,
        },
        iconCircle: {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.iron[300],
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 12,
            elevation: 2,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
        },
        title: {
            color: colors.iron[700],
            fontWeight: '900',
            fontSize: 14,
            marginBottom: 4,
            textAlign: 'center',
            letterSpacing: -0.2,
        },
        message: {
            color: colors.iron[500],
            fontSize: 12,
            textAlign: 'center',
            lineHeight: 18,
            fontWeight: '600',
        },
    }), [colors]);

    return (
        <View style={[ss.wrapper, { height }]}>
            {/* Simulated grid lines */}
            <View style={ss.gridOverlay}>
                {[0, 1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={[
                            ss.gridLine,
                            { top: `${(i + 1) * 20}%` },
                        ]}
                    />
                ))}
            </View>

            {/* Content */}
            <View style={ss.contentBox}>
                <View style={ss.iconCircle}>
                    <BarChart2 size={20} color={colors.iron[400]} />
                </View>
                <Text style={ss.title}>{title}</Text>
                <Text style={ss.message}>{message}</Text>
            </View>
        </View>
    );
}
