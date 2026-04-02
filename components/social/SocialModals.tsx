import { SocialColors, SocialStyles } from '@/components/social/types';
import { GlobalEvent, SocialComparisonEntry, SocialFriend, SocialLeaderboardEntry, SocialProfile, WeatherLog } from '@/src/services/SocialService';
import { feedbackSelection } from '@/src/social/feedback';
import { withAlpha } from '@/src/theme';
import * as Clipboard from 'expo-clipboard';
import { Award, CheckCircle, CloudRain, Copy, Droplets, Flame, Info as InfoIcon, MapPin, RefreshCcw, Scale, Thermometer, TrendingUp, Trophy, UserMinus as UserMinusIcon, Wind, XCircle, X as XIcon, Zap } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native';

interface ProfileEditModalProps {
    visible: boolean;
    onClose: () => void;
    displayName: string;
    setDisplayName: (value: string) => void;
    username: string;
    setUsername: (value: string) => void;
    isPublic: boolean;
    setIsPublic: (value: boolean) => void;
    onSave: () => Promise<void> | void;
    saving: boolean;
    profile: SocialProfile | null;
    colors: SocialColors;
    styles: SocialStyles;
}

type FriendModalAction = 'accept' | 'reject' | 'remove' | 'block';

interface FriendDetailModalProps {
    visible: boolean;
    onClose: () => void;
    friend: SocialFriend | null;
    friendLeaderboardEntry?: SocialLeaderboardEntry | null;
    friendComparisonPreview?: SocialComparisonEntry[];
    onAction?: (action: FriendModalAction) => Promise<void> | void;
    onOpenComparison?: (friendUserId: string) => Promise<void> | void;
    loading: boolean;
    colors: SocialColors;
    styles: SocialStyles;
}

interface ScoreInfoModalProps {
    visible: boolean;
    onClose: () => void;
    profile: SocialProfile | null;
    colors: SocialColors;
    styles: SocialStyles;
}

interface GlobalEventModalProps {
    visible: boolean;
    onClose: () => void;
    event: GlobalEvent | null | undefined;
    colors: SocialColors;
    styles: SocialStyles;
}

interface WeatherBonusModalProps {
    visible: boolean;
    onClose: () => void;
    profile: SocialProfile | null;
    refreshingLocation: boolean;
    onRefreshLocation?: (silent?: boolean) => Promise<void> | void;
    weatherHistory?: WeatherLog[];
    onLoadHistory?: () => Promise<void> | void;
    colors: SocialColors;
    styles: SocialStyles;
}

