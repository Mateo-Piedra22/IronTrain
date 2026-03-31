import { SocialFriend, SocialInboxItem } from '@/src/services/SocialService';
import { CheckCircle, Inbox, UserPlus2, XCircle } from 'lucide-react-native';
import React, { memo } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

type SocialNotificationsModalProps = {
    visible: boolean;
    onClose: () => void;
    incomingFriendRequests: SocialFriend[];
    shares: SocialInboxItem[];
    onAcceptFriend: (requestId: string) => Promise<void> | void;
    onRejectFriend: (requestId: string) => Promise<void> | void;
    onAcceptShare: (inboxId: string, payload?: unknown) => Promise<void> | void;
    onRejectShare: (inboxId: string) => Promise<void> | void;
    onMarkAllSeen?: () => Promise<void> | void;
    colors: any;
    styles: any;
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
    onAcceptFriend,
    onRejectFriend,
    onAcceptShare,
    onRejectShare,
    onMarkAllSeen,
    colors,
    styles,
}: SocialNotificationsModalProps) => {
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, { maxHeight: '86%' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Notificaciones</Text>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
                            <Text style={{ color: colors.textMuted, fontWeight: '900' }}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 16 }}>
                        {incomingFriendRequests.length > 0 && (
                            <View>
                                <Text style={[styles.inboxStatusTitle, { marginBottom: 10 }]}>Solicitudes de amistad</Text>
                                <View style={{ gap: 10 }}>
                                    {incomingFriendRequests.map((request) => (
                                        <View key={request.id} style={{ borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 12 }}>
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
                                                <TouchableOpacity style={[styles.modalPrimaryBtn, { flex: 1 }]} onPress={() => onAcceptFriend(request.id)}>
                                                    <Text style={styles.modalPrimaryText}>Aceptar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={[styles.modalSecondaryBtn, { flex: 1 }]} onPress={() => onRejectFriend(request.id)}>
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
                                {!!onMarkAllSeen && shares.length > 0 && (
                                    <TouchableOpacity style={styles.archiveToggle} onPress={onMarkAllSeen}>
                                        <Text style={styles.archiveToggleText}>Archivar todo</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {shares.length === 0 ? (
                                <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 18, backgroundColor: colors.surface }}>
                                    <Text style={{ color: colors.textMuted, textAlign: 'center', fontWeight: '700' }}>No tenés notificaciones pendientes.</Text>
                                </View>
                            ) : (
                                <View style={{ gap: 10 }}>
                                    {shares.map((share) => (
                                        <View key={share.id} style={{ borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 12 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
                                                    <TouchableOpacity style={[styles.modalPrimaryBtn, { flex: 1 }]} onPress={() => onAcceptShare(share.id, share.payload)}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                                            <CheckCircle size={14} color={colors.onPrimary} />
                                                            <Text style={styles.modalPrimaryText}>Importar</Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={[styles.modalSecondaryBtn, { flex: 1 }]} onPress={() => onRejectShare(share.id)}>
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
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
});

export default SocialNotificationsModal;
