import { Colors } from '@/src/theme';
import { BarChart2 } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
    return (
        <View style={[styles.wrapper, { height }]}>
            {/* Simulated grid lines */}
            <View style={styles.gridOverlay}>
                {[0, 1, 2, 3].map((i) => (
                    <View
                        key={i}
                        style={[
                            styles.gridLine,
                            { top: `${(i + 1) * 20}%` },
                        ]}
                    />
                ))}
            </View>

            {/* Content */}
            <View style={styles.contentBox}>
                <View style={styles.iconCircle}>
                    <BarChart2 size={20} color={Colors.iron[400]} />
                </View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.message}>{message}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        borderRadius: 12,
        backgroundColor: Colors.iron[200],
        borderWidth: 1,
        borderColor: Colors.iron[300],
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
        backgroundColor: Colors.iron[300],
        opacity: 0.5,
    },
    contentBox: {
        alignItems: 'center',
        paddingHorizontal: 32,
        zIndex: 1,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        color: Colors.iron[500],
        fontWeight: '800',
        fontSize: 13,
        marginBottom: 4,
        textAlign: 'center',
    },
    message: {
        color: Colors.iron[400],
        fontSize: 11,
        textAlign: 'center',
        lineHeight: 16,
        fontWeight: '500',
    },
});
