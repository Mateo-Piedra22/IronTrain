import { SocialColors, SocialStyles } from '@/components/social/types';
import { SocialProfile } from '@/src/services/SocialService';
import { feedbackSelection, feedbackSoftImpact } from '@/src/social/feedback';
import { CalendarCheck, CalendarDays, ChevronDown, ChevronUp, CloudRain, Copy, Flame, Globe, LayoutDashboard, Lock as LockIcon, MapPin, MapPinOff, Shield as ShieldIcon, Trophy, Zap } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, LayoutAnimation, Platform, Text, TouchableOpacity, UIManager, View } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ProfileCardProps {
    profile: SocialProfile | null;
    isProfileExpanded: boolean;
    setIsProfileExpanded: (expanded: boolean) => void;
    isGoalsExpanded: boolean;
    setIsGoalsExpanded: (expanded: boolean) => void;
    trainingDays: number[];
    onToggleTrainingDay: (dayId: number) => void;
    onCopyId: () => void;
    onEditProfile: () => void;
    onShowEventModal: () => void;
    onShowWeatherModal: () => void;
    onRefreshLocation: (silent?: boolean) => void;
    locationPermissionDenied: boolean;
    lastKnownLocation: string | null;
    refreshingLocation: boolean;
    colors: SocialColors;
    styles: SocialStyles;
}

