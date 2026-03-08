import { Heart } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { BroadcastEngagementService } from '../../src/services/BroadcastEngagementService';
import { Colors } from '../../src/theme';

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
    const [isLoading, setIsLoading] = useState(false);

    const handlePress = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            const action = kind === 'announcement'
                ? await BroadcastEngagementService.toggleAnnouncementReaction(id)
                : await BroadcastEngagementService.toggleChangelogReaction(id);

            if (action !== 'error') {
                const newReacted = action === 'added';
                const newCount = newReacted ? initialCount + 1 : Math.max(0, initialCount - 1);
                onUpdated(newReacted, newCount);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={isLoading}
            style={[
                ss.container,
                initialReacted && ss.containerReacted
            ]}
        >
            {isLoading ? (
                <ActivityIndicator size="small" color={initialReacted ? Colors.white : Colors.primary.DEFAULT} />
            ) : (
                <Heart
                    size={16}
                    color={initialReacted ? Colors.white : Colors.iron[500]}
                    fill={initialReacted ? Colors.white : 'transparent'}
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

const ss = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: Colors.iron[100],
        borderWidth: 1,
        borderColor: Colors.iron[200],
    },
    containerReacted: {
        backgroundColor: Colors.primary.DEFAULT,
        borderColor: Colors.primary.DEFAULT,
    },
    count: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.iron[600],
    },
    countReacted: {
        color: Colors.white,
    },
});
