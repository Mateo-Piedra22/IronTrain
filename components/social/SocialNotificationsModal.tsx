import { SocialColors, SocialStyles } from '@/components/social/types';
import { SocialFriend, SocialInboxItem } from '@/src/services/SocialService';
import { feedbackSelection } from '@/src/social/feedback';
import { withAlpha } from '@/src/theme';
import { Bell, CheckCircle, Inbox, UserPlus2, XCircle } from 'lucide-react-native';
import React, { memo, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type SocialNotificationsModalProps = {
    visible: boolean;
    onClose: () => void;
    incomingFriendRequests: SocialFriend[];
    shares: SocialInboxItem[];
    activityAlerts?: SocialInboxItem[];
    onAcceptFriend: (requestId: string) => Promise<void> | void;
    onRejectFriend: (requestId: string) => Promise<void> | void;
    onAcceptShare: (inboxId: string, payload?: unknown) => Promise<void> | void;
    onRejectShare: (inboxId: string) => Promise<void> | void;
    onOpenActivity?: (activityId: string) => Promise<void> | void;
    onMarkAllSeen?: () => Promise<void> | void;
    colors: SocialColors;
    styles: SocialStyles;
};

const dateLabel = (value: unknown): string => {
    if (!value) return 'recién';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return 'recién';
    return date.toLocaleDateString('es-AR');
};

export const SocialNotificationsModal = memo(({
    visible,
    onClose,
    incomingFriendRequests,
    shares,
    activityAlerts = [],
    onAcceptFriend,
    onRejectFriend,
    onAcceptShare,
    onRejectShare,
    onOpenActivity,
    onMarkAllSeen,
    colors,
    styles,
}: SocialNotificationsModalProps) => {
    const [pendingOnly, setPendingOnly] = useState(true);

    const visibleShares = useMemo(() => {
        if (!pendingOnly) return shares;
        return shares.filter((item) => !item.seenAt || item.status === 'pending');
    }, [shares, pendingOnly]);

    const visibleAlerts = useMemo(() => {
        if (!pendingOnly) return activityAlerts;
        return activityAlerts.filter((item) => !item.seenAt);
    }, [activityAlerts, pendingOnly]);

    const activityLabel = (item: SocialInboxItem): string => {
        if (item.actionType === 'pr_broken') return 'rompió un PR';
        if (item.actionType === 'routine_shared') return 'compartió una rutina';
        if (item.actionType === 'workout_completed') return 'completó un entrenamiento';
        return 'tuvo nueva actividad';
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center', backgroundColor: withAlpha(colors.background, '38'), paddingHorizontal: 16 }]}> 
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={onClose}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <View style={[styles.detailModalCard, { width: '94%', maxWidth: 450, maxHeight: '88%', padding: 18, borderRadius: 20, backgroundColor: colors.surface }]}> 
                    <View style={[styles.detailIconCircle, { width: 72, height: 72, borderRadius: 36, marginBottom: 12, borderColor: colors.primary.DEFAULT, backgroundColor: withAlpha(colors.primary.DEFAULT, '15') }]}>
                        <Bell size={30} color={colors.primary.DEFAULT} />
                    </View>

                    <View style={{ width: '100%', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                        <View style={{ marginBottom: 2 }}>
                            <TouchableOpacity
                                style={[styles.modalCloseBtn, { position: 'absolute', right: 0, top: 0, zIndex: 2 }]}
                                onPress={() => { feedbackSelection(); onClose(); }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Text style={{ color: colors.textMuted, fontWeight: '900' }}>Cerrar</Text>
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center', paddingHorizontal: 56 }}>
                                <Text style={styles.detailTitle}>Notificaciones</Text>
                                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2, textAlign: 'center' }}>
                                    {incomingFriendRequests.length + shares.length + activityAlerts.length} pendientes
                                </Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                            <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>SOLICITUDES</Text>
                                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 2 }}>{incomingFriendRequests.length}</Text>
                            </View>
                            <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>RUTINAS</Text>
                                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 2 }}>{shares.length}</Text>
                            </View>
                            <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surfaceLighter, paddingVertical: 8, paddingHorizontal: 10 }}>
                                <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>ALERTAS</Text>
                                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 2 }}>{visibleAlerts.length}</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                            <TouchableOpacity
                                style={[styles.archiveToggle, { flex: 1, justifyContent: 'center' }, pendingOnly && styles.archiveToggleActive]}
                                onPress={() => {
                                    feedbackSelection();
                                    setPendingOnly(true);
                                }}
                            >
                                <Text style={[styles.archiveToggleText, { textAlign: 'center' }, pendingOnly && styles.archiveToggleTextActive]}>Solo pendientes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.archiveToggle, { flex: 1, justifyContent: 'center' }, !pendingOnly && styles.archiveToggleActive]}
                                onPress={() => {
                                    feedbackSelection();
                                    setPendingOnly(false);
                                }}
                            >
                                <Text style={[styles.archiveToggleText, { textAlign: 'center' }, !pendingOnly && styles.archiveToggleTextActive]}>Todas</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        style={{ width: '100%' }}
                        contentContainerStyle={{ gap: 14, paddingTop: 12, paddingBottom: 8 }}
                    >
                        {incomingFriendRequests.length > 0 && (
                            <View>
                                <Text style={[styles.inboxStatusTitle, { marginBottom: 10 }]}>Solicitudes de amistad</Text>
                                <View style={{ gap: 10 }}>
                                    {incomingFriendRequests.map((request) => (
                                        <View key={request.id} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLighter }}>
                                                        <UserPlus2 size={16} color={colors.primary.DEFAULT} />
                                                    </View>
                                                    <View>
                                                        <Text style={{ color: colors.text, fontWeight: '800' }}>{request.displayName}</Text>
                                                        <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 12 }}>@{request.username || 'usuario'}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                                <TouchableOpacity style={[styles.modalPrimaryBtn, { flex: 1 }]} onPress={() => { feedbackSelection(); onAcceptFriend(request.id); }}>
                                                    <Text style={styles.modalPrimaryText}>Aceptar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={[styles.modalSecondaryBtn, { flex: 1 }]} onPress={() => { feedbackSelection(); onRejectFriend(request.id); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                                    <Text style={styles.modalSecondaryText}>Rechazar</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <Text style={styles.inboxStatusTitle}>Rutinas compartidas</Text>
                                {!!onMarkAllSeen && visibleShares.length > 0 && (
                                    <TouchableOpacity style={styles.archiveToggle} onPress={() => { feedbackSelection(); onMarkAllSeen(); }} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                        <Text style={styles.archiveToggleText}>Archivar todo</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {visibleShares.length === 0 ? (
                                <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 18, backgroundColor: colors.surface }}>
                                    <Text style={{ color: colors.textMuted, textAlign: 'center', fontWeight: '700' }}>No tenés notificaciones pendientes.</Text>
                                </View>
                            ) : (
                                <View style={{ gap: 10 }}>
                                    {visibleShares.map((share) => (
                                        <View key={share.id} style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLighter }}>
                                                        <Inbox size={16} color={colors.primary.DEFAULT} />
                                                    </View>
                                                    <View>
                                                        <Text style={{ color: colors.text, fontWeight: '800' }}>{share.senderName}</Text>
                                                        <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 12 }}>{dateLabel(share.createdAt)}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            {!share.seenAt && (
                                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                                    <TouchableOpacity style={[styles.modalPrimaryBtn, { flex: 1 }]} onPress={() => { feedbackSelection(); onAcceptShare(share.id, share.payload); }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                            <CheckCircle size={14} color={colors.onPrimary} />
                                                            <Text style={styles.modalPrimaryText}>Importar</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={[styles.modalSecondaryBtn, { flex: 1 }]} onPress={() => { feedbackSelection(); onRejectShare(share.id); }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                            <XCircle size={14} color={colors.textMuted} />
                                                            <Text style={styles.modalSecondaryText}>Ignorar</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View>
                            <Text style={[styles.inboxStatusTitle, { marginBottom: 10 }]}>Actividad social</Text>
                            {visibleAlerts.length === 0 ? (
                                <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 14, backgroundColor: colors.surface }}>
                                    <Text style={{ color: colors.textMuted, textAlign: 'center', fontWeight: '700' }}>Sin alertas nuevas. Todo está al día.</Text>
                                </View>
                            ) : (
                                <View style={{ gap: 10 }}>
                                    {visibleAlerts.map((activity) => (
                                        <TouchableOpacity
                                            key={activity.id}
                                            activeOpacity={0.85}
                                            style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 12 }}
                                            onPress={() => {
                                                feedbackSelection();
                                                onOpenActivity?.(activity.id);
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                                    <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLighter }}>
                                                        <Inbox size={16} color={colors.primary.DEFAULT} />
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: colors.text, fontWeight: '800' }} numberOfLines={1}>{activity.senderName}</Text>
                                                        <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 12 }} numberOfLines={1}>{activityLabel(activity)}</Text>
                                                    </View>
                                                </View>
                                                <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 12 }}>{dateLabel(activity.createdAt)}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
});

export default SocialNotificationsModal;
