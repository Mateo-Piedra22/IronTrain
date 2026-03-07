import { ChangelogRelease } from '@/src/services/ChangelogService';
import { Colors, ThemeFx, withAlpha } from '@/src/theme';
import { ChevronRight, X, Zap } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface Props {
    isVisible: boolean;
    release: ChangelogRelease;
    onClose: () => void;
}

export const WhatsNewModal: React.FC<Props> = ({ isVisible, release, onClose }) => {
    const items = Array.isArray(release?.items) ? release.items : [];

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
        >
            <View style={ss.overlay}>
                <Pressable style={ss.backdropPressable} onPress={onClose} />
                <Animated.View entering={FadeIn} exiting={FadeOut} style={ss.container}>
                        <View style={ss.header}>
                            <View style={ss.iconCircle}>
                                <Zap size={24} color={Colors.primary.DEFAULT} fill={Colors.primary.DEFAULT} />
                            </View>
                            <View style={ss.headerText}>
                                <Text style={ss.title}>Versión {release.version}</Text>
                                <Text style={ss.subtitle}>Novedades importantes</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={ss.closeBtn} accessibilityRole="button" accessibilityLabel="Cerrar novedades">
                                <X size={20} color={Colors.iron[500]} />
                            </TouchableOpacity>
                        </View>

                        <View style={ss.contentPanel}>
                            <ScrollView
                                style={ss.content}
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
                                                    <ChevronRight size={14} color={Colors.primary.DEFAULT} />
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

const ss = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    backdropPressable: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: ThemeFx.backdrop,
    },
    container: {
        width: '100%',
        maxWidth: 520,
        minWidth: 320,
        minHeight: 360,
        maxHeight: '92%',
        backgroundColor: Colors.surface,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        padding: 24,
        elevation: 8,
        shadowColor: ThemeFx.shadowColor,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: ThemeFx.shadowOpacityStrong,
        shadowRadius: 24,
        justifyContent: 'flex-start',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    iconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: withAlpha(Colors.primary.DEFAULT, '14'),
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        color: Colors.iron[950],
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    subtitle: {
        color: Colors.iron[500],
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    closeBtn: {
        padding: 8,
    },
    content: {
        flex: 1,
    },
    contentPanel: {
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 180,
        maxHeight: 520,
        marginBottom: 20,
        backgroundColor: withAlpha(Colors.iron[50], 'CC'),
        borderRadius: 12,
        padding: 4,
        overflow: 'hidden',
    },
    contentContainer: {
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    itemsList: {
        gap: 10,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    bullet: {
        marginTop: 4,
        marginRight: 8,
    },
    itemText: {
        flex: 1,
        color: Colors.iron[950],
        fontSize: 15,
        lineHeight: 24,
        fontWeight: '500',
    },
    richBold: {
        fontWeight: '900',
        color: Colors.iron[950],
    },
    emptyText: {
        color: Colors.iron[600],
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
        paddingVertical: 8,
    },
    button: {
        backgroundColor: Colors.primary.DEFAULT,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
    },
    buttonText: {
        color: Colors.white,
        fontSize: 16,
        fontWeight: '700',
    }
});
