import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { AppNotification, AppNotificationService } from '@/src/services/AppNotificationService';
import { ChangelogRelease, ChangelogService } from '@/src/services/ChangelogService';
import { configService } from '@/src/services/ConfigService';
import { Colors } from '@/src/theme';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Bell, ChevronLeft, Info } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function isSameVersion(a: string, b: string) {
    return String(a).trim() === String(b).trim();
}

const renderFormattedText = (text: string, style: any, boldStyle: any) => {
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

const KudosButton = ({ id, type, initialCount }: { id: string; type: 'version' | 'news'; initialCount?: number }) => {
    const [count, setCount] = useState<number | null>(initialCount ?? null);
    const [isReacting, setIsReacting] = useState(false);

    useEffect(() => {
        if (count === null) {
            if (type === 'version') {
                ChangelogService.getReactionCount(id).then(setCount);
            } else {
                AppNotificationService.getReactionCount(id).then(setCount);
            }
        }
    }, [id, type]);

    const handlePress = async () => {
        if (isReacting) return;
        setIsReacting(true);
        const result = type === 'version'
            ? await ChangelogService.toggleReaction(id)
            : await AppNotificationService.toggleReaction(id);

        if (result !== 'error') {
            const newCount = type === 'version'
                ? await ChangelogService.getReactionCount(id)
                : await AppNotificationService.getReactionCount(id);
            setCount(newCount);
        }
        setIsReacting(false);
    };

    if (count === null) return null;

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={isReacting}
            style={[ss.kudosBtn, isReacting && { opacity: 0.7 }]}
        >
            <View style={ss.kudosContent}>
                <Text style={ss.kudosCount}>{count}</Text>
                <Text style={ss.kudosText}>🔥 Kudos</Text>
            </View>
        </TouchableOpacity>
    );
};

