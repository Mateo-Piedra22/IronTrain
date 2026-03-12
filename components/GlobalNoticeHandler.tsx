import { Config } from '@/src/constants/Config';
import { AppNotificationService } from '@/src/services/AppNotificationService';
import type { BroadcastItem } from '@/src/services/BroadcastFeedService';
import { BroadcastFeedService } from '@/src/services/BroadcastFeedService';
import { decideGlobalInterruption } from '@/src/services/BroadcastInterruptionPolicy';
import { ChangelogService, type ChangelogRelease } from '@/src/services/ChangelogService';
import { configService } from '@/src/services/ConfigService';
import { useAuthStore } from '@/src/store/authStore';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { logger } from '@/src/utils/logger';
import { useRouter } from 'expo-router';
import { Bell, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import { useColors } from '../src/hooks/useColors';
import { PushRegistrationService } from '../src/services/PushRegistrationService';
import { WhatsNewModal } from './WhatsNewModal';

export const GlobalNoticeHandler: React.FC = () => {
    const colors = useColors();
    const { serverStatus } = useSettingsStore();
    const [whatsNew, setWhatsNew] = useState<ChangelogRelease | null>(null);
    const [activeAnnouncement, setActiveAnnouncement] = useState<BroadcastItem | null>(null);
    const [showToast, setShowToast] = useState(false);
    const hideToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const router = useRouter();

    const ss = useMemo(() => StyleSheet.create({
        modalOverlay: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            backgroundColor: withAlpha(colors.black, '80'), // Solid backdrop
        },
        modalBackdropPressable: {
            ...StyleSheet.absoluteFillObject,
        },
        modalContainer: {
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: 28,
            borderWidth: 1.5,
            borderColor: colors.border,
            padding: 24,
            ...ThemeFx.shadowLg,
            overflow: 'hidden',
        },
        modalHeader: {
            alignItems: 'center',
            marginBottom: 24,
            gap: 12,
        },
        iconCircle: {
            width: 56,
            height: 56,
            borderRadius: 18,
            backgroundColor: colors.surfaceLighter,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, '50'),
        },
        modalTitle: {
            fontSize: 22,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.5,
            textAlign: 'center',
        },
        modalBody: {
            flexShrink: 1,
            marginBottom: 20,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 20,
            padding: 4,
            borderWidth: 1,
            borderColor: colors.border,
        },
        modalMessageScroll: {
            maxHeight: 310,
        },
        modalMessageContent: {
            paddingVertical: 16,
            paddingHorizontal: 20,
        },
        modalActionText: {
            color: colors.primary.DEFAULT,
            fontWeight: '900',
            fontSize: 13,
            letterSpacing: 1,
            textTransform: 'uppercase',
        },
        modalMessage: {
            fontSize: 15,
            color: colors.text,
            lineHeight: 24,
            fontWeight: '500',
        },
        richBold: {
            fontWeight: '900',
            color: colors.primary.DEFAULT,
        },
        modalActionBtn: {
            marginTop: 12,
            alignSelf: 'center',
            paddingVertical: 8,
            paddingHorizontal: 16,
        },
        modalButton: {
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            ...ThemeFx.shadowSm,
        },
        modalButtonText: {
            color: colors.onPrimary,
            fontWeight: '900',
            fontSize: 15,
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        toastContainer: {
            position: 'absolute',
            top: 60,
            left: 16,
            right: 16,
            backgroundColor: colors.surface,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            zIndex: 9999,
            ...ThemeFx.shadowLg,
        },
        toastIcon: {
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '15'),
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 14,
            borderWidth: 1,
            borderColor: withAlpha(colors.primary.DEFAULT, '25'),
        },
        toastContent: {
            flex: 1,
        },
        toastTitle: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.3,
        },
        toastMessage: {
            color: colors.textMuted,
            fontSize: 13,
            marginTop: 2,
            fontWeight: '600',
        },
        toastClose: {
            padding: 8,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 10,
            marginLeft: 8,
        },
        // Banner specific styles
        serverBanner: {
            top: 60,
            zIndex: 10000,
        },
        serverBannerIcon: {
            borderColor: 'transparent',
        }
    }), [colors]);

    const bannerConfig = useMemo(() => {
        if (!serverStatus || serverStatus.mode === 'normal') return null;
        const isMaintenance = serverStatus.mode === 'maintenance';
        const fg = isMaintenance ? colors.white : colors.onPrimary;

        return {
            bg: isMaintenance ? colors.red : colors.primary.DEFAULT,
            fg,
            borderColor: withAlpha(fg, '20'),
            iconBg: withAlpha(fg, '15'),
            textOpacity: withAlpha(fg, '80'),
            title: isMaintenance ? 'MODO MANTENIMIENTO' : 'MODO 100% OFFLINE',
            message: serverStatus.message || (isMaintenance
                ? 'El sistema se encuentra en mantenimiento.'
                : 'El servidor se encuentra en modo offline temporalmente.')
        };
    }, [serverStatus, colors]);

    useEffect(() => {
        let cancelled = false;

        const clearHideToastTimeout = () => {
            if (hideToastTimeoutRef.current) {
                clearTimeout(hideToastTimeoutRef.current);
                hideToastTimeoutRef.current = null;
            }
        };

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
                        clearHideToastTimeout();
                        setShowToast(true);
                        hideToastTimeoutRef.current = setTimeout(() => {
                            setShowToast(false);
                        }, 6000);
                    } else {
                        clearHideToastTimeout();
                        setShowToast(false);
                    }
                    return;
                }

                setWhatsNew(null);
                setActiveAnnouncement(null);
                clearHideToastTimeout();
                setShowToast(false);
            } catch (e) {
                logger.captureException(e, { scope: 'GlobalNoticeHandler.fetchAll', message: 'Failed to fetch broadcast feed' });
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
            clearHideToastTimeout();
        };
    }, []);

    const handleUrlAction = async (actionUrl: string) => {
        try {
            setActiveAnnouncement(null);
            setShowToast(false);

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
                                    <X size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                                <View style={ss.iconCircle}>
                                    <Bell size={20} color={colors.primary.DEFAULT} />
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
                        <Bell size={16} color={colors.primary.DEFAULT} />
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
                        <X size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* 4. Global Server Status Banner */}
            {bannerConfig && (
                <Animated.View
                    entering={SlideInUp}
                    exiting={SlideOutUp}
                    style={[
                        ss.toastContainer,
                        ss.serverBanner,
                        {
                            backgroundColor: bannerConfig.bg,
                            borderColor: bannerConfig.borderColor,
                        }
                    ]}
                >
                    <View style={[
                        ss.toastIcon,
                        ss.serverBannerIcon,
                        { backgroundColor: bannerConfig.iconBg }
                    ]}>
                        <Bell size={16} color={bannerConfig.fg} />
                    </View>
                    <View style={ss.toastContent}>
                        <Text style={[ss.toastTitle, { color: bannerConfig.fg }]}>
                            {bannerConfig.title}
                        </Text>
                        <Text
                            style={[ss.toastMessage, { color: bannerConfig.textOpacity }]}
                            numberOfLines={2}
                        >
                            {bannerConfig.message}
                        </Text>
                    </View>
                </Animated.View>
            )}
        </>
    );
};
