import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useDataReload } from '@/src/hooks/useDataReload';
import { locationPermissionsService } from '@/src/services/LocationPermissionsService';
import { routineService } from '@/src/services/RoutineService';
import { SocialComparisonEntry, SocialFriend, SocialInboxItem, SocialLeaderboardEntry, SocialProfile, SocialSearchUser, SocialService } from '@/src/services/SocialService';
import { useAuthStore } from '@/src/store/authStore';
import { confirm } from '@/src/store/confirmStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { logger } from '@/src/utils/logger';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { Award, CalendarDays, CheckCircle, ChevronDown, ChevronUp, CloudRain, Copy, Dumbbell, Eye, EyeOff, Flame, Globe, Info, Lock as LockIcon, MapPin, MapPinOff, RefreshCcw, Scale, Settings, Shield as ShieldIcon, TrendingUp, Trophy, UserCheck, UserMinus as UserMinusIcon, XCircle, X as XIcon, Zap } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { IronTrainLogo } from '../../components/IronTrainLogo';
import { useColors } from '../../src/hooks/useColors';

import { configService } from '@/src/services/ConfigService';
import { useSettingsStore } from '@/src/store/useSettingsStore';
import { dedupeByInboxKey, getInboxKey } from '@/src/utils/dedupe';

type SocialTabKey = 'leaderboard' | 'friends' | 'inbox' | 'search';
const USERNAME_REGEX = /^[a-z0-9_]+$/;

