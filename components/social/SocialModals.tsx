import { withAlpha } from '@/src/theme';
import * as Clipboard from 'expo-clipboard';
import { Award, CheckCircle, CloudRain, Copy, Droplets, Flame, Info as InfoIcon, MapPin, RefreshCcw, Scale, Thermometer, TrendingUp, Trophy, UserMinus as UserMinusIcon, Wind, XCircle, X as XIcon, Zap } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
}: any) => {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
                    <Pressable style={styles.modalCard} onPress={() => { }}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Perfil Social</Text>
                            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
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
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
                                <Text style={styles.modalCancelText}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalPrimaryBtn} onPress={onSave} disabled={saving}>
                                {saving ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={styles.modalPrimaryText}>GUARDAR</Text>}
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
    onAction,
    onOpenComparison,
    loading,
    colors,
    styles
}: any) => {
    if (!friend) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.modalOverlay} onPress={onClose}>
                <Pressable style={styles.modalCard} onPress={() => { }}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{friend.displayName || 'Amigo'}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
                            <XIcon size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                        {friend.username ? (
                            <Text style={styles.friendModalUsername}>@{friend.username}</Text>
                        ) : null}

                        <Text style={styles.friendModalStatus}>
                            {friend.status === 'pending'
                                ? friend.isSender
                                    ? 'Solicitud enviada'
                                    : 'Solicitud recibida'
                                : 'Amistad aceptada'}
                        </Text>

                        <View style={styles.friendInfoCard}>
                            <Text style={styles.friendInfoLabel}>ID Social</Text>
                            <TouchableOpacity
                                style={styles.friendInfoCopyBtn}
                                onPress={async () => {
                                    await Clipboard.setStringAsync(friend.friendId ?? friend.id);
                                }}
                            >
                                <Text style={styles.friendInfoId} numberOfLines={1} ellipsizeMode="middle">{friend.friendId ?? friend.id}</Text>
                                <Copy size={14} color={colors.textMuted} />
                            </TouchableOpacity>

                            {friend.status === 'accepted' && onOpenComparison ? (
                                <TouchableOpacity style={styles.friendInfoActionBtn} onPress={() => onOpenComparison(friend.friendId ?? friend.id)}>
                                    <Scale size={14} color={colors.onPrimary} />
                                    <Text style={styles.friendInfoActionText}>Ver comparación en ranking</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.modalActionsStack}>
                        {friend.status === 'pending' && !friend.isSender && (
                            <View style={styles.dualActionRow}>
                                <TouchableOpacity style={styles.modalPrimaryBtn} disabled={loading} onPress={() => onAction?.('accept')}>
                                    <Text style={styles.modalPrimaryText}>Aceptar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalDangerBtn} disabled={loading} onPress={() => onAction?.('reject')}>
                                    <Text style={styles.modalDangerText}>Rechazar</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {friend.status === 'pending' && friend.isSender && (
                            <TouchableOpacity style={styles.modalSecondaryBtn} disabled={loading} onPress={() => onAction?.('reject')}>
                                <XCircle size={14} color={colors.text} />
                                <Text style={styles.modalSecondaryText}>Cancelar solicitud</Text>
                            </TouchableOpacity>
                        )}

                        {friend.status === 'accepted' && (
                            <View style={styles.dualActionRow}>
                                <TouchableOpacity style={styles.modalSecondaryBtn} disabled={loading} onPress={() => onAction?.('remove')}>
                                    <UserMinusIcon size={14} color={colors.textMuted} />
                                    <Text style={styles.modalSecondaryText}>Eliminar amigo</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalDangerBtn} disabled={loading} onPress={() => onAction?.('block')}>
                                    <Text style={styles.modalDangerText}>Bloquear</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {loading ? <ActivityIndicator size="small" color={colors.primary.DEFAULT} style={{ marginTop: 4 }} /> : null}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
});

export const ScoreInfoModal = React.memo(({
    visible,
    onClose,
    profile,
    colors,
    styles
}: any) => {
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
                        <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
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
                                <Text style={styles.infoPointText}>Voluntad de Hierro ({'<'}{profile?.scoreConfig?.coldThresholdC || 5}°C)</Text>
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
}: any) => {
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

                    <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose}>
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
}: any) => {
    React.useEffect(() => {
        if (visible && onLoadHistory) {
            onLoadHistory();
        }
    }, [visible]);
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
                        onPress={() => onRefreshLocation?.(false)}
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
                            : 'El sistema detecta tu ubicación para validar bonus por clima adverso. Podrás obtener puntos extra si entrenas bajo lluvia, nieve o frío extremo.'}
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
                            {weatherHistory.slice(0, 3).map((log: any, idx: number) => (
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
                        </View>
                    )}

                    <TouchableOpacity style={styles.detailCloseBtn} onPress={onClose}>
                        <Text style={styles.detailCloseText}>{profile?.weatherBonus?.isActive ? '¡A darle!' : 'Entendido'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
});
