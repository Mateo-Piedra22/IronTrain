import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { ChangelogRelease, ChangelogService } from '@/src/services/ChangelogService';
import { configService } from '@/src/services/ConfigService';
import { Colors } from '@/src/theme';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function isSameVersion(a: string, b: string) {
    return String(a).trim() === String(b).trim();
}

const renderFormattedText = (text: string, style: any, boldStyle: any) => {
    // Matches **bold text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
        <Text style={style}>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <Text key={i} style={boldStyle}>{part.slice(2, -2)}</Text>;
                }
                return part;
            })}
        </Text>
    );
};

export default function ChangelogModalScreen() {
    const router = useRouter();
    const appVersion = ChangelogService.getAppVersion();
    const [releases, setReleases] = useState<ChangelogRelease[]>(() => ChangelogService.getReleases());
    const [unreleased, setUnreleased] = useState<ChangelogRelease[]>(() => {
        const all = ChangelogService.getReleases({ includeUnreleased: true });
        return all.filter((r) => r.unreleased === true || r.date === null || String(r.date ?? '').trim().toLowerCase() === 'unreleased');
    });

    useFocusEffect(
        useCallback(() => {
            ChangelogService.reload();
            setReleases(ChangelogService.getReleases());
            const all = ChangelogService.getReleases({ includeUnreleased: true });
            setUnreleased(all.filter((r) => r.unreleased === true || r.date === null || String(r.date ?? '').trim().toLowerCase() === 'unreleased'));
            const latest = ChangelogService.getLatestRelease();
            if (latest?.version) { configService.set('lastViewedChangelogVersion', latest.version); }
        }, [])
    );

    const initialExpanded = useMemo(() => {
        const match = releases.find((r) => isSameVersion(r.version, appVersion));
        return match?.version ?? releases[0]?.version ?? null;
    }, [releases, appVersion]);

    const [expandedVersion, setExpandedVersion] = useState<string | null>(initialExpanded);
    const [showUnreleased, setShowUnreleased] = useState(false);

    useEffect(() => {
        setExpandedVersion((prev) => {
            if (!prev) return initialExpanded;
            const stillExists = releases.some((r) => r.version === prev) || unreleased.some((r) => r.version === prev);
            return stillExists ? prev : initialExpanded;
        });
    }, [initialExpanded, releases, unreleased]);

    const toggle = (v: string) => { setExpandedVersion((prev) => prev === v ? null : v); };

    const renderRelease = (r: ChangelogRelease) => {
        const expanded = expandedVersion === r.version;
        const isCurrent = isSameVersion(r.version, appVersion);
        return (
            <View key={r.version} style={ss.releaseCard}>
                <Pressable onPress={() => toggle(r.version)} style={ss.releaseHeader} accessibilityRole="button" accessibilityLabel={`Ver cambios ${r.version}`}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                        <View style={ss.releaseTop}>
                            <Text style={ss.releaseVersion}>v{r.version}</Text>
                            {isCurrent && (
                                <View style={ss.currentBadge}>
                                    <Text style={ss.currentBadgeText}>INSTALADA</Text>
                                </View>
                            )}
                        </View>
                        <Text style={ss.releaseDate}>{r.date ?? '—'}</Text>
                    </View>
                    {expanded ? <ChevronUp size={16} color={Colors.iron[400]} /> : <ChevronDown size={16} color={Colors.iron[400]} />}
                </Pressable>

                {expanded && (
                    <View style={ss.releaseBody}>
                        <View style={{ gap: 12 }}>
                            {r.items.map((it, idx) => (
                                <View key={`${r.version}-${idx}`} style={ss.itemRow}>
                                    <View style={ss.itemBulletWrapper}>
                                        <View style={ss.itemBulletDot} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        {renderFormattedText(it, ss.itemText, ss.itemBold)}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaWrapper style={{ flex: 1, backgroundColor: Colors.iron[900] }} edges={['top', 'left', 'right', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                <View style={{ marginBottom: 24, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
                        <ChevronLeft size={20} color={Colors.iron[950]} />
                    </TouchableOpacity>
                    <View>
                        <Text style={ss.pageTitle}>Novedades</Text>
                        <Text style={ss.pageSub}>Versión actual: v{appVersion}</Text>
                    </View>
                </View>

                {releases.length > 0 ? (
                    <View>
                        {releases.map(renderRelease)}

                        {unreleased.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                <Pressable onPress={() => setShowUnreleased((v) => !v)} style={ss.unreleasedBtn} accessibilityRole="button" accessibilityLabel="Mostrar u ocultar cambios no publicados">
                                    <Text style={ss.unreleasedText}>Próximamente</Text>
                                    {showUnreleased ? <ChevronUp size={16} color={Colors.iron[400]} /> : <ChevronDown size={16} color={Colors.iron[400]} />}
                                </Pressable>
                                {showUnreleased && (
                                    <View style={{ marginTop: 10 }}>
                                        {unreleased.map(renderRelease)}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={ss.emptyCard}>
                        <Text style={ss.emptyTitle}>No hay changelog disponible</Text>
                        <Text style={ss.emptySub}>Verifica que `src/changelog.generated.json` exista y esté actualizado.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaWrapper>
    );
}

const ss = StyleSheet.create({
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.iron[300], elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    pageTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 24, letterSpacing: -1 },
    pageSub: { color: Colors.primary.DEFAULT, fontSize: 12, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
    releaseCard: { backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.iron[300], marginBottom: 16, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12 },
    releaseHeader: { paddingHorizontal: 20, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface },
    releaseTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    releaseVersion: { color: Colors.iron[950], fontWeight: '900', fontSize: 20, letterSpacing: -0.5 },
    currentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.primary.DEFAULT + '20', borderWidth: 1, borderColor: Colors.primary.DEFAULT + '40' },
    currentBadgeText: { color: Colors.primary.dark, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    releaseDate: { color: Colors.iron[500], fontSize: 12, fontWeight: '600', marginTop: 2 },
    releaseBody: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4 },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
    itemBulletWrapper: { width: 20, alignItems: 'flex-start', paddingTop: 8 },
    itemBulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary.DEFAULT },
    itemText: { color: Colors.iron[600], flex: 1, fontSize: 14, lineHeight: 22 },
    itemBold: { color: Colors.primary.DEFAULT, fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
    unreleasedBtn: { paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.iron[300], borderStyle: 'dashed' },
    unreleasedText: { color: Colors.iron[950], fontWeight: '900', fontSize: 15 },
    emptyCard: { backgroundColor: Colors.surface, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: Colors.iron[300] },
    emptyTitle: { color: Colors.iron[950], fontWeight: '800', fontSize: 15 },
    emptySub: { color: Colors.iron[500], fontSize: 13, marginTop: 6, lineHeight: 20 },
});
