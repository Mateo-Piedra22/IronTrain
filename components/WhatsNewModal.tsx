import { ChangelogRelease } from '@/src/services/ChangelogService';
import { ThemeFx, withAlpha } from '@/src/theme';
import { ChevronRight, Zap } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useColors } from '../src/hooks/useColors';

interface Props {
    isVisible: boolean;
    release: ChangelogRelease;
    onClose: () => void;
}

export const WhatsNewModal: React.FC<Props> = ({ isVisible, release, onClose }) => {
    const colors = useColors();
    const items = Array.isArray(release?.items) ? release.items : [];

    const ss = useMemo(() => StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            backgroundColor: withAlpha(colors.black, '80'),
        },
        backdropPressable: {
            ...StyleSheet.absoluteFillObject,
        },
        container: {
            width: '100%',
            maxWidth: 420,
            maxHeight: '85%',
            backgroundColor: colors.surface,
            borderRadius: 28,
            borderWidth: 1.5,
            borderColor: colors.border,
            padding: 24,
            ...ThemeFx.shadowLg,
            overflow: 'hidden',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
            marginBottom: 24,
        },
        iconCircle: {
            width: 52,
            height: 52,
            borderRadius: 16,
            backgroundColor: colors.surfaceLighter,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: withAlpha(colors.primary.DEFAULT, '25'),
        },
        headerText: {
            flex: 1,
        },
        title: {
            color: colors.text,
            fontSize: 22,
            fontWeight: '900',
            letterSpacing: -0.6,
        },
        subtitle: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '900',
            marginTop: 2,
            textTransform: 'uppercase',
            letterSpacing: 1.5,
        },
        contentPanel: {
            flexGrow: 1,
            flexShrink: 1,
            backgroundColor: colors.surfaceLighter,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            marginBottom: 28,
            overflow: 'hidden',
        },
        contentContainer: {
            padding: 16,
        },
        itemsList: {
            gap: 14,
        },
        itemRow: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 12,
        },
        bullet: {
            marginTop: 4,
            width: 24,
            height: 24,
            borderRadius: 8,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
            justifyContent: 'center',
            alignItems: 'center',
        },
        itemText: {
            flex: 1,
            color: colors.text,
            fontSize: 15,
            lineHeight: 22,
            fontWeight: '600',
        },
        richBold: {
            fontWeight: '900',
            color: colors.primary.DEFAULT,
        },
        emptyText: {
            color: colors.textMuted,
            fontSize: 14,
            lineHeight: 20,
            fontWeight: '600',
            textAlign: 'center',
            paddingVertical: 24,
        },
        button: {
            backgroundColor: colors.primary.DEFAULT,
            borderRadius: 16,
            height: 56,
            alignItems: 'center',
            justifyContent: 'center',
            ...ThemeFx.shadowSm,
        },
        buttonText: {
            color: colors.onPrimary,
            fontSize: 15,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 1,
        }
    }), [colors]);


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
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={ss.overlay}>
                <Pressable style={ss.backdropPressable} onPress={onClose} />
                <Animated.View entering={FadeIn} exiting={FadeOut} style={ss.container}>
                    <View style={ss.header}>
                        <View style={ss.iconCircle}>
                            <Zap size={24} color={colors.primary.DEFAULT} fill={colors.primary.DEFAULT} />
                        </View>
                        <View style={ss.headerText}>
                            <Text style={ss.title}>Versión {release.version}</Text>
                            <Text style={ss.subtitle}>Novedades importantes</Text>
                        </View>
                    </View>

                    <View style={ss.contentPanel}>
                        <ScrollView
                            contentContainerStyle={ss.contentContainer}
                            showsVerticalScrollIndicator={true}
                        >
                            <View style={ss.itemsList}>
                                {items.length === 0 ? (
                                    <Text style={ss.emptyText}>No hay novedades para mostrar en esta versión.</Text>
                                ) : (
                                    items.map((item, idx) => (
                                        <View key={idx} style={ss.itemRow}>
                                            <View style={ss.bullet}>
                                                <ChevronRight size={12} color={colors.primary.DEFAULT} />
                                            </View>
                                            <Text style={ss.itemText}>{renderRichText(item)}</Text>
                                        </View>
                                    ))
                                )}
                            </View>
                        </ScrollView>
                    </View>

                    <TouchableOpacity
                        style={ss.button}
                        onPress={onClose}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Cerrar modal de novedades"
                    >
                        <Text style={ss.buttonText}>¡ENTENDIDO!</Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
};