export const ProfileEditModal = React.memo(({
    visible,
    onClose,
    displayName,
    setDisplayName,
    username,
    setUsername,
    isPublic,
    setIsPublic,
    onSave,
    saving,
    profile,
    colors,
    styles
}: ProfileEditModalProps) => {
    const normalizedUsername = (username || profile?.username || '')
        .replace(/^@+/, '')
        .trim()
        .toLowerCase();
    const publicProfileUrl = normalizedUsername
        ? `https://irontrain.motiona.xyz/user/${encodeURIComponent(normalizedUsername)}`
        : 'https://irontrain.motiona.xyz/profile';
    const accountSecurityUrl = 'https://irontrain.motiona.xyz/auth/forgot-password';

    const confirmOpenExternal = (url: string, label: string) => {
        Alert.alert(
            'Abrir enlace externo',
            `Vas a salir de la app para abrir ${label}.`,
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Abrir',
                    onPress: () => {
                        Linking.openURL(url);
                    },
                },
            ],
            { cancelable: true },
        );
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
                    <Pressable style={styles.modalCard} onPress={() => { }}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Perfil Social</Text>
                            <TouchableOpacity onPress={() => { feedbackSelection(); onClose(); }} style={styles.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <XIcon size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Nombre visible</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={displayName}
                                onChangeText={setDisplayName}
                                maxLength={64}
                                placeholder="Tu nombre visible"
                                placeholderTextColor={colors.textMuted}
                            />
                            <Text style={styles.modalFieldHint}>
                                Entre 2 y 64 caracteres. Evitá datos sensibles.
                            </Text>

                            <Text style={styles.modalLabel}>Username (@)</Text>
                            <TextInput
                                style={[
                                    styles.modalInput,
                                    profile?.lastUsernameChangeAt &&
                                    (Date.now() - new Date(profile.lastUsernameChangeAt).getTime() < 30 * 24 * 60 * 60 * 1000) &&
                                    { opacity: 0.5, borderColor: colors.red }
                                ]}
                                value={username}
                                onChangeText={(val) => setUsername(val.replace(/\s+/g, '').toLowerCase())}
                                maxLength={32}
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder="tu_username"
                                placeholderTextColor={colors.textMuted}
                                editable={!profile?.lastUsernameChangeAt || (Date.now() - new Date(profile.lastUsernameChangeAt).getTime() >= 30 * 24 * 60 * 60 * 1000)}
                            />

                            {profile?.lastUsernameChangeAt && (Date.now() - new Date(profile.lastUsernameChangeAt).getTime() < 30 * 24 * 60 * 60 * 1000) ? (
                                <View style={{
                                    backgroundColor: withAlpha(colors.red, '10'),
                                    borderColor: withAlpha(colors.red, '30'),
                                    borderWidth: 1,
                                    borderRadius: 12,
                                    marginTop: 4,
                                    padding: 12
                                }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <XCircle size={14} color={colors.red} />
                                        <Text style={{ color: colors.red, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>Restricción Temporal</Text>
                                    </View>
                                    <Text style={[styles.modalFieldHint, { marginBottom: 0 }]}>
                                        Cambio bloqueado. Podrás modificarlo nuevamente el {new Date(new Date(profile.lastUsernameChangeAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}.
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.modalFieldHint}>
                                    Permitido: a-z, 0-9 y _ (1 vez cada 30 días). Dejá vacío para quitar.
                                </Text>
                            )}

                            <View style={{ height: 16 }} />

                            <View style={styles.privacyRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.modalLabel}>Visibilidad pública</Text>
                                    <Text style={styles.privacyHint}>
                                        {isPublic
                                            ? "Tu perfil y rutinas son visibles para otros atletas."
                                            : "Solo vos podés ver tu progreso y rutinas."}
                                    </Text>
                                </View>
                                <Switch
                                    value={isPublic}
                                    onValueChange={setIsPublic}
                                    trackColor={{ false: colors.border, true: withAlpha(colors.primary.DEFAULT, '40') }}
                                    thumbColor={isPublic ? colors.primary.DEFAULT : colors.textMuted}
                                />
                            </View>

                            <View style={styles.profileQuickActionsCard}>
                                <Text style={styles.profileQuickActionsTitle}>Perfil web y seguridad</Text>

                                <TouchableOpacity
                                    style={styles.profileQuickActionBtn}
                                    onPress={() => {
                                        feedbackSelection();
                                        confirmOpenExternal(publicProfileUrl, 'tu perfil público');
                                    }}
                                >
                                    <Text style={styles.profileQuickActionBtnText}>Ver perfil público</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.profileQuickActionBtn}
                                    onPress={() => {
                                        feedbackSelection();
                                        confirmOpenExternal(accountSecurityUrl, 'la página de seguridad de cuenta');
                                    }}
                                >
                                    <Text style={styles.profileQuickActionBtnText}>Seguridad: email y contraseña</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { feedbackSelection(); onClose(); }} activeOpacity={0.85}>
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => { feedbackSelection(); onSave(); }} disabled={saving} activeOpacity={0.85}>
                                {saving ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={styles.modalPrimaryText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </KeyboardAvoidingView>
            </Pressable>
        </Modal>
    );
});

export const FriendDetailModal = React.memo(({
    visible,
    onClose,
    friend,
    friendLeaderboardEntry,
    friendComparisonPreview,
    onAction,
    onOpenComparison,
    loading,
    colors,
    styles
}: FriendDetailModalProps) => {
    const [copiedId, setCopiedId] = useState(false);
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const cardTranslateY = useRef(new Animated.Value(10)).current;
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(cardOpacity, {
                toValue: visible ? 1 : 0,
                duration: visible ? 180 : 120,
                useNativeDriver: true,
            }),
            Animated.timing(cardTranslateY, {
                toValue: visible ? 0 : 10,
                duration: visible ? 180 : 120,
                useNativeDriver: true,
            }),
        ]).start();
    }, [cardOpacity, cardTranslateY, visible]);

    useEffect(() => {
        if (!copiedId) return;
        const timeout = setTimeout(() => setCopiedId(false), 1500);
        return () => clearTimeout(timeout);
    }, [copiedId]);

    if (!friend) return null;

    const relationLabel =
        friend.status === 'pending'
            ? friend.isSender
                ? 'Solicitud enviada'
                : 'Solicitud recibida'
            : friend.status === 'blocked'
                ? 'Contacto bloqueado'
                : 'Amistad aceptada';

    const statusColor =
        friend.status === 'accepted'
            ? colors.green
            : friend.status === 'blocked'
                ? colors.red
                : colors.yellow;

    const commonExercises = friendComparisonPreview?.length ?? 0;
    const comparisonDelta = (friendComparisonPreview ?? []).reduce((acc, entry) => acc + (entry.user1RMKg - entry.friend1RMKg), 0);
    const hasComparisonData = commonExercises > 0;
    const modalMaxWidth = Math.min(430, windowWidth - 24);
    const modalMaxHeight = Math.max(360, Math.round(windowHeight * 0.92));
    const actionAreaEstimate = friend.status === 'pending' && friend.isSender ? 138 : 118;
    const bodyMaxHeight = Math.max(220, modalMaxHeight - 66 - actionAreaEstimate);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={{ width: '100%', alignItems: 'center' }}>
                    <Animated.View style={[styles.modalCard, { width: '100%', maxWidth: modalMaxWidth, maxHeight: modalMaxHeight, opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{friend.displayName || 'Amigo'}</Text>
                        <TouchableOpacity onPress={() => { feedbackSelection(); onClose(); }} style={styles.modalCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <XIcon size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={{ width: '100%', maxHeight: bodyMaxHeight, flexGrow: 0 }}
                        contentContainerStyle={[styles.modalBody, { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 20 }]}
                        showsVerticalScrollIndicator={true}
                        bounces={true}
                        nestedScrollEnabled={true}
                        keyboardShouldPersistTaps="handled"
                    >
                        <View style={styles.friendModalHero}>
                            <View style={styles.friendModalAvatar}>
                                <Text style={styles.friendModalAvatarText}>
                                    {(friend.displayName || 'A').charAt(0).toUpperCase()}
                                </Text>
                            </View>

                            {friend.username ? (
                                <Text style={styles.friendModalUsername}>@{friend.username}</Text>
                            ) : null}

                            <Text style={styles.friendModalDisplayName}>{friend.displayName || 'Amigo'}</Text>

                            <View style={styles.friendModalBadgeRow}>
                                <View style={[styles.friendModalBadge, { borderColor: withAlpha(statusColor, '35'), backgroundColor: withAlpha(statusColor, '12') }]}>
                                    <CheckCircle size={13} color={statusColor} />
                                    <Text style={[styles.friendModalBadgeText, { color: statusColor }]}>{relationLabel}</Text>
                                </View>
                                {friendLeaderboardEntry ? (
                                    <View style={styles.friendModalBadge}>
                                        <Trophy size={13} color={colors.yellow} />
                                        <Text style={styles.friendModalBadgeText}>IronScore {friendLeaderboardEntry.scores.lifetime}</Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        {friendLeaderboardEntry ? (
                            <View style={styles.friendModalMetricsGrid}>
                                <View style={styles.friendModalMetricCard}>
                                    <Text style={styles.friendModalMetricLabel}>Racha actual</Text>
                                    <Text style={styles.friendModalMetricValue}>{friendLeaderboardEntry.stats.currentStreak}</Text>
                                </View>
                                <View style={styles.friendModalMetricCard}>
                                    <Text style={styles.friendModalMetricLabel}>Mejor racha</Text>
                                    <Text style={styles.friendModalMetricValue}>{friendLeaderboardEntry.stats.highestStreak}</Text>
                                </View>
                                <View style={styles.friendModalMetricCard}>
                                    <Text style={styles.friendModalMetricLabel}>Entrenos (mes)</Text>
                                    <Text style={styles.friendModalMetricValue}>{friendLeaderboardEntry.stats.workoutsMonthly}</Text>
                                </View>
                                <View style={styles.friendModalMetricCard}>
                                    <Text style={styles.friendModalMetricLabel}>Interacción</Text>
                                    <Text style={styles.friendModalMetricValue}>{friendLeaderboardEntry.stats.engagementScore ?? 0}</Text>
                                </View>
                            </View>
                        ) : null}

                        <View style={styles.friendInfoCard}>
                            <Text style={styles.friendInfoLabel}>ID Social</Text>
                            <TouchableOpacity
                                style={styles.friendInfoCopyBtn}
                                onPress={async () => {
                                    feedbackSelection();
                                    await Clipboard.setStringAsync(friend.friendId ?? friend.id);
                                    setCopiedId(true);
                                }}
                            >
                                <Text style={styles.friendInfoId} numberOfLines={1} ellipsizeMode="middle">{friend.friendId ?? friend.id}</Text>
                                <Copy size={14} color={colors.textMuted} />
                            </TouchableOpacity>

                            {copiedId ? (
                                <Text style={[styles.friendInfoMetaText, { color: colors.green }]}>ID copiado al portapapeles</Text>
                            ) : null}

                            <View style={styles.friendInfoMetaRow}>
                                <Text style={styles.friendInfoMetaText}>Ejercicios comunes 1RM: {commonExercises}</Text>
                                {hasComparisonData ? (
                                    <Text style={[styles.friendInfoMetaText, { color: comparisonDelta >= 0 ? colors.green : colors.red }]}> 
                                        {comparisonDelta >= 0 ? 'Ventaja total:' : 'Desventaja total:'} {Math.abs(comparisonDelta).toFixed(1)} kg
                                    </Text>
                                ) : (
                                    <Text style={styles.friendInfoMetaText}>Aún no hay base para comparar fuerza.</Text>
                                )}
                            </View>

                            {friend.status === 'accepted' && onOpenComparison ? (
                                <TouchableOpacity style={styles.friendInfoActionBtn} onPress={() => {
                                    feedbackSelection();
                                    onOpenComparison(friend.friendId ?? friend.id);
                                }}>
                                    <Scale size={14} color={colors.onPrimary} />
                                    <Text style={styles.friendInfoActionText}>{hasComparisonData ? 'Abrir comparación en ranking' : 'Comparar 1RM en ranking'}</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        <View style={styles.friendModalHintBox}>
                            <InfoIcon size={14} color={colors.textMuted} />
                            <Text style={styles.friendModalHintText}>
                                Consejo: desde Ranking podés expandir la comparación por ejercicio para detectar fortalezas y debilidades reales.
                            </Text>
                        </View>
                    </ScrollView>

                    <View style={[styles.modalActionsStackCompact, friend.status === 'pending' && friend.isSender && { paddingBottom: 30 }]}> 
                        {friend.status === 'pending' && !friend.isSender && (
                            <View style={styles.dualActionRowCompact}>
                                <TouchableOpacity style={[styles.modalPrimaryBtn, styles.modalActionBtnCompact]} disabled={loading} onPress={() => { feedbackSelection(); onAction?.('accept'); }}>
                                    <Text style={styles.modalPrimaryText}>Aceptar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalDangerBtn, styles.modalActionBtnCompact]} disabled={loading} onPress={() => { feedbackSelection(); onAction?.('reject'); }}>
                                    <Text style={styles.modalDangerText}>Rechazar</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {friend.status === 'pending' && friend.isSender && (
                            <TouchableOpacity
                                style={[styles.modalSecondaryBtn, styles.modalActionBtnCompact, { minHeight: 48, paddingTop: 12, paddingBottom: 12 }]}
                                disabled={loading}
                                onPress={() => { feedbackSelection(); onAction?.('reject'); }}
                            >
                                <XCircle size={14} color={colors.textMuted} />
                                <Text style={styles.modalSecondaryText}>Cancelar solicitud</Text>
                            </TouchableOpacity>
                        )}

                        {friend.status === 'accepted' && (
                            <View style={styles.dualActionRowCompact}>
                                <TouchableOpacity style={[styles.modalSecondaryBtn, styles.modalActionBtnCompact, { minHeight: 48, paddingTop: 12, paddingBottom: 12 }]} disabled={loading} onPress={() => { feedbackSelection(); onAction?.('remove'); }}>
                                    <UserMinusIcon size={14} color={colors.textMuted} />
                                    <Text style={styles.modalSecondaryText}>Eliminar amigo</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalDangerBtn, styles.modalActionBtnCompact]} disabled={loading} onPress={() => { feedbackSelection(); onAction?.('block'); }}>
                                    <Text style={styles.modalDangerText}>Bloquear</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {loading ? <ActivityIndicator size="small" color={colors.primary.DEFAULT} style={{ marginTop: 4 }} /> : null}
                    </View>
                    </Animated.View>
                </View>
            </View>
        </Modal>
    );
});

export const ScoreInfoModal = React.memo(({
    visible,
    onClose,
    profile,
    colors,
    styles
}: ScoreInfoModalProps) => {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[styles.modalCard, { height: '80%', maxHeight: '85%' }]}>
                    <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TrendingUp size={22} color={colors.primary.DEFAULT} />
                            <Text style={styles.modalTitle}>Sistema IronScore</Text>
                        </View>
                        <TouchableOpacity onPress={() => { feedbackSelection(); onClose(); }} style={styles.modalCloseBtn}>
                            <XIcon size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                        showsVerticalScrollIndicator={true}
                    >
                        <Text style={styles.infoSectionTitle}>Nueva Economía de Puntos</Text>
                        <Text style={styles.infoSectionDesc}>
                            Los puntos premian el esfuerzo real y NO se reinician nunca ni se pierden.
                        </Text>

                        <View style={styles.infoPointRow}>
                            <CheckCircle size={18} color={colors.green} />
                            <Text style={styles.infoPointText}>Completar Entrenamiento</Text>
                            <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.workoutCompletePoints || 20} pts</Text>
                        </View>

                        <View style={styles.infoPointRow}>
                            <TrendingUp size={18} color={colors.primary.DEFAULT} />
                            <Text style={styles.infoPointText}>Día Extra (Máx {profile?.scoreConfig?.extraDayWeeklyCap || 3}/sem)</Text>
                            <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.extraDayPoints || 10} pts</Text>
                        </View>

                        <View style={styles.infoPointRow}>
                            <Trophy size={18} color={colors.yellow} />
                            <Text style={styles.infoPointText}>Romper PR (Normal)</Text>
                            <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.prNormalPoints || 10} pts</Text>
                        </View>

                        <View style={styles.infoPointRow}>
                            <Award size={18} color={colors.yellow} />
                            <Text style={styles.infoPointText}>Romper PR (Big 3)</Text>
                            <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.prBig3Points || 25} pts</Text>
                        </View>

                        {profile?.scoreConfig?.weatherBonusEnabled !== 0 && (
                            <View style={styles.infoPointRow}>
                                <CloudRain size={18} color={colors.blue} />
                                <Text style={styles.infoPointText}>Voluntad de Hierro ({'<'}{profile?.scoreConfig?.coldThresholdC || 5}°C o {'>'}{profile?.scoreConfig?.heatThresholdC || 33}°C)</Text>
                                <Text style={styles.infoPointValue}>+{profile?.scoreConfig?.adverseWeatherPoints || 15} pts</Text>
                            </View>
                        )}

                        <View style={styles.infoDivider} />

                        <Text style={styles.infoSectionTitle}>Sistema de Rachas (Semanas)</Text>
                        <Text style={styles.infoSectionDesc}>
                            El multiplicador aumenta si cumplís tu meta de días configurada semanalmente.
                        </Text>

                        <View style={styles.infoStreakRow}>
                            <Text style={styles.infoStreakLabel}>Semanas 1-{(profile?.scoreConfig?.weekTier2Min || 3) - 1}</Text>
                            <Text style={styles.infoStreakValue}>x1.00</Text>
                        </View>
                        <View style={styles.infoStreakRow}>
                            <Text style={styles.infoStreakLabel}>Semanas {profile?.scoreConfig?.weekTier2Min || 3}-{(profile?.scoreConfig?.weekTier3Min || 5) - 1}</Text>
                            <Text style={styles.infoStreakValue}>x{(profile?.scoreConfig?.tier2Multiplier || 1.1).toFixed(2)}</Text>
                        </View>
                        <View style={styles.infoStreakRow}>
                            <Text style={styles.infoStreakLabel}>Semanas {profile?.scoreConfig?.weekTier3Min || 5}-{(profile?.scoreConfig?.weekTier4Min || 10) - 1}</Text>
                            <Text style={styles.infoStreakValue}>x{(profile?.scoreConfig?.tier3Multiplier || 1.25).toFixed(2)}</Text>
                        </View>
                        <View style={[styles.infoStreakRow, styles.infoStreakBestia]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Flame size={14} color={colors.onPrimary} />
                                <Text style={[styles.infoStreakLabel, { color: colors.onPrimary }]}>Semanas {profile?.scoreConfig?.weekTier4Min || 10}+ (Bestia)</Text>
                            </View>
                            <Text style={[styles.infoStreakValue, { color: colors.onPrimary }]}>x{(profile?.scoreConfig?.tier4Multiplier || 1.5).toFixed(2)}</Text>
                        </View>

                        <View style={{ height: 10 }} />
                        <View style={[styles.infoDivider, { marginTop: 6 }]} />

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                            <View style={styles.infoIconBox}>
                                <Zap size={20} color={colors.yellow} fill={colors.yellow} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.infoSectionTitle}>Eventos Globales</Text>
                                <Text style={styles.infoSectionDesc}>
                                    Multiplicadores de experiencia activados por el administrador durante fechas especiales.
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.infoDivider, { marginTop: 2 }]} />

                        <View style={{ height: 6 }} />

                        <View style={styles.formulaBox}>
                            <Text style={styles.formulaTitle}>Fórmula de Puntos</Text>
                            <Text style={styles.formulaText}>Puntos = (Base + Bonos) × Multiplicador Racha × Evento Global</Text>
                        </View>

                        <View style={{ height: 10 }} />

                        <View style={styles.infoFooterBox}>
                            <InfoIcon size={14} color={colors.textMuted} />
                            <Text style={styles.infoFooterText}>
                                El puntaje se calcula en tiempo real al finalizar cada entrenamiento. Los PRs se validan contra tu historial completo.
                            </Text>
                        </View>

                        <View style={{ height: 20 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
});

