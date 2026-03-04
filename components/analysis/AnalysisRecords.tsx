import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { PRCenter } from '@/components/PRCenter';
import { OneRepMax } from '@/src/services/AnalysisService';
import { Colors } from '@/src/theme';
import { useRouter } from 'expo-router';
import { ChevronRight, Trophy } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface AnalysisRecordsProps {
    oneRepMaxes: OneRepMax[];
    rangeDays: 7 | 30 | 90 | 365;
}

export function AnalysisRecords({ oneRepMaxes, rangeDays }: AnalysisRecordsProps) {
    const router = useRouter();

    return (
        <View style={{ paddingBottom: 32 }}>
            <PRCenter />

            <View style={{ marginTop: 20 }}>
                <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.sectionAccent} />
                        <Trophy size={16} color={Colors.iron[950]} />
                        <Text style={styles.sectionTitle}>Est. 1RM</Text>
                    </View>
                    <View style={styles.rangeBadge}>
                        <Text style={styles.rangeBadgeText}>{rangeDays}D</Text>
                    </View>
                </View>

                {oneRepMaxes.length === 0 ? (
                    <EmptyChartPlaceholder
                        title="Sin registros suficientes"
                        message="Necesitamos al menos 1 serie con peso para calcular tu 1RM estimado."
                        height={140}
                    />
                ) : (
                    oneRepMaxes.map((orm, idx) => (
                        <Pressable
                            key={orm.exerciseId}
                            style={[styles.ormCard, idx < oneRepMaxes.length - 1 && { marginBottom: 10 }]}
                            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: orm.exerciseId, exerciseId: orm.exerciseId, exerciseName: orm.exerciseName } } as any)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {/* Rank */}
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>{idx + 1}</Text>
                                </View>

                                {/* Info */}
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.ormName} numberOfLines={1}>{orm.exerciseName}</Text>
                                    <Text style={styles.ormBasis}>
                                        Basado en {orm.weight}kg × {orm.reps} reps
                                    </Text>
                                </View>

                                {/* 1RM Value */}
                                <View style={styles.ormValueContainer}>
                                    <Text style={styles.ormValue}>{Math.round(orm.estimated1RM)}</Text>
                                    <Text style={styles.ormUnit}>KG</Text>
                                </View>

                                <ChevronRight size={16} color={Colors.iron[400]} style={{ marginLeft: 6 }} />
                            </View>
                        </Pressable>
                    ))
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    sectionAccent: {
        width: 3,
        height: 18,
        borderRadius: 2,
        backgroundColor: Colors.primary.DEFAULT,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.3,
    },
    rangeBadge: {
        backgroundColor: Colors.primary.DEFAULT + '15',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    rangeBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.primary.DEFAULT,
    },
    ormCard: {
        backgroundColor: Colors.surface,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
    },
    rankBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.primary.DEFAULT + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        fontSize: 13,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
    },
    ormName: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.iron[950],
    },
    ormBasis: {
        fontSize: 11,
        fontWeight: '500',
        color: Colors.iron[400],
        marginTop: 2,
    },
    ormValueContainer: {
        alignItems: 'flex-end',
    },
    ormValue: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
        letterSpacing: -0.5,
    },
    ormUnit: {
        fontSize: 9,
        fontWeight: '700',
        color: Colors.iron[400],
        textTransform: 'uppercase',
    },
});
