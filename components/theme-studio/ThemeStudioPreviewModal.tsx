import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { contrastRatio } from './helpers';
import { EditableColorFieldKey, EditableColorFields, EditorMode } from './types';

type HeatmapSeverity = 'blocker' | 'warning' | 'info';

type ThemeStudioPreviewModalProps = {
    visible: boolean;
    onClose: () => void;
    colors: any;
    lightColors: any;
    darkColors: any;
    lightResolvedFields: EditableColorFields;
    darkResolvedFields: EditableColorFields;
    initialMode: EditorMode;
    onJumpToColorField?: (field: EditableColorFieldKey, mode: EditorMode) => void;
    onAutoFixColorField?: (field: EditableColorFieldKey, mode: EditorMode) => void;
};

export function ThemeStudioPreviewModal({
    visible,
    onClose,
    colors,
    lightColors,
    darkColors,
    lightResolvedFields,
    darkResolvedFields,
    initialMode,
    onJumpToColorField,
    onAutoFixColorField,
}: ThemeStudioPreviewModalProps) {
    const [previewMode, setPreviewMode] = useState<EditorMode>(initialMode);

    useEffect(() => {
        if (visible) setPreviewMode(initialMode);
    }, [visible, initialMode]);

    const draftColors = useMemo(() => (previewMode === 'light' ? lightColors : darkColors), [previewMode, lightColors, darkColors]);
    const draftResolvedFields = useMemo(
        () => (previewMode === 'light' ? lightResolvedFields : darkResolvedFields),
        [previewMode, lightResolvedFields, darkResolvedFields],
    );

    const resolvedPreviewColors = useMemo(
        () => ({
            ...draftColors,
            primary: {
                DEFAULT: draftResolvedFields.primaryDefault,
                light: draftResolvedFields.primaryLight,
                dark: draftResolvedFields.primaryDark,
            },
            onPrimary: draftResolvedFields.onPrimary,
            background: draftResolvedFields.background,
            surface: draftResolvedFields.surface,
            surfaceLighter: draftResolvedFields.surfaceLighter,
            text: draftResolvedFields.text,
            textMuted: draftResolvedFields.textMuted,
            border: draftResolvedFields.border,
        }),
        [draftColors, draftResolvedFields],
    );

    const contrastRows = useMemo(
        () => [
            {
                id: 'text-on-background',
                label: 'Texto principal / Fondo',
                ratio: contrastRatio(draftResolvedFields.text, draftResolvedFields.background),
                min: 4.5,
                focusField: 'text' as EditableColorFieldKey,
                severity: 'blocker' as HeatmapSeverity,
            },
            {
                id: 'text-on-surface',
                label: 'Texto principal / Superficie',
                ratio: contrastRatio(draftResolvedFields.text, draftResolvedFields.surface),
                min: 4.5,
                focusField: 'text' as EditableColorFieldKey,
                severity: 'blocker' as HeatmapSeverity,
            },
            {
                id: 'text-on-surface-lighter',
                label: 'Texto principal / Superficie secundaria',
                ratio: contrastRatio(draftResolvedFields.text, draftResolvedFields.surfaceLighter),
                min: 4.5,
                focusField: 'text' as EditableColorFieldKey,
                severity: 'blocker' as HeatmapSeverity,
            },
            {
                id: 'onprimary-on-primary',
                label: 'Texto en botón / Primario',
                ratio: contrastRatio(draftResolvedFields.onPrimary, draftResolvedFields.primaryDefault),
                min: 4.5,
                focusField: 'onPrimary' as EditableColorFieldKey,
                severity: 'blocker' as HeatmapSeverity,
            },
            {
                id: 'muted-on-background',
                label: 'Texto secundario / Fondo',
                ratio: contrastRatio(draftResolvedFields.textMuted, draftResolvedFields.background),
                min: 3,
                focusField: 'textMuted' as EditableColorFieldKey,
                severity: 'warning' as HeatmapSeverity,
            },
            {
                id: 'muted-on-surface',
                label: 'Texto secundario / Superficie',
                ratio: contrastRatio(draftResolvedFields.textMuted, draftResolvedFields.surface),
                min: 3,
                focusField: 'textMuted' as EditableColorFieldKey,
                severity: 'warning' as HeatmapSeverity,
            },
            {
                id: 'primary-on-background',
                label: 'Primario / Fondo',
                ratio: contrastRatio(draftResolvedFields.primaryDefault, draftResolvedFields.background),
                min: 3,
                focusField: 'primaryDefault' as EditableColorFieldKey,
                severity: 'warning' as HeatmapSeverity,
            },
            {
                id: 'primary-light-on-background',
                label: 'Primario claro / Fondo',
                ratio: contrastRatio(draftResolvedFields.primaryLight, draftResolvedFields.background),
                min: 3,
                focusField: 'primaryLight' as EditableColorFieldKey,
                severity: 'info' as HeatmapSeverity,
            },
            {
                id: 'primary-dark-on-background',
                label: 'Primario oscuro / Fondo',
                ratio: contrastRatio(draftResolvedFields.primaryDark, draftResolvedFields.background),
                min: 3,
                focusField: 'primaryDark' as EditableColorFieldKey,
                severity: 'info' as HeatmapSeverity,
            },
            {
                id: 'border-on-surface',
                label: 'Borde / Superficie',
                ratio: contrastRatio(draftResolvedFields.border, draftResolvedFields.surface),
                min: 1.5,
                focusField: 'border' as EditableColorFieldKey,
                severity: 'info' as HeatmapSeverity,
            },
        ],
        [draftResolvedFields],
    );

    const contrastSummary = useMemo(() => {
        const failed = contrastRows.filter((row) => row.ratio < row.min).length;
        const passed = contrastRows.length - failed;
        return { failed, passed, total: contrastRows.length };
    }, [contrastRows]);

    const orderedContrastRows = useMemo(() => {
        const severityWeight = (severity: HeatmapSeverity) => {
            if (severity === 'blocker') return 3;
            if (severity === 'warning') return 2;
            return 1;
        };

        return [...contrastRows].sort((left, right) => {
            const leftFailed = left.ratio < left.min;
            const rightFailed = right.ratio < right.min;

            if (leftFailed !== rightFailed) {
                return leftFailed ? -1 : 1;
            }

            if (leftFailed && rightFailed) {
                const severityDiff = severityWeight(right.severity) - severityWeight(left.severity);
                if (severityDiff !== 0) return severityDiff;
            }

            if (leftFailed && rightFailed) {
                const leftDeficit = left.min - left.ratio;
                const rightDeficit = right.min - right.ratio;
                if (leftDeficit !== rightDeficit) {
                    return rightDeficit - leftDeficit;
                }
            }

            return left.label.localeCompare(right.label);
        });
    }, [contrastRows]);

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
                        <View
                            style={{
                                borderRadius: 12,
                                borderWidth: 1.5,
                                borderColor: resolvedPreviewColors.border,
                                backgroundColor: resolvedPreviewColors.background,
                                padding: 9,
                                gap: 7,
                            }}
                        >
                            <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>
                                Palette tokens completos
                            </Text>
                            {([
                                { key: 'primary', label: 'Primary', color: resolvedPreviewColors.primary.DEFAULT },
                                { key: 'primary-light', label: 'Primary Light', color: resolvedPreviewColors.primary.light },
                                { key: 'primary-dark', label: 'Primary Dark', color: resolvedPreviewColors.primary.dark },
                                { key: 'on-primary', label: 'On Primary', color: resolvedPreviewColors.onPrimary },
                                { key: 'background', label: 'Background', color: resolvedPreviewColors.background },
                                { key: 'surface', label: 'Surface', color: resolvedPreviewColors.surface },
                                { key: 'surface-lighter', label: 'Surface Lighter', color: resolvedPreviewColors.surfaceLighter },
                                { key: 'text', label: 'Text', color: resolvedPreviewColors.text },
                                { key: 'text-muted', label: 'Text Muted', color: resolvedPreviewColors.textMuted },
                                { key: 'border', label: 'Border', color: resolvedPreviewColors.border },
                            ] as const).map((token) => (
                                <View key={token.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View
                                            style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: 5,
                                                borderWidth: 1,
                                                borderColor: resolvedPreviewColors.border,
                                                backgroundColor: token.color,
                                            }}
                                        />
                                        <Text style={{ color: resolvedPreviewColors.text, fontSize: 10, fontWeight: '800' }}>{token.label}</Text>
                                    </View>
                                    <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9, fontWeight: '700' }}>{token.color}</Text>
                                </View>
                            ))}
                        </View>

                        <View
                            style={{
                                borderRadius: 12,
                                borderWidth: 1.5,
                                borderColor: resolvedPreviewColors.border,
                                backgroundColor: resolvedPreviewColors.background,
                                padding: 9,
                                gap: 7,
                            }}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>
                                    Contraste heatmap
                                </Text>
                                <Text style={{ color: contrastSummary.failed > 0 ? resolvedPreviewColors.text : resolvedPreviewColors.primary.DEFAULT, fontSize: 9, fontWeight: '900' }}>
                                    {contrastSummary.passed}/{contrastSummary.total} aprobados
                                </Text>
                            </View>
                            <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9, fontWeight: '700' }}>
                                Modo actual: {previewMode === 'light' ? 'Claro' : 'Oscuro'}. Los hallazgos pueden cambiar entre modos.
                            </Text>
                            {orderedContrastRows.map((row) => {
                                const ok = row.ratio >= row.min;
                                const isCritical = !ok && row.severity === 'blocker';
                                const isWarning = !ok && row.severity === 'warning';
                                const isInfo = !ok && row.severity === 'info';
                                return (
                                    <View
                                        key={row.id}
                                        style={{
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            borderColor: resolvedPreviewColors.border,
                                            backgroundColor: resolvedPreviewColors.surface,
                                            paddingHorizontal: 8,
                                            paddingVertical: 6,
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={{ color: resolvedPreviewColors.text, fontSize: 10, fontWeight: '800' }}>{row.label}</Text>
                                            {isCritical ? (
                                                <View
                                                    style={{
                                                        borderRadius: 999,
                                                        borderWidth: 1,
                                                        borderColor: resolvedPreviewColors.primary.dark,
                                                        backgroundColor: resolvedPreviewColors.primary.DEFAULT,
                                                        paddingHorizontal: 6,
                                                        paddingVertical: 2,
                                                    }}
                                                >
                                                    <Text style={{ color: resolvedPreviewColors.onPrimary, fontSize: 8, fontWeight: '900' }}>CRÍTICO</Text>
                                                </View>
                                            ) : null}
                                            {isWarning ? (
                                                <View
                                                    style={{
                                                        borderRadius: 999,
                                                        borderWidth: 1,
                                                        borderColor: resolvedPreviewColors.border,
                                                        backgroundColor: resolvedPreviewColors.surfaceLighter,
                                                        paddingHorizontal: 6,
                                                        paddingVertical: 2,
                                                    }}
                                                >
                                                    <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 8, fontWeight: '900' }}>ADVERTENCIA</Text>
                                                </View>
                                            ) : null}
                                            {isInfo ? (
                                                <View
                                                    style={{
                                                        borderRadius: 999,
                                                        borderWidth: 1,
                                                        borderColor: resolvedPreviewColors.border,
                                                        backgroundColor: resolvedPreviewColors.surfaceLighter,
                                                        paddingHorizontal: 6,
                                                        paddingVertical: 2,
                                                    }}
                                                >
                                                    <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 8, fontWeight: '900' }}>INFO</Text>
                                                </View>
                                            ) : null}
                                            {!ok && onAutoFixColorField ? (
                                                <TouchableOpacity
                                                    activeOpacity={0.85}
                                                    onPress={() => onAutoFixColorField(row.focusField, previewMode)}
                                                    style={{
                                                        borderRadius: 999,
                                                        borderWidth: 1,
                                                        borderColor: resolvedPreviewColors.primary.dark,
                                                        backgroundColor: resolvedPreviewColors.surfaceLighter,
                                                        paddingHorizontal: 7,
                                                        paddingVertical: 2,
                                                    }}
                                                >
                                                    <Text style={{ color: resolvedPreviewColors.text, fontSize: 8, fontWeight: '900' }}>Auto</Text>
                                                </TouchableOpacity>
                                            ) : null}
                                            {!ok && onJumpToColorField ? (
                                                <TouchableOpacity
                                                    activeOpacity={0.85}
                                                    onPress={() => onJumpToColorField(row.focusField, previewMode)}
                                                    style={{
                                                        borderRadius: 999,
                                                        borderWidth: 1,
                                                        borderColor: resolvedPreviewColors.primary.dark,
                                                        backgroundColor: resolvedPreviewColors.primary.DEFAULT,
                                                        paddingHorizontal: 7,
                                                        paddingVertical: 2,
                                                    }}
                                                >
                                                    <Text style={{ color: resolvedPreviewColors.onPrimary, fontSize: 8, fontWeight: '900' }}>Corregir</Text>
                                                </TouchableOpacity>
                                            ) : null}
                                        </View>
                                        <View
                                            style={{
                                                borderRadius: 999,
                                                borderWidth: 1,
                                                borderColor: ok ? resolvedPreviewColors.primary.dark : resolvedPreviewColors.border,
                                                backgroundColor: ok ? resolvedPreviewColors.primary.DEFAULT : resolvedPreviewColors.surfaceLighter,
                                                paddingHorizontal: 7,
                                                paddingVertical: 2,
                                            }}
                                        >
                                            <Text style={{ color: ok ? resolvedPreviewColors.onPrimary : resolvedPreviewColors.textMuted, fontSize: 9, fontWeight: '900' }}>
                                                {row.ratio}:1 / mín {row.min}:1
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {[
                            {
                                id: 'home',
                                title: 'Inicio',
                                body: (
                                    <>
                                        <Text style={{ color: resolvedPreviewColors.text, fontWeight: '900', fontSize: 12 }}>Resumen semanal</Text>
                                        <Text style={{ color: resolvedPreviewColors.primary.DEFAULT, fontWeight: '900', fontSize: 18 }}>42,800 kg</Text>
                                        <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 10 }}>+6.2% vs semana anterior</Text>
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
                                                borderColor: resolvedPreviewColors.primary.dark,
                                                backgroundColor: resolvedPreviewColors.primary.DEFAULT,
                                                paddingHorizontal: 12,
                                                paddingVertical: 5,
                                            }}
                                        >
                                            <Text style={{ color: resolvedPreviewColors.onPrimary, fontSize: 10, fontWeight: '900' }}>Iniciar sesión</Text>
                                        </View>
                                        <Text style={{ color: resolvedPreviewColors.text, fontSize: 11, fontWeight: '700', marginTop: 4 }}>Press banca · 4x8</Text>
                                        <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 10 }}>Descanso activo 90s</Text>
                                        <View
                                            style={{
                                                marginTop: 5,
                                                borderRadius: 8,
                                                borderWidth: 1,
                                                borderColor: resolvedPreviewColors.border,
                                                backgroundColor: resolvedPreviewColors.surfaceLighter,
                                                padding: 6,
                                            }}
                                        >
                                            <Text style={{ color: resolvedPreviewColors.text, fontSize: 10, fontWeight: '800' }}>Última serie: 90kg x 8</Text>
                                        </View>
                                    </>
                                ),
                            },
                            {
                                id: 'exercises',
                                title: 'Ejercicios',
                                body: (
                                    <>
                                        <View style={{ gap: 5 }}>
                                            <View style={{ borderRadius: 8, backgroundColor: resolvedPreviewColors.surfaceLighter, padding: 7 }}>
                                                <Text style={{ color: resolvedPreviewColors.text, fontSize: 11, fontWeight: '800' }}>Sentadilla trasera</Text>
                                                <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9 }}>Piernas · Intermedio</Text>
                                            </View>
                                            <View style={{ borderRadius: 8, backgroundColor: resolvedPreviewColors.surfaceLighter, padding: 7 }}>
                                                <Text style={{ color: resolvedPreviewColors.text, fontSize: 11, fontWeight: '800' }}>Peso muerto rumano</Text>
                                                <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9 }}>Posterior · Intermedio</Text>
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
                                        <Text style={{ color: resolvedPreviewColors.text, fontSize: 11, fontWeight: '800' }}>@ironmate compartió una rutina</Text>
                                        <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 10 }}>“Upper potencia - 40 min”</Text>
                                        <Text style={{ color: resolvedPreviewColors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>Ver publicación</Text>
                                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 5 }}>
                                            <View style={{ borderRadius: 999, backgroundColor: resolvedPreviewColors.surfaceLighter, borderWidth: 1, borderColor: resolvedPreviewColors.border, paddingHorizontal: 7, paddingVertical: 3 }}>
                                                <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9, fontWeight: '800' }}>👍 18</Text>
                                            </View>
                                            <View style={{ borderRadius: 999, backgroundColor: resolvedPreviewColors.surfaceLighter, borderWidth: 1, borderColor: resolvedPreviewColors.border, paddingHorizontal: 7, paddingVertical: 3 }}>
                                                <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9, fontWeight: '800' }}>💬 6</Text>
                                            </View>
                                        </View>
                                    </>
                                ),
                            },
                            {
                                id: 'settings',
                                title: 'Ajustes',
                                body: (
                                    <>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text style={{ color: resolvedPreviewColors.text, fontSize: 11, fontWeight: '800' }}>Notificaciones</Text>
                                            <View
                                                style={{
                                                    width: 36,
                                                    height: 20,
                                                    borderRadius: 999,
                                                    backgroundColor: resolvedPreviewColors.primary.DEFAULT,
                                                    borderWidth: 1,
                                                    borderColor: resolvedPreviewColors.primary.dark,
                                                    alignItems: 'flex-end',
                                                    justifyContent: 'center',
                                                    paddingHorizontal: 2,
                                                }}
                                            >
                                                <View style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: resolvedPreviewColors.onPrimary }} />
                                            </View>
                                        </View>
                                        <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 10 }}>Perfil · Privacidad · Sincronización</Text>
                                    </>
                                ),
                            },
                            {
                                id: 'components',
                                title: 'Componentes',
                                body: (
                                    <>
                                        <View style={{ gap: 6 }}>
                                            <View
                                                style={{
                                                    borderRadius: 8,
                                                    borderWidth: 1,
                                                    borderColor: resolvedPreviewColors.border,
                                                    backgroundColor: resolvedPreviewColors.surfaceLighter,
                                                    padding: 7,
                                                }}
                                            >
                                                <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9, fontWeight: '800' }}>INPUT</Text>
                                                <Text style={{ color: resolvedPreviewColors.text, fontSize: 11, fontWeight: '800' }}>Buscar ejercicio...</Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                                <View style={{ flex: 1, borderRadius: 8, borderWidth: 1, borderColor: resolvedPreviewColors.border, backgroundColor: resolvedPreviewColors.surface, padding: 6 }}>
                                                    <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9, fontWeight: '800' }}>BADGE</Text>
                                                    <Text style={{ color: resolvedPreviewColors.text, fontSize: 10, fontWeight: '800' }}>Intermedio</Text>
                                                </View>
                                                <View style={{ flex: 1, borderRadius: 8, borderWidth: 1, borderColor: resolvedPreviewColors.primary.dark, backgroundColor: resolvedPreviewColors.primary.DEFAULT, padding: 6 }}>
                                                    <Text style={{ color: resolvedPreviewColors.onPrimary, fontSize: 10, fontWeight: '900' }}>CTA Primario</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </>
                                ),
                            },
                            {
                                id: 'feedback-states',
                                title: 'Estados UI',
                                body: (
                                    <>
                                        <View style={{ gap: 6 }}>
                                            <View style={{ borderRadius: 8, borderWidth: 1, borderColor: resolvedPreviewColors.border, backgroundColor: resolvedPreviewColors.surfaceLighter, padding: 7 }}>
                                                <Text style={{ color: resolvedPreviewColors.text, fontSize: 10, fontWeight: '800' }}>ℹ️ Información de sistema</Text>
                                                <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9 }}>Esta es una prueba de legibilidad en bloques informativos.</Text>
                                            </View>
                                            <View style={{ borderRadius: 8, borderWidth: 1, borderColor: resolvedPreviewColors.primary.dark, backgroundColor: resolvedPreviewColors.primary.DEFAULT, padding: 7 }}>
                                                <Text style={{ color: resolvedPreviewColors.onPrimary, fontSize: 10, fontWeight: '900' }}>✅ Acción completada</Text>
                                            </View>
                                        </View>
                                    </>
                                ),
                            },
                        ].map((section) => (
                            <View
                                key={section.id}
                                style={{
                                    borderRadius: 12,
                                    borderWidth: 1.5,
                                    borderColor: resolvedPreviewColors.border,
                                    backgroundColor: resolvedPreviewColors.background,
                                    padding: 9,
                                    gap: 7,
                                }}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>
                                        {section.title}
                                    </Text>
                                    <View
                                        style={{
                                            borderRadius: 999,
                                            borderWidth: 1,
                                            borderColor: resolvedPreviewColors.border,
                                            backgroundColor: resolvedPreviewColors.surface,
                                            paddingHorizontal: 7,
                                            paddingVertical: 2,
                                        }}
                                    >
                                        <Text style={{ color: resolvedPreviewColors.textMuted, fontSize: 9, fontWeight: '800' }}>
                                            {previewMode === 'light' ? 'Claro' : 'Oscuro'}
                                        </Text>
                                    </View>
                                </View>

                                <View
                                    style={{
                                        borderRadius: 10,
                                        borderWidth: 1.5,
                                        borderColor: resolvedPreviewColors.border,
                                        backgroundColor: resolvedPreviewColors.surface,
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