export const ProfileCard = React.memo(({
    profile,
    isProfileExpanded,
    setIsProfileExpanded,
    isGoalsExpanded,
    setIsGoalsExpanded,
    trainingDays,
    onToggleTrainingDay,
    onCopyId,
    onEditProfile,
    onShowEventModal,
    onShowWeatherModal,
    onRefreshLocation,
    refreshingLocation,
    locationPermissionDenied,
    lastKnownLocation,
    colors,
    styles
}: ProfileCardProps) => {
    if (!profile) return null;

    const baseWorkoutPoints = profile.scoreConfig?.workoutCompletePoints ?? 0;
    const weatherMultiplier = profile.weatherBonus?.multiplier ?? 1;
    const eventMultiplier = profile.activeEvent?.multiplier ?? 1;
    const streakMultiplier = profile.streakMultiplier ?? 1;
    const effectiveWorkoutPoints = Math.round(baseWorkoutPoints * weatherMultiplier * eventMultiplier * streakMultiplier);

    return (
        <View style={styles.profileCard}>
            {/* Main Header / Trigger */}
            <TouchableOpacity
                onPress={() => {
                    feedbackSoftImpact();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIsProfileExpanded(!isProfileExpanded);
                }}
                activeOpacity={0.9}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <View style={[styles.profileHeader, isProfileExpanded && styles.profileHeaderExpanded]}>
                    <View style={styles.profileInfoWrapper}>
                        <Text style={styles.profileName} numberOfLines={1}>{profile.displayName}</Text>
                        {profile.username && (
                            <Text style={styles.profileUsername} numberOfLines={1}>@{profile.username}</Text>
                        )}
                    </View>

                    <View style={styles.profileBadgesRow}>
                        {profile.activeEvent && (
                            <TouchableOpacity
                                style={styles.eventBadge}
                                onPress={onShowEventModal}
                                activeOpacity={0.7}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                onPressIn={feedbackSelection}
                            >
                                <Zap size={10} color={colors.text} fill={colors.text} />
                                <Text style={styles.eventBadgeText}>Evento {profile.activeEvent.multiplier}x</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={profile.weatherBonus?.isActive ? styles.weatherBadge : styles.locationBadge}
                            onPress={onShowWeatherModal}
                            activeOpacity={0.7}
                            disabled={refreshingLocation}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            onPressIn={feedbackSelection}
                        >
                            {refreshingLocation ? (
                                <ActivityIndicator size={10} color={colors.textMuted} />
                            ) : profile.weatherBonus?.isActive ? (
                                <CloudRain size={10} color={colors.onPrimary} />
                            ) : locationPermissionDenied ? (
                                <MapPinOff size={10} color={colors.textMuted} />
                            ) : (
                                <MapPin size={10} color={colors.textMuted} />
                            )}
                            <Text style={profile.weatherBonus?.isActive ? styles.weatherBadgeText : styles.locationBadgeText}>
                                {refreshingLocation ? 'Localizando...' :
                                    profile.weatherBonus?.isActive ? 'Voluntad de Hierro' :
                                        locationPermissionDenied ? 'Ubicación desactivada' :
                                            (profile.weatherBonus?.location || lastKnownLocation || 'Activar ubicación')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Collapsed Stats Summary */}
                {!isProfileExpanded && (
                    <View style={styles.profileStatsRow}>
                        <View style={styles.statMiniItem}>
                            <Trophy size={14} color={colors.yellow} />
                            <Text style={styles.statMiniText}>{profile.scoreLifetime || 0}</Text>
                        </View>
                        <View style={styles.statMiniItem}>
                            <Flame size={14} color={colors.red} />
                            <Text style={styles.statMiniText}>{profile.currentStreak || 0} d</Text>
                        </View>
                        <View style={styles.statMiniItem}>
                            <CloudRain size={14} color={colors.primary.DEFAULT} />
                            <Text style={styles.statMiniText}>x{weatherMultiplier.toFixed(2)}</Text>
                        </View>
                    </View>
                )}
            </TouchableOpacity>

            {/* Expanded Information */}
            {isProfileExpanded && (
                <View style={styles.expandedDetails}>
                    {/* Primary Metrics (Cards) */}
                    <View style={styles.statRow}>
                        <View style={styles.statCard}>
                            <Trophy size={22} color={colors.yellow} />
                            <Text style={styles.statCardValue}>{profile.scoreLifetime || 0}</Text>
                            <Text style={styles.statCardLabel}>IronScore</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Flame size={22} color={colors.red} />
                            <Text style={styles.statCardValue}>{profile.currentStreak || 0}</Text>
                            <Text style={styles.statCardLabel}>Días</Text>
                        </View>
                        <View style={styles.statCard}>
                            <CalendarCheck size={22} color={colors.primary.DEFAULT} />
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={styles.statCardValue}>{profile.streakWeeks || 0}</Text>
                                {(profile.streakWeeks || 0) >= 2 && (
                                    <View style={styles.multiplierBadge}>
                                        <Text style={styles.multiplierText}>{Math.min(Math.floor((profile.streakWeeks || 0) / 2) + 1, 3)}x</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.statCardLabel}>Semanas</Text>
                        </View>
                    </View>

                    {/* Secondary Metrics (Badges) */}
                    <View style={styles.socialHighlightRow}>
                        <View style={styles.infoBadge}>
                            <LayoutDashboard size={14} color={colors.textMuted} />
                            <Text style={styles.infoBadgeText}>{profile.shareStats || 0} rutinas</Text>
                        </View>
                        {profile.scoreConfig && (
                            <View style={styles.infoBadge}>
                                <Zap size={14} color={colors.textMuted} />
                                <Text style={styles.infoBadgeText}>+{effectiveWorkoutPoints} pts/ent</Text>
                            </View>
                        )}
                    </View>

                    <Text style={[styles.friendStatus, { marginBottom: 10 }]}>Estado social: {(profile.is_public === 0 || profile.is_public === false || profile.isPublic === 0 || profile.isPublic === false) ? 'perfil privado' : 'perfil visible a la comunidad'}</Text>

                    {/* Weekly Meta Card */}
                    <TouchableOpacity
                        style={styles.goalCard}
                        onPress={() => {
                            feedbackSoftImpact();
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
                            setIsGoalsExpanded(!isGoalsExpanded);
                        }}
                        activeOpacity={0.8}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <View style={styles.goalCardLeft}>
                            <CalendarDays size={22} color={colors.primary.DEFAULT} />
                            <View>
                                <Text style={styles.goalTitle}>Mi Meta Semanal</Text>
                                <Text style={styles.goalSubtitle}>{trainingDays.length} días seleccionados</Text>
                            </View>
                        </View>
                        <View style={{ transform: [{ rotate: isGoalsExpanded ? '180deg' : '0deg' }] }}>
                            <ChevronDown size={22} color={colors.textMuted} />
                        </View>
                    </TouchableOpacity>

                    {/* Goal Editor expansion */}
                    {isGoalsExpanded && (
                        <View style={styles.goalsExpanded}>
                            <Text style={styles.goalsDesc}>
                                Seleccioná los días que planeás entrenar. Los días no seleccionados no cortarán tu racha.
                            </Text>
                            <View style={styles.daysRow}>
                                {[
                                    { id: 1, label: 'L' }, { id: 2, label: 'M' }, { id: 3, label: 'X' },
                                    { id: 4, label: 'J' }, { id: 5, label: 'V' }, { id: 6, label: 'S' },
                                    { id: 0, label: 'D' }
                                ].map(day => {
                                    const isSelected = trainingDays.includes(day.id);
                                    return (
                                        <TouchableOpacity
                                            key={day.id}
                                            onPress={() => {
                                                feedbackSelection();
                                                onToggleTrainingDay(day.id);
                                            }}
                                            style={[styles.dayChip, isSelected && styles.dayChipActive]}
                                            activeOpacity={0.7}
                                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                        >
                                            <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>{day.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Profile Status & Action */}
                    <View style={styles.profileActionRow}>
                        <View style={styles.profileVisibilityBadge}>
                            {(profile.is_public === 0 || profile.is_public === false || profile.isPublic === 0 || profile.isPublic === false) ? (
                                <LockIcon size={16} color={colors.textMuted} />
                            ) : (
                                <Globe size={16} color={colors.primary.DEFAULT} />
                            )}
                            <Text style={styles.profileVisibilityText}>
                                {(profile.is_public === 0 || profile.is_public === false || profile.isPublic === 0 || profile.isPublic === false) ? 'Perfil Privado' : 'Perfil Público'}
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.profileEditBtn} onPress={onEditProfile} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} onPressIn={feedbackSelection}>
                            <ShieldIcon size={18} color={colors.onPrimary} />
                            <Text style={styles.profileEditBtnText}>Configurar Perfil</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Footer Utility */}
                    <TouchableOpacity style={styles.idFooter} onPress={onCopyId} activeOpacity={0.6} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} onPressIn={feedbackSelection}>
                        <Text style={styles.idFooterText}>ID: {profile.id.toUpperCase()}</Text>
                        <Copy size={12} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Bottom Collapse Trigger */}
            <TouchableOpacity
                onPress={() => {
                    feedbackSoftImpact();
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setIsProfileExpanded(!isProfileExpanded);
                }}
                activeOpacity={0.7}
                style={styles.toggleCollapseWrapper}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                {isProfileExpanded ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
            </TouchableOpacity>
        </View>
    );
});
