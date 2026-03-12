import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Constants from 'expo-constants';
import { Stack, useRouter } from 'expo-router';
import { Bell, ChevronDown, ChevronLeft, ChevronUp } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { KudosButton } from '../components/ui/KudosButton';
import { ModalScreenOverlayHost } from '../components/ui/ModalScreenOverlayHost';
import { SafeAreaWrapper } from '../components/ui/SafeAreaWrapper';
import { useColors } from '../src/hooks/useColors';
import { BroadcastFeedService, type BroadcastItem } from '../src/services/BroadcastFeedService';
import { configService } from '../src/services/ConfigService';
import { ThemeFx, withAlpha } from '../src/theme';
import { logger } from '../src/utils/logger';
import { notify } from '../src/utils/notify';

function isSameVersion(v1: string, v2: string) {
    return String(v1).trim() === String(v2).trim();
}

function renderFormattedText(text: string, textStyle: any, boldStyle: any) {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
        <Text style={textStyle}>
            {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                        <Text key={i} style={boldStyle}>
                            {part.slice(2, -2)}
                        </Text>
                    );
                }
                return part;
            })}
        </Text>
    );
}

export default function ChangelogScreen() {
    const router = useRouter();
    const colors = useColors();
    const [items, setItems] = useState<BroadcastItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
    const appVersion = Constants.expoConfig?.version ?? '0.0.0';

    const ss = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollContent: {
            padding: 16,
            paddingBottom: 40,
        },
        headerContainer: {
            marginBottom: 20,
            paddingHorizontal: 4,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16
        },
        backBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm
        },
        pageTitle: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 28,
            letterSpacing: -1.2
        },
        pageSub: {
            color: colors.primary.DEFAULT,
            fontSize: 13,
            fontWeight: '800',
            marginTop: 0,
            letterSpacing: 0.2,
            textTransform: 'uppercase'
        },
        loadingWrapper: {
            padding: 40,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16
        },
        loadingText: {
            color: colors.textMuted,
            fontWeight: '600',
            fontSize: 14
        },
        releaseCard: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginBottom: 20,
            overflow: 'hidden',
            ...ThemeFx.shadowSm
        },
        newsCard: {
            borderColor: withAlpha(colors.primary.DEFAULT, '40'),
        },
        newsHeader: {
            padding: 20,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14
        },
        newsIconWrapper: {
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            alignItems: 'center',
            justifyContent: 'center'
        },
        newsLabel: {
            color: colors.primary.DEFAULT,
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.5,
            marginBottom: 4,
            textTransform: 'uppercase'
        },
        newsTitle: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 20,
            letterSpacing: -0.5,
            lineHeight: 24
        },
        newsBody: {
            paddingHorizontal: 20,
            paddingBottom: 20
        },
        newsMessage: {
            color: colors.textMuted,
            fontSize: 15,
            lineHeight: 22,
            fontWeight: '500'
        },
        releaseHeader: {
            paddingHorizontal: 20,
            paddingVertical: 18,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surfaceLighter
        },
        releaseTop: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10
        },
        releaseVersion: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 22,
            letterSpacing: -0.8
        },
        currentBadge: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '20'),
            borderWidth: 1,
            borderColor: withAlpha(colors.primary.DEFAULT, '40')
        },
        currentBadgeText: {
            color: colors.primary.DEFAULT,
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1
        },
        releaseDate: {
            color: colors.textMuted,
            fontSize: 13,
            fontWeight: '600',
            marginTop: 2
        },
        releaseBody: {
            paddingHorizontal: 20,
            paddingVertical: 20
        },
        itemRow: {
            flexDirection: 'row',
            alignItems: 'flex-start'
        },
        itemBulletWrapper: {
            width: 18,
            alignItems: 'flex-start',
            paddingTop: 8
        },
        itemBulletDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.primary.DEFAULT
        },
        itemText: {
            color: colors.textMuted,
            flex: 1,
            fontSize: 14,
            lineHeight: 22
        },
        itemBold: {
            color: colors.text,
            fontWeight: '900'
        },
        releaseSummary: {
            color: colors.textMuted,
            fontSize: 13,
            marginTop: 6,
            fontWeight: '500',
            fontStyle: 'italic'
        },
        expandIconWrapper: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surfaceLighter,
            alignItems: 'center',
            justifyContent: 'center'
        },
        newsInfo: {
            flex: 1
        },
        releaseInfo: {
            flex: 1,
            paddingRight: 12
        },
        headerActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12
        },
        releaseBodyList: {
            gap: 10
        },
        globalEventCard: {
            borderColor: withAlpha(colors.primary.DEFAULT, '20')
        },
        globalEventIconWrapper: {
            backgroundColor: withAlpha(colors.primary.DEFAULT, '10')
        },
        itemContent: {
            flex: 1
        },
        sectionSpacing: {
            marginBottom: 12
        },

        sectionHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            marginTop: 8,
            paddingHorizontal: 4
        },
        sectionTitle: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '900',
            letterSpacing: 1.2
        },
        sectionLine: {
            flex: 1,
            height: 1.5,
            backgroundColor: colors.border,
        },
        emptyCard: {
            backgroundColor: colors.surface,
            padding: 32,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center'
        },
        emptyTitle: {
            color: colors.text,
            fontWeight: '800',
            fontSize: 17,
            marginBottom: 8
        },
        emptySub: {
            color: colors.textMuted,
            fontSize: 14,
            textAlign: 'center',
            lineHeight: 20
        },
    }), [colors]);

    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await BroadcastFeedService.getFeed({ isFeed: true, includeUnreleased: false });
            setItems(res.items);

            const latestChangelog = res.items.find((i) => i.kind === 'changelog' && i.targeting.version);
            const latestVersion = latestChangelog?.targeting.version ?? null;
            if (latestVersion) {
                setExpandedVersion(latestVersion);
                configService.set('lastViewedChangelogVersion' as any, latestVersion);
            }
        } catch (e) {
            logger.captureException(e, { scope: 'Changelog.fetchItems', message: 'Failed to fetch broadcast feed' });
            notify.error('Error', 'No se pudieron cargar las novedades.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchItems();
        }, [fetchItems])
    );

    const handleKudosUpdated = useCallback((payload: { id: string; reacted: boolean; count: number }) => {
        setItems((prev) => prev.map((it) => {
            if (it.id !== payload.id) return it;
            return {
                ...it,
                engagement: {
                    ...it.engagement,
                    reactionCount: payload.count,
                    userReacted: payload.reacted,
                }
            };
        }));
    }, []);

    const renderAnnouncement = (n: BroadcastItem) => {
        return (
            <View key={n.id} style={[ss.releaseCard, ss.newsCard]}>
                <View style={ss.newsHeader}>
                    <View style={ss.newsIconWrapper}>
                        <Bell size={18} color={colors.primary.DEFAULT} />
                    </View>
                    <View style={ss.newsInfo}>
                        <Text style={ss.newsLabel}>NOTICIA OFICIAL</Text>
                        <Text style={ss.newsTitle}>{n.title}</Text>
                        {n.createdAt && (
                            <Text style={ss.releaseDate}>
                                {format(new Date(n.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                            </Text>
                        )}
                    </View>
                    <KudosButton
                        id={n.id}
                        kind="announcement"
                        initialCount={n.engagement.reactionCount}
                        initialReacted={n.engagement.userReacted === true}
                        onUpdated={(reacted: boolean, count: number) => handleKudosUpdated({ id: n.id, reacted, count })}
                    />
                </View>
                <View style={ss.newsBody}>
                    <Text style={ss.newsMessage}>{n.body}</Text>
                </View>
            </View>
        );
    };

    const renderChangelog = (r: BroadcastItem) => {
        const version = r.targeting.version ?? '0.0.0';
        const isCurrent = isSameVersion(version, appVersion);
        const isExpanded = expandedVersion === version;
        const itemsList = String(r.body)
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        return (
            <View key={version} style={ss.releaseCard}>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => setExpandedVersion(isExpanded ? null : version)}
                    style={ss.releaseHeader}
                >
                    <View style={ss.releaseInfo}>
                        <View style={ss.releaseTop}>
                            <Text style={ss.releaseVersion}>v{version}</Text>
                            {isCurrent && (
                                <View style={ss.currentBadge}>
                                    <Text style={ss.currentBadgeText}>INSTALADA</Text>
                                </View>
                            )}
                        </View>
                        <Text style={ss.releaseDate}>
                            {r.createdAt ? format(new Date(r.createdAt), "d 'de' MMMM, yyyy", { locale: es }) : '—'}
                        </Text>

                        {!isExpanded && itemsList.length > 0 && (
                            <Text style={ss.releaseSummary} numberOfLines={1}>
                                {itemsList[0].replace(/\*\*/g, '')}
                            </Text>
                        )}
                    </View>
                    <View style={ss.headerActions}>
                        <KudosButton
                            id={r.id}
                            kind="changelog"
                            initialCount={r.engagement.reactionCount}
                            initialReacted={r.engagement.userReacted === true}
                            onUpdated={(reacted: boolean, count: number) => handleKudosUpdated({ id: r.id, reacted, count })}
                        />
                        <View style={ss.expandIconWrapper}>
                            {isExpanded ? (
                                <ChevronUp size={20} color={colors.primary.DEFAULT} />
                            ) : (
                                <ChevronDown size={20} color={colors.textMuted} />
                            )}
                        </View>
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={ss.releaseBody}>
                        <View style={ss.releaseBodyList}>
                            {itemsList.map((it, idx) => (
                                <View key={`${version}-${idx}`} style={ss.itemRow}>
                                    <View style={ss.itemBulletWrapper}>
                                        <View style={ss.itemBulletDot} />
                                    </View>
                                    <View style={ss.itemContent}>
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

    const announcements = items.filter((i) => i.kind === 'announcement');
    const changelogs = items.filter((i) => i.kind === 'changelog');
    const globalEvents = items.filter((i) => i.kind === 'global_event');

    const renderGlobalEvent = (e: BroadcastItem) => {
        return (
            <View key={e.id} style={[ss.releaseCard, ss.globalEventCard]}>
                <View style={ss.newsHeader}>
                    <View style={[ss.newsIconWrapper, ss.globalEventIconWrapper]}>
                        <Bell size={18} color={colors.primary.DEFAULT} />
                    </View>
                    <View style={ss.newsInfo}>
                        <Text style={ss.newsLabel}>EVENTO GLOBAL</Text>
                        <Text style={ss.newsTitle}>{e.title}</Text>
                        {e.createdAt && (
                            <Text style={ss.releaseDate}>
                                {format(new Date(e.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                            </Text>
                        )}
                    </View>
                </View>
                <View style={ss.newsBody}>
                    <Text style={ss.newsMessage}>{e.body}</Text>
                </View>
            </View>
        );
    };

    return (
        <ModalScreenOverlayHost>
            <SafeAreaWrapper style={ss.container} edges={['top', 'left', 'right', 'bottom']}>
                <Stack.Screen options={{ headerShown: false }} />
                <ScrollView style={ss.newsInfo} contentContainerStyle={ss.scrollContent}>
                    <View style={ss.headerContainer}>
                        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
                            <ChevronLeft size={22} color={colors.text} strokeWidth={2.5} />
                        </TouchableOpacity>
                        <View>
                            <Text style={ss.pageTitle}>Novedades</Text>
                            <Text style={ss.pageSub}>Noticias y versiones de IronTrain</Text>
                        </View>
                    </View>

                    {isLoading ? (
                        <View style={ss.loadingWrapper}>
                            <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                            <Text style={ss.loadingText}>Sincronizando novedades...</Text>
                        </View>
                    ) : (
                        <View>
                            {announcements.length > 0 && (
                                <View style={ss.sectionSpacing}>
                                    <View style={ss.sectionHeader}>
                                        <Text style={ss.sectionTitle}>ANUNCIOS</Text>
                                        <View style={ss.sectionLine} />
                                    </View>
                                    {announcements.map(n => renderAnnouncement(n))}
                                </View>
                            )}

                            {changelogs.length > 0 && (
                                <View>
                                    <View style={ss.sectionHeader}>
                                        <Text style={ss.sectionTitle}>HISTORIAL DE VERSIONES</Text>
                                        <View style={ss.sectionLine} />
                                    </View>
                                    {changelogs.map(r => renderChangelog(r))}
                                </View>
                            )}

                            {globalEvents.length > 0 && (
                                <View>
                                    <View style={ss.sectionHeader}>
                                        <Text style={ss.sectionTitle}>EVENTOS GLOBALES</Text>
                                        <View style={ss.sectionLine} />
                                    </View>
                                    {globalEvents.map(e => renderGlobalEvent(e))}
                                </View>
                            )}

                            {announcements.length === 0 && changelogs.length === 0 && globalEvents.length === 0 && (
                                <View style={ss.emptyCard}>
                                    <Text style={ss.emptyTitle}>Sin novedades recientes</Text>
                                    <Text style={ss.emptySub}>No hemos encontrado anuncios ni versiones nuevas todavía.</Text>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaWrapper>
        </ModalScreenOverlayHost>
    );
}

