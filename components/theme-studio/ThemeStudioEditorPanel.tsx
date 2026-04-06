import { ColorPicker } from '@/components/ui/ColorPicker';
import { ThemeDraft } from '@/src/theme-engine';
import { Check, ChevronDown, ChevronUp, Moon, Palette, Save, Sun, SunMoon } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { applyEditorSmartDefaults, ContrastAuditReport } from './helpers';
import { ThemeStudioPreviewModal } from './ThemeStudioPreviewModal';
import { ApplyOnSave, CatalogItem, EditableColorFieldKey, EditableColorFields, EditorMode, LocalThemeMeta } from './types';

type ThemeStudioEditorTabProps = {
    styles: any;
    colors: any;
    name: string;
    setName: (value: string) => void;
    editorThemeListExpanded: boolean;
    setEditorThemeListExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    newThemeNameInput: string;
    setNewThemeNameInput: (value: string) => void;
    editorSelectableThemes: CatalogItem[];
    selectedThemeId: string | null;
    editorMode: EditorMode;
    setEditorMode: (mode: EditorMode) => void;
    applyOnSave: ApplyOnSave;
    setApplyOnSave: (value: ApplyOnSave) => void;
    editorAdvancedExpanded: boolean;
    setEditorAdvancedExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    editorVisibilityExpanded: boolean;
    setEditorVisibilityExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    editorVisibility: LocalThemeMeta['visibility'];
    selectedDraft: ThemeDraft | null;
    colorFieldMeta: Array<{ key: EditableColorFieldKey; label: string; description: string }>;
    activeFields: Record<EditableColorFieldKey, string>;
    pickerField: EditableColorFieldKey | null;
    hasInvalidInputs: boolean;
    validColorCount: number;
    contrastScoreAverage: number;
    contrastBlockersTotal: number;
    contrastWarningsTotal: number;
    effectiveContrastBlockersTotal: number;
    strictContrastMode: boolean;
    lightContrastReport: ContrastAuditReport;
    darkContrastReport: ContrastAuditReport;
    isCreationFlow: boolean;
    canSaveTheme: boolean;
    isSavingTheme: boolean;
    saveDisabledReason: string | null;
    editorEntryReady: boolean;
    hasUnsavedNewDraft: boolean;
    isEditingCoreTheme: boolean;
    selectedEditorThemeKey: string | null;
    previewLightColors: any;
    previewDarkColors: any;
    previewLightResolvedFields: EditableColorFields;
    previewDarkResolvedFields: EditableColorFields;
    onFeedbackSelection: () => void;
    onCreateNamedThemeFromEditor: () => void;
    onCreateBlankTheme: () => void;
    onRequestThemeSwitch: () => void;
    onSelectThemeForEdit: (item: CatalogItem) => void;
    onSetEditorThemeVisibility: (visibility: LocalThemeMeta['visibility']) => void;
    onSetPickerField: (field: EditableColorFieldKey | null) => void;
    onUpdateFieldFromHex: (fieldKey: EditableColorFieldKey, next: string) => void;
    onUpdateFieldFromRgb: (fieldKey: EditableColorFieldKey, next: string) => void;
    onUpdateFieldFromHsl: (fieldKey: EditableColorFieldKey, next: string) => void;
    onSaveTheme: () => void;
    onAutoFixContrast: () => void;
    onToggleStrictContrast: () => void;
    onGetSuggestedColorForField: (fieldKey: EditableColorFieldKey, mode: EditorMode) => string | null;
    onApplySuggestedColorForField: (fieldKey: EditableColorFieldKey, mode: EditorMode, color: string) => void;
    onSelectColorFromPicker: (fieldKey: EditableColorFieldKey, color: string) => void;
    hexToRgbInput: (hex: string) => string;
    hexToHslInput: (hex: string) => string;
    isValidHexColor: (hex: string) => boolean;
    renderPreviewCard: (mode: EditorMode, title: string, draftColors: any) => React.ReactNode;
};

