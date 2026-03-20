import { AlertTriangle, Hammer } from 'lucide-react-native';
import { useFeatureFlagWithPayload } from 'posthog-react-native';
import React from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../src/hooks/useTheme';

const { width } = Dimensions.get('window');

interface MaintenancePayload {
    title?: string;
    description?: string;
    errorCode?: string;
}

export default function MaintenanceMode({ children }: { children: React.ReactNode }) {
    const [isMaintenanceMode, payload] = useFeatureFlagWithPayload('maintenance-mode') as [boolean | string, MaintenancePayload | null];
    const { activeTheme } = useTheme();
    const { colors } = activeTheme;

    if (isMaintenanceMode === true) {
        const title = payload?.title || 'IRONTRAIN_UNDER_REPAIR';
        const description = payload?.description || 'Estamos optimizando la infraestructura de sincronización para que tus entrenamientos se guarden más rápido que nunca. Volvemos en breve.';
        const errorCode = payload?.errorCode || '503_MAINTENANCE_ACTIVE';

        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Stripe Header */}
                <View style={[styles.stripe, { backgroundColor: colors.red }]} />

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.iron[900] || '#1a1a2e', shadowColor: colors.black }]}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.iron[900] || '#1a1a2e' }]}>
                        <Hammer size={48} color={colors.white} />
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>
                        {title}
                    </Text>

                    <View style={styles.statusBadge}>
                        <AlertTriangle size={16} color={colors.text} style={{ opacity: 0.5 }} />
                        <Text style={[styles.statusText, { color: colors.text }]}>Mantenimiento de Sistemas</Text>
                    </View>

                    <Text style={[styles.description, { color: colors.text }]}>
                        {description}
                    </Text>

                    <View style={[styles.codeBox, { backgroundColor: colors.surfaceLighter, borderColor: colors.iron[900] || '#1a1a2e' }]}>
                        <Text style={[styles.codeLabel, { color: colors.text }]}>System_Status</Text>
                        <Text style={[styles.codeText, { color: colors.text }]}>{errorCode}</Text>
                    </View>

                    <Text style={[styles.footerText, { color: colors.text }]}>
                        GRACIAS POR TU PACIENCIA ● MOTIONA CORE
                    </Text>
                </View>
            </View>
        );
    }

    return <>{children}</>;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    stripe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 8,
    },
    card: {
        width: '100%',
        borderWidth: 4,
        padding: 32,
        alignItems: 'center',
        shadowOffset: { width: 12, height: 12 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 10,
    },
    iconContainer: {
        padding: 16,
        borderRadius: 20,
        marginBottom: 24,
        transform: [{ rotate: '3deg' }],
    },
    title: {
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 12,
        letterSpacing: -1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 24,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 2,
        opacity: 0.5,
    },
    description: {
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 32,
        opacity: 0.7,
    },
    codeBox: {
        width: '100%',
        padding: 16,
        borderWidth: 2,
        borderStyle: 'dashed',
        marginBottom: 24,
    },
    codeLabel: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        opacity: 0.5,
        marginBottom: 4,
    },
    codeText: {
        fontSize: 14,
        fontWeight: '700',
    },
    footerText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 3,
        opacity: 0.3,
        textAlign: 'center',
    }
});
