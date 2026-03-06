import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { PRCenter } from '@/components/PRCenter';
import { BadgePill } from '@/components/ui/BadgePill';
import { OneRMProgressRow, OneRepMax } from '@/src/services/AnalysisService';
import { Colors } from '@/src/theme';
import { useRouter } from 'expo-router';
import { ChevronRight, TrendingUp, Trophy } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface AnalysisRecordsProps {
    oneRepMaxes: OneRepMax[];
    top1RMProgress: OneRMProgressRow[];
    rangeDays: 7 | 30 | 90 | 365;
}

export function AnalysisRecords({ oneRepMaxes, top1RMProgress, rangeDays }: AnalysisRecordsProps) {
    const router = useRouter();

    return (
        <View style={{ paddingBottom: 32 }}>
            <PRCenter />

            {/* TOP 1RMs */}
            <View style={{ marginTop: 24 }}>
                <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={styles.sectionAccent} />
                        <Trophy size={16} color={Colors.iron[950]} />
                        <Text style={styles.sectionTitle}>Ranking de Fuerza (1RM Est.)</Text>
                    </View>
                    <View style={styles.rangeBadge}>
                        <Text style={styles.rangeBadgeText}>{rangeDays}D</Text>
                    </View>
                </View>

                {oneRepMaxes.length === 0 ? (
                    <EmptyChartPlaceholder
                        title="Sin registros suficientes"
                        message="Necesitamos al menos 1 serie con peso para calcular tu 1RM estimado."
                        height={120}
                    />
                ) : (
                    oneRepMaxes.slice(0, 5).map((orm, idx) => (
                        <Pressable
                            key={orm.exerciseId}
                            style={[styles.ormCard, idx < 4 && { marginBottom: 10 }]}
                            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: orm.exerciseId, exerciseId: orm.exerciseId, exerciseName: orm.exerciseName } } as any)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>{idx + 1}</Text>
                                </View>

                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.ormName} numberOfLines={1}>{orm.exerciseName}</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {orm.badges?.map((b, i) => (
                                            <BadgePill key={i} name={b.name} color={b.color} icon={b.icon} size="xs" />
                                        ))}
                                    </View>
                                    <Text style={styles.ormBasis}>
                                        Máximo: {orm.weight}kg × {orm.reps}
                                    </Text>
                                </View>

                                <View style={styles.ormValueContainer}>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                                        <Text style={styles.ormValue}>{Math.round(orm.estimated1RM)}</Text>
                                        <Text style={styles.ormUnit}>kg</Text>
                                    </View>
                                </View>
                                <ChevronRight size={14} color={Colors.iron[400]} style={{ marginLeft: 6 }} />
                            </View>
                        </Pressable>
                    ))
                )}
            </View>

            {/* TOP PROGRESS */}
            <View style={{ marginTop: 32 }}>
                <View style={styles.sectionHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.sectionAccent, { backgroundColor: '#16a34a' }]} />
                        <TrendingUp size={16} color={Colors.iron[950]} />
                        <Text style={styles.sectionTitle}>Mayores Progresos</Text>
                    </View>
                </View>

                {top1RMProgress.length === 0 ? (
                    <EmptyChartPlaceholder
                        title="Sin progresos detectados"
                        message="Sigue entrenando para ver tu evolución en el tiempo."
                        height={120}
                    />
                ) : (
                    top1RMProgress.slice(0, 4).map((prog, idx) => (
                        <Pressable
                            key={prog.exerciseId}
                            style={[styles.ormCard, idx < 3 && { marginBottom: 10 }]}
                            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: prog.exerciseId, exerciseId: prog.exerciseId, exerciseName: prog.exerciseName } } as any)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.rankBadge, { backgroundColor: '#16a34a15' }]}>
                                    <TrendingUp size={14} color="#16a34a" />
                                </View>

                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.ormName} numberOfLines={1}>{prog.exerciseName}</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {prog.badges?.map((b, i) => (
                                            <BadgePill key={i} name={b.name} color={b.color} icon={b.icon} size="xs" />
                                        ))}
                                    </View>
                                    <Text style={styles.ormBasis}>
                                        {Math.round(prog.start1RM)}kg → {Math.round(prog.end1RM)}kg
                                    </Text>
                                </View>

                                <View style={styles.ormValueContainer}>
                                    <Text style={[styles.ormValue, { color: '#16a34a' }]}>+{Math.round(prog.delta)}</Text>
                                    <Text style={[styles.ormUnit, { color: '#16a34a' }]}>
                                        {prog.deltaPct ? `${prog.deltaPct}%` : 'kg'}
                                    </Text>
                                </View>
                                <ChevronRight size={14} color={Colors.iron[400]} style={{ marginLeft: 6 }} />
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
        paddingHorizontal: 4,
    },
    sectionAccent: {
        width: 3,
        height: 18,
        borderRadius: 2,
        backgroundColor: Colors.primary.DEFAULT,
    },
    sectionTitle: {
        fontSize: 16,
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
        padding: 12,
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
        fontSize: 10,
        fontWeight: '600',
        color: Colors.iron[400],
        marginTop: 2,
    },
    ormValueContainer: {
        alignItems: 'flex-end',
        minWidth: 50,
    },
    ormValue: {
        fontSize: 18,
        fontWeight: '900',
        color: Colors.primary.DEFAULT,
        letterSpacing: -0.5,
    },
    ormUnit: {
        fontSize: 9,
        fontWeight: '800',
        color: Colors.iron[400],
        textTransform: 'uppercase',
    },
});