export const GlobalEventModal = React.memo(({
    visible,
    onClose,
    event,
    colors,
    styles
}: GlobalEventModalProps) => {
    if (!event) return null;
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.detailModalCard}>
                    <View style={[styles.detailIconCircle, { borderColor: colors.yellow, backgroundColor: withAlpha(colors.yellow, '15') }]}>
                        <Zap size={32} color={colors.yellow} fill={colors.yellow} />
                    </View>
                    <View style={styles.activeEventBadge}>
                        <Zap size={10} color={colors.onPrimary} fill={colors.onPrimary} />
                        <Text style={styles.activeEventBadgeText}>Evento Global Activo</Text>
                    </View>
                    <Text style={styles.detailTitle}>{event?.title || 'Evento Especial'}</Text>
                    <Text style={styles.detailDesc}>¡Un multiplicador global está activo! Todas tus ganancias de IronScore se verán potenciadas automáticamente.</Text>

                    <View style={styles.detailInfoGrid}>
                        <View style={styles.detailInfoRow}>
                            <Text style={styles.detailInfoLabel}>Multiplicador</Text>
                            <Text style={[styles.detailInfoValue, { color: colors.yellow, fontSize: 18 }]}>x{event?.multiplier?.toFixed?.(1) || String(event?.multiplier || '1.0')}</Text>
                        </View>
                        <View style={styles.detailInfoRow}>
                            <Text style={styles.detailInfoLabel}>Estado</Text>
                            <Text style={[styles.detailInfoValue, { color: colors.green }]}>Activo Ahora</Text>
                        </View>
                        {event?.endDate ? (
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Finaliza el</Text>
                                <Text style={styles.detailInfoValue}>{new Date(event.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</Text>
                            </View>
                        ) : null}
                    </View>

                    <TouchableOpacity style={styles.detailCloseBtn} onPress={() => { feedbackSelection(); onClose(); }}>
                        <Text style={styles.detailCloseText}>Entendido</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
});

export const WeatherBonusModal = React.memo(({
    visible,
    onClose,
    profile,
    refreshingLocation,
    onRefreshLocation,
    weatherHistory = [],
    onLoadHistory,
    colors,
    styles
}: WeatherBonusModalProps) => {
    React.useEffect(() => {
        if (visible && onLoadHistory) {
            onLoadHistory();
        }
    }, [visible, onLoadHistory]);
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.modalOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={styles.detailModalCard}>
                    <View style={[
                        styles.detailIconCircle,
                        {
                            borderColor: profile?.weatherBonus?.isActive ? colors.primary.DEFAULT : colors.border,
                            backgroundColor: withAlpha(profile?.weatherBonus?.isActive ? colors.primary.DEFAULT : colors.border, '15'),
                        }
                    ]}>
                        {profile?.weatherBonus?.isActive ? (
                            <CloudRain size={32} color={colors.primary.DEFAULT} />
                        ) : (
                            <MapPin size={32} color={colors.textMuted} />
                        )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Text style={styles.detailTitle}>{profile?.weatherBonus?.isActive ? 'Voluntad de Hierro' : 'Ubicación y Clima'}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.refreshBadgeBtn}
                        onPress={() => {
                            feedbackSelection();
                            onRefreshLocation?.(false);
                        }}
                        disabled={refreshingLocation}
                    >
                        {refreshingLocation ? (
                            <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                        ) : (
                            <>
                                <RefreshCcw size={14} color={colors.primary.DEFAULT} />
                                <Text style={styles.refreshBadgeText}>Recomprobar Ubicación</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.detailDesc}>
                        {profile?.weatherBonus?.isActive
                            ? '¡Has vencido a los elementos! Entrenar con clima adverso te otorga puntos extra por tu disciplina inquebrantable.'
                            : 'El sistema detecta tu ubicación para validar bonus por clima adverso. Podrás obtener puntos extra si entrenas bajo lluvia, nieve, frío o calor extremo.'}
                    </Text>

                    <View style={styles.detailInfoGrid}>
                        <View style={styles.detailInfoRow}>
                            <Text style={styles.detailInfoLabel}>Ubicación</Text>
                            <Text style={styles.detailInfoValue}>{profile?.weatherBonus?.location || 'Detectando...'}</Text>
                        </View>
                        <View style={styles.detailInfoRow}>
                            <Text style={styles.detailInfoLabel}>Clima</Text>
                            <Text style={styles.detailInfoValue}>{profile?.weatherBonus?.condition || 'Despejado'}</Text>
                        </View>
                        <View style={styles.detailInfoRow}>
                            <Text style={styles.detailInfoLabel}>Bonus</Text>
                            <Text style={[styles.detailInfoValue, { color: profile?.weatherBonus?.isActive ? colors.primary.DEFAULT : colors.textMuted }]}>
                                {profile?.weatherBonus?.isActive ? '+15 pts' : 'Inactivo'}
                            </Text>
                        </View>
                    </View>

                    {weatherHistory && weatherHistory.length > 0 && (
                        <View style={{ marginTop: 20, width: '100%' }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 12, opacity: 0.8 }}>
                                DETECCIONES RECIENTES
                            </Text>
                            <ScrollView
                                style={{ maxHeight: 140 }}
                                showsVerticalScrollIndicator={false}
                                nestedScrollEnabled={true}
                            >
                                {weatherHistory.map((log: WeatherLog) => (
                                    <View key={log.id} style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: withAlpha(colors.border, '15'),
                                        borderRadius: 12,
                                        padding: 10,
                                        marginBottom: 8,
                                        gap: 12
                                    }}>
                                        <View style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 16,
                                            backgroundColor: withAlpha(log.isAdverse ? colors.primary.DEFAULT : colors.textMuted, '15'),
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {log.isAdverse ? (
                                                <CloudRain size={16} color={colors.primary.DEFAULT} />
                                            ) : (
                                                <MapPin size={16} color={colors.textMuted} />
                                            )}
                                        </View>

                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                                                {log.isAdverse ? 'Bonus Detectado' : 'Chequeo Rutinario'}
                                            </Text>
                                            <Text style={{ fontSize: 11, color: colors.textMuted }}>
                                                {new Date(log.createdAt).toLocaleDateString()} • {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>

                                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Thermometer size={10} color={colors.textMuted} />
                                                <Text style={{ fontSize: 11, color: colors.textMuted }}>{Math.round(log.tempC || 0)}°C</Text>
                                            </View>
                                            {(log.windSpeed || log.humidity) && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    {log.windSpeed && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                            <Wind size={10} color={colors.textMuted} />
                                                            <Text style={{ fontSize: 10, color: colors.textMuted }}>{Math.round(log.windSpeed)}km/h</Text>
                                                        </View>
                                                    )}
                                                    {log.humidity && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                                            <Droplets size={10} color={colors.textMuted} />
                                                            <Text style={{ fontSize: 10, color: colors.textMuted }}>{log.humidity}%</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <TouchableOpacity style={styles.detailCloseBtn} onPress={() => { feedbackSelection(); onClose(); }}>
                        <Text style={styles.detailCloseText}>{profile?.weatherBonus?.isActive ? '¡A darle!' : 'Entendido'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
});
