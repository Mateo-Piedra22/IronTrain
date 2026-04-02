import { useTheme } from '@/src/hooks/useTheme';
import { ThemeFx, withAlpha } from '@/src/theme';
import { applyThemeColorPatch, getCoreThemeToken, isValidHexColor, ThemeColorPatch, ThemeDraft } from '@/src/theme-engine';
import { notify } from '@/src/utils/notify';
import { triggerSensoryFeedback } from '@/src/utils/sensoryFeedback';
import { CopyPlus, Moon, Palette, Save, Sun, SunMoon, Trash2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type EditableColorFieldKey =
    | 'primaryDefault'
    | 'primaryLight'
    | 'primaryDark'
    | 'onPrimary'
    | 'background'
    | 'surface'
    | 'surfaceLighter'
    | 'text'
    | 'textMuted'
    | 'border';

type EditableColorFields = Record<EditableColorFieldKey, string>;

type EditorMode = 'light' | 'dark';
type ApplyOnSave = 'none' | 'light' | 'dark' | 'both';

const EMPTY_FIELDS: EditableColorFields = {
    primaryDefault: '',
    primaryLight: '',
    primaryDark: '',
    onPrimary: '',
    background: '',
    surface: '',
    surfaceLighter: '',
    text: '',
    textMuted: '',
    border: '',
};

function patchToFields(patch: ThemeColorPatch): EditableColorFields {
    return {
        primaryDefault: patch.primary?.DEFAULT ?? '',
        primaryLight: patch.primary?.light ?? '',
        primaryDark: patch.primary?.dark ?? '',
        onPrimary: patch.onPrimary ?? '',
        background: patch.background ?? '',
        surface: patch.surface ?? '',
        surfaceLighter: patch.surfaceLighter ?? '',
        text: patch.text ?? '',
        textMuted: patch.textMuted ?? '',
        border: patch.border ?? '',
    };
}

function fieldsToPatch(fields: EditableColorFields): ThemeColorPatch {
    const patch: ThemeColorPatch = {};

    if (isValidHexColor(fields.primaryDefault) || isValidHexColor(fields.primaryLight) || isValidHexColor(fields.primaryDark)) {
        patch.primary = {};
        if (isValidHexColor(fields.primaryDefault)) patch.primary.DEFAULT = fields.primaryDefault;
        if (isValidHexColor(fields.primaryLight)) patch.primary.light = fields.primaryLight;
        if (isValidHexColor(fields.primaryDark)) patch.primary.dark = fields.primaryDark;
    }

    if (isValidHexColor(fields.onPrimary)) patch.onPrimary = fields.onPrimary;
    if (isValidHexColor(fields.background)) patch.background = fields.background;
    if (isValidHexColor(fields.surface)) patch.surface = fields.surface;
    if (isValidHexColor(fields.surfaceLighter)) patch.surfaceLighter = fields.surfaceLighter;
    if (isValidHexColor(fields.text)) patch.text = fields.text;
    if (isValidHexColor(fields.textMuted)) patch.textMuted = fields.textMuted;
    if (isValidHexColor(fields.border)) patch.border = fields.border;

    return patch;
}

function prettifyHexInput(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    return normalized.slice(0, 9).toUpperCase();
}

const COLOR_FIELD_META: Array<{ key: EditableColorFieldKey; label: string; description: string }> = [
    { key: 'primaryDefault', label: 'Primary', description: 'Color principal de marca' },
    { key: 'primaryLight', label: 'Primary Light', description: 'Variante clara para estados' },
    { key: 'primaryDark', label: 'Primary Dark', description: 'Variante oscura para foco' },
    { key: 'onPrimary', label: 'On Primary', description: 'Texto sobre botones primarios' },
    { key: 'background', label: 'Background', description: 'Fondo global de la app' },
    { key: 'surface', label: 'Surface', description: 'Cards y contenedores' },
    { key: 'surfaceLighter', label: 'Surface Light', description: 'Superficie secundaria' },
    { key: 'text', label: 'Text', description: 'Texto principal' },
    { key: 'textMuted', label: 'Text Muted', description: 'Texto secundario' },
    { key: 'border', label: 'Border', description: 'Bordes y divisores' },
];

export function ThemeStudioPanel() {
    const {
        activeTheme,
        effectiveMode,
        themeDrafts,
        activeThemePackIdLight,
        activeThemePackIdDark,
        saveThemeDraft,
        deleteThemeDraft,
        setActiveThemePackId,
    } = useTheme();

    const colors = activeTheme.colors;

    const [selectedDraftId, setSelectedDraftId] = useState<string | null>(themeDrafts[0]?.id ?? null);
    const [name, setName] = useState(themeDrafts[0]?.name ?? '');
    const [editorMode, setEditorMode] = useState<EditorMode>('light');
    const [applyOnSave, setApplyOnSave] = useState<ApplyOnSave>('both');
    const [lightFields, setLightFields] = useState<EditableColorFields>(themeDrafts[0] ? patchToFields(themeDrafts[0].lightPatch) : EMPTY_FIELDS);
    const [darkFields, setDarkFields] = useState<EditableColorFields>(themeDrafts[0] ? patchToFields(themeDrafts[0].darkPatch) : EMPTY_FIELDS);

    const styles = useMemo(() => StyleSheet.create({
        container: {
            marginTop: 12,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surfaceLighter,
            padding: 12,
            gap: 12,
        },
        titleRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },
        titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
        title: { color: colors.text, fontSize: 15, fontWeight: '900' },
        subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
        modeBadge: {
            backgroundColor: withAlpha(colors.primary.DEFAULT, '22'),
            borderWidth: 1,
            borderColor: withAlpha(colors.primary.DEFAULT, '44'),
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 6,
        },
        modeBadgeText: { color: colors.primary.DEFAULT, fontSize: 11, fontWeight: '800' },
        draftChip: {
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            marginRight: 8,
        },
        draftChipActive: {
            borderColor: colors.primary.DEFAULT,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '18'),
        },
        draftChipText: { color: colors.text, fontWeight: '700', fontSize: 12 },
        draftChipTextActive: { color: colors.primary.DEFAULT },
        row: { flexDirection: 'row', gap: 8 },
        grow: { flex: 1 },
        input: {
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 14,
            fontWeight: '700',
            paddingHorizontal: 12,
            paddingVertical: 10,
        },
        colorRow: {
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: 10,
            gap: 8,
        },
        colorRowTitle: { color: colors.text, fontSize: 12, fontWeight: '800' },
        colorRowSub: { color: colors.textMuted, fontSize: 11 },
        swatch: {
            width: 22,
            height: 22,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surfaceLighter,
        },
        helperError: { color: colors.red, fontSize: 11, fontWeight: '700' },
        helperOk: { color: colors.green, fontSize: 11, fontWeight: '700' },
        toggleBtn: {
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: colors.border,
            paddingVertical: 10,
            paddingHorizontal: 10,
            backgroundColor: colors.surface,
            alignItems: 'center',
        },
        toggleBtnActive: {
            borderColor: colors.primary.DEFAULT,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '18'),
        },
        toggleBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
        toggleBtnTextActive: { color: colors.primary.DEFAULT },
        previewTitle: { color: colors.text, fontSize: 13, fontWeight: '900', marginBottom: 6 },
        previewCard: {
            borderRadius: 12,
            borderWidth: 1.5,
            padding: 10,
            minHeight: 140,
            justifyContent: 'space-between',
            ...ThemeFx.shadowSm,
        },
        previewBtn: {
            alignSelf: 'flex-start',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
        },
        previewBtnText: { fontSize: 11, fontWeight: '900' },
        sectionLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
        applyChip: {
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: colors.border,
            paddingHorizontal: 10,
            paddingVertical: 7,
            backgroundColor: colors.surface,
        },
        applyChipActive: {
            borderColor: colors.primary.DEFAULT,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '18'),
        },
        applyChipText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
        applyChipTextActive: { color: colors.primary.DEFAULT },
        iconBtn: {
            width: 40,
            height: 40,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
        },
    }), [colors]);

    const selectedDraft = useMemo(() => themeDrafts.find((draft) => draft.id === selectedDraftId) ?? null, [themeDrafts, selectedDraftId]);

    const activeFields = editorMode === 'light' ? lightFields : darkFields;
    const setActiveFields = (next: EditableColorFields) => {
        if (editorMode === 'light') setLightFields(next);
        else setDarkFields(next);
    };

    const previewLight = useMemo(() => {
        return applyThemeColorPatch(getCoreThemeToken('light'), fieldsToPatch(lightFields), { id: 'preview-light', label: name || 'Preview Light' });
    }, [lightFields, name]);

    const previewDark = useMemo(() => {
        return applyThemeColorPatch(getCoreThemeToken('dark'), fieldsToPatch(darkFields), { id: 'preview-dark', label: name || 'Preview Dark' });
    }, [darkFields, name]);

    const hasInvalidInputs = useMemo(() => {
        const values = [...Object.values(lightFields), ...Object.values(darkFields)];
        return values.some((value) => value.length > 0 && !isValidHexColor(value));
    }, [lightFields, darkFields]);

    const selectDraft = async (draft: ThemeDraft) => {
        setSelectedDraftId(draft.id);
        setName(draft.name);
        setLightFields(patchToFields(draft.lightPatch));
        setDarkFields(patchToFields(draft.darkPatch));
        await triggerSensoryFeedback('selection');
    };

    const createBlankDraft = async () => {
        setSelectedDraftId(null);
        setName('');
        setLightFields(EMPTY_FIELDS);
        setDarkFields(EMPTY_FIELDS);
        setApplyOnSave('both');
        await triggerSensoryFeedback('selection');
    };

    const duplicateDraft = async () => {
        if (!selectedDraft) {
            notify.info('Sin tema seleccionado', 'Elegí un draft para duplicarlo.');
            return;
        }
        setSelectedDraftId(null);
        setName(`${selectedDraft.name} Copy`);
        setLightFields(patchToFields(selectedDraft.lightPatch));
        setDarkFields(patchToFields(selectedDraft.darkPatch));
        await triggerSensoryFeedback('selection');
    };

    const saveDraft = async () => {
        if (hasInvalidInputs) {
            notify.error('Hex inválido', 'Corregí los colores con formato #RRGGBB o #RRGGBBAA.');
            return;
        }

        const result = await saveThemeDraft({
            id: selectedDraftId ?? undefined,
            name,
            lightPatch: fieldsToPatch(lightFields),
            darkPatch: fieldsToPatch(darkFields),
        });

        if (!result.ok) {
            notify.error('No se pudo guardar', result.errors.join('\n'));
            return;
        }

        setSelectedDraftId(result.draft.id);

        if (applyOnSave === 'light' || applyOnSave === 'both') {
            await setActiveThemePackId('light', result.draft.id);
        }
        if (applyOnSave === 'dark' || applyOnSave === 'both') {
            await setActiveThemePackId('dark', result.draft.id);
        }

        notify.success('Tema guardado', 'El draft quedó listo y aplicado según tu selección.');
        await triggerSensoryFeedback('success');
    };

    const removeDraft = async () => {
        if (!selectedDraft) {
            notify.info('Sin draft activo', 'Elegí un draft para eliminar.');
            return;
        }
        await deleteThemeDraft(selectedDraft.id);
        setSelectedDraftId(null);
        setName('');
        setLightFields(EMPTY_FIELDS);
        setDarkFields(EMPTY_FIELDS);
        notify.success('Tema eliminado', 'Se eliminó el draft local y se limpió la asignación activa si aplicaba.');
        await triggerSensoryFeedback('warning');
    };

    const renderPreviewCard = (mode: EditorMode, title: string, draftColors: ReturnType<typeof applyThemeColorPatch>['colors']) => {
        return (
            <View style={styles.grow}>
                <Text style={styles.previewTitle}>{title}</Text>
                <View style={[styles.previewCard, { backgroundColor: draftColors.surface, borderColor: draftColors.border }]}> 
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: draftColors.text, fontSize: 13, fontWeight: '900' }}>IronTrain {mode === 'light' ? 'Light' : 'Dark'}</Text>
                        <View style={[styles.previewBtn, { backgroundColor: draftColors.primary.DEFAULT, borderColor: draftColors.primary.dark }]}> 
                            <Text style={[styles.previewBtnText, { color: draftColors.onPrimary }]}>Acción</Text>
                        </View>
                    </View>
                    <View style={{ marginTop: 12, gap: 6 }}>
                        <Text style={{ color: draftColors.text, fontWeight: '800', fontSize: 12 }}>Volumen semanal</Text>
                        <Text style={{ color: draftColors.primary.DEFAULT, fontWeight: '900', fontSize: 18 }}>42,800 kg</Text>
                        <Text style={{ color: draftColors.textMuted, fontSize: 11 }}>+6.2% vs semana anterior</Text>
                    </View>
                    <View style={{ borderTopWidth: 1, borderTopColor: draftColors.border, paddingTop: 8, marginTop: 8 }}>
                        <Text style={{ color: draftColors.textMuted, fontSize: 10 }}>Preview en vivo del draft actual</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                    <View style={styles.titleWrap}>
                        <Palette size={16} color={colors.primary.DEFAULT} />
                        <Text style={styles.title}>Theme Studio</Text>
                    </View>
                    <Text style={styles.subtitle}>Editor avanzado local con preview dual y aplicación inmediata por modo.</Text>
                </View>
                <View style={styles.modeBadge}>
                    <Text style={styles.modeBadgeText}>Activo: {effectiveMode.toUpperCase()}</Text>
                </View>
            </View>

            <View style={{ gap: 8 }}>
                <Text style={styles.sectionLabel}>Tus drafts</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {themeDrafts.map((draft) => {
                        const isSelected = selectedDraftId === draft.id;
                        const isLightActive = activeThemePackIdLight === draft.id;
                        const isDarkActive = activeThemePackIdDark === draft.id;
                        return (
                            <TouchableOpacity
                                key={draft.id}
                                style={[styles.draftChip, isSelected && styles.draftChipActive]}
                                activeOpacity={0.8}
                                onPress={() => { void selectDraft(draft); }}
                            >
                                <Text style={[styles.draftChipText, isSelected && styles.draftChipTextActive]}>{draft.name}</Text>
                                {(isLightActive || isDarkActive) && (
                                    <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 4, fontWeight: '700' }}>
                                        {isLightActive ? 'L' : '-'} · {isDarkActive ? 'D' : '-'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
                <View style={styles.row}>
                    <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={() => { void createBlankDraft(); }}>
                        <Palette size={16} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={() => { void duplicateDraft(); }}>
                        <CopyPlus size={16} color={colors.primary.DEFAULT} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={() => { void removeDraft(); }}>
                        <Trash2 size={16} color={colors.red} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ gap: 8 }}>
                <Text style={styles.sectionLabel}>Metadata</Text>
                <TextInput
                    value={name}
                    onChangeText={setName}
                    style={styles.input}
                    placeholder="Nombre del tema"
                    placeholderTextColor={colors.textMuted}
                />
            </View>

            <View style={{ gap: 8 }}>
                <Text style={styles.sectionLabel}>Edición por modo</Text>
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, styles.grow, editorMode === 'light' && styles.toggleBtnActive]}
                        onPress={() => setEditorMode('light')}
                        activeOpacity={0.85}
                    >
                        <Sun size={15} color={editorMode === 'light' ? colors.primary.DEFAULT : colors.textMuted} />
                        <Text style={[styles.toggleBtnText, editorMode === 'light' && styles.toggleBtnTextActive]}>Light</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, styles.grow, editorMode === 'dark' && styles.toggleBtnActive]}
                        onPress={() => setEditorMode('dark')}
                        activeOpacity={0.85}
                    >
                        <Moon size={15} color={editorMode === 'dark' ? colors.primary.DEFAULT : colors.textMuted} />
                        <Text style={[styles.toggleBtnText, editorMode === 'dark' && styles.toggleBtnTextActive]}>Dark</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ gap: 8 }}>
                {COLOR_FIELD_META.map((field) => {
                    const value = activeFields[field.key];
                    const valid = !value || isValidHexColor(value);
                    return (
                        <View key={field.key} style={styles.colorRow}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.colorRowTitle}>{field.label}</Text>
                                    <Text style={styles.colorRowSub}>{field.description}</Text>
                                </View>
                                <View style={[styles.swatch, { backgroundColor: valid && value ? value : colors.surfaceLighter }]} />
                            </View>
                            <TextInput
                                value={value}
                                onChangeText={(next) => {
                                    const normalized = prettifyHexInput(next);
                                    setActiveFields({ ...activeFields, [field.key]: normalized });
                                }}
                                style={styles.input}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                placeholder="#RRGGBB"
                                placeholderTextColor={colors.textMuted}
                            />
                            <Text style={valid ? styles.helperOk : styles.helperError}>
                                {valid ? 'Formato válido' : 'Formato inválido. Usá #RRGGBB o #RRGGBBAA'}
                            </Text>
                        </View>
                    );
                })}
            </View>

            <View style={{ gap: 8 }}>
                <Text style={styles.sectionLabel}>Preview dual en vivo</Text>
                <View style={styles.row}>
                    {renderPreviewCard('light', 'Light Preview', previewLight.colors)}
                    {renderPreviewCard('dark', 'Dark Preview', previewDark.colors)}
                </View>
            </View>

            <View style={{ gap: 8 }}>
                <Text style={styles.sectionLabel}>Aplicación al guardar</Text>
                <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    {[
                        { id: 'none', label: 'No aplicar', icon: SunMoon },
                        { id: 'light', label: 'Solo Light', icon: Sun },
                        { id: 'dark', label: 'Solo Dark', icon: Moon },
                        { id: 'both', label: 'Light + Dark', icon: SunMoon },
                    ].map((option) => {
                        const Icon = option.icon;
                        const isActive = applyOnSave === option.id;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={[styles.applyChip, isActive && styles.applyChipActive]}
                                onPress={() => setApplyOnSave(option.id as ApplyOnSave)}
                                activeOpacity={0.85}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Icon size={12} color={isActive ? colors.primary.DEFAULT : colors.textMuted} />
                                    <Text style={[styles.applyChipText, isActive && styles.applyChipTextActive]}>{option.label}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <TouchableOpacity
                onPress={() => { void saveDraft(); }}
                style={{
                    borderRadius: 12,
                    backgroundColor: colors.primary.DEFAULT,
                    borderWidth: 1.5,
                    borderColor: colors.primary.dark,
                    paddingVertical: 13,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                }}
                activeOpacity={0.86}
            >
                <Save size={16} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontWeight: '900', fontSize: 14 }}>Guardar y aplicar</Text>
            </TouchableOpacity>
        </View>
    );
}
