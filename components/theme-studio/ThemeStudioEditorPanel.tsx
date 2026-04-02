import { ColorPicker } from '@/components/ui/ColorPicker';
import { ThemeDraft } from '@/src/theme-engine';
import { Check, ChevronDown, ChevronUp, Moon, Palette, Save, Sun, SunMoon } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { applyEditorSmartDefaults } from './helpers';
import { ThemeStudioPreviewModal } from './ThemeStudioPreviewModal';
import { ApplyOnSave, CatalogItem, EditableColorFieldKey, EditorMode, LocalThemeMeta } from './types';

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
    isCreationFlow: boolean;
    canSaveTheme: boolean;
    saveDisabledReason: string | null;
    editorEntryReady: boolean;
    hasUnsavedNewDraft: boolean;
    isEditingCoreTheme: boolean;
    selectedEditorThemeKey: string | null;
    previewLightColors: any;
    previewDarkColors: any;
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
    isCreationFlow,
    canSaveTheme,
    saveDisabledReason,
    editorEntryReady,
    hasUnsavedNewDraft,
    isEditingCoreTheme,
    selectedEditorThemeKey,
    previewLightColors,
    previewDarkColors,
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
    const [expandedColorDetails, setExpandedColorDetails] = useState<Record<EditableColorFieldKey, boolean>>({
        primaryDefault: false,
        primaryLight: false,
        primaryDark: false,
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
            <View style={styles.card}>
                <Text style={styles.sectionLabel}>Editor del tema</Text>
                <Text style={styles.cardSub}>Flujo: nombre → colores principales → guardar.</Text>

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
                    <TouchableOpacity
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                        activeOpacity={0.85}
                        onPress={() => {
                            setEditorAdvancedExpanded((current) => !current);
                            onFeedbackSelection();
                        }}
                    >
                        <Text style={styles.sectionLabel}>Controles avanzados</Text>
                        {editorAdvancedExpanded ? <ChevronUp size={13} color={colors.textMuted} /> : <ChevronDown size={13} color={colors.textMuted} />}
                    </TouchableOpacity>

                    {editorAdvancedExpanded ? (
                        <View style={{ gap: 7 }}>
                            <TouchableOpacity
                                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                                activeOpacity={0.85}
                                onPress={() => {
                                    setEditorVisibilityExpanded((current) => !current);
                                    onFeedbackSelection();
                                }}
                            >
                                <Text style={styles.colorRowSub}>Visibilidad del tema</Text>
                                {editorVisibilityExpanded ? <ChevronUp size={12} color={colors.textMuted} /> : <ChevronDown size={12} color={colors.textMuted} />}
                            </TouchableOpacity>

                            {editorVisibilityExpanded ? (
                                isEditingCoreTheme ? (
                                    <View style={{ gap: 6 }}>
                                        <Text style={styles.cardSub}>Tema core seleccionado: visibilidad fija.</Text>
                                        <View style={[styles.row, { flexWrap: 'wrap' }]}>
                                            <View style={[styles.chip, styles.chipActive]}>
                                                <Text style={[styles.chipText, styles.chipTextActive]}>Público (bloqueado)</Text>
                                            </View>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={[styles.row, { flexWrap: 'wrap' }]}>
                                        {([
                                            { id: 'private', label: 'Privado' },
                                            { id: 'friends', label: 'Amigos' },
                                            { id: 'public', label: 'Público' },
                                        ] as const).map((option) => {
                                            const selected = editorVisibility === option.id;
                                            return (
                                                <TouchableOpacity
                                                    key={option.id}
                                                    style={[styles.chip, selected && styles.chipActive]}
                                                    activeOpacity={0.85}
                                                    onPress={() => {
                                                        onSetEditorThemeVisibility(option.id);
                                                    }}
                                                >
                                                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option.label}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                )
                            ) : null}
                            {!selectedDraft && !isEditingCoreTheme ? <Text style={styles.cardSub}>Se aplicará al guardar el nuevo tema.</Text> : null}
                        </View>
                    ) : null}
                </View>
            </View>

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
            </View>

            <View style={{ gap: 7 }}>
                {visibleColorFields.map((field) => {
                    const explicitValue = activeFields[field.key];
                    const effectiveValue = getEffectiveColorForField(field.key);
                    const valid = !effectiveValue || isValidHexColor(effectiveValue);
                    const rgbText = hexToRgbInput(effectiveValue);
                    const detailsExpanded = expandedColorDetails[field.key] === true;

                    return (
                        <View key={field.key} style={styles.colorRow}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.colorRowTitle}>{field.label}</Text>
                                    <Text style={styles.colorRowSub}>{field.description}</Text>
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
                                        <View style={[styles.swatch, { width: 16, height: 16, borderRadius: 5, backgroundColor: valid && effectiveValue ? effectiveValue : colors.surfaceLighter }]} />
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

                            <Text style={valid ? styles.helperOk : styles.helperError}>
                                {valid ? 'Formato válido' : 'Formato inválido. Usá #RRGGBB, #RRGGBBAA o RGB'}
                            </Text>
                        </View>
                    );
                })}
            </View>

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
            </View>

            <TouchableOpacity
                onPress={onSaveTheme}
                disabled={!canSaveTheme}
                style={{
                    borderRadius: 11,
                    backgroundColor: canSaveTheme ? colors.primary.DEFAULT : colors.surfaceLighter,
                    borderWidth: 1.5,
                    borderColor: canSaveTheme ? colors.primary.dark : colors.border,
                    paddingVertical: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                    opacity: canSaveTheme ? 1 : 0.65,
                }}
                activeOpacity={0.86}
            >
                <Save size={15} color={canSaveTheme ? colors.onPrimary : colors.textMuted} />
                <Text style={{ color: canSaveTheme ? colors.onPrimary : colors.textMuted, fontWeight: '900', fontSize: 14 }}>Guardar tema</Text>
                <Check size={13} color={canSaveTheme ? colors.onPrimary : colors.textMuted} />
            </TouchableOpacity>
            {!canSaveTheme && saveDisabledReason ? <Text style={styles.cardSub}>{saveDisabledReason}</Text> : null}

            <ColorPicker
                visible={pickerField !== null}
                initialColor={pickerField ? (getEffectiveColorForField(pickerField) || colors.primary.DEFAULT) : colors.primary.DEFAULT}
                onClose={() => onSetPickerField(null)}
                onSelect={(pickedColor) => {
                    if (!pickerField) return;
                    onSelectColorFromPicker(pickerField, pickedColor);
                }}
            />

            <ThemeStudioPreviewModal
                visible={previewModalVisible}
                onClose={() => setPreviewModalVisible(false)}
                colors={colors}
                lightColors={previewLightColors}
                darkColors={previewDarkColors}
                initialMode={editorMode}
            />
        </View>
    );
}
