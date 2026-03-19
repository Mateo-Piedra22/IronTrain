import { EmptyChartPlaceholder } from '@/components/EmptyChartPlaceholder';
import { PRCenter } from '@/components/PRCenter';
import { BadgePill } from '@/components/ui/BadgePill';
import { useColors } from '@/src/hooks/useColors';
import { OneRMProgressRow, OneRepMax } from '@/src/services/AnalysisService';
import { ThemeFx, withAlpha } from '@/src/theme';
import { useRouter } from 'expo-router';
import { ChevronRight, TrendingUp, Trophy } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface AnalysisRecordsProps {
    oneRepMaxes: OneRepMax[];
    top1RMProgress: OneRMProgressRow[];
    rangeDays: 7 | 30 | 90 | 365;
}

export const AnalysisRecords = React.memo(({ oneRepMaxes, top1RMProgress, rangeDays }: AnalysisRecordsProps) => {
    const colors = useColors();
    const styles = useMemo(() => StyleSheet.create({
        container: {
            paddingBottom: 32
        },
        sectionSpacing: {
            marginTop: 8
        },
        sectionSpacingLarge: {
            marginTop: 16
        },
        sectionHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            paddingHorizontal: 4,
        },
        sectionTitleContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10
        },
        sectionAccent: {
            width: 4,
            height: 20,
            borderRadius: 2,
            backgroundColor: colors.primary.DEFAULT,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.3,
        },
        rangeBadge: {
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: withAlpha(colors.primary.DEFAULT, '20'),
        },
        rangeBadgeText: {
            fontSize: 12,
            fontWeight: '900',
            color: colors.primary.DEFAULT,
        },
        ormCard: {
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
            marginBottom: 12,
        },
        cardContent: {
            flexDirection: 'row',
            alignItems: 'center'
        },
        rankBadge: {
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            justifyContent: 'center',
            alignItems: 'center',
        },
        rankText: {
            fontSize: 15,
            fontWeight: '900',
            color: colors.primary.DEFAULT,
        },
        cardInfo: {
            flex: 1,
            marginLeft: 14
        },
        ormName: {
            fontSize: 16,
            fontWeight: '900',
            color: colors.text,
        },
        badgesContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 6,
            marginTop: 6
        },
        ormBasis: {
            fontSize: 12,
            fontWeight: '800',
            color: colors.textMuted,
            marginTop: 6,
        },
        ormValueContainer: {
            alignItems: 'flex-end',
            minWidth: 55,
        },
        valueWithUnit: {
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 2
        },
        ormValue: {
            fontSize: 22,
            fontWeight: '900',
            color: colors.primary.DEFAULT,
            letterSpacing: -0.5,
        },
        ormUnit: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
        },
        chevron: {
            marginLeft: 8
        },
        progBadge: {
            backgroundColor: withAlpha(colors.green, '15'),
        },
        progText: {
            color: colors.green,
        },
        deltaValue: {
            fontSize: 22,
            fontWeight: '900',
            color: colors.green,
            letterSpacing: -0.5,
        },
        deltaUnit: {
            fontSize: 11,
            fontWeight: '900',
            color: colors.green,
            textTransform: 'uppercase',
        }
    }), [colors]);
    const router = useRouter();

    return (
        <View style={styles.container}>
            <PRCenter />

            {/* TOP 1RMs */}
            <View style={styles.sectionSpacing}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleContainer}>
                        <View style={styles.sectionAccent} />
                        <Trophy size={18} color={colors.text} />
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
                            style={styles.ormCard}
                            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: orm.exerciseId, exerciseId: orm.exerciseId, exerciseName: orm.exerciseName } } as any)}
                        >
                            <View style={styles.cardContent}>
                                <View style={styles.rankBadge}>
                                    <Text style={styles.rankText}>{idx + 1}</Text>
                                </View>

                                <View style={styles.cardInfo}>
                                    <Text style={styles.ormName} numberOfLines={1}>{orm.exerciseName}</Text>
                                    <View style={styles.badgesContainer}>
                                        {orm.badges?.map((b, i) => (
                                            <BadgePill key={i} name={b.name} color={b.color} icon={b.icon} size="xs" />
                                        ))}
                                    </View>
                                    <Text style={styles.ormBasis}>
                                        Máximo: {orm.weight}kg × {orm.reps}
                                    </Text>
                                </View>

                                <View style={styles.ormValueContainer}>
                                    <View style={styles.valueWithUnit}>
                                        <Text style={styles.ormValue}>{Math.round(orm.estimated1RM)}</Text>
                                        <Text style={styles.ormUnit}>kg</Text>
                                    </View>
                                </View>
                                <ChevronRight size={16} color={colors.textMuted} style={styles.chevron} />
                            </View>
                        </Pressable>
                    ))
                )}
            </View>

            {/* TOP PROGRESS */}
            <View style={styles.sectionSpacingLarge}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleContainer}>
                        <View style={[styles.sectionAccent, { backgroundColor: colors.green }]} />
                        <TrendingUp size={18} color={colors.text} />
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
                            style={styles.ormCard}
                            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: prog.exerciseId, exerciseId: prog.exerciseId, exerciseName: prog.exerciseName } } as any)}
                        >
                            <View style={styles.cardContent}>
                                <View style={[styles.rankBadge, styles.progBadge]}>
                                    <TrendingUp size={16} color={colors.green} />
                                </View>

                                <View style={styles.cardInfo}>
                                    <Text style={styles.ormName} numberOfLines={1}>{prog.exerciseName}</Text>
                                    <View style={styles.badgesContainer}>
                                        {prog.badges?.map((b, i) => (
                                            <BadgePill key={i} name={b.name} color={b.color} icon={b.icon} size="xs" />
                                        ))}
                                    </View>
                                    <Text style={styles.ormBasis}>
                                        {Math.round(prog.start1RM)}kg → {Math.round(prog.end1RM)}kg
                                    </Text>
                                </View>

                                <View style={styles.ormValueContainer}>
                                    <Text style={styles.deltaValue}>+{Math.round(prog.delta)}</Text>
                                    <Text style={styles.deltaUnit}>
                                        {prog.deltaPct ? `${prog.deltaPct}%` : 'kg'}
                                    </Text>
                                </View>
                                <ChevronRight size={16} color={colors.textMuted} style={styles.chevron} />
                            </View>
                        </Pressable>
                    ))
                )}
            </View>
        </View>
    );
});


