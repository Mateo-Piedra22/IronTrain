import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { EditorMode } from './types';

type ThemeStudioPreviewModalProps = {
    visible: boolean;
    onClose: () => void;
    colors: any;
    lightColors: any;
    darkColors: any;
    initialMode: EditorMode;
};

export function ThemeStudioPreviewModal({
    visible,
    onClose,
    colors,
    lightColors,
    darkColors,
    initialMode,
}: ThemeStudioPreviewModalProps) {
    const [previewMode, setPreviewMode] = useState<EditorMode>(initialMode);

    useEffect(() => {
        if (visible) setPreviewMode(initialMode);
    }, [visible, initialMode]);

    const draftColors = useMemo(() => (previewMode === 'light' ? lightColors : darkColors), [previewMode, lightColors, darkColors]);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    justifyContent: 'flex-end',
                }}
            >
                <View
                    style={{
                        maxHeight: '88%',
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        borderWidth: 1.5,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                        padding: 12,
                        gap: 10,
                    }}
                >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '900' }}>Vista previa por pestañas</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                                Previsualización en tiempo real del tema {previewMode === 'light' ? 'claro' : 'oscuro'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={{
                                borderRadius: 10,
                                borderWidth: 1.5,
                                borderColor: colors.border,
                                backgroundColor: colors.surfaceLighter,
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                            }}
                            onPress={onClose}
                            activeOpacity={0.85}
                        >
                            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 11 }}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                            style={{
                                flex: 1,
                                borderRadius: 10,
                                borderWidth: 1.5,
                                borderColor: previewMode === 'light' ? colors.primary.DEFAULT : colors.border,
                                backgroundColor: previewMode === 'light' ? colors.surfaceLighter : colors.surface,
                                paddingVertical: 8,
                                alignItems: 'center',
                            }}
                            onPress={() => setPreviewMode('light')}
                            activeOpacity={0.85}
                        >
                            <Text style={{ color: previewMode === 'light' ? colors.primary.DEFAULT : colors.textMuted, fontWeight: '900', fontSize: 11 }}>
                                Claro
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{
                                flex: 1,
                                borderRadius: 10,
                                borderWidth: 1.5,
                                borderColor: previewMode === 'dark' ? colors.primary.DEFAULT : colors.border,
                                backgroundColor: previewMode === 'dark' ? colors.surfaceLighter : colors.surface,
                                paddingVertical: 8,
                                alignItems: 'center',
                            }}
                            onPress={() => setPreviewMode('dark')}
                            activeOpacity={0.85}
                        >
                            <Text style={{ color: previewMode === 'dark' ? colors.primary.DEFAULT : colors.textMuted, fontWeight: '900', fontSize: 11 }}>
                                Oscuro
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 10 }}>
                        {[
                            {
                                id: 'home',
                                title: 'Inicio',
                                body: (
                                    <>
                                        <Text style={{ color: draftColors.text, fontWeight: '900', fontSize: 12 }}>Resumen semanal</Text>
                                        <Text style={{ color: draftColors.primary.DEFAULT, fontWeight: '900', fontSize: 18 }}>42,800 kg</Text>
                                        <Text style={{ color: draftColors.textMuted, fontSize: 10 }}>+6.2% vs semana anterior</Text>
                                    </>
                                ),
                            },
                            {
                                id: 'workout',
                                title: 'Workout',
                                body: (
                                    <>
                                        <View
                                            style={{
                                                borderRadius: 999,
                                                alignSelf: 'flex-start',
                                                borderWidth: 1,
                                                borderColor: draftColors.primary.dark,
                                                backgroundColor: draftColors.primary.DEFAULT,
                                                paddingHorizontal: 12,
                                                paddingVertical: 5,
                                            }}
                                        >
                                            <Text style={{ color: draftColors.onPrimary, fontSize: 10, fontWeight: '900' }}>Iniciar sesión</Text>
                                        </View>
                                        <Text style={{ color: draftColors.text, fontSize: 11, fontWeight: '700', marginTop: 4 }}>Press banca · 4x8</Text>
                                        <Text style={{ color: draftColors.textMuted, fontSize: 10 }}>Descanso activo 90s</Text>
                                    </>
                                ),
                            },
                            {
                                id: 'exercises',
                                title: 'Ejercicios',
                                body: (
                                    <>
                                        <View style={{ gap: 5 }}>
                                            <View style={{ borderRadius: 8, backgroundColor: draftColors.surfaceLighter, padding: 7 }}>
                                                <Text style={{ color: draftColors.text, fontSize: 11, fontWeight: '800' }}>Sentadilla trasera</Text>
                                                <Text style={{ color: draftColors.textMuted, fontSize: 9 }}>Piernas · Intermedio</Text>
                                            </View>
                                            <View style={{ borderRadius: 8, backgroundColor: draftColors.surfaceLighter, padding: 7 }}>
                                                <Text style={{ color: draftColors.text, fontSize: 11, fontWeight: '800' }}>Peso muerto rumano</Text>
                                                <Text style={{ color: draftColors.textMuted, fontSize: 9 }}>Posterior · Intermedio</Text>
                                            </View>
                                        </View>
                                    </>
                                ),
                            },
                            {
                                id: 'social',
                                title: 'Social',
                                body: (
                                    <>
                                        <Text style={{ color: draftColors.text, fontSize: 11, fontWeight: '800' }}>@ironmate compartió una rutina</Text>
                                        <Text style={{ color: draftColors.textMuted, fontSize: 10 }}>“Upper potencia - 40 min”</Text>
                                        <Text style={{ color: draftColors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>Ver publicación</Text>
                                    </>
                                ),
                            },
                            {
                                id: 'settings',
                                title: 'Ajustes',
                                body: (
                                    <>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ color: draftColors.text, fontSize: 11, fontWeight: '800' }}>Notificaciones</Text>
                                            <View
                                                style={{
                                                    width: 36,
                                                    height: 20,
                                                    borderRadius: 999,
                                                    backgroundColor: draftColors.primary.DEFAULT,
                                                    borderWidth: 1,
                                                    borderColor: draftColors.primary.dark,
                                                    alignItems: 'flex-end',
                                                    justifyContent: 'center',
                                                    paddingHorizontal: 2,
                                                }}
                                            >
                                                <View style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: draftColors.onPrimary }} />
                                            </View>
                                        </View>
                                        <Text style={{ color: draftColors.textMuted, fontSize: 10 }}>Perfil · Privacidad · Sincronización</Text>
                                    </>
                                ),
                            },
                        ].map((section) => (
                            <View
                                key={section.id}
                                style={{
                                    borderRadius: 12,
                                    borderWidth: 1.5,
                                    borderColor: draftColors.border,
                                    backgroundColor: draftColors.background,
                                    padding: 9,
                                    gap: 7,
                                }}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ color: draftColors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>
                                        {section.title}
                                    </Text>
                                    <View
                                        style={{
                                            borderRadius: 999,
                                            borderWidth: 1,
                                            borderColor: draftColors.border,
                                            backgroundColor: draftColors.surface,
                                            paddingHorizontal: 7,
                                            paddingVertical: 2,
                                        }}
                                    >
                                        <Text style={{ color: draftColors.textMuted, fontSize: 9, fontWeight: '800' }}>
                                            {previewMode === 'light' ? 'Claro' : 'Oscuro'}
                                        </Text>
                                    </View>
                                </View>

                                <View
                                    style={{
                                        borderRadius: 10,
                                        borderWidth: 1.5,
                                        borderColor: draftColors.border,
                                        backgroundColor: draftColors.surface,
                                        padding: 9,
                                        gap: 5,
                                    }}
                                >
                                    {section.body}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}