export default function UpdatesScreen() {
    const router = useRouter();
    const appVersion = ChangelogService.getAppVersion();
    const [releases, setReleases] = useState<ChangelogRelease[]>([]);
    const [news, setNews] = useState<AppNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            await Promise.all([
                ChangelogService.sync(),
                AppNotificationService.getActiveNotifications().then(setNews)
            ]);
            const rels = await ChangelogService.getReleases();
            setReleases(rels);

            const latest = rels[0];
            if (latest?.version) {
                configService.set('lastViewedChangelogVersion', latest.version);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [loadData])
    );

    const combinedItems = useMemo(() => {
        const items: Array<{ type: 'version' | 'news'; data: any; sortDate: number }> = [];

        releases.forEach(r => {
            let dateVal = 0;
            if (r.date) {
                try { dateVal = new Date(r.date).getTime(); } catch { }
            }
            items.push({ type: 'version', data: r, sortDate: dateVal });
        });

        news.forEach(n => {
            let dateVal = 0;
            if (n.createdAt) {
                try { dateVal = new Date(n.createdAt).getTime(); } catch { }
            }
            items.push({ type: 'news', data: n, sortDate: dateVal });
        });

        return items.sort((a, b) => b.sortDate - a.sortDate);
    }, [releases, news]);

    const renderNews = (n: AppNotification) => {
        return (
            <View key={n.id} style={[ss.releaseCard, ss.newsCard]}>
                <View style={ss.newsHeader}>
                    <View style={ss.newsIconWrapper}>
                        <Bell size={18} color={Colors.primary.DEFAULT} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={ss.newsLabel}>ANUNCIO OFICIAL</Text>
                        <Text style={ss.newsTitle}>{n.title}</Text>
                        {n.createdAt && (
                            <Text style={ss.releaseDate}>
                                {format(new Date(n.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={ss.newsBody}>
                    <Text style={ss.newsMessage}>{n.message}</Text>
                    <View style={ss.releaseFooter}>
                        <KudosButton id={n.id} type="news" initialCount={n.reactionCount} />
                    </View>
                </View>
            </View>
        );
    };

    const renderRelease = (r: ChangelogRelease) => {
        const isCurrent = isSameVersion(r.version, appVersion);
        return (
            <View key={r.version} style={ss.releaseCard}>
                <View style={ss.releaseHeader}>
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
                    <Info size={16} color={Colors.iron[400]} />
                </View>

                <View style={ss.releaseBody}>
                    <View style={{ gap: 10 }}>
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

                    <View style={ss.releaseFooter}>
                        <KudosButton id={r.version} type="version" initialCount={r.reactionCount} />
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaWrapper style={{ flex: 1, backgroundColor: Colors.iron[900] }} edges={['top', 'left', 'right', 'bottom']}>
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                <View style={{ marginBottom: 28, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
                        <ChevronLeft size={20} color={Colors.iron[950]} />
                    </TouchableOpacity>
                    <View>
                        <Text style={ss.pageTitle}>Novedades</Text>
                        <Text style={ss.pageSub}>Noticias y versiones de IronTrain</Text>
                    </View>
                </View>

                {isLoading ? (
                    <View style={ss.loadingWrapper}>
                        <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
                        <Text style={ss.loadingText}>Sincronizando novedades...</Text>
                    </View>
                ) : combinedItems.length > 0 ? (
                    <View>
                        {combinedItems.map(item =>
                            item.type === 'news' ? renderNews(item.data) : renderRelease(item.data)
                        )}
                    </View>
                ) : (
                    <View style={ss.emptyCard}>
                        <Text style={ss.emptyTitle}>Sin novedades recientes</Text>
                        <Text style={ss.emptySub}>No hemos encontrado anuncios ni versiones nuevas todavía.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaWrapper>
    );
}

const ss = StyleSheet.create({
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.iron[300], elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    pageTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 28, letterSpacing: -1.2 },
    pageSub: { color: Colors.primary.DEFAULT, fontSize: 13, fontWeight: '700', marginTop: 0, letterSpacing: 0.2 },
    loadingWrapper: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 16 },
    loadingText: { color: Colors.iron[500], fontWeight: '600', fontSize: 14 },
    releaseCard: { backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.iron[300], marginBottom: 20, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 16 },
    newsCard: { borderColor: Colors.primary.DEFAULT + '30', backgroundColor: '#fff' },
    newsHeader: { padding: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    newsIconWrapper: { width: 40, height: 40, borderRadius: 14, backgroundColor: Colors.primary.DEFAULT + '15', alignItems: 'center', justifyContent: 'center' },
    newsLabel: { color: Colors.primary.DEFAULT, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
    newsTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 20, letterSpacing: -0.5, lineHeight: 24 },
    newsBody: { paddingHorizontal: 20, paddingBottom: 20 },
    newsMessage: { color: Colors.iron[600], fontSize: 15, lineHeight: 22, fontWeight: '500' },
    releaseHeader: { paddingHorizontal: 20, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.iron[50] },
    releaseTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    releaseVersion: { color: Colors.iron[950], fontWeight: '900', fontSize: 22, letterSpacing: -0.8 },
    currentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: Colors.primary.DEFAULT + '20', borderWidth: 1, borderColor: Colors.primary.DEFAULT + '40' },
    currentBadgeText: { color: Colors.primary.dark, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    releaseDate: { color: Colors.iron[500], fontSize: 13, fontWeight: '600', marginTop: 2 },
    releaseBody: { paddingHorizontal: 20, paddingVertical: 20 },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start' },
    itemBulletWrapper: { width: 18, alignItems: 'flex-start', paddingTop: 8 },
    itemBulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary.DEFAULT },
    itemText: { color: Colors.iron[600], flex: 1, fontSize: 14, lineHeight: 22 },
    itemBold: { color: Colors.iron[900], fontWeight: '800' },
    releaseFooter: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: Colors.iron[100], alignItems: 'flex-end' },
    kudosBtn: { backgroundColor: Colors.iron[50], paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: Colors.iron[200] },
    kudosContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    kudosCount: { color: Colors.iron[950], fontWeight: '900', fontSize: 16 },
    kudosText: { color: Colors.iron[600], fontWeight: '700', fontSize: 13 },
    emptyCard: { backgroundColor: Colors.surface, padding: 32, borderRadius: 24, borderWidth: 1, borderColor: Colors.iron[300], alignItems: 'center' },
    emptyTitle: { color: Colors.iron[950], fontWeight: '800', fontSize: 17, marginBottom: 8 },
    emptySub: { color: Colors.iron[500], fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
