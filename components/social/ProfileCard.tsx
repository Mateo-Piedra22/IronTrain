import { SocialProfile } from '@/src/services/SocialService';
import { CalendarCheck, CalendarDays, ChevronDown, ChevronUp, CloudRain, Copy, Flame, Globe, Lock as LockIcon, MapPin, MapPinOff, Shield as ShieldIcon, Trophy, Zap } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

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
    colors: any;
    styles: any;
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

    return (
        <View style={styles.profileCard}>
            <TouchableOpacity
                onPress={() => setIsProfileExpanded(!isProfileExpanded)}
                activeOpacity={0.9}
            >
                <View style={[styles.profileHeader, isProfileExpanded && styles.profileHeaderExpanded]}>
                    <View style={styles.profileInfoWrapper}>
                        <Text style={styles.profileName} numberOfLines={1}>{profile.displayName}</Text>
                        {profile.username && (
                            <Text style={styles.profileUsername} numberOfLines={1}>@{profile.username}</Text>
                        )}
                    </View>

                    <View style={styles.bonusColumn}>
                        {profile.activeEvent && (
                            <TouchableOpacity
                                style={styles.eventBadge}
                                onPress={onShowEventModal}
                                activeOpacity={0.7}
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

                {!isProfileExpanded ? (
                    <View style={styles.profileStatsRow}>
                        <View style={styles.statMiniItem}>
                            <Trophy size={14} color={colors.yellow} fill={colors.yellow + '20'} />
                            <Text style={styles.statMiniText}>{profile.scoreLifetime || 0}</Text>
                        </View>
                        <View style={styles.statMiniItem}>
                            <Flame size={14} color={colors.red} fill={colors.red + '20'} />
                            <Text style={styles.statMiniText}>{profile.currentStreak || 0}</Text>
                        </View>
                        <View style={styles.statMiniItem}>
                            <CalendarCheck size={14} color={colors.primary.DEFAULT} />
                            <Text style={styles.statMiniText}>{profile.streakWeeks || 0}w</Text>
                        </View>
                    </View>
                ) : (
                    <View style={styles.metaSummaryRow}>
                        <CalendarDays size={14} color={colors.primary.DEFAULT} />
                        <Text style={styles.metaSummaryText}>Meta: {trainingDays.length} días</Text>
                    </View>
                )}
            </TouchableOpacity>

            {isProfileExpanded && (
                <View style={styles.expandedDetails}>
                    <View style={styles.statsGrid}>
                        <View style={styles.statGridItem}>
                            <Trophy size={20} color={colors.yellow} fill={colors.yellow + '20'} />
                            <Text style={styles.statGridValue}>{profile.scoreLifetime || 0}</Text>
                            <Text style={styles.statGridLabel}>IronScore</Text>
                        </View>
                        <View style={styles.statGridItem}>
                            <Flame size={20} color={colors.red} fill={colors.red + '20'} />
                            <Text style={styles.statGridValue}>{profile.currentStreak || 0}</Text>
                            <Text style={styles.statGridLabel}>Racha Días</Text>
                        </View>
                        <View style={styles.statGridItem}>
                            <CalendarCheck size={20} color={colors.primary.DEFAULT} />
                            <Text style={styles.statGridValue}>{profile.streakWeeks || 0}</Text>
                            <Text style={styles.statGridLabel}>Racha Semanas</Text>
                        </View>
                    </View>

                    <Text style={styles.profileStats}>Rutinas compartidas: {profile.shareStats || 0}</Text>
                    <View style={styles.profileMetaRow}>
                        <View style={styles.profileVisibilityBadge}>
                            {profile.isPublic === 0 ? <LockIcon size={14} color={colors.textMuted} /> : <Globe size={14} color={colors.primary.DEFAULT} />}
                            <Text style={styles.profileVisibilityText}>{profile.isPublic === 0 ? 'Perfil Privado' : 'Perfil Público'}</Text>
                        </View>
                        <TouchableOpacity style={styles.profileEditBtn} onPress={onEditProfile}>
                            <ShieldIcon size={14} color={colors.onPrimary} />
                            <Text style={styles.profileEditBtnText}>Editar Perfil</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.idBox} onPress={onCopyId}>
                        <Text style={styles.idText} numberOfLines={1} ellipsizeMode="middle">ID: {profile.id}</Text>
                        <Copy size={16} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.goalsTrigger}
                        onPress={() => setIsGoalsExpanded(!isGoalsExpanded)}
                    >
                        <View style={styles.goalsTriggerLeft}>
                            <CalendarDays size={18} color={colors.primary.DEFAULT} />
                            <Text style={styles.goalsTriggerTitle}>Mi Meta Semanal</Text>
                        </View>
                        <View style={styles.goalsTriggerRight}>
                            <Text style={styles.goalsSummaryText}>{trainingDays.length} días</Text>
                            {isGoalsExpanded ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
                        </View>
                    </TouchableOpacity>

                    {isGoalsExpanded && (
                        <View style={styles.goalsExpanded}>
                            <Text style={styles.goalsDesc}>
                                Seleccioná los días que planeás entrenar. Los días no marcados como entrenamiento no cortarán tu racha de puntuación.
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
                                            onPress={() => onToggleTrainingDay(day.id)}
                                            style={[styles.dayChip, isSelected && styles.dayChipActive]}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>{day.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </View>
            )}

            <TouchableOpacity
                onPress={() => setIsProfileExpanded(!isProfileExpanded)}
                activeOpacity={0.7}
                style={styles.toggleCollapseWrapper}
            >
                {isProfileExpanded ? <ChevronUp size={18} color={colors.textMuted} /> : <ChevronDown size={18} color={colors.textMuted} />}
            </TouchableOpacity>
        </View>
    );
});
