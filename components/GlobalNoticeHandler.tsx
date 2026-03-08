import { Config } from '@/src/constants/Config';
import { AppNotificationService } from '@/src/services/AppNotificationService';
import type { BroadcastItem } from '@/src/services/BroadcastFeedService';
import { BroadcastFeedService } from '@/src/services/BroadcastFeedService';
import { decideGlobalInterruption } from '@/src/services/BroadcastInterruptionPolicy';
import { ChangelogService, type ChangelogRelease } from '@/src/services/ChangelogService';
import { configService } from '@/src/services/ConfigService';
import { useAuthStore } from '@/src/store/authStore';
import { Colors, ThemeFx, withAlpha } from '@/src/theme';
import { useRouter } from 'expo-router';
import { Bell, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { PushRegistrationService } from '../src/services/PushRegistrationService';
import { WhatsNewModal } from './WhatsNewModal';

export const GlobalNoticeHandler: React.FC = () => {
    const [whatsNew, setWhatsNew] = useState<ChangelogRelease | null>(null);
    const [activeAnnouncement, setActiveAnnouncement] = useState<BroadcastItem | null>(null);
    const [showToast, setShowToast] = useState(false);
    const router = useRouter();

    useEffect(() => {
        let cancelled = false;

        const fetchAll = async () => {
            try {
                const feed = await BroadcastFeedService.getFeed({ isFeed: false, includeUnreleased: false });
                if (cancelled) return;

                const decision = await decideGlobalInterruption({
                    items: feed.items,
                    currentVersion: ChangelogService.getAppVersion(),
                    seen: {
                        isSeen: async (id: string) => {
                            if (id.startsWith('whats_new:')) {
                                const key = id.slice('whats_new:'.length);
                                const lastSeen = await configService.get('last_seen_changelog_version' as any);
                                return String(lastSeen ?? '').trim() === String(key).trim();
                            }
                            return AppNotificationService.isSeen(id);
                        }
                    },
                });

                if (cancelled) return;

                if (decision.kind === 'whats_new') {
                    setWhatsNew({
                        version: decision.release.version,
                        date: null,
                        items: decision.release.items,
                    });
                    setActiveAnnouncement(null);
                    setShowToast(false);
                    return;
                }

                if (decision.kind === 'announcement') {
                    const n = decision.announcement;
                    setActiveAnnouncement(n);
                    if (n.uiType === 'toast') {
                        setShowToast(true);
                        setTimeout(() => setShowToast(false), 6000);
                    } else {
                        setShowToast(false);
                    }
                    return;
                }

                setWhatsNew(null);
                setActiveAnnouncement(null);
                setShowToast(false);
            } catch (e) {
                console.error('[GlobalNoticeHandler] Error fetching feed', e);
            }
        };

        fetchAll();

        // Real-time listener: refresh when a push arrives in foreground
        const cleanup = PushRegistrationService.initListeners(
            () => {
                fetchAll();
            },
            (response) => {
                const data = response.notification.request.content.data;
                const actionUrl = data?.actionUrl;
                if (typeof actionUrl === 'string') {
                    handleUrlAction(actionUrl);
                    return;
                }
                if (typeof data?.type === 'string' && data.type.startsWith('social_')) {
                    handleUrlAction('irontrain://social');
                }
            }
        );

        return () => {
            cancelled = true;
            cleanup();
        };
    }, []);

    const handleUrlAction = async (actionUrl: string) => {
        try {
            // Cierro el modal/toast antes para evitar bloqueos visuales
            setActiveAnnouncement(null);
            setShowToast(false);

            // Pequeño timeout antes de navegar
            setTimeout(async () => {
                if (actionUrl === 'changelog' || actionUrl === 'social' || actionUrl.startsWith('/') || actionUrl.startsWith('irontrain://')) {
                    const rawPath = actionUrl.replace('irontrain://', '');
                    const path =
                        rawPath === 'social' ? '/(tabs)/social'
                            : rawPath === 'changelog' ? '/changelog'
                                : rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
                    // @ts-ignore
                    router.push(path as any);
                } else {
                    const supported = await Linking.canOpenURL(actionUrl);
                    if (supported) {
                        await Linking.openURL(actionUrl);
                    }
                }
            }, 100);
        } catch {
            return;
        }
    };

    const handleCloseWhatsNew = async () => {
        await ChangelogService.markWhatsNewAsSeen();
        setWhatsNew(null);
    };

    const handleCloseNotification = async () => {
        if (activeAnnouncement) {
            await AppNotificationService.markAsSeen(activeAnnouncement.id);
            setActiveAnnouncement(null);
            setShowToast(false);
        }
    };

    const handleNotifPress = async () => {
        if (!activeAnnouncement) return;

        // Log the click
        const { token } = useAuthStore.getState();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        void fetch(`${Config.API_URL}/api/notifications/log`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ id: activeAnnouncement.id, action: 'clicked' })
        }).catch(() => undefined);

        const actionUrl = activeAnnouncement.actionUrl;
        if (typeof actionUrl === 'string' && actionUrl.trim().length > 0) {
            handleUrlAction(actionUrl);
        }

        // Close it unless it's displayMode 'always'
        if (activeAnnouncement.displayMode !== 'always') {
            await handleCloseNotification();
        }
    };

    const renderRichText = (text: string) => {
        return text.split(/(\*\*.*?\*\*|\n)/g).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <Text key={i} style={ss.richBold}>{part.slice(2, -2)}</Text>;
            }
            if (part === '\n') {
                return '\n';
            }
            return part;
        });
    };

    return (
        <>
            {/* 1. What's New Modal */}
            {whatsNew && (
                <WhatsNewModal
                    isVisible={!!whatsNew}
                    release={whatsNew}
                    onClose={handleCloseWhatsNew}
                />
            )}

            {activeAnnouncement && activeAnnouncement.uiType === 'modal' && (
                <Modal visible={true} transparent animationType="fade">
                    <View style={ss.modalOverlay}>
                        <Pressable style={ss.modalBackdropPressable} onPress={handleCloseNotification} />
                        <View style={ss.modalContainer}>
                            <View style={ss.modalHeader}>
                                <TouchableOpacity
                                    onPress={handleCloseNotification}
                                    style={{ position: 'absolute', right: 0, top: 0, padding: 8, zIndex: 10 }}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cerrar notificación"
                                >
                                    <X size={20} color={Colors.iron[500]} />
                                </TouchableOpacity>
                                <View style={ss.iconCircle}>
                                    <Bell size={20} color={Colors.primary.DEFAULT} />
                                </View>
                                <Text style={ss.modalTitle}>{activeAnnouncement.title}</Text>
                            </View>
                            <View style={ss.modalBody}>
                                <ScrollView
                                    style={ss.modalMessageScroll}
                                    contentContainerStyle={ss.modalMessageContent}
                                    showsVerticalScrollIndicator={true}
                                >
                                    <Text style={ss.modalMessage}>
                                        {renderRichText(activeAnnouncement.body)}
                                    </Text>
                                </ScrollView>
                                {activeAnnouncement.actionUrl && (
                                    <TouchableOpacity style={ss.modalActionBtn} onPress={handleNotifPress} accessibilityRole="button" accessibilityLabel="Ver detalle de notificación">
                                        <Text style={ss.modalActionText}>Ver más</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity style={ss.modalButton} onPress={handleCloseNotification} accessibilityRole="button" accessibilityLabel="Cerrar modal de notificación">
                                <Text style={ss.modalButtonText}>CERRAR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {/* 3. Custom BroadCast Toast */}
            {activeAnnouncement && activeAnnouncement.uiType === 'toast' && showToast && (
                <Animated.View
                    entering={SlideInUp}
                    exiting={SlideOutUp}
                    style={ss.toastContainer}
                >
                    <View style={ss.toastIcon}>
                        <Bell size={16} color={Colors.white} />
                    </View>
                    <TouchableOpacity
                        style={ss.toastContent}
                        onPress={handleNotifPress}
                        accessibilityRole="button"
                        accessibilityLabel="Abrir notificación rápida"
                    >
                        <Text style={ss.toastTitle}>{activeAnnouncement.title}</Text>
                        <Text style={ss.toastMessage} numberOfLines={2}>{activeAnnouncement.body}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleCloseNotification}
                        style={ss.toastClose}
                        accessibilityRole="button"
                        accessibilityLabel="Cerrar notificación rápida"
                    >
                        <X size={16} color={Colors.iron[400]} />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </>
    );
};

const ss = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalBackdropPressable: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: ThemeFx.backdrop,
    },
    modalContainer: {
        width: '100%',
        maxWidth: 420,
        minHeight: 260,
        maxHeight: '86%',
        backgroundColor: Colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        padding: 24,
        elevation: 8,
        shadowColor: ThemeFx.shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: ThemeFx.shadowOpacityStrong,
        shadowRadius: 24,
        overflow: 'hidden',
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 20,
        gap: 12,
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: withAlpha(Colors.primary.DEFAULT, '14'),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: Colors.iron[950],
        letterSpacing: -0.3,
        textAlign: 'center',
        flexShrink: 1,
    },
    modalBody: {
        flexShrink: 1,
        minHeight: 120,
        maxHeight: 360,
        marginBottom: 16,
        backgroundColor: withAlpha(Colors.iron[50], 'CC'),
        borderRadius: 12,
        padding: 4,
    },
    modalMessageScroll: {
        maxHeight: 310,
    },
    modalMessageContent: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    modalActionText: {
        color: Colors.primary.DEFAULT,
        fontWeight: '900',
        fontSize: 12,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    modalMessage: {
        fontSize: 14,
        color: Colors.iron[950],
        lineHeight: 22,
        fontWeight: '500',
        textAlign: 'left',
    },
    richBold: {
        fontWeight: '900',
        color: Colors.black, // Forzamos negro para máximo contraste en las novedades
    },
    modalActionBtn: {
        alignSelf: 'flex-start',
        marginLeft: 16,
        marginBottom: 12,
    },
    modalButton: {
        backgroundColor: Colors.primary.DEFAULT,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    modalButtonText: {
        color: Colors.white,
        fontWeight: '700',
        fontSize: 16,
    },
    toastContainer: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        zIndex: 9999,
        elevation: 10,
        shadowColor: ThemeFx.shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: ThemeFx.shadowOpacityStrong,
        shadowRadius: 8,
    },
    toastIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: Colors.primary.DEFAULT,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    toastContent: {
        flex: 1,
    },
    toastTitle: {
        color: Colors.iron[950],
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    toastMessage: {
        color: Colors.iron[950],
        fontSize: 12,
        marginTop: 2,
        fontWeight: '500',
    },
    toastClose: {
        padding: 8,
    }
});