export function ThemeStudioEditorTab({
    styles,
    colors,
    name,
    setName,
    newThemeNameInput,
    setNewThemeNameInput,
    editorSelectableThemes,
    selectedThemeId,
    editorMode,
    setEditorMode,
    applyOnSave,
    setApplyOnSave,
    editorAdvancedExpanded,
    setEditorAdvancedExpanded,
    editorVisibilityExpanded,
    setEditorVisibilityExpanded,
    editorVisibility,
    selectedDraft,
    colorFieldMeta,
    activeFields,
    pickerField,
    hasInvalidInputs,
    validColorCount,
    contrastScoreAverage,
    contrastBlockersTotal,
    contrastWarningsTotal,
    effectiveContrastBlockersTotal,
    strictContrastMode,
    lightContrastReport,
    darkContrastReport,
    isCreationFlow,
    canSaveTheme,
    isSavingTheme,
    saveDisabledReason,
    editorEntryReady,
    hasUnsavedNewDraft,
    isEditingCoreTheme,
    selectedEditorThemeKey,
    previewLightColors,
    previewDarkColors,
    previewLightResolvedFields,
    previewDarkResolvedFields,
    onFeedbackSelection,
    onCreateNamedThemeFromEditor,
    onRequestThemeSwitch,
    onSelectThemeForEdit,
    onSetEditorThemeVisibility,
    onSetPickerField,
    onUpdateFieldFromHex,
    onUpdateFieldFromRgb,
    onUpdateFieldFromHsl,
    onSaveTheme,
    onAutoFixContrast,
    onToggleStrictContrast,
    onGetSuggestedColorForField,
    onApplySuggestedColorForField,
    onSelectColorFromPicker,
    hexToRgbInput,
    hexToHslInput,
    isValidHexColor,
    renderPreviewCard,
}: ThemeStudioEditorTabProps) {
    const [showAllColorFields, setShowAllColorFields] = useState(false);
    const [renameExpanded, setRenameExpanded] = useState(false);
    const [chooseExistingExpanded, setChooseExistingExpanded] = useState(true);
    const [createNewExpanded, setCreateNewExpanded] = useState(false);
    const [previewModalVisible, setPreviewModalVisible] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [highlightedField, setHighlightedField] = useState<EditableColorFieldKey | null>(null);
    const [highlightPulseOn, setHighlightPulseOn] = useState(false);
    const [suggestedColorMap, setSuggestedColorMap] = useState<Partial<Record<EditableColorFieldKey, string>>>({});
    const [pendingScrollField, setPendingScrollField] = useState<EditableColorFieldKey | null>(null);
    const colorFieldsScrollRef = useRef<ScrollView | null>(null);
    const colorFieldOffsetsRef = useRef<Partial<Record<EditableColorFieldKey, number>>>({});
    const [expandedColorDetails, setExpandedColorDetails] = useState<Record<EditableColorFieldKey, boolean>>({
        primaryDefault: false,
        primaryLight: false,
        primaryDark: false,
        logoPrimary: false,
        logoAccent: false,
        onPrimary: false,
        background: false,
        surface: false,
        surfaceLighter: false,
        text: false,
        textMuted: false,
        border: false,
    });

    const essentialColorKeys: EditableColorFieldKey[] = useMemo(
        () => ['primaryDefault', 'background', 'surface', 'text'],
        []
    );

    const visibleColorFields = useMemo(
        () => colorFieldMeta.filter((field) => showAllColorFields || essentialColorKeys.includes(field.key)),
        [colorFieldMeta, showAllColorFields, essentialColorKeys]
    );

    const previewModeColors = useMemo(
        () => (editorMode === 'light' ? previewLightColors : previewDarkColors),
        [editorMode, previewLightColors, previewDarkColors]
    );

    const effectiveFields = useMemo(
        () =>
            applyEditorSmartDefaults(activeFields as any, editorMode, {
                primary: {
                    DEFAULT: previewModeColors.primary?.DEFAULT ?? colors.primary.DEFAULT,
                    light: previewModeColors.primary?.light ?? colors.primary.light,
                    dark: previewModeColors.primary?.dark ?? colors.primary.dark,
                },
                logoPrimary:
                    previewModeColors.logoPrimary ??
                    (editorMode === 'dark' ? previewModeColors.iron?.[800] : previewModeColors.iron?.[900]) ??
                    (editorMode === 'dark' ? colors.iron?.[800] : colors.iron?.[900]) ??
                    previewModeColors.text ??
                    colors.text,
                logoAccent:
                    previewModeColors.logoAccent ??
                    (editorMode === 'dark' ? previewModeColors.primary?.light : previewModeColors.primary?.dark) ??
                    previewModeColors.primary?.DEFAULT ??
                    colors.primary.DEFAULT,
                onPrimary: previewModeColors.onPrimary ?? colors.onPrimary,
                background: previewModeColors.background ?? colors.background,
                surface: previewModeColors.surface ?? colors.surface,
                surfaceLighter: previewModeColors.surfaceLighter ?? colors.surfaceLighter,
                text: previewModeColors.text ?? colors.text,
                textMuted: previewModeColors.textMuted ?? colors.textMuted,
                border: previewModeColors.border ?? colors.border,
            }),
        [activeFields, editorMode, previewModeColors, colors]
    );

    const getEffectiveColorForField = (fieldKey: EditableColorFieldKey) => {
        return effectiveFields[fieldKey] ?? '';
    };

    const currentContrastIssuesByField = useMemo(() => {
        const issues = editorMode === 'light' ? lightContrastReport.issues : darkContrastReport.issues;
        const result: Partial<Record<EditableColorFieldKey, 'blocker' | 'warning' | 'info'>> = {};

        const rank = (severity: 'blocker' | 'warning' | 'info') => (severity === 'blocker' ? 3 : severity === 'warning' ? 2 : 1);

        const setIfHigher = (fieldKey: EditableColorFieldKey, severity: 'blocker' | 'warning' | 'info') => {
            const current = result[fieldKey];
            if (!current || rank(severity) > rank(current)) {
                result[fieldKey] = severity;
            }
        };

        for (const issue of issues) {
            if (issue.id === 'text-on-background' || issue.id === 'text-on-surface' || issue.id === 'text-on-surface-lighter') setIfHigher('text', issue.severity);
            if (issue.id === 'onprimary-on-primary') setIfHigher('onPrimary', issue.severity);
            if (issue.id === 'muted-on-background' || issue.id === 'muted-on-surface') setIfHigher('textMuted', issue.severity);
            if (issue.id === 'primary-on-background') setIfHigher('primaryDefault', issue.severity);
            if (issue.id === 'primary-light-on-background') setIfHigher('primaryLight', issue.severity);
            if (issue.id === 'primary-dark-on-background') setIfHigher('primaryDark', issue.severity);
            if (issue.id === 'border-on-surface') setIfHigher('border', issue.severity);
        }

        return result;
    }, [editorMode, lightContrastReport.issues, darkContrastReport.issues]);

    const steps = useMemo(
        () => [
            { id: 'setup', label: '1. Config' },
            { id: 'colors', label: '2. Colores' },
            { id: 'preview', label: '3. Preview' },
            { id: 'quality', label: '4. QA' },
            { id: 'save', label: '5. Guardar' },
        ] as const,
        [],
    );

    const currentStep = steps[currentStepIndex]?.id ?? 'setup';

    useEffect(() => {
        if (!editorEntryReady) {
            setCurrentStepIndex(0);
        }
    }, [editorEntryReady]);

    useEffect(() => {
        if (!highlightedField) return;
        setHighlightPulseOn(true);
        const pulseOffTimeout = setTimeout(() => setHighlightPulseOn(false), 170);
        const pulseOnTimeout = setTimeout(() => setHighlightPulseOn(true), 310);
        const timeout = setTimeout(() => setHighlightedField(null), 1800);
        return () => {
            clearTimeout(pulseOffTimeout);
            clearTimeout(pulseOnTimeout);
            clearTimeout(timeout);
            setHighlightPulseOn(false);
        };
    }, [highlightedField]);

    useEffect(() => {
        if (!pendingScrollField) return;
        if (currentStep !== 'colors') return;

        const timeout = setTimeout(() => {
            const y = colorFieldOffsetsRef.current[pendingScrollField];
            if (typeof y === 'number') {
                colorFieldsScrollRef.current?.scrollTo({ y: Math.max(0, y - 14), animated: true });
            }
            setPendingScrollField(null);
        }, 120);

        return () => clearTimeout(timeout);
    }, [pendingScrollField, currentStep]);

    const nextStepBlockedReason = useMemo(() => {
        if (currentStep === 'setup') {
            if (!name.trim()) return 'Definí el nombre para avanzar.';
            return null;
        }
        if (currentStep === 'colors') {
            if (hasInvalidInputs) return 'Corregí colores inválidos para avanzar.';
            if (validColorCount === 0) return 'Definí al menos 1 color válido para avanzar.';
            return null;
        }
        if (currentStep === 'quality') {
            if (effectiveContrastBlockersTotal > 0) return 'Resolvé bloqueos de contraste para avanzar.';
            return null;
        }
        return null;
    }, [currentStep, name, hasInvalidInputs, validColorCount, effectiveContrastBlockersTotal]);

    const canGoNext = nextStepBlockedReason === null;

    const goPrevStep = () => {
        setCurrentStepIndex((prev) => Math.max(0, prev - 1));
        onFeedbackSelection();
    };

    const goNextStep = () => {
        if (!canGoNext) return;
        setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
        onFeedbackSelection();
    };

    if (!editorEntryReady) {
        return (
            <View style={{ gap: 9 }}>
                <View style={styles.card}>
                    <Text style={styles.sectionLabel}>Editor del tema</Text>
                    <Text style={styles.cardSub}>Elegí una opción obligatoria para continuar:</Text>

                    <View style={styles.subtlePanel}>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            activeOpacity={0.85}
                            onPress={() => {
                                setChooseExistingExpanded((value) => !value);
                                onFeedbackSelection();
                            }}
                        >
                            <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.actionBtnText}>1) Seleccionar tema existente</Text>
                                {chooseExistingExpanded ? <ChevronUp size={12} color={colors.textMuted} /> : <ChevronDown size={12} color={colors.textMuted} />}
                            </View>
                        </TouchableOpacity>

                        {chooseExistingExpanded ? (
                            <View style={{ gap: 6 }}>
                                <View style={{ maxHeight: 180 }}>
                                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                                        {editorSelectableThemes.length === 0 ? (
                                            <Text style={styles.cardSub}>No hay temas disponibles para editar.</Text>
                                        ) : (
                                            editorSelectableThemes.map((draft) => {
                                                const selected = selectedEditorThemeKey === draft.id || (!selectedEditorThemeKey && selectedThemeId === draft.id);
                                                return (
                                                    <TouchableOpacity
                                                        key={draft.id}
                                                        style={[styles.actionBtn, selected && styles.actionBtnPrimary]}
                                                        activeOpacity={0.85}
                                                        onPress={() => {
                                                            onSelectThemeForEdit(draft);
                                                        }}
                                                    >
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Text style={[styles.actionBtnText, selected && styles.actionBtnTextPrimary]}>{draft.name}</Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                                {draft.isCore ? <Text style={styles.cardSub}>CORE</Text> : null}
                                                                {selected ? <Check size={12} color={colors.primary.DEFAULT} /> : null}
                                                            </View>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })
                                        )}
                                    </ScrollView>
                                </View>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.subtlePanel}>
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.actionBtnPrimary]}
                            activeOpacity={0.85}
                            onPress={() => {
                                setCreateNewExpanded((value) => !value);
                                onFeedbackSelection();
                            }}
                        >
                            <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>2) Crear tema nuevo</Text>
                                {createNewExpanded ? <ChevronUp size={12} color={colors.primary.DEFAULT} /> : <ChevronDown size={12} color={colors.primary.DEFAULT} />}
                            </View>
                        </TouchableOpacity>

                        {createNewExpanded ? (
                            <View style={{ gap: 6 }}>
                                <TextInput
                                    value={newThemeNameInput}
                                    onChangeText={setNewThemeNameInput}
                                    style={styles.compactInput}
                                    placeholder="Nombre obligatorio para crear"
                                    placeholderTextColor={colors.textMuted}
                                />
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                                    activeOpacity={0.85}
                                    onPress={onCreateNamedThemeFromEditor}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Palette size={12} color={colors.primary.DEFAULT} />
                                        <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Crear y continuar</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={{ gap: 9 }}>
            <View style={styles.subtlePanel}>
                <Text style={styles.sectionLabel}>Flujo guiado</Text>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    {steps.map((step, index) => {
                        const selected = index === currentStepIndex;
                        const completed = index < currentStepIndex;
                        return (
                            <TouchableOpacity
                                key={step.id}
                                style={[styles.chip, (selected || completed) && styles.chipActive]}
                                activeOpacity={0.85}
                                onPress={() => {
                                    setCurrentStepIndex(index);
                                    onFeedbackSelection();
                                }}
                            >
                                <Text style={[styles.chipText, (selected || completed) && styles.chipTextActive]}>
                                    {step.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {nextStepBlockedReason ? <Text style={styles.helperError}>{nextStepBlockedReason}</Text> : null}
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.grow, currentStepIndex === 0 && styles.disabledBtn]}
                        activeOpacity={0.85}
                        disabled={currentStepIndex === 0}
                        onPress={goPrevStep}
                    >
                        <Text style={styles.actionBtnText}>Atrás</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnPrimary, styles.grow, (currentStepIndex === steps.length - 1 || !canGoNext) && styles.disabledBtn]}
                        activeOpacity={0.85}
                        disabled={currentStepIndex === steps.length - 1 || !canGoNext}
                        onPress={goNextStep}
                    >
                        <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Siguiente</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {currentStep === 'setup' ? (
            <View style={styles.card}>
                <Text style={styles.sectionLabel}>Editor del tema</Text>
                <Text style={styles.cardSub}>Flujo: configuración → colores → preview → QA → guardar.</Text>

                <View style={styles.statusCard}>
                    <Text style={styles.sectionLabel}>Estado del editor</Text>
                    <Text style={styles.cardSub}>{isCreationFlow ? 'Creando tema nuevo' : 'Editando tema existente'}</Text>
                    <Text style={styles.cardSub}>Colores válidos definidos: {validColorCount}</Text>
                    {hasUnsavedNewDraft ? <Text style={styles.cardSub}>Cambios nuevos sin guardar.</Text> : null}
                    {!canSaveTheme && saveDisabledReason ? <Text style={styles.helperError}>{saveDisabledReason}</Text> : <Text style={styles.helperOk}>Listo para guardar.</Text>}
                </View>

                <View style={styles.subtlePanel}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.colorRowSub}>Tema activo: {name.trim() || 'Sin nombre'}</Text>
                        <TouchableOpacity
                            style={styles.actionBtn}
                            activeOpacity={0.85}
                            onPress={() => {
                                onRequestThemeSwitch();
                                onFeedbackSelection();
                            }}
                        >
                            <Text style={styles.actionBtnText}>Cambiar tema</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.subtlePanel}>
                    <TouchableOpacity
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        activeOpacity={0.85}
                        onPress={() => {
                            setRenameExpanded((value) => !value);
                            onFeedbackSelection();
                        }}
                    >
                        <Text style={styles.sectionLabel}>Nombre del tema</Text>
                        {renameExpanded ? <ChevronUp size={13} color={colors.textMuted} /> : <ChevronDown size={13} color={colors.textMuted} />}
                    </TouchableOpacity>
                    {renameExpanded ? (
                        <>
                            <TextInput
                                value={name}
                                onChangeText={setName}
                                style={styles.input}
                                placeholder="Nombre del tema"
                                placeholderTextColor={colors.textMuted}
                            />
                            {!name.trim() ? <Text style={styles.helperError}>Obligatorio: nombre del tema.</Text> : <Text style={styles.helperOk}>Nombre validado.</Text>}
                        </>
                    ) : (
                        <Text style={styles.cardSub}>{name.trim() || 'Sin nombre'}</Text>
                    )}
                </View>

                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.modeBtn, styles.grow, editorMode === 'light' && styles.modeBtnActive]}
                        onPress={() => {
                            setEditorMode('light');
                            onFeedbackSelection();
                        }}
                        activeOpacity={0.85}
                    >
                        <Sun size={15} color={editorMode === 'light' ? colors.primary.DEFAULT : colors.textMuted} />
                        <Text style={[styles.modeBtnText, editorMode === 'light' && styles.modeBtnTextActive]}>Modo Claro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeBtn, styles.grow, editorMode === 'dark' && styles.modeBtnActive]}
                        onPress={() => {
                            setEditorMode('dark');
                            onFeedbackSelection();
                        }}
                        activeOpacity={0.85}
                    >
                        <Moon size={15} color={editorMode === 'dark' ? colors.primary.DEFAULT : colors.textMuted} />
                        <Text style={[styles.modeBtnText, editorMode === 'dark' && styles.modeBtnTextActive]}>Modo Oscuro</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.subtlePanel}>
                    <Text style={styles.sectionLabel}>Visibilidad del tema</Text>
                    <Text style={styles.cardSub}>Definí quién puede ver este tema cuando lo guardes.</Text>

                    {isEditingCoreTheme ? (
                        <View style={{ gap: 6 }}>
                            <Text style={styles.cardSub}>Tema core seleccionado: visibilidad fija.</Text>
                            <View style={[styles.row, { flexWrap: 'wrap' }]}>
                                <View style={[styles.chip, styles.chipActive]}>
                                    <Text style={[styles.chipText, styles.chipTextActive]}>Público (bloqueado)</Text>
                                </View>
                            </View>
                        </View>
                    ) : (
                        <View style={{ gap: 7 }}>
                            <View style={[styles.row, { flexWrap: 'wrap' }]}>
                                {([
                                    {
                                        id: 'private',
                                        label: 'Privado',
                                        description: 'Solo vos lo podés ver y usar.',
                                    },
                                    {
                                        id: 'friends',
                                        label: 'Amigos',
                                        description: 'Disponible solo para tus contactos/amigos.',
                                    },
                                    {
                                        id: 'public',
                                        label: 'Público',
                                        description: 'Visible para toda la comunidad.',
                                    },
                                ] as const).map((option) => {
                                    const selected = editorVisibility === option.id;
                                    return (
                                        <TouchableOpacity
                                            key={option.id}
                                            style={[styles.chip, selected && styles.chipActive]}
                                            activeOpacity={0.85}
                                            onPress={() => {
                                                onSetEditorThemeVisibility(option.id);
                                                onFeedbackSelection();
                                            }}
                                        >
                                            <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option.label}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <View style={{ gap: 4 }}>
                                <Text style={styles.cardSub}>• Privado: solo vos.</Text>
                                <Text style={styles.cardSub}>• Amigos: solo tus contactos/amigos.</Text>
                                <Text style={styles.cardSub}>• Público: visible para la comunidad.</Text>
                            </View>
                        </View>
                    )}

                    {!selectedDraft && !isEditingCoreTheme ? <Text style={styles.cardSub}>Se aplicará al guardar el nuevo tema.</Text> : null}
                </View>
            </View>
            ) : null}

            {currentStep === 'colors' ? (
            <View style={styles.subtlePanel}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.sectionLabel}>Colores del tema</Text>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        activeOpacity={0.85}
                        onPress={() => {
                            setShowAllColorFields((value) => !value);
                            onFeedbackSelection();
                        }}
                    >
                        <Text style={styles.actionBtnText}>{showAllColorFields ? 'Ver esenciales' : 'Ver todos'}</Text>
                    </TouchableOpacity>
                </View>
                <Text style={styles.cardSub}>Vista principal: Picker. Detalles HEX/RGB/HSL en desplegable.</Text>
                <Text style={styles.cardSub}>Formato válido no siempre implica contraste correcto: validá en Preview/QA.</Text>
                {effectiveContrastBlockersTotal > 0 ? (
                    <Text style={styles.helperError}>Pendientes de contraste: {effectiveContrastBlockersTotal}.</Text>
                ) : (
                    <Text style={styles.helperOk}>Sin pendientes de contraste.</Text>
                )}
            </View>
            ) : null}

            {currentStep === 'colors' ? (
            <ScrollView
                ref={colorFieldsScrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 7, paddingBottom: 4 }}
                keyboardShouldPersistTaps="handled"
            >
                {visibleColorFields.map((field) => {
                    const explicitValue = activeFields[field.key];
                    const effectiveValue = getEffectiveColorForField(field.key);
                    const valid = !effectiveValue || isValidHexColor(effectiveValue);
                    const rgbText = hexToRgbInput(effectiveValue);
                    const detailsExpanded = expandedColorDetails[field.key] === true;
                    const isHighlighted = highlightedField === field.key;
                    const suggestedColor = suggestedColorMap[field.key];
                    const contrastSeverity = currentContrastIssuesByField[field.key];
                    const contrastValid = !contrastSeverity;

                    return (
                        <View
                            key={field.key}
                            onLayout={(event) => {
                                colorFieldOffsetsRef.current[field.key] = event.nativeEvent.layout.y;
                            }}
                            style={[
                                styles.colorRow,
                                isHighlighted
                                    ? {
                                        borderColor: colors.primary.DEFAULT,
                                        backgroundColor: colors.surfaceLighter,
                                    }
                                    : null,
                            ]}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.colorRowTitle}>{field.label}</Text>
                                    <Text style={styles.colorRowSub}>{field.description}</Text>
                                    <Text style={[styles.cardSub, { fontSize: 10 }]}>Token: {field.key}</Text>
                                </View>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.actionBtnPrimary, { minWidth: 120 }]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        onSetPickerField(field.key);
                                        onFeedbackSelection();
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <View
                                            style={[
                                                styles.swatch,
                                                {
                                                    width: isHighlighted && highlightPulseOn ? 18 : 16,
                                                    height: isHighlighted && highlightPulseOn ? 18 : 16,
                                                    borderRadius: 5,
                                                    borderWidth: isHighlighted ? 2 : 1,
                                                    borderColor: isHighlighted ? colors.primary.DEFAULT : colors.border,
                                                    backgroundColor: valid && effectiveValue ? effectiveValue : colors.surfaceLighter,
                                                },
                                            ]}
                                        />
                                        <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Abrir picker</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View
                                style={{
                                    height: 20,
                                    borderRadius: 7,
                                    borderWidth: 1.5,
                                    borderColor: colors.border,
                                    backgroundColor: valid && effectiveValue ? effectiveValue : colors.surfaceLighter,
                                }}
                            />
                            <Text style={styles.cardSub}>{valid && effectiveValue ? effectiveValue : 'Sin color válido definido'}</Text>
                            {!explicitValue && valid && effectiveValue ? <Text style={styles.cardSub}>Usando default del tema core ({editorMode === 'light' ? 'claro' : 'oscuro'}).</Text> : null}
                            {isHighlighted ? (
                                <View style={{ gap: 6 }}>
                                    <Text style={[styles.helperOk, { color: colors.primary.DEFAULT }]}>
                                        Campo sugerido para corregir contraste.
                                        {suggestedColor ? ` Sugerido: ${suggestedColor}` : ''}
                                    </Text>
                                    {suggestedColor ? (
                                        <TouchableOpacity
                                            style={[styles.actionBtn, styles.actionBtnPrimary]}
                                            activeOpacity={0.85}
                                            onPress={() => {
                                                onApplySuggestedColorForField(field.key, editorMode, suggestedColor);
                                                setSuggestedColorMap((current) => {
                                                    if (!current[field.key]) return current;
                                                    const next = { ...current };
                                                    delete next[field.key];
                                                    return next;
                                                });
                                                onFeedbackSelection();
                                            }}
                                        >
                                            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Aplicar sugerido</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={styles.actionBtn}
                                activeOpacity={0.85}
                                onPress={() => {
                                    setExpandedColorDetails((current) => ({ ...current, [field.key]: !current[field.key] }));
                                    onFeedbackSelection();
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    {detailsExpanded ? <ChevronUp size={12} color={colors.textMuted} /> : <ChevronDown size={12} color={colors.textMuted} />}
                                    <Text style={styles.actionBtnText}>{detailsExpanded ? 'Ocultar HEX/RGB/HSL' : 'Ver HEX/RGB/HSL'}</Text>
                                </View>
                            </TouchableOpacity>

                            {detailsExpanded ? (
                                <>
                                    <View style={styles.row}>
                                        <View style={styles.grow}>
                                            <Text style={[styles.colorRowSub, { marginBottom: 4 }]}>HEX</Text>
                                            <TextInput
                                                value={effectiveValue}
                                                onChangeText={(next) => {
                                                    onUpdateFieldFromHex(field.key, next);
                                                }}
                                                style={styles.compactInput}
                                                autoCapitalize="characters"
                                                autoCorrect={false}
                                                placeholder="#RRGGBB"
                                                placeholderTextColor={colors.textMuted}
                                            />
                                        </View>
                                        <View style={styles.grow}>
                                            <Text style={[styles.colorRowSub, { marginBottom: 4 }]}>RGB</Text>
                                            <TextInput
                                                value={rgbText}
                                                onChangeText={(next) => {
                                                    onUpdateFieldFromRgb(field.key, next);
                                                }}
                                                style={styles.compactInput}
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                                placeholder="255, 255, 255"
                                                placeholderTextColor={colors.textMuted}
                                            />
                                        </View>
                                    </View>

                                    <View>
                                        <Text style={[styles.colorRowSub, { marginBottom: 4 }]}>HSL</Text>
                                        <TextInput
                                            value={hexToHslInput(effectiveValue)}
                                            onChangeText={(next) => {
                                                onUpdateFieldFromHsl(field.key, next);
                                            }}
                                            style={styles.compactInput}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            placeholder="210, 60, 50"
                                            placeholderTextColor={colors.textMuted}
                                        />
                                    </View>
                                </>
                            ) : null}

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <Text style={valid ? styles.helperOk : styles.helperError}>
                                    {valid ? 'Formato válido' : 'Formato inválido. Usá #RRGGBB, #RRGGBBAA o RGB'}
                                </Text>
                                <Text style={contrastValid ? styles.helperOk : styles.helperError}>
                                    {contrastValid
                                        ? 'Contraste válido'
                                        : contrastSeverity === 'blocker'
                                            ? 'Contraste inválido (crítico)'
                                            : contrastSeverity === 'warning'
                                                ? 'Contraste inválido (advertencia)'
                                                : 'Contraste inválido (info)'}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
            ) : null}

            {currentStep === 'preview' ? (
            <View style={{ gap: 7 }}>
                <Text style={styles.sectionLabel}>Vista previa en vivo</Text>
                <View style={styles.row}>
                    {renderPreviewCard('light', 'Preview Claro', previewLightColors)}
                    {renderPreviewCard('dark', 'Preview Oscuro', previewDarkColors)}
                </View>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    activeOpacity={0.85}
                    onPress={() => {
                        setPreviewModalVisible(true);
                        onFeedbackSelection();
                    }}
                >
                    <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Abrir preview por pestañas</Text>
                </TouchableOpacity>
            </View>
            ) : null}

            {currentStep === 'quality' ? (
            <View style={{ gap: 7 }}>
                <Text style={styles.sectionLabel}>QA contraste</Text>
                <View style={styles.statusCard}>
                    <Text style={styles.cardSub}>Score promedio: {contrastScoreAverage}/100</Text>
                    <Text style={styles.cardSub}>Bloqueos críticos: {contrastBlockersTotal} · Advertencias: {contrastWarningsTotal}</Text>
                    <Text style={styles.cardSub}>Modo AA estricto: {strictContrastMode ? 'ON' : 'OFF'}</Text>
                    {effectiveContrastBlockersTotal > 0 ? (
                        <Text style={styles.helperError}>
                            {strictContrastMode
                                ? 'AA estricto activo: las advertencias también bloquean guardado.'
                                : 'Hay bloqueos críticos. El guardado queda bloqueado hasta corregirlos.'}
                        </Text>
                    ) : (
                        <Text style={styles.helperOk}>Sin bloqueos críticos de contraste.</Text>
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.actionBtn, strictContrastMode ? styles.actionBtnPrimary : null]}
                    activeOpacity={0.85}
                    onPress={() => {
                        onToggleStrictContrast();
                        onFeedbackSelection();
                    }}
                >
                    <Text style={[styles.actionBtnText, strictContrastMode ? styles.actionBtnTextPrimary : null]}>
                        {strictContrastMode ? 'Desactivar AA estricto' : 'Activar AA estricto'}
                    </Text>
                </TouchableOpacity>
                <Text style={styles.cardSub}>
                    En AA estricto, también se bloquea guardar por advertencias (no solo bloqueos críticos).
                </Text>
                <Text style={styles.cardSub}>Este QA usa la misma base de reglas que el heatmap de Preview.</Text>

                <View style={styles.subtlePanel}>
                    <Text style={styles.colorRowSub}>Modo claro</Text>
                    {lightContrastReport.issues.length === 0 ? (
                        <Text style={styles.helperOk}>Sin incidencias.</Text>
                    ) : (
                        lightContrastReport.issues.slice(0, 4).map((issue) => (
                            <Text key={`light-${issue.id}`} style={issue.severity === 'blocker' ? styles.helperError : styles.cardSub}>
                                • {issue.label}: {issue.ratio}:1 (mín {issue.minRatio}:1)
                            </Text>
                        ))
                    )}
                </View>

                <View style={styles.subtlePanel}>
                    <Text style={styles.colorRowSub}>Modo oscuro</Text>
                    {darkContrastReport.issues.length === 0 ? (
                        <Text style={styles.helperOk}>Sin incidencias.</Text>
                    ) : (
                        darkContrastReport.issues.slice(0, 4).map((issue) => (
                            <Text key={`dark-${issue.id}`} style={issue.severity === 'blocker' ? styles.helperError : styles.cardSub}>
                                • {issue.label}: {issue.ratio}:1 (mín {issue.minRatio}:1)
                            </Text>
                        ))
                    )}
                </View>

                <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnPrimary]}
                    activeOpacity={0.85}
                    onPress={() => {
                        onAutoFixContrast();
                        onFeedbackSelection();
                    }}
                >
                    <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Autocorregir contraste</Text>
                </TouchableOpacity>
            </View>
            ) : null}

            {currentStep === 'save' ? (
            <View style={{ gap: 7 }}>
                <Text style={styles.sectionLabel}>Al guardar</Text>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    {([
                        { id: 'none', label: 'Solo guardar', icon: SunMoon },
                        { id: 'light', label: 'Activar Claro', icon: Sun },
                        { id: 'dark', label: 'Activar Oscuro', icon: Moon },
                        { id: 'both', label: 'Activar ambos', icon: SunMoon },
                    ] as const).map((option) => {
                        const Icon = option.icon;
                        const isActive = applyOnSave === option.id;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={[styles.chip, isActive && styles.chipActive]}
                                onPress={() => {
                                    setApplyOnSave(option.id);
                                    onFeedbackSelection();
                                }}
                                activeOpacity={0.85}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Icon size={12} color={isActive ? colors.primary.DEFAULT : colors.textMuted} />
                                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                {hasInvalidInputs ? <Text style={styles.helperError}>Hay colores inválidos. Revisá antes de guardar.</Text> : <Text style={styles.helperOk}>Colores válidos.</Text>}

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                <View style={[styles.chip, strictContrastMode && styles.chipActive]}>
                    <Text style={[styles.chipText, strictContrastMode && styles.chipTextActive]}>
                        {strictContrastMode ? 'AA ESTRICTO ON' : 'AA ESTRICTO OFF'}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                onPress={onSaveTheme}
                disabled={!canSaveTheme || isSavingTheme}
                style={{
                    borderRadius: 11,
                    backgroundColor: canSaveTheme && !isSavingTheme ? colors.primary.DEFAULT : colors.surfaceLighter,
                    borderWidth: 1.5,
                    borderColor: canSaveTheme && !isSavingTheme ? colors.primary.dark : colors.border,
                    paddingVertical: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                    opacity: canSaveTheme && !isSavingTheme ? 1 : 0.65,
                }}
                activeOpacity={0.86}
            >
                {isSavingTheme ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                    <Save size={15} color={canSaveTheme ? colors.onPrimary : colors.textMuted} />
                )}
                <Text style={{ color: canSaveTheme && !isSavingTheme ? colors.onPrimary : colors.textMuted, fontWeight: '900', fontSize: 14 }}>
                    {isSavingTheme ? 'Guardando...' : 'Guardar tema'}
                </Text>
                {!isSavingTheme ? <Check size={13} color={canSaveTheme ? colors.onPrimary : colors.textMuted} /> : null}
            </TouchableOpacity>
            <Text style={[styles.cardSub, { color: strictContrastMode ? colors.yellow : colors.green, fontWeight: '800' }]}>
                {strictContrastMode
                    ? 'Validación AA estricta activa: se bloquea guardar si hay advertencias o bloqueos de contraste.'
                    : 'Validación estándar activa: se bloquea guardar solo con bloqueos críticos de contraste.'}
            </Text>
            {!canSaveTheme && saveDisabledReason ? <Text style={styles.cardSub}>{saveDisabledReason}</Text> : null}
            </View>
            ) : null}

            <ColorPicker
                visible={pickerField !== null}
                initialColor={
                    pickerField
                        ? (suggestedColorMap[pickerField] || getEffectiveColorForField(pickerField) || colors.primary.DEFAULT)
                        : colors.primary.DEFAULT
                }
                onClose={() => onSetPickerField(null)}
                onSelect={(pickedColor) => {
                    if (!pickerField) return;
                    onSelectColorFromPicker(pickerField, pickedColor);
                    setSuggestedColorMap((current) => {
                        if (!current[pickerField]) return current;
                        const next = { ...current };
                        delete next[pickerField];
                        return next;
                    });
                }}
            />

            <ThemeStudioPreviewModal
                visible={previewModalVisible}
                onClose={() => setPreviewModalVisible(false)}
                colors={colors}
                lightColors={previewLightColors}
                darkColors={previewDarkColors}
                lightResolvedFields={previewLightResolvedFields}
                darkResolvedFields={previewDarkResolvedFields}
                initialMode={editorMode}
                onJumpToColorField={(fieldKey, mode) => {
                    const suggested = onGetSuggestedColorForField(fieldKey, mode);
                    if (suggested) {
                        setSuggestedColorMap((current) => ({ ...current, [fieldKey]: suggested }));
                    }
                    setPreviewModalVisible(false);
                    setEditorMode(mode);
                    setCurrentStepIndex(1);
                    setShowAllColorFields(true);
                    setExpandedColorDetails((current) => ({ ...current, [fieldKey]: true }));
                    setHighlightedField(fieldKey);
                    setPendingScrollField(fieldKey);
                    onSetPickerField(fieldKey);
                    onFeedbackSelection();
                }}
                onAutoFixColorField={(fieldKey, mode) => {
                    const suggested = onGetSuggestedColorForField(fieldKey, mode);
                    if (!suggested) return;
                    setEditorMode(mode);
                    onApplySuggestedColorForField(fieldKey, mode, suggested);
                    setSuggestedColorMap((current) => {
                        if (!current[fieldKey]) return current;
                        const next = { ...current };
                        delete next[fieldKey];
                        return next;
                    });
                    onFeedbackSelection();
                }}
            />
        </View>
    );
}