export default function SocialTab() {
    const colors = useColors();
    const styles = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        loggedOutContainer: {
            alignItems: 'center',
            paddingHorizontal: 32,
            paddingTop: 80,
        },
        loggedOutIcon: {
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: colors.surfaceLighter,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 28,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        loggedOutTitle: {
            fontSize: 28,
            fontWeight: '900',
            color: colors.text,
            textAlign: 'center',
            marginBottom: 14,
            letterSpacing: -1,
        },
        loggedOutSub: {
            fontSize: 16,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 24,
            marginBottom: 44,
        },
        loginBtn: {
            backgroundColor: colors.primary.DEFAULT,
            paddingVertical: 18,
            paddingHorizontal: 32,
            borderRadius: 16,
            width: '100%',
            alignItems: 'center',
            marginBottom: 14,
            ...ThemeFx.shadowSm,
        },
        loginBtnText: {
            color: colors.onPrimary,
            fontSize: 17,
            fontWeight: '900',
            letterSpacing: 0.5,
        },
        signupBtn: {
            backgroundColor: colors.surface,
            paddingVertical: 18,
            paddingHorizontal: 32,
            borderRadius: 16,
            width: '100%',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        signupBtnText: {
            color: colors.text,
            fontSize: 17,
            fontWeight: '800',
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            height: 76,
            backgroundColor: colors.background,
            zIndex: 10,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        title: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 26,
            letterSpacing: -1.2,
        },
        headerActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            zIndex: 10,
        },
        publicBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: colors.primary.DEFAULT,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 14,
            ...ThemeFx.shadowSm,
        },
        publicBtnText: {
            color: colors.onPrimary,
            fontSize: 13,
            fontWeight: '900',
            letterSpacing: 0.5,
        },
        headerIconBtn: {
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            zIndex: 10,
            flex: 1,
        },
        headerLoadingWrapper: {
            marginLeft: 12,
        },
        headerCenterIconWrapper: {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
        },
        headerCenterIcon: {
            width: 100,
            height: 100,
            resizeMode: 'contain',
        },
        headerActionsBox: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            zIndex: 10,
            flex: 0,
        },
        scrollContent: {
            paddingHorizontal: 20,
            paddingBottom: 40,
            paddingTop: 20,
        },
        profileCard: {
            backgroundColor: colors.surface,
            padding: 24,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginBottom: 24,
            ...ThemeFx.shadowSm,
        },
        profileName: {
            fontSize: 26,
            fontWeight: '900',
            color: colors.text,
            marginBottom: 6,
            letterSpacing: -0.8,
        },
        profileUsername: {
            fontSize: 17,
            fontWeight: '800',
            color: colors.primary.DEFAULT,
            marginBottom: 14,
            letterSpacing: 0.2,
        },
        profileStats: {
            fontSize: 14,
            color: colors.textMuted,
            marginBottom: 18,
            fontWeight: '600',
        },
        profileMetaRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
            gap: 12,
        },
        profileVisibilityBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        profileVisibilityText: {
            fontSize: 12,
            color: colors.text,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
        },
        profileEditBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: 16,
            paddingHorizontal: 18,
            paddingVertical: 12,
            ...ThemeFx.shadowSm,
        },
        profileEditBtnText: {
            color: colors.onPrimary,
            fontSize: 12,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
        },
        idBox: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surfaceLighter,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        idText: {
            color: colors.textMuted,
            fontFamily: 'monospace',
            fontSize: 12,
            flex: 1,
            marginRight: 10,
            fontWeight: '700',
        },
        tabsMenuWrapper: {
            marginBottom: 24,
        },
        tabsMenu: {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 6,
            borderWidth: 1.5,
            borderColor: colors.border,
            gap: 6,
            ...ThemeFx.shadowSm,
        },
        tabBtn: {
            flex: 1,
            paddingHorizontal: 10,
            paddingVertical: 14,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
        },
        tabBtnActive: {
            backgroundColor: colors.primary.DEFAULT,
        },
        tabText: {
            color: colors.textMuted,
            fontWeight: '900',
            fontSize: 12,
            letterSpacing: 1,
            textTransform: 'uppercase',
        },
        tabTextActive: {
            color: colors.onPrimary,
        },
        tabContent: {
            minHeight: 200,
        },
        emptyText: {
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 40,
            fontSize: 16,
            fontWeight: '600',
        },
        friendRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: colors.surface,
            padding: 20,
            borderRadius: 20,
            marginBottom: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        highlightRow: {
            borderColor: colors.primary.DEFAULT,
            // Usamos el surfaceLighter (sólido) en lugar de una transparencia para evitar el bug del motor de renderizado
            backgroundColor: colors.surfaceLighter,
            borderWidth: 2, // Lo hacemos un poco más grueso para que resalte más
        },
        expandedComparisonBox: {
            backgroundColor: colors.surface,
            marginHorizontal: 8,
            marginBottom: 16,
            padding: 20,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginTop: -4,
        },
        compareHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottomWidth: 1.5,
            borderColor: colors.border,
        },
        compareTitle: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        compareEmptyText: {
            color: colors.textMuted,
            fontSize: 14,
            fontStyle: 'italic',
            textAlign: 'center',
            marginVertical: 12,
        },
        compareRow: {
            marginBottom: 12,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 16,
        },
        compareRowHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
        },
        compareExerciseName: {
            color: colors.text,
            fontSize: 16,
            fontWeight: '900',
            textTransform: 'capitalize',
            flex: 1,
        },
        compareDiff: {
            fontSize: 13,
            fontWeight: '900',
        },
        compareBarContainer: {
            alignItems: 'center',
        },
        compareValueRow: {
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: 'transparent',
        },
        compareValueHighlightBox: {
            backgroundColor: colors.isDark ? withAlpha(colors.primary.DEFAULT, '20') : withAlpha(colors.primary.DEFAULT, '15'),
            borderColor: withAlpha(colors.primary.DEFAULT, '30'),
            borderWidth: 1.5,
        },
        compareBars: {
            flexDirection: 'row',
            justifyContent: 'space-between',
        },
        compareValue: {
            fontSize: 22,
            color: colors.text,
            fontWeight: '900',
        },
        compareValueHighlight: {
            color: colors.primary.DEFAULT,
        },
        compareLabel: {
            fontSize: 12,
            color: colors.textMuted,
            fontWeight: '800',
            marginTop: 4,
            textTransform: 'uppercase',
        },
        rankRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
        },
        rankingHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
        },
        rankingSegmentRow: {
            flexDirection: 'row',
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            padding: 6,
            flex: 1,
            marginRight: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        segmentBtn: {
            backgroundColor: 'transparent',
            flex: 1,
            paddingVertical: 12,
            alignItems: 'center',
            borderRadius: 12,
        },
        segmentBtnActive: {
            backgroundColor: colors.surface,
            ...ThemeFx.shadowSm,
        },
        segmentText: {
            fontSize: 12,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        segmentTextActive: {
            color: colors.text,
        },
        infoBtn: {
            width: 48,
            height: 48,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            ...ThemeFx.shadowSm,
        },
        streakBadge: {
            backgroundColor: withAlpha(colors.red, '15'),
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: withAlpha(colors.red, '30'),
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        streakText: {
            fontSize: 12,
            fontWeight: '900',
            color: colors.red,
        },
        friendName: {
            color: colors.text,
            fontSize: 18,
            fontWeight: '900',
            marginBottom: 4,
            letterSpacing: -0.5,
        },
        friendStatus: {
            color: colors.textMuted,
            fontSize: 13,
            textTransform: 'uppercase',
            fontWeight: '800',
        },
        rankNumber: {
            fontSize: 28,
            fontWeight: '900',
            color: colors.text,
            minWidth: 32,
            textAlign: 'center',
        },
        actionsBox: {
            flexDirection: 'row',
            gap: 10,
        },
        btnSmallAccept: {
            backgroundColor: colors.primary.DEFAULT,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 14,
            ...ThemeFx.shadowSm,
        },
        btnSmallReject: {
            backgroundColor: colors.surfaceLighter,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        btnSmallText: {
            color: colors.onPrimary,
            fontWeight: '900',
            fontSize: 13,
            textTransform: 'uppercase',
        },
        btnSmallTextReject: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 13,
            textTransform: 'uppercase',
        },
        searchBox: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 24,
        },
        searchInput: {
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: colors.border,
            paddingHorizontal: 18,
            paddingVertical: 16,
            borderRadius: 18,
            color: colors.text,
            fontSize: 16,
            fontWeight: '600',
        },
        searchBtn: {
            backgroundColor: colors.primary.DEFAULT,
            justifyContent: 'center',
            paddingHorizontal: 28,
            borderRadius: 18,
            ...ThemeFx.shadowSm,
        },
        searchBtnText: {
            color: colors.onPrimary,
            fontWeight: '900',
            fontSize: 16,
        },
        premiumCard: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            overflow: 'hidden',
            marginBottom: 16,
            ...ThemeFx.shadowSm,
        },
        premiumHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: 20,
            paddingBottom: 12,
            gap: 14,
        },
        premiumIconBox: {
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: colors.primary.DEFAULT,
            alignItems: 'center',
            justifyContent: 'center',
        },
        premiumTitle: {
            fontSize: 20,
            fontWeight: '900',
            color: colors.text,
            marginBottom: 2,
            letterSpacing: -0.5,
        },
        premiumSender: {
            fontSize: 14,
            color: colors.primary.DEFAULT,
            fontWeight: '800',
        },
        premiumBody: {
            paddingHorizontal: 20,
            paddingBottom: 20,
        },
        premiumDescription: {
            fontSize: 15,
            color: colors.textMuted,
            lineHeight: 22,
            fontWeight: '500',
        },
        premiumActions: {
            flexDirection: 'row',
            padding: 16,
            gap: 10,
            borderTopWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surfaceLighter,
        },
        premiumBtnPrimary: {
            flex: 1,
            backgroundColor: colors.primary.DEFAULT,
            paddingVertical: 14,
            alignItems: 'center',
            borderRadius: 14,
            ...ThemeFx.shadowSm,
        },
        premiumBtnTextPrimary: {
            color: colors.onPrimary,
            fontSize: 14,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        premiumBtnSecondary: {
            backgroundColor: colors.surface,
            paddingVertical: 14,
            paddingHorizontal: 24,
            alignItems: 'center',
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        premiumBtnTextSecondary: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 14,
            textTransform: 'uppercase',
        },
        premiumResolved: {
            padding: 16,
            alignItems: 'center',
            borderTopWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.background,
        },
        premiumStatusText: {
            color: colors.textMuted,
            fontWeight: '800',
            fontStyle: 'italic',
            fontSize: 13,
        },
        activityRow: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginBottom: 16,
            ...ThemeFx.shadowSm,
        },
        activityHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            marginBottom: 16,
        },
        activityIconBox: {
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.surfaceLighter,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        activityUser: {
            fontSize: 16,
            fontWeight: '900',
            color: colors.text,
            marginBottom: 2,
        },
        activityDesc: {
            fontSize: 14,
            color: colors.textMuted,
            fontWeight: '600',
        },
        activityDate: {
            fontSize: 11,
            color: colors.textMuted,
            textTransform: 'uppercase',
            fontWeight: '800',
            letterSpacing: 0.5,
        },
        activityFooter: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTopWidth: 1.5,
            borderColor: colors.border,
            paddingTop: 16,
            marginTop: 4,
        },
        kudoBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 8,
            paddingHorizontal: 16,
            borderRadius: 999,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        kudoBtnActive: {
            backgroundColor: withAlpha(colors.yellow, '15'),
            borderColor: withAlpha(colors.yellow, '40'),
        },
        kudoBtnDisabled: {
            opacity: 0.5,
        },
        kudoText: {
            color: colors.textMuted,
            fontSize: 14,
            fontWeight: '900',
        },
        kudoTextActive: {
            color: colors.yellow,
        },
        ownActivityHint: {
            marginLeft: 10,
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: '700',
            fontStyle: 'italic',
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: ThemeFx.backdrop,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
        },
        modalCard: {
            width: '100%',
            maxWidth: 450,
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            overflow: 'hidden',
            ...ThemeFx.shadowLg,
        },
        modalHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingVertical: 20,
            borderBottomWidth: 1.5,
            borderColor: colors.border,
        },
        modalTitle: {
            color: colors.text,
            fontSize: 20,
            fontWeight: '900',
            letterSpacing: -0.5,
        },
        modalCloseBtn: {
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        modalBody: {
            padding: 24,
            gap: 16,
        },
        modalLabel: {
            color: colors.textMuted,
            fontSize: 13,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        modalFieldHint: {
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: '700',
            marginTop: -8,
            marginBottom: 4,
            fontStyle: 'italic',
        },
        modalInput: {
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 18,
            paddingVertical: 16,
            color: colors.text,
            fontSize: 16,
            fontWeight: '700',
        },
        privacyRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 4,
            gap: 12,
        },
        privacyHint: {
            color: colors.textMuted,
            fontSize: 13,
            fontWeight: '600',
        },
        modalActions: {
            flexDirection: 'row',
            gap: 12,
            padding: 24,
            paddingTop: 8,
        },
        modalActionsStack: {
            padding: 24,
            paddingTop: 8,
            gap: 10,
        },
        modalCancelBtn: {
            flex: 1,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
        },
        modalCancelText: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '900',
            textTransform: 'uppercase',
        },
        modalPrimaryBtn: {
            flex: 1,
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            ...ThemeFx.shadowSm,
        },
        modalPrimaryText: {
            color: colors.onPrimary,
            fontSize: 14,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        friendModalUsername: {
            fontSize: 18,
            fontWeight: '900',
            color: colors.primary.DEFAULT,
            letterSpacing: -0.5,
        },
        friendModalStatus: {
            color: colors.textMuted,
            fontSize: 14,
            textTransform: 'uppercase',
            fontWeight: '800',
        },
        friendInfoCard: {
            marginTop: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 16,
            padding: 16,
            backgroundColor: colors.surfaceLighter,
            gap: 12,
        },
        friendInfoLabel: {
            color: colors.textMuted,
            fontSize: 12,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        friendInfoCopyBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 14,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: colors.surface,
        },
        friendInfoId: {
            flex: 1,
            fontSize: 14,
            color: colors.text,
            fontWeight: '800',
            fontFamily: 'System',
        },
        infoFooterBox: {
            flexDirection: 'row',
            backgroundColor: colors.isDark ? withAlpha(colors.primary.DEFAULT, '10') : colors.surfaceLighter,
            padding: 16,
            borderRadius: 16,
            gap: 12,
            borderWidth: 1.5,
            borderColor: colors.isDark ? withAlpha(colors.primary.DEFAULT, '20') : colors.border,
        },
        infoFooterText: {
            flex: 1,
            fontSize: 12,
            color: colors.textMuted,
            lineHeight: 18,
            fontWeight: '600',
            fontStyle: 'italic',
        },
        bonusColumn: {
            alignItems: 'flex-end',
            gap: 8,
        },
        refreshBadgeBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 24,
            gap: 8,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: withAlpha(colors.primary.DEFAULT, '20'),
        },
        refreshBadgeText: {
            fontSize: 13,
            fontWeight: '900',
            color: colors.primary.DEFAULT,
        },
        infoDivider: {
            height: 1,
            backgroundColor: colors.border,
            marginVertical: 24,
            width: '100%',
        },
        infoStreakRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: 10,
            paddingHorizontal: 4,
        },
        infoStreakLabel: {
            fontSize: 14,
            color: colors.text,
            fontWeight: '600',
        },
        infoStreakValue: {
            fontSize: 14,
            fontWeight: '900',
            color: colors.primary.DEFAULT,
        },
        infoStreakBestia: {
            backgroundColor: colors.red,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 12,
            marginTop: 8,
            ...ThemeFx.shadowSm,
        },
        infoIconBox: {
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: withAlpha(colors.yellow, '15'),
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: withAlpha(colors.yellow, '20'),
        },
        formulaBox: {
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.border,
            marginVertical: 12,
        },
        formulaTitle: {
            fontSize: 12,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            marginBottom: 10,
            letterSpacing: 1,
        },
        formulaText: {
            fontSize: 16,
            fontWeight: '900',
            color: colors.text,
            textAlign: 'center',
            lineHeight: 24,
        },
        eventBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.yellow,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            gap: 8,
        },
        eventBadgeText: {
            color: colors.black,
            fontSize: 12,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        weatherBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.primary.DEFAULT,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            gap: 8,
        },
        weatherBadgeText: {
            color: colors.onPrimary,
            fontSize: 12,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        locationBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surfaceLighter,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            gap: 8,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        locationBadgeText: {
            color: colors.text,
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
        },
        activeEventBadge: {
            backgroundColor: colors.yellow,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
        },
        activeEventBadgeText: {
            color: colors.onPrimary,
            fontSize: 10,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        detailModalCard: {
            width: '90%',
            maxWidth: 400,
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 28,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            ...ThemeFx.shadowLg,
        },
        detailIconCircle: {
            width: 80,
            height: 80,
            borderRadius: 40,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            borderWidth: 1.5,
            borderColor: colors.primary.DEFAULT,
            backgroundColor: colors.isDark ? withAlpha(colors.primary.DEFAULT, '15') : colors.surfaceLighter,
        },
        detailTitle: {
            fontSize: 24,
            fontWeight: '900',
            color: colors.text,
            textAlign: 'center',
            marginBottom: 8,
            letterSpacing: -0.5,
        },
        detailDesc: {
            fontSize: 15,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 22,
            fontWeight: '500',
            marginBottom: 28,
        },
        detailInfoGrid: {
            width: '100%',
            backgroundColor: colors.surfaceLighter,
            borderRadius: 20,
            padding: 24,
            gap: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        detailInfoRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        detailInfoLabel: {
            fontSize: 12,
            color: colors.textMuted,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        detailInfoValue: {
            fontSize: 16,
            color: colors.text,
            fontWeight: '900',
        },
        detailCloseBtn: {
            marginTop: 28,
            width: '100%',
            paddingVertical: 18,
            borderRadius: 16,
            backgroundColor: colors.primary.DEFAULT,
            alignItems: 'center',
            ...ThemeFx.shadowSm,
        },
        detailCloseText: {
            color: colors.onPrimary,
            fontSize: 15,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        // Goal System
        goalsTrigger: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surfaceLighter,
            padding: 18,
            borderRadius: 20,
            marginTop: 18,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        goalsTriggerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
        },
        goalsTriggerTitle: {
            fontSize: 15,
            fontWeight: '900',
            color: colors.text,
            letterSpacing: -0.3,
        },
        goalsTriggerRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        goalsSummaryText: {
            fontSize: 13,
            fontWeight: '800',
            color: colors.primary.DEFAULT,
            textTransform: 'uppercase',
        },
        goalsExpanded: {
            marginTop: 12,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        goalsDesc: {
            fontSize: 13,
            color: colors.textMuted,
            lineHeight: 18,
            marginBottom: 16,
            fontWeight: '500',
        },
        daysRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 6,
        },
        dayChip: {
            flex: 1,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        dayChipActive: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        dayChipText: {
            fontSize: 14,
            fontWeight: '900',
            color: colors.textMuted,
        },
        dayChipTextActive: {
            color: colors.onPrimary,
        },
        // Action Rows & Buttons
        dualActionRow: {
            flexDirection: 'row',
            gap: 12,
            marginTop: 8,
        },
        modalDangerBtn: {
            flex: 1,
            backgroundColor: withAlpha(colors.red, '10'),
            borderWidth: 1.5,
            borderColor: withAlpha(colors.red, '30'),
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
        },
        modalDangerText: {
            color: colors.red,
            fontSize: 14,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        modalSecondaryBtn: {
            flex: 1,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
        },
        modalSecondaryText: {
            color: colors.text,
            fontSize: 14,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        },
        friendInfoActionBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            backgroundColor: colors.primary.DEFAULT,
            paddingVertical: 16,
            borderRadius: 16,
            marginTop: 4,
            ...ThemeFx.shadowSm,
        },
        friendInfoActionText: {
            color: colors.onPrimary,
            fontSize: 15,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        // Info Sections
        infoSectionTitle: {
            fontSize: 13,
            fontWeight: '900',
            color: colors.primary.DEFAULT,
            textTransform: 'uppercase',
            letterSpacing: 1.2,
            marginBottom: 8,
            marginTop: 12,
        },
        infoSectionDesc: {
            fontSize: 14,
            color: colors.textMuted,
            lineHeight: 20,
            fontWeight: '500',
            marginBottom: 16,
        },
        infoPointRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: withAlpha(colors.border, '50'),
        },
        infoPointText: {
            fontSize: 14,
            color: colors.text,
            fontWeight: '700',
        },
        infoPointValue: {
            fontSize: 14,
            color: colors.primary.DEFAULT,
            fontWeight: '900',
        },
        inboxSecondaryHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            paddingHorizontal: 4,
        },
        inboxStatusTitle: {
            fontSize: 14,
            fontWeight: '800',
            color: colors.text,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        archiveToggle: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.surfaceLighter,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
        },
        archiveToggleActive: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        archiveToggleText: {
            fontSize: 12,
            fontWeight: '800',
            color: colors.textMuted,
        },
        archiveToggleTextActive: {
            color: colors.onPrimary,
        },
        markSeenBtn: {
            padding: 8,
            backgroundColor: withAlpha(colors.textMuted, '10'),
            borderRadius: 10,
        },
        // Collapsible Profile Styles
        mainScroll: {
            flex: 1,
        },
        mainScrollContent: {
            paddingHorizontal: 20,
            paddingBottom: 100,
            paddingTop: 20,
            flexGrow: 1,
        },
        profileHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
        },
        profileHeaderExpanded: {
            marginBottom: 16,
        },
        profileInfoWrapper: {
            flex: 1,
            marginRight: 12,
        },
        profileBadgesRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        metaSummaryRow: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 12,
            gap: 8,
            backgroundColor: colors.surfaceLighter,
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
        },
        metaSummaryText: {
            fontSize: 13,
            color: colors.textMuted,
            fontWeight: '800',
        },
        toggleCollapseWrapper: {
            marginTop: 12,
            alignSelf: 'center',
            width: 64,
            height: 28,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceLighter,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: withAlpha(colors.border, '50'),
        },
        expandedDetails: {
            marginTop: 8,
        },
        badgeSmall: {
            paddingHorizontal: 8,
        },
    }), [colors]);
    const [profile, setProfile] = useState<SocialProfile | null>(null);
    const [friends, setFriends] = useState<SocialFriend[]>([]);
    const [inbox, setInbox] = useState<SocialInboxItem[]>([]);
    const [leaderboard, setLeaderboard] = useState<SocialLeaderboardEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SocialSearchUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showSeen, setShowSeen] = useState(false);
    const [activeTab, setActiveTab] = useState<SocialTabKey>('leaderboard');
    const router = useRouter();
    const [rankingSegment, setRankingSegment] = useState<'weekly' | 'monthly' | 'lifetime'>('lifetime');
    const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
    const [comparisons, setComparisons] = useState<Record<string, SocialComparisonEntry[]>>({});
    const [loadingCompare, setLoadingCompare] = useState(false);
    const [activeFriend, setActiveFriend] = useState<SocialFriend | null>(null);
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
    const [profileFormDisplayName, setProfileFormDisplayName] = useState('');
    const [profileFormUsername, setProfileFormUsername] = useState('');
    const [profileFormPublic, setProfileFormPublic] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [trainingDays, setTrainingDays] = useState<number[]>([]);
    const [isGoalsExpanded, setIsGoalsExpanded] = useState(false);
    const [isProfileExpanded, setIsProfileExpanded] = useState(false);
    const [isScoreModalVisible, setIsScoreModalVisible] = useState(false);
    const [isEventModalVisible, setIsEventModalVisible] = useState(false);
    const [isWeatherModalVisible, setIsWeatherModalVisible] = useState(false);
    const [refreshingLocation, setRefreshingLocation] = useState(false);
    const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

    const authState = useAuthStore();
    const navigation = useNavigation();

    const loadData = useCallback(async () => {
        if (!authState.token) return;
        try {
            setLoading(true);
            const [prof, fr, inb, lb] = await Promise.all([
                SocialService.getProfile(),
                SocialService.getFriends(),
                SocialService.getInbox(),
                SocialService.getAnalytics(),
            ]);
            setProfile(prev => ({
                ...prof,
                weatherBonus: prof.weatherBonus || prev?.weatherBonus || null
            }));
            setFriends(fr);
            // Deduplicate and filter out potentially corrupt data
            const uniqueInb = dedupeByInboxKey(inb);

            // Re-apply optimistic local "seen" if a markers is pending
            setInbox(uniqueInb);
            setLeaderboard(lb);
        } catch {
            confirm.error('Error', 'No se pudieron cargar los datos sociales.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [authState.token]);

    const loadTrainingDays = useCallback(async () => {
        const rawDays = await configService.get('training_days');
        setTrainingDays(Array.isArray(rawDays) ? rawDays : [1, 2, 3, 4, 5, 6]);
    }, []);

    useDataReload(() => {
        loadData();
    }, ['DATA_UPDATED', 'SOCIAL_UPDATED']);

    useDataReload(() => {
        loadTrainingDays();
    }, ['SETTINGS_UPDATED']);

    useFocusEffect(
        useCallback(() => {
            loadData();
            loadTrainingDays();
            // Comprobar ubicación al entrar de manera silenciosa
            handleRefreshLocation(true);
        }, [loadData, loadTrainingDays])
    );

    const handleCopyId = async () => {
        if (profile?.id) {
            await Clipboard.setStringAsync(profile.id);
            confirm.success('Copiado', 'Tu ID ha sido copiado al portapapeles. Compartilo con un amigo.');
        }
    };

    const handleRefreshLocation = useCallback(async (silent = false) => {
        try {
            setRefreshingLocation(true);
            const location = await locationPermissionsService.getCurrentLocation(silent);

            if (location) {
                setProfile(prev => prev ? ({
                    ...prev,
                    weatherBonus: {
                        ...(prev.weatherBonus || {
                            condition: 'Sincronizando...',
                            temperature: 20,
                            multiplier: 1.0,
                            isActive: false
                        }),
                        location: location.city || 'Tu ubicación',
                    }
                }) : null);

                try {
                    const updatedBonus = await SocialService.updateWeatherBonus(
                        location.lat,
                        location.lon,
                        location.city
                    );

                    if (updatedBonus) {
                        setProfile(prev => prev ? ({
                            ...prev,
                            weatherBonus: updatedBonus
                        }) : null);
                        if (!silent) confirm.success('Ubicación Actualizada', `Se detectó: ${location.city || 'Tu ubicación'}`);
                    }
                } catch (err) {
                    logger.captureException(err, { scope: 'SocialTab.refreshLocation', message: 'Weather API failed, keeping local location' });
                    if (!silent) confirm.error('Servicio de Clima', 'No pudimos verificar bonificaciones climáticas, pero detectamos tu ubicación.');
                }
            } else {
                const status = await Location.getForegroundPermissionsAsync();
                setLocationPermissionDenied(status.status === 'denied');
                // Don't show error message in silent mode to avoid annoying the user on tab entry
                if (!silent) confirm.error('Error de GPS', 'No pudimos obtener tu ubicación exacta. Verificá los permisos.');
            }
        } catch (e: unknown) {
            logger.captureException(e, { scope: 'SocialTab.refreshLocation', message: 'Error refreshing location' });
            if (!silent) confirm.error('Error de GPS', 'Ocurrió un error al intentar obtener tu ubicación.');
        } finally {
            setRefreshingLocation(false);
        }
    }, [confirm]);

    const handleSearch = async () => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return;
        try {
            setLoading(true);
            const res = await SocialService.searchUsers(trimmed);
            setSearchResults(res);
            setActiveTab('search');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPublicRoutines = async () => {
        try {
            await Linking.openURL('https://irontrain.motiona.xyz/feed');
        } catch {
            confirm.error('Error', 'No se pudo abrir la página de rutinas públicas.');
        }
    };

    const handleSendRequest = async (friendId: string) => {
        try {
            await SocialService.sendFriendRequest(friendId);
            confirm.success('Solicitud enviada', 'La solicitud fue enviada correctamente.');
            loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        }
    };

    const handleFriendResponse = async (requestId: string, action: 'accept' | 'reject') => {
        try {
            await SocialService.respondFriendRequest(requestId, action);
            loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        }
    };

    const openProfileModal = () => {
        if (!profile) return;
        setProfileFormDisplayName((profile.displayName || '').trim());
        setProfileFormUsername((profile.username || '').trim());
        setProfileFormPublic(profile.isPublic !== 0);
        setIsProfileModalVisible(true);
    };

    const handleSaveProfile = async () => {
        const normalizedDisplayName = profileFormDisplayName.replace(/\s+/g, ' ').trim();
        const normalizedUsername = profileFormUsername.trim().toLowerCase();

        if (!normalizedDisplayName) {
            confirm.error('Error', 'El nombre visible es obligatorio.');
            return;
        }

        if (normalizedDisplayName.length < 2 || normalizedDisplayName.length > 64) {
            confirm.error('Error', 'El nombre visible debe tener entre 2 y 64 caracteres.');
            return;
        }

        if (normalizedUsername.length > 0) {
            if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
                confirm.error('Error', 'El username debe tener entre 3 y 20 caracteres.');
                return;
            }
            if (!USERNAME_REGEX.test(normalizedUsername)) {
                confirm.error('Error', 'El username solo permite letras, números y guion bajo.');
                return;
            }
        }

        const isChangingUsername = normalizedUsername !== (profile?.username || '').toLowerCase();

        if (isChangingUsername && profile?.lastUsernameChangeAt) {
            const lastChange = new Date(profile.lastUsernameChangeAt);
            const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
            const diff = Date.now() - lastChange.getTime();

            if (diff < thirtyDaysInMs) {
                const nextChangeDate = new Date(lastChange.getTime() + thirtyDaysInMs);
                confirm.error(
                    'Espera un poco',
                    `Solo podés cambiar tu username una vez cada 30 días. Próximo cambio: ${nextChangeDate.toLocaleDateString()}`
                );
                return;
            }
        }

        setProfileSaving(true);
        try {
            await SocialService.updateProfile(
                normalizedDisplayName,
                normalizedUsername.length > 0 ? normalizedUsername : null,
                profileFormPublic ? 1 : 0
            );

            setProfile((prev) => prev ? ({
                ...prev,
                displayName: normalizedDisplayName,
                username: normalizedUsername.length > 0 ? normalizedUsername : null,
                isPublic: profileFormPublic ? 1 : 0,
                lastUsernameChangeAt: isChangingUsername ? new Date().toISOString() : prev.lastUsernameChangeAt
            }) : prev);

            setIsProfileModalVisible(false);
            confirm.success('Perfil actualizado', 'Tu perfil social se actualizó correctamente.');
            await loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        } finally {
            setProfileSaving(false);
        }
    };

    const handleInboxResponse = async (inboxId: string, action: 'accept' | 'reject', payload?: unknown) => {
        try {
            if (action === 'accept' && payload) {
                const parsedPayload = typeof payload === 'string'
                    ? JSON.parse(payload)
                    : payload;
                await routineService.importSharedRoutine(parsedPayload);
                confirm.success('Rutina importada', 'La rutina ha sido añadida a tu biblioteca local.');
            }
            setInbox(prev => prev.map(item => item.id === inboxId ? { ...item, seenAt: new Date().toISOString() } : item));
            await SocialService.respondInbox(inboxId, action);
            loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        }
    };

    const handleMarkAsSeen = async (id: string, feedType: 'direct_share' | 'activity_log') => {
        try {
            const success = await SocialService.markAsSeen(id, feedType);
            if (success) {
                setInbox(prev => prev.map(item => item.id === id ? { ...item, seenAt: new Date().toISOString() } : item));
            }
        } catch { }
    };

    const handleToggleKudo = async (feedId: string) => {
        // Optimistic UI update
        const prevInbox = [...inbox];
        setInbox(prev => prev.map(item => {
            if (item.id === feedId) {
                return {
                    ...item,
                    hasKudoed: !item.hasKudoed,
                    kudosCount: (item.kudosCount || 0) + (item.hasKudoed ? -1 : 1)
                };
            }
            return item;
        }));

        try {
            const action = await SocialService.toggleKudo(feedId);
            if (action === 'error') {
                setInbox(prevInbox);
            } else {
                setInbox(prev => prev.map(item => {
                    if (item.id !== feedId) return item;
                    const count = Math.max(0, item.kudosCount || 0);
                    const hasKudoed = action === 'added';
                    const nextCount = action === 'added' ? Math.max(1, count) : Math.max(0, count - 1);
                    return { ...item, hasKudoed, kudosCount: nextCount };
                }));
            }
        } catch {
            setInbox(prevInbox);
        }
    };

    const handleShowScoreInfo = () => {
        setIsScoreModalVisible(true);
    };

    const handleToggleTrainingDay = async (dayId: number) => {
        const isSelected = trainingDays.includes(dayId);
        const newDays = isSelected
            ? trainingDays.filter(d => d !== dayId)
            : [...trainingDays, dayId].sort((a, b) => a - b);

        setTrainingDays(newDays);
        await configService.set('training_days', newDays);
        await useSettingsStore.getState().setTrainingDays(newDays);
    };

    const handleExpandFriend = async (friendId: string) => {
        if (friendId === profile?.id) return;
        if (expandedFriendId === friendId) {
            setExpandedFriendId(null);
            return;
        }
        setExpandedFriendId(friendId);
        if (!comparisons[friendId]) {
            setLoadingCompare(true);
            try {
                const data = await SocialService.compareFriend(friendId);
                setComparisons(prev => ({ ...prev, [friendId]: data }));
            } catch {
                confirm.error('Error', 'No se pudo cargar la comparación de fuerza.');
            } finally {
                setLoadingCompare(false);
            }
        }
    };

    const handleOpenFriendModal = (friend: SocialFriend) => {
        setActiveFriend(friend);
    };

    const handleOpenFriendInRanking = async () => {
        if (!activeFriend) return;
        setActiveTab('leaderboard');
        setActiveFriend(null);
        await handleExpandFriend(activeFriend.friendId);
    };

    const closeFriendModal = () => {
        if (!friendActionLoading) {
            setActiveFriend(null);
        }
    };

    const executeFriendAction = async (action: 'accept' | 'reject' | 'remove' | 'block') => {
        if (!activeFriend) return;
        setFriendActionLoading(true);
        try {
            await SocialService.respondFriendRequest(activeFriend.id, action);
            setActiveFriend(null);
            await loadData();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Error desconocido';
            confirm.error('Error', msg);
        } finally {
            setFriendActionLoading(false);
        }
    };

    const handleFriendAction = async (action: 'accept' | 'reject' | 'remove' | 'block') => {
        if (action === 'remove') {
            confirm.ask(
                'Eliminar amistad',
                'Vas a eliminar a este amigo de tu lista. Podrás volver a enviar solicitud después.',
                () => {
                    confirm.hide();
                    executeFriendAction('remove');
                },
                'Eliminar'
            );
            return;
        }
        if (action === 'block') {
            confirm.ask(
                'Bloquear usuario',
                'Se bloqueará esta relación social. Esta acción impacta solicitudes y visibilidad entre ambos.',
                () => {
                    confirm.hide();
                    executeFriendAction('block');
                },
                'Bloquear'
            );
            return;
        }
        if (action === 'reject' && activeFriend?.isSender) {
            confirm.ask(
                'Cancelar solicitud',
                '¿Querés cancelar la solicitud enviada a este usuario?',
                () => {
                    confirm.hide();
                    executeFriendAction('reject');
                },
                'Cancelar solicitud'
            );
            return;
        }
        executeFriendAction(action);
    };

    const pendingInboxCount = inbox.filter(i => i.status === 'pending').length;

    // Sincronizar badge de la pestaña
    useEffect(() => {
        navigation.setOptions({
            tabBarBadge: pendingInboxCount > 0 ? pendingInboxCount : undefined
        });
    }, [pendingInboxCount, navigation]);

    if (!authState.token) {
        return (
            <SafeAreaWrapper style={styles.container} centered contentStyle={{ alignItems: 'center', justifyContent: 'center' }}>
                <View style={styles.loggedOutContainer}>
                    <View style={styles.loggedOutIcon}>
                        <Globe size={48} color={colors.textMuted} />
                    </View>
                    <Text style={styles.loggedOutTitle}>Conectate a IronSocial</Text>
                    <Text style={styles.loggedOutSub}>
                        Sincronizá tus rutinas, compartilas con amigos y descubrí la comunidad IronTrain.
                    </Text>
                    <TouchableOpacity style={styles.loginBtn} onPress={() => useAuthStore.getState().login()}>
                        <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.signupBtn} onPress={() => useAuthStore.getState().login()}>
                        <Text style={styles.signupBtnText}>Crear Cuenta</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaWrapper>
        );
    }

    return (
        <SafeAreaWrapper style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.title}>IronSocial</Text>
                    {loading && (
                        <View style={styles.headerLoadingWrapper}>
                            <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                        </View>
                    )}
                </View>
                <View style={styles.headerCenterIconWrapper}>
                    <IronTrainLogo size={60} />
                </View>
                <View style={styles.headerActionsBox}>
                    <TouchableOpacity style={styles.headerIconBtn} onPress={() => router.push('/settings' as any)}>
                        <Settings size={20} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.publicBtn} onPress={handleOpenPublicRoutines}>
                        <Globe size={16} color={colors.onPrimary} />
                        <Text style={styles.publicBtnText}>Públicas</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={styles.mainScrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            >
                {profile && (
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
                                            onPress={() => setIsEventModalVisible(true)}
                                            activeOpacity={0.7}
                                        >
                                            <Zap size={10} color={colors.text} fill={colors.text} />
                                            <Text style={styles.eventBadgeText}>Evento {profile.activeEvent.multiplier}x</Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={profile.weatherBonus?.isActive ? styles.weatherBadge : styles.locationBadge}
                                        onPress={() => refreshingLocation ? null : handleRefreshLocation(false)}
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
                                                        (profile.weatherBonus?.location || 'Activar ubicación')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {!isProfileExpanded && (
                                <View style={styles.metaSummaryRow}>
                                    <CalendarDays size={14} color={colors.primary.DEFAULT} />
                                    <Text style={styles.metaSummaryText}>Meta: {trainingDays.length} días</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {isProfileExpanded && (
                            <View style={styles.expandedDetails}>
                                <Text style={styles.profileStats}>Rutinas compartidas: {profile.shareStats || 0}</Text>
                                <View style={styles.profileMetaRow}>
                                    <View style={styles.profileVisibilityBadge}>
                                        {profile.isPublic === 0 ? <LockIcon size={14} color={colors.textMuted} /> : <Globe size={14} color={colors.primary.DEFAULT} />}
                                        <Text style={styles.profileVisibilityText}>{profile.isPublic === 0 ? 'Perfil Privado' : 'Perfil Público'}</Text>
                                    </View>
                                    <TouchableOpacity style={styles.profileEditBtn} onPress={openProfileModal}>
                                        <ShieldIcon size={14} color={colors.onPrimary} />
                                        <Text style={styles.profileEditBtnText}>Editar Perfil</Text>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity style={styles.idBox} onPress={handleCopyId}>
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
                                                        onPress={() => handleToggleTrainingDay(day.id)}
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
                )}

                <View style={styles.tabsMenuWrapper}>
                    <View style={styles.tabsMenu}>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'leaderboard' && styles.tabBtnActive]} onPress={() => setActiveTab('leaderboard')}>
                            <Text style={[styles.tabText, activeTab === 'leaderboard' && styles.tabTextActive]}>Ranking</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'friends' && styles.tabBtnActive]} onPress={() => setActiveTab('friends')}>
                            <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>Amigos</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'inbox' && styles.tabBtnActive]} onPress={() => setActiveTab('inbox')}>
                            <Text style={[styles.tabText, activeTab === 'inbox' && styles.tabTextActive]}>
                                Feed{pendingInboxCount > 0 ? ` (${pendingInboxCount})` : ''}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]} onPress={() => setActiveTab('search')}>
                            <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>Buscar</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.tabContent}>
                    {activeTab === 'leaderboard' && (
                        <View>
                            <View style={styles.rankingHeader}>
                                <View style={styles.rankingSegmentRow}>
                                    {(['weekly', 'monthly', 'lifetime'] as const).map((seg) => (
                                        <TouchableOpacity
                                            key={seg}
                                            style={[styles.segmentBtn, rankingSegment === seg && styles.segmentBtnActive]}
                                            onPress={() => setRankingSegment(seg)}
                                        >
                                            <Text style={[styles.segmentText, rankingSegment === seg && styles.segmentTextActive]}>
                                                {seg === 'weekly' ? 'Semanal' : seg === 'monthly' ? 'Mensual' : 'Histórico'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TouchableOpacity onPress={handleShowScoreInfo} style={styles.infoBtn}>
                                    <Info size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            {leaderboard.length === 0 ? (
                                <Text style={styles.emptyText}>Sin datos de ranking aún.</Text>
                            ) : (
                                [...leaderboard].sort((a, b) => b.scores[rankingSegment] - a.scores[rankingSegment]).map((user, i) => {
                                    const isExpanded = expandedFriendId === user.id;
                                    const comparisonData = comparisons[user.id] || [];

                                    return (
                                        <View key={user.id}>
                                            <TouchableOpacity
                                                style={[styles.friendRow, user.id === profile?.id && styles.highlightRow]}
                                                onPress={() => handleExpandFriend(user.id)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.rankRow}>
                                                    <Text style={[styles.rankNumber, { color: i === 0 ? colors.yellow : i === 1 ? colors.textMuted : i === 2 ? colors.primary.light : colors.textMuted }]}>
                                                        {i + 1}
                                                    </Text>
                                                    <View>
                                                        <Text style={styles.friendName}>{user.id === profile?.id ? 'Tú' : user.displayName}</Text>
                                                        <Text style={styles.friendStatus}>IronScore {user.scores[rankingSegment]}</Text>
                                                    </View>
                                                </View>
                                                {user.stats?.currentStreak >= 3 && (
                                                    <View style={styles.streakBadge}>
                                                        <Flame size={12} color={colors.red} fill={colors.red} style={{ marginRight: 4 }} />
                                                        <Text style={styles.streakText}>Racha: {user.stats.currentStreak}</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>

                                            {isExpanded && (
                                                <View style={styles.expandedComparisonBox}>
                                                    <View style={styles.compareHeader}>
                                                        <Scale size={18} color={colors.textMuted} />
                                                        <Text style={styles.compareTitle}>Comparación de Fuerza (1RM)</Text>
                                                    </View>
                                                    {loadingCompare ? (
                                                        <ActivityIndicator size="small" color={colors.primary.DEFAULT} style={{ marginVertical: 10 }} />
                                                    ) : comparisonData.length === 0 ? (
                                                        <Text style={styles.compareEmptyText}>No hay ejercicios comunes acá.</Text>
                                                    ) : (
                                                        comparisonData.map((comp, cidx) => {
                                                            const userWon = comp.user1RM > comp.friend1RM;
                                                            const friendWon = comp.friend1RM > comp.user1RM;
                                                            const diff = Math.abs(comp.user1RM - comp.friend1RM);

                                                            return (
                                                                <View key={cidx} style={styles.compareRow}>
                                                                    <View style={styles.compareRowHeader}>
                                                                        <Text style={styles.compareExerciseName}>{comp.exerciseName}</Text>
                                                                        {diff > 0 && (
                                                                            <Text style={[styles.compareDiff, { color: userWon ? colors.green : colors.red }]}>
                                                                                {userWon ? '+' : '-'}{diff.toFixed(1)}{comp.unit}
                                                                            </Text>
                                                                        )}
                                                                    </View>
                                                                    <View style={styles.compareBars}>
                                                                        <View style={[styles.compareBarContainer, { flex: 1 }]}>
                                                                            <View style={[styles.compareValueRow, userWon && styles.compareValueHighlightBox]}>
                                                                                <Text style={[styles.compareValue, userWon && styles.compareValueHighlight]}>{comp.user1RM}{comp.unit}</Text>
                                                                            </View>
                                                                            <Text style={styles.compareLabel}>Tú</Text>
                                                                        </View>
                                                                        <View style={[styles.compareBarContainer, { flex: 1 }]}>
                                                                            <View style={[styles.compareValueRow, friendWon && styles.compareValueHighlightBox]}>
                                                                                <Text style={[styles.compareValue, friendWon && styles.compareValueHighlight]}>{comp.friend1RM}{comp.unit}</Text>
                                                                            </View>
                                                                            <Text style={styles.compareLabel}>{user.displayName}</Text>
                                                                        </View>
                                                                    </View>
                                                                </View>
                                                            );
                                                        })
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </View>
                    )}

                    {activeTab === 'friends' && (
                        <View>
                            {friends.length === 0 ? (
                                <Text style={styles.emptyText}>No tienes amigos aún. Busca a alguien por su ID.</Text>
                            ) : (
                                friends.map((f) => (
                                    <TouchableOpacity key={f.id} style={styles.friendRow} onPress={() => handleOpenFriendModal(f)} activeOpacity={0.8}>
                                        <View>
                                            <Text style={styles.friendName}>{f.displayName}</Text>
                                            <Text style={styles.friendStatus}>
                                                {f.status === 'pending' ? (f.isSender ? 'Solicitud Enviada' : 'Te envió solicitud') : 'Amigo'}
                                            </Text>
                                        </View>
                                        {f.status === 'pending' && !f.isSender && (
                                            <View style={styles.actionsBox}>
                                                <TouchableOpacity style={styles.btnSmallAccept} onPress={() => handleFriendResponse(f.id, 'accept')}>
                                                    <Text style={styles.btnSmallText}>Aceptar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={styles.btnSmallReject} onPress={() => handleFriendResponse(f.id, 'reject')}>
                                                    <Text style={styles.btnSmallText}>Rechazar</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                        {f.status === 'accepted' && (
                                            <UserCheck size={20} color={colors.primary.DEFAULT} />
                                        )}
                                    </TouchableOpacity>
                                ))
                            )}
                        </View>
                    )}

                    {activeTab === 'inbox' && (
                        <View style={{ gap: 16 }}>
                            <View style={styles.inboxSecondaryHeader}>
                                <Text style={styles.inboxStatusTitle}>
                                    {showSeen ? 'Historial de Notificaciones' : 'Notificaciones Recientes'}
                                </Text>
                                <TouchableOpacity
                                    style={[styles.archiveToggle, showSeen && styles.archiveToggleActive]}
                                    onPress={() => setShowSeen(!showSeen)}
                                >
                                    {showSeen ? <Eye size={16} color={colors.onPrimary} /> : <EyeOff size={16} color={colors.textMuted} />}
                                    <Text style={[styles.archiveToggleText, showSeen && styles.archiveToggleTextActive]}>
                                        {showSeen ? 'Ver pendientes' : 'Ver archivadas'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {(inbox.filter(item => showSeen ? !!item.seenAt : !item.seenAt)).length === 0 ? (
                                <Text style={styles.emptyText}>
                                    {showSeen ? 'No tenés notificaciones archivadas.' : 'Todo al día por acá.'}
                                </Text>
                            ) : (
                                inbox
                                    .filter(item => showSeen ? !!item.seenAt : !item.seenAt)
                                    .map((item) => {
                                        if (item.feedType === 'direct_share' || !item.feedType) {
                                            return (
                                                <View key={getInboxKey(item)} style={styles.premiumCard}>
                                                    <View style={styles.premiumHeader}>
                                                        <View style={styles.premiumIconBox}>
                                                            <Dumbbell size={24} color={colors.onPrimary} />
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.premiumTitle}>Invitación a Entrenar</Text>
                                                            <Text style={styles.premiumSender}>de @{item.senderUsername || item.senderName}</Text>
                                                        </View>
                                                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                                            <Text style={styles.activityDate}>
                                                                {new Date(item.createdAt).toLocaleDateString()}
                                                            </Text>
                                                            {!item.seenAt && (
                                                                <TouchableOpacity
                                                                    style={styles.markSeenBtn}
                                                                    onPress={() => handleMarkAsSeen(item.id, 'direct_share')}
                                                                >
                                                                    <Eye size={16} color={colors.textMuted} />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    </View>

                                                    <View style={styles.premiumBody}>
                                                        <Text style={styles.premiumDescription}>
                                                            @{item.senderUsername || item.senderName} diseñó una rutina para vos. Sumala a tu biblioteca.
                                                        </Text>
                                                    </View>

                                                    {item.status === 'pending' ? (
                                                        <View style={styles.premiumActions}>
                                                            <TouchableOpacity style={styles.premiumBtnPrimary} onPress={() => handleInboxResponse(item.id, 'accept', item.payload)}>
                                                                <Text style={styles.premiumBtnTextPrimary}>Descargar & Importar</Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity style={styles.premiumBtnSecondary} onPress={() => handleInboxResponse(item.id, 'reject')}>
                                                                <Text style={styles.premiumBtnTextSecondary}>Ignorar</Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    ) : (
                                                        <View style={styles.premiumResolved}>
                                                            {item.status === 'accepted' ? (
                                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <CheckCircle size={16} color={colors.green} style={{ marginRight: 6 }} />
                                                                    <Text style={[styles.premiumStatusText, { color: colors.green }]}>Rutina Importada</Text>
                                                                </View>
                                                            ) : (
                                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                    <XCircle size={16} color={colors.red} style={{ marginRight: 6 }} />
                                                                    <Text style={[styles.premiumStatusText, { color: colors.red }]}>Rutina Rechazada</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    )}
                                                </View>
                                            );
                                        }

                                        if (item.feedType === 'activity_log') {
                                            const isPr = item.actionType === 'pr_broken';
                                            const isRoutineShared = item.actionType === 'routine_shared';
                                            const isOwnActivity = profile?.id && item.senderId === profile.id;

                                            return (
                                                <View key={getInboxKey(item)} style={styles.activityRow}>
                                                    <View style={styles.activityHeader}>
                                                        <View style={[styles.activityIconBox, isPr ? { backgroundColor: withAlpha(colors.yellow, '30') } : (isRoutineShared ? { backgroundColor: withAlpha(colors.primary.DEFAULT, '30') } : { backgroundColor: withAlpha(colors.primary.DEFAULT, '15') })]}>
                                                            {isPr ? <Trophy size={18} color={colors.yellow} /> : isRoutineShared ? <Globe size={18} color={colors.primary.DEFAULT} /> : <Dumbbell size={18} color={colors.primary.DEFAULT} />}
                                                        </View>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.activityUser}>@{item.senderUsername || item.senderName}</Text>
                                                            <Text style={styles.activityDesc}>
                                                                {isPr ? 'Rompió un Récord Personal' : isRoutineShared ? 'Compartió una rutina' : 'Completó un Entrenamiento'}
                                                            </Text>
                                                        </View>
                                                        <Text style={styles.activityDate}>
                                                            {new Date(item.createdAt).toLocaleDateString()}
                                                        </Text>
                                                    </View>

                                                    <View style={styles.activityFooter}>
                                                        <TouchableOpacity
                                                            style={[styles.kudoBtn, item.hasKudoed && styles.kudoBtnActive, isOwnActivity && styles.kudoBtnDisabled]}
                                                            onPress={() => !isOwnActivity && handleToggleKudo(item.id)}
                                                            disabled={!!isOwnActivity}
                                                        >
                                                            <Flame size={18} color={item.hasKudoed ? colors.yellow : colors.textMuted} fill={item.hasKudoed ? colors.yellow : "transparent"} />
                                                            <Text style={[styles.kudoText, item.hasKudoed && styles.kudoTextActive]}>
                                                                {item.kudosCount || 0} Kudos
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                            {isOwnActivity && <Text style={styles.ownActivityHint}>Tu actividad</Text>}
                                                            {!item.seenAt && (
                                                                <TouchableOpacity
                                                                    style={styles.markSeenBtn}
                                                                    onPress={() => handleMarkAsSeen(item.id, 'activity_log')}
                                                                >
                                                                    <Eye size={18} color={colors.textMuted} />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    </View>
                                                </View>
                                            );
                                        }
                                        return null;
                                    })
                            )}
                        </View>
                    )}

                    {activeTab === 'search' && (
                        <View>
                            <View style={styles.searchBox}>
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Buscar por ID o username..."
                                    placeholderTextColor={colors.textMuted}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="search"
                                    onSubmitEditing={handleSearch}
                                />
                                <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                                    <Text style={styles.searchBtnText}>Buscar</Text>
                                </TouchableOpacity>
                            </View>
                            {searchResults.length === 0 && searchQuery.trim().length > 0 && !loading && (
                                <Text style={styles.emptyText}>Sin resultados para "{searchQuery.trim()}"</Text>
                            )}
                            {searchResults.map((u) => (
                                <View key={u.id} style={styles.friendRow}>
                                    <View>
                                        <Text style={styles.friendName}>{u.displayName || 'Sin nombre'}</Text>
                                        {u.username && <Text style={styles.friendStatus}>@{u.username}</Text>}
                                    </View>
                                    <TouchableOpacity style={styles.btnSmallAccept} onPress={() => handleSendRequest(u.id)}>
                                        <Text style={styles.btnSmallText}>Agregar</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>

            <Modal visible={isProfileModalVisible} transparent animationType="fade" onRequestClose={() => setIsProfileModalVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setIsProfileModalVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
                        <Pressable style={styles.modalCard} onPress={() => { }}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Perfil Social</Text>
                                <TouchableOpacity onPress={() => setIsProfileModalVisible(false)} style={styles.modalCloseBtn}>
                                    <XIcon size={18} color={colors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalBody}>
                                <Text style={styles.modalLabel}>Nombre visible</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    value={profileFormDisplayName}
                                    onChangeText={setProfileFormDisplayName}
                                    maxLength={64}
                                    placeholder="Tu nombre visible"
                                    placeholderTextColor={colors.textMuted}
                                />
                                <Text style={styles.modalFieldHint}>
                                    Entre 2 y 64 caracteres. Evitá datos sensibles.
                                </Text>

                                <Text style={styles.modalLabel}>Username</Text>
                                <TextInput
                                    style={[
                                        styles.modalInput,
                                        profile?.lastUsernameChangeAt &&
                                        (Date.now() - new Date(profile.lastUsernameChangeAt).getTime() < 30 * 24 * 60 * 60 * 1000) &&
                                        { backgroundColor: colors.surface, color: colors.textMuted }
                                    ]}
                                    value={profileFormUsername}
                                    onChangeText={(value) => setProfileFormUsername(value.replace(/\s+/g, '').toLowerCase())}
                                    maxLength={32}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    placeholder="sin espacios"
                                    placeholderTextColor={colors.textMuted}
                                    editable={!profile?.lastUsernameChangeAt || (Date.now() - new Date(profile.lastUsernameChangeAt).getTime() >= 30 * 24 * 60 * 60 * 1000)}
                                />
                                {profile?.lastUsernameChangeAt && (Date.now() - new Date(profile.lastUsernameChangeAt).getTime() < 30 * 24 * 60 * 60 * 1000) ? (
                                    <Text style={[styles.modalFieldHint, { color: colors.primary.DEFAULT, fontWeight: '900' }]}>
                                        Bloqueado hasta: {new Date(new Date(profile.lastUsernameChangeAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                    </Text>
                                ) : (
                                    <Text style={styles.modalFieldHint}>
                                        Dejá vacío para quitar username. Permitido: a-z, 0-9 y _ (1 vez cada 30 días)
                                    </Text>
                                )}

                                <View style={styles.privacyRow}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.modalLabel}>Visibilidad del perfil</Text>
                                        <Text style={styles.privacyHint}>
                                            {profileFormPublic ? 'Público: apareces en búsqueda social.' : 'Privado: no apareces en búsqueda social.'}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={profileFormPublic}
                                        onValueChange={setProfileFormPublic}
                                        trackColor={{ false: colors.border, true: withAlpha(colors.primary.DEFAULT, '66') }}
                                        thumbColor={profileFormPublic ? colors.primary.DEFAULT : colors.textMuted}
                                    />
                                </View>
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsProfileModalVisible(false)}>
                                    <Text style={styles.modalCancelText}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleSaveProfile} disabled={profileSaving}>
                                    {profileSaving ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Text style={styles.modalPrimaryText}>Guardar</Text>}
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </KeyboardAvoidingView>
                </Pressable>
            </Modal>

            <Modal visible={!!activeFriend} transparent animationType="fade" onRequestClose={closeFriendModal}>
                <Pressable style={styles.modalOverlay} onPress={closeFriendModal}>
                    <Pressable style={styles.modalCard} onPress={() => { }}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{activeFriend?.displayName || 'Amigo'}</Text>
                            <TouchableOpacity onPress={closeFriendModal} style={styles.modalCloseBtn}>
                                <XIcon size={18} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            {activeFriend?.username && (
                                <Text style={styles.friendModalUsername}>@{activeFriend.username}</Text>
                            )}
                            <Text style={styles.friendModalStatus}>
                                {activeFriend?.status === 'pending'
                                    ? activeFriend.isSender
                                        ? 'Solicitud enviada'
                                        : 'Solicitud recibida'
                                    : activeFriend?.status === 'blocked'
                                        ? 'Bloqueado'
                                        : 'Amistad aceptada'}
                            </Text>
                            {activeFriend ? (
                                <View style={styles.friendInfoCard}>
                                    <Text style={styles.friendInfoLabel}>ID Social</Text>
                                    <TouchableOpacity style={styles.friendInfoCopyBtn} onPress={async () => {
                                        await Clipboard.setStringAsync(activeFriend.friendId);
                                        confirm.success('Copiado', 'ID del amigo copiado al portapapeles.');
                                    }}>
                                        <Text style={styles.friendInfoId} numberOfLines={1} ellipsizeMode="middle">{activeFriend.friendId}</Text>
                                        <Copy size={14} color={colors.textMuted} />
                                    </TouchableOpacity>
                                    {activeFriend.status === 'accepted' ? (
                                        <TouchableOpacity style={styles.friendInfoActionBtn} onPress={handleOpenFriendInRanking}>
                                            <Scale size={14} color={colors.onPrimary} />
                                            <Text style={styles.friendInfoActionText}>Ver comparación en ranking</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.modalActionsStack}>
                            {activeFriend?.status === 'pending' && !activeFriend?.isSender && (
                                <View style={styles.dualActionRow}>
                                    <TouchableOpacity style={styles.modalPrimaryBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('accept')}>
                                        <Text style={styles.modalPrimaryText}>Aceptar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalDangerBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('reject')}>
                                        <Text style={styles.modalDangerText}>Rechazar</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {activeFriend?.status === 'pending' && activeFriend?.isSender && (
                                <TouchableOpacity style={styles.modalSecondaryBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('reject')}>
                                    <XCircle size={14} color={colors.text} />
                                    <Text style={styles.modalSecondaryText}>Cancelar solicitud</Text>
                                </TouchableOpacity>
                            )}

                            {activeFriend?.status === 'accepted' && (
                                <View style={styles.dualActionRow}>
                                    <TouchableOpacity style={styles.modalSecondaryBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('remove')}>
                                        <UserMinusIcon size={14} color={colors.textMuted} />
                                        <Text style={styles.modalSecondaryText}>Eliminar amigo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.modalDangerBtn} disabled={friendActionLoading} onPress={() => handleFriendAction('block')}>
                                        <Text style={styles.modalDangerText}>Bloquear</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {friendActionLoading ? <ActivityIndicator size="small" color={colors.primary.DEFAULT} style={{ marginTop: 4 }} /> : null}
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Modal: IronScore System Info */}
            <Modal
                visible={isScoreModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsScoreModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsScoreModalVisible(false)} />
                    <View style={[styles.modalCard, { height: '80%', maxHeight: '85%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Award size={20} color={colors.primary.DEFAULT} />
                                <Text style={styles.modalTitle}>Sistema IronScore</Text>
                            </View>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsScoreModalVisible(false)}>
                                <XIcon size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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

                            <View style={styles.infoDivider} />

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

                            <View style={styles.infoDivider} />

                            <View style={styles.formulaBox}>
                                <Text style={styles.formulaTitle}>Fórmula de Puntos</Text>
                                <Text style={styles.formulaText}>
                                    Puntos = (Base + Bonos) × Multiplicador Racha × Evento Global
                                </Text>
                            </View>

                            <View style={styles.infoFooterBox}>
                                <Info size={14} color={colors.textMuted} />
                                <Text style={styles.infoFooterText}>
                                    El puntaje se calcula en tiempo real al finalizar cada entrenamiento. Los PRs se validan contra tu historial completo.
                                </Text>
                            </View>

                            <View style={{ height: 20 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal: Global Event Details */}
            <Modal
                visible={isEventModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsEventModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsEventModalVisible(false)} />
                    <View style={styles.detailModalCard}>
                        <View style={[styles.detailIconCircle, { borderColor: colors.yellow, backgroundColor: withAlpha(colors.yellow, '15') }]}>
                            <Zap size={32} color={colors.yellow} fill={colors.yellow} />
                        </View>
                        <View style={styles.activeEventBadge}>
                            <Zap size={10} color={colors.onPrimary} fill={colors.onPrimary} />
                            <Text style={styles.activeEventBadgeText}>Evento Global Activo</Text>
                        </View>
                        <Text style={styles.detailTitle}>{profile?.activeEvent?.title || 'Evento Especial'}</Text>
                        <Text style={styles.detailDesc}>¡Un multiplicador global está activo! Todas tus ganancias de IronScore se verán potenciadas automáticamente.</Text>

                        <View style={styles.detailInfoGrid}>
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Multiplicador</Text>
                                <Text style={[styles.detailInfoValue, { color: colors.yellow, fontSize: 18 }]}>x{profile?.activeEvent?.multiplier?.toFixed(1) || '1.0'}</Text>
                            </View>
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Estado</Text>
                                <Text style={[styles.detailInfoValue, { color: colors.green }]}>Activo Ahora</Text>
                            </View>
                            <View style={styles.detailInfoRow}>
                                <Text style={styles.detailInfoLabel}>Finaliza el</Text>
                                <Text style={styles.detailInfoValue}>
                                    {profile?.activeEvent ? new Date(profile.activeEvent.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : '--/--/--'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setIsEventModalVisible(false)}>
                            <Text style={styles.detailCloseText}>Entendido</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal: Weather Bonus Details */}
            <Modal
                visible={isWeatherModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsWeatherModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsWeatherModalVisible(false)} />
                    <View style={styles.detailModalCard}>
                        <View style={[
                            styles.detailIconCircle,
                            {
                                borderColor: profile?.weatherBonus?.isActive ? colors.primary.DEFAULT : colors.border,
                                backgroundColor: withAlpha(profile?.weatherBonus?.isActive ? colors.primary.DEFAULT : colors.border, '15')
                            }
                        ]}>
                            {profile?.weatherBonus?.isActive ? (
                                <CloudRain size={32} color={colors.primary.DEFAULT} />
                            ) : (
                                <MapPin size={32} color={colors.textMuted} />
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <Text style={styles.detailTitle}>
                                {profile?.weatherBonus?.isActive ? 'Voluntad de Hierro' : 'Ubicación y Clima'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.refreshBadgeBtn}
                            onPress={() => handleRefreshLocation()}
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
                                : 'El sistema detecta tu ubicación para validar bonus por clima adverso. Podrás obtener +15 pts extra si entrenas bajo lluvia, nieve o frío extremo.'}
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
                                <Text style={[
                                    styles.detailInfoValue,
                                    { color: profile?.weatherBonus?.isActive ? colors.primary.DEFAULT : colors.textMuted }
                                ]}>
                                    {profile?.weatherBonus?.isActive ? '+15 pts' : 'Inactivo'}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setIsWeatherModalVisible(false)}>
                            <Text style={styles.detailCloseText}>
                                {profile?.weatherBonus?.isActive ? '¡A darle!' : 'Entendido'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >
        </SafeAreaWrapper >
    );
}
