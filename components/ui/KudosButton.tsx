import { Heart } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useColors } from '../../src/hooks/useColors';
import { BroadcastEngagementService } from '../../src/services/BroadcastEngagementService';
import { ThemeFx } from '../../src/theme';
import { logger } from '../../src/utils/logger';
import { notify } from '../../src/utils/notify';

interface KudosButtonProps {
    id: string;
    kind: 'announcement' | 'changelog';
    initialCount: number;
    initialReacted: boolean;
    onUpdated: (reacted: boolean, count: number) => void;
}

export const KudosButton: React.FC<KudosButtonProps> = ({
    id,
    kind,
    initialCount,
    initialReacted,
    onUpdated,
}) => {
    const colors = useColors();
    const [isLoading, setIsLoading] = useState(false);

    const ss = useMemo(() => StyleSheet.create({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        containerReacted: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
            ...ThemeFx.shadowMd,
            shadowColor: colors.primary.DEFAULT,
        },
        count: {
            fontSize: 14,
            fontWeight: '900',
            color: colors.textMuted,
            letterSpacing: -0.2,
        },
        countReacted: {
            color: colors.onPrimary,
        },
    }), [colors]);

    const handlePress = async () => {
        if (isLoading) return;

        // Save original state for possible revert
        const originalReacted = initialReacted;
        const originalCount = initialCount;

        // Optimistic UI Update
        const targetReacted = !originalReacted;
        const targetCount = targetReacted ? originalCount + 1 : Math.max(0, originalCount - 1);
        onUpdated(targetReacted, targetCount);

        setIsLoading(true);
        try {
            const action = kind === 'announcement'
                ? await BroadcastEngagementService.toggleAnnouncementReaction(id)
                : await BroadcastEngagementService.toggleChangelogReaction(id);

            if (action === 'error') {
                // Revert on error
                onUpdated(originalReacted, originalCount);
                notify.error('Sincronización', 'Hubo un problema al guardar tu kudo. Reintentando...');
            } else {
                // Ensure UI state matches server's reported action
                const confirmedReacted = action === 'added';
                if (confirmedReacted !== targetReacted) {
                    const confirmedCount = confirmedReacted ? originalCount + 1 : Math.max(0, originalCount - 1);
                    onUpdated(confirmedReacted, confirmedCount);
                }
            }
        } catch (error) {
            // Revert on exception
            onUpdated(originalReacted, originalCount);
            logger.captureException(error, { scope: 'KudosButton.handlePress', message: 'Failed to toggle reaction' });
            notify.error('Error', 'No se pudo conectar con el servidor.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            disabled={isLoading}
            style={[
                ss.container,
                initialReacted && ss.containerReacted
            ]}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color={initialReacted ? colors.onPrimary : colors.primary.DEFAULT} />
            ) : (
                <Heart
                    size={16}
                    color={initialReacted ? colors.onPrimary : colors.textMuted}
                    fill={initialReacted ? colors.onPrimary : 'transparent'}
                />
            )}
            <Text style={[
                ss.count,
                initialReacted && ss.countReacted
            ]}>
                {initialCount}
            </Text>
        </TouchableOpacity>
    );
};

