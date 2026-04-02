import { useTheme } from '@/src/hooks/useTheme';
import { configService } from '@/src/services/ConfigService';
import { MarketplaceThemePackSummary, SocialApiError, SocialService } from '@/src/services/SocialService';
import { confirm } from '@/src/store/confirmStore';
import {
    applyThemeColorPatch,
    getCoreThemeToken,
    isValidHexColor,
    ThemeColorPatch,
    ThemeDraft,
} from '@/src/theme-engine';
import { notify } from '@/src/utils/notify';
import { triggerSensoryFeedback } from '@/src/utils/sensoryFeedback';
import * as Linking from 'expo-linking';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { COLOR_FIELD_META, EMPTY_FIELDS, META_STORAGE_KEY, REMOTE_LINK_STORAGE_KEY, THEME_STUDIO_STRICT_CONTRAST_STORAGE_KEY, THEMES_EXPANDED_ACTIONS_STORAGE_KEY, THEMES_FILTER_PREFS_STORAGE_KEY } from './theme-studio/constants';
import {
    applyEditorSmartDefaults,
    autoFixThemeContrastFields,
    evaluateThemeContrastAudit,
    fieldsToPatch,
    hexToHslInput,
    hexToRgbInput,
    ModeFallbackColors,
    normalizeRemoteLinkMap,
    normalizeThemeFilterPreferences,
    normalizeThemeMeta,
    parseHslInput,
    parseRgbInput,
    patchToFields,
    prettifyHexInput,
} from './theme-studio/helpers';
import { createThemeStudioStyles } from './theme-studio/styles';
import { ThemeStudioEditorTab } from './theme-studio/ThemeStudioEditorPanel';
import { ThemeStudioThemesTab } from './theme-studio/ThemeStudioThemesTab';
import {
    ActiveFilter,
    ApplyOnSave,
    CatalogItem,
    EditableColorFieldKey,
    EditableColorFields,
    EditorMode,
    LocalThemeMeta,
    MarketplaceStatusFilter,
    SourceFilter,
    StudioTab,
    ThemesFilterPreferences,
} from './theme-studio/types';

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

    const [selectedThemeId, setSelectedThemeId] = useState<string | null>(themeDrafts[0]?.id ?? null);
    const [name, setName] = useState(themeDrafts[0]?.name ?? '');
    const [editorMode, setEditorMode] = useState<EditorMode>('light');
    const [applyOnSave, setApplyOnSave] = useState<ApplyOnSave>('both');
    const [studioTab, setStudioTab] = useState<StudioTab>('themes');
    const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
    const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
    const [statusFilter, setStatusFilter] = useState<MarketplaceStatusFilter>('all');
    const [themeSearch, setThemeSearch] = useState('');
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [editorThemeListExpanded, setEditorThemeListExpanded] = useState(false);
    const [editorAdvancedExpanded, setEditorAdvancedExpanded] = useState(false);
    const [editorVisibilityExpanded, setEditorVisibilityExpanded] = useState(false);
    const [strictContrastMode, setStrictContrastMode] = useState(false);
    const [editorEntryReady, setEditorEntryReady] = useState(false);
    const [editorSelectedCatalogItem, setEditorSelectedCatalogItem] = useState<CatalogItem | null>(null);
    const [newThemeNameInput, setNewThemeNameInput] = useState('');
    const [editorVisibility, setEditorVisibility] = useState<LocalThemeMeta['visibility']>('private');
    const [pickerField, setPickerField] = useState<EditableColorFieldKey | null>(null);
    const [liveFeedback, setLiveFeedback] = useState<{ message: string; tone: 'ok' | 'warn' } | null>(null);
    const [themeMetaMap, setThemeMetaMap] = useState<Record<string, LocalThemeMeta>>({});
    const [remoteThemeLinks, setRemoteThemeLinks] = useState<Record<string, string>>({});
    const [remoteThemes, setRemoteThemes] = useState<MarketplaceThemePackSummary[]>([]);
    const [isLoadingRemoteThemes, setIsLoadingRemoteThemes] = useState(false);
    const [isSavingTheme, setIsSavingTheme] = useState(false);
    const [remoteThemeError, setRemoteThemeError] = useState<string | null>(null);
    const [expandedActionsThemeId, setExpandedActionsThemeId] = useState<string | null>(null);
    const [lightFields, setLightFields] = useState<EditableColorFields>(themeDrafts[0] ? patchToFields(themeDrafts[0].lightPatch) : EMPTY_FIELDS);
    const [darkFields, setDarkFields] = useState<EditableColorFields>(themeDrafts[0] ? patchToFields(themeDrafts[0].darkPatch) : EMPTY_FIELDS);

    const liveFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const stored = configService.get(META_STORAGE_KEY as any);
        setThemeMetaMap(normalizeThemeMeta(stored));

        const storedRemoteLinks = configService.get(REMOTE_LINK_STORAGE_KEY as any);
        setRemoteThemeLinks(normalizeRemoteLinkMap(storedRemoteLinks));

        const storedFilterPrefs = configService.get(THEMES_FILTER_PREFS_STORAGE_KEY as any);
        const filterPrefs = normalizeThemeFilterPreferences(storedFilterPrefs);
        setSourceFilter(filterPrefs.sourceFilter);
        setActiveFilter(filterPrefs.activeFilter);
        setStatusFilter(filterPrefs.statusFilter);
        setThemeSearch(filterPrefs.themeSearch);
        setFiltersExpanded(filterPrefs.filtersExpanded);

        const storedExpanded = configService.get(THEMES_EXPANDED_ACTIONS_STORAGE_KEY as any);
        setExpandedActionsThemeId(typeof storedExpanded === 'string' && storedExpanded.trim().length > 0 ? storedExpanded : null);

        const storedStrictContrast = configService.get(THEME_STUDIO_STRICT_CONTRAST_STORAGE_KEY as any);
        setStrictContrastMode(storedStrictContrast === true);

        return () => {
            if (liveFeedbackTimeoutRef.current) {
                clearTimeout(liveFeedbackTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const preferences: ThemesFilterPreferences = {
            sourceFilter,
            activeFilter,
            statusFilter,
            themeSearch,
            filtersExpanded,
        };
        void configService.set(THEMES_FILTER_PREFS_STORAGE_KEY as any, preferences as any);
    }, [sourceFilter, activeFilter, statusFilter, themeSearch, filtersExpanded]);

    useEffect(() => {
        if (!expandedActionsThemeId) {
            void configService.set(THEMES_EXPANDED_ACTIONS_STORAGE_KEY as any, '' as any);
            return;
        }
        void configService.set(THEMES_EXPANDED_ACTIONS_STORAGE_KEY as any, expandedActionsThemeId as any);
    }, [expandedActionsThemeId]);

    useEffect(() => {
        void configService.set(THEME_STUDIO_STRICT_CONTRAST_STORAGE_KEY as any, strictContrastMode as any);
    }, [strictContrastMode]);

    const persistRemoteThemeLinks = async (next: Record<string, string>) => {
        setRemoteThemeLinks(next);
        await configService.set(REMOTE_LINK_STORAGE_KEY as any, next as any);
    };

    const findRemoteThemeIdByLocalDraftId = (localDraftId: string): string | null => {
        for (const [remoteId, linkedLocalId] of Object.entries(remoteThemeLinks)) {
            if (linkedLocalId === localDraftId) return remoteId;
        }
        return null;
    };

    const normalizeCompare = (value: string): string => value.trim().toLowerCase();
    const slugifyThemeName = (value: string): string =>
        value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

    const resolveOwnedRemoteMatch = async (draft: ThemeDraft): Promise<MarketplaceThemePackSummary | null> => {
        const draftName = draft.name.trim();
        if (!draftName) return null;

        try {
            const ownedCandidates = await SocialService.listMarketplaceThemes({
                scope: 'owned',
                mode: 'both',
                sort: 'new',
                source: 'all',
                page: 1,
                pageSize: 100,
                q: draftName,
            });

            const draftNameKey = normalizeCompare(draftName);
            const draftSlug = slugifyThemeName(draftName);

            return ownedCandidates.find((item) => {
                const sameName = normalizeCompare(item.name) === draftNameKey;
                const sameSlug = item.slug === draftSlug;
                return sameName || sameSlug;
            }) ?? null;
        } catch {
            return null;
        }
    };

    const ensureRemoteLinkForDraft = async (draft: ThemeDraft): Promise<string | null> => {
        const alreadyLinked = findRemoteThemeIdByLocalDraftId(draft.id);
        if (alreadyLinked) return alreadyLinked;

        const matched = await resolveOwnedRemoteMatch(draft);
        if (!matched) return null;

        await persistRemoteThemeLinks({
            ...remoteThemeLinks,
            [matched.id]: draft.id,
        });

        return matched.id;
    };

    const buildMarketplacePayloadFromDraft = (draft: ThemeDraft) => ({
        schemaVersion: 1 as const,
        base: { light: 'core-light' as const, dark: 'core-dark' as const },
        lightPatch: draft.lightPatch,
        darkPatch: draft.darkPatch,
        meta: {
            name: draft.name,
        },
    });

    const formatMarketplaceError = (error: unknown): string => {
        if (error instanceof SocialApiError) {
            const codePart = error.code ? ` (${error.code})` : '';
            return `Marketplace ${error.status}${codePart}: ${error.message}`;
        }
        if (error instanceof Error) {
            return error.message;
        }
        return 'Error desconocido en marketplace.';
    };

    const loadRemoteThemes = async (query?: string) => {
        setIsLoadingRemoteThemes(true);
        try {
            const token = await SocialService.getToken();
            if (!token) {
                setRemoteThemes([]);
                setRemoteThemeError('No hay sesión activa para marketplace. Iniciá sesión e intentá de nuevo.');
                return;
            }

            try {
                const items = await SocialService.listMarketplaceThemes({
                    scope: 'owned',
                    mode: 'both',
                    sort: 'new',
                    source: 'all',
                    page: 1,
                    pageSize: 50,
                    q: query?.trim() || undefined,
                });
                setRemoteThemes(items);
                setRemoteThemeError(null);
            } catch (ownedError) {
                const publicItems = await SocialService.listMarketplaceThemes({
                    scope: 'public',
                    mode: 'both',
                    sort: 'new',
                    source: 'all',
                    page: 1,
                    pageSize: 50,
                    q: query?.trim() || undefined,
                });
                setRemoteThemes(publicItems);
                setRemoteThemeError(`No se pudo cargar "owned". Mostrando catálogo público. ${formatMarketplaceError(ownedError)}`);
            }

            if (query !== undefined) {
                pushLiveFeedback('Catálogo del marketplace actualizado.');
            }
        } catch (error) {
            const errorMessage = formatMarketplaceError(error);
            setRemoteThemeError(errorMessage);
            setRemoteThemes([]);
            if (query !== undefined) {
                pushLiveFeedback(`No se pudo actualizar marketplace. ${errorMessage}`, 'warn');
            }
        } finally {
            setIsLoadingRemoteThemes(false);
        }
    };

    useEffect(() => {
        void loadRemoteThemes();
    }, []);

    useEffect(() => {
        if (remoteThemes.length === 0) return;

        const localIds = new Set(themeDrafts.map((draft) => draft.id));
        const remoteById = new Map(remoteThemes.map((item) => [item.id, item]));
        const usedLocalIds = new Set<string>();
        const nextLinks: Record<string, string> = {};

        for (const [remoteId, localId] of Object.entries(remoteThemeLinks)) {
            if (!remoteById.has(remoteId)) continue;
            if (!localIds.has(localId)) continue;
            if (usedLocalIds.has(localId)) continue;
            nextLinks[remoteId] = localId;
            usedLocalIds.add(localId);
        }

        const localBySlug = new Map<string, string>();
        const duplicatedSlug = new Set<string>();
        const localByName = new Map<string, string>();
        const duplicatedName = new Set<string>();

        for (const draft of themeDrafts) {
            const slug = slugifyThemeName(draft.name);
            const nameKey = normalizeCompare(draft.name);

            if (slug) {
                if (localBySlug.has(slug)) {
                    duplicatedSlug.add(slug);
                } else {
                    localBySlug.set(slug, draft.id);
                }
            }

            if (nameKey) {
                if (localByName.has(nameKey)) {
                    duplicatedName.add(nameKey);
                } else {
                    localByName.set(nameKey, draft.id);
                }
            }
        }

        for (const item of remoteThemes) {
            if (nextLinks[item.id]) continue;

            const remoteSlug = item.slug;
            const remoteName = normalizeCompare(item.name);
            const slugCandidate = remoteSlug && !duplicatedSlug.has(remoteSlug) ? localBySlug.get(remoteSlug) : null;
            const nameCandidate = remoteName && !duplicatedName.has(remoteName) ? localByName.get(remoteName) : null;
            const candidateId = slugCandidate ?? nameCandidate ?? null;

            if (!candidateId || usedLocalIds.has(candidateId)) continue;
            nextLinks[item.id] = candidateId;
            usedLocalIds.add(candidateId);
        }

        const prevSerialized = JSON.stringify(remoteThemeLinks);
        const nextSerialized = JSON.stringify(nextLinks);
        if (prevSerialized !== nextSerialized) {
            void persistRemoteThemeLinks(nextLinks);
        }
    }, [remoteThemes, themeDrafts, remoteThemeLinks]);

    const pushLiveFeedback = (message: string, tone: 'ok' | 'warn' = 'ok') => {
        setLiveFeedback({ message, tone });
        if (liveFeedbackTimeoutRef.current) clearTimeout(liveFeedbackTimeoutRef.current);
        liveFeedbackTimeoutRef.current = setTimeout(() => setLiveFeedback(null), 1800);
    };

    const persistThemeMeta = async (next: Record<string, LocalThemeMeta>) => {
        setThemeMetaMap(next);
        await configService.set(META_STORAGE_KEY as any, next as any);
    };

    const coreThemes: CatalogItem[] = useMemo(() => {
        const coreLight = getCoreThemeToken('light');
        const coreDark = getCoreThemeToken('dark');
        return [
            {
                id: 'core-light',
                name: 'Core Claro',
                source: 'core',
                lightPatch: {},
                darkPatch: {},
                supportsLight: true,
                supportsDark: false,
                isCore: true,
                isVerified: true,
                origin: 'core',
            },
            {
                id: 'core-dark',
                name: 'Core Oscuro',
                source: 'core',
                lightPatch: patchToFields(coreLight.colors as any) ? {} : {},
                darkPatch: patchToFields(coreDark.colors as any) ? {} : {},
                supportsLight: false,
                supportsDark: true,
                isCore: true,
                isVerified: true,
                origin: 'core',
            },
        ];
    }, []);

    const localThemes: CatalogItem[] = useMemo(() => {
        const remoteByLocalDraftId = new Map<string, MarketplaceThemePackSummary>();
        const remoteById = new Map(remoteThemes.map((item) => [item.id, item]));

        for (const [remoteId, localDraftId] of Object.entries(remoteThemeLinks)) {
            const remote = remoteById.get(remoteId);
            if (!remote) continue;
            remoteByLocalDraftId.set(localDraftId, remote);
        }

        return themeDrafts.map((draft) => {
            const linkedRemote = remoteByLocalDraftId.get(draft.id);

            return {
                id: draft.id,
                name: draft.name,
                source: 'community' as const,
                lightPatch: draft.lightPatch,
                darkPatch: draft.darkPatch,
                supportsLight: true,
                supportsDark: true,
                isCore: false,
                isVerified: linkedRemote?.status === 'approved',
                origin: 'local' as const,
                remoteId: linkedRemote?.id,
                remoteStatus: linkedRemote?.status,
                remoteVisibility: linkedRemote?.visibility,
                remoteRatingCount: linkedRemote?.ratingCount,
                remoteDownloadsCount: linkedRemote?.downloadsCount,
            };
        });
    }, [themeDrafts, remoteThemeLinks, remoteThemes]);

    const remoteCatalogThemes: CatalogItem[] = useMemo(() => {
        return remoteThemes
            .filter((item) => !remoteThemeLinks[item.id])
            .map((item) => ({
            id: `remote:${item.id}`,
            name: item.name,
            source: item.isSystem ? 'core' : 'community',
            lightPatch: {},
            darkPatch: {},
            supportsLight: !!item.supportsLight,
            supportsDark: !!item.supportsDark,
            isCore: !!item.isSystem,
            isVerified: item.status === 'approved',
            origin: 'remote' as const,
            remoteId: item.id,
            remoteStatus: item.status,
            remoteVisibility: item.visibility,
            remoteRatingCount: item.ratingCount,
            remoteDownloadsCount: item.downloadsCount,
        }));
    }, [remoteThemes, remoteThemeLinks]);

    const catalog = useMemo(() => [...coreThemes, ...localThemes, ...remoteCatalogThemes], [coreThemes, localThemes, remoteCatalogThemes]);
    const editorSelectableThemes = useMemo(() => [...coreThemes, ...localThemes], [coreThemes, localThemes]);
    const localMarketplaceStateByDraftId = useMemo(() => {
        const map: Record<string, { visibility: 'private' | 'friends' | 'public'; status: string }> = {};
        for (const remoteItem of remoteThemes) {
            const linkedLocalId = remoteThemeLinks[remoteItem.id];
            if (!linkedLocalId) continue;
            map[linkedLocalId] = {
                visibility: remoteItem.visibility ?? 'private',
                status: remoteItem.status ?? 'draft',
            };
        }
        return map;
    }, [remoteThemes, remoteThemeLinks]);

    const selectedDraft = useMemo(() => themeDrafts.find((draft) => draft.id === selectedThemeId) ?? null, [themeDrafts, selectedThemeId]);

    useEffect(() => {
        if (!selectedDraft) {
            setEditorVisibility('private');
            return;
        }
        const current = themeMetaMap[selectedDraft.id];
        setEditorVisibility(current?.visibility ?? 'private');
    }, [selectedDraft, themeMetaMap]);

    const activeFields = editorMode === 'light' ? lightFields : darkFields;
    const setActiveFields = (next: EditableColorFields) => {
        if (editorMode === 'light') setLightFields(next);
        else setDarkFields(next);
    };

    const filteredCatalog = useMemo(() => {
        const query = themeSearch.trim().toLowerCase();
        return catalog.filter((item) => {
            const linkedDraftId = item.remoteId ? remoteThemeLinks[item.remoteId] : null;
            const candidateThemeId = linkedDraftId ?? item.id;
            const isActive = item.isCore
                ? (item.id === 'core-light' ? activeThemePackIdLight === null : activeThemePackIdDark === null)
                : activeThemePackIdLight === candidateThemeId || activeThemePackIdDark === candidateThemeId;

            if (sourceFilter === 'core' && item.source !== 'core') return false;
            if (sourceFilter === 'community' && item.source !== 'community') return false;
            if (activeFilter === 'active' && !isActive) return false;
            if (activeFilter === 'inactive' && isActive) return false;
            if (statusFilter !== 'all' && item.origin === 'remote' && item.remoteStatus !== statusFilter) return false;
            if (!query) return true;
            return item.name.toLowerCase().includes(query);
        });
    }, [catalog, sourceFilter, activeFilter, statusFilter, themeSearch, activeThemePackIdLight, activeThemePackIdDark, remoteThemeLinks]);

    const hasInvalidInputs = useMemo(() => {
        const values = [...Object.values(lightFields), ...Object.values(darkFields)];
        return values.some((value) => value.length > 0 && !isValidHexColor(value));
    }, [lightFields, darkFields]);

    const validColorCount = useMemo(() => {
        const values = [...Object.values(lightFields), ...Object.values(darkFields)];
        return values.filter((value) => value.length > 0 && isValidHexColor(value)).length;
    }, [lightFields, darkFields]);

    const hasAnyValidColor = validColorCount > 0;
    const isCreationFlow = !selectedThemeId;
    const hasUnsavedNewDraft = isCreationFlow && (name.trim().length > 0 || hasAnyValidColor);
    const selectedThemeMeta = selectedThemeId ? themeMetaMap[selectedThemeId] : null;
    const isEditingCoreTheme = editorSelectedCatalogItem?.isCore === true || selectedThemeMeta?.isCoreDerived === true;

    const basicSaveDisabledReason = useMemo(() => {
        if (!name.trim()) return 'Definí un nombre antes de guardar.';
        if (hasInvalidInputs) return 'Corregí los colores inválidos antes de guardar.';
        if (isCreationFlow && !hasAnyValidColor) return 'Agregá al menos 1 color válido para crear el tema.';
        return null;
    }, [name, hasInvalidInputs, isCreationFlow, hasAnyValidColor]);

    const requestThemeSwitch = () => {
        if (hasUnsavedNewDraft) {
            confirm.destructive(
                'Cambiar tema',
                'Tenés cambios de un tema nuevo sin guardar. Si cambiás de tema se perderán. ¿Querés continuar?',
                () => {
                    setEditorEntryReady(false);
                },
                'Cambiar igual'
            );
            return;
        }

        setEditorEntryReady(false);
    };

    const previewLight = useMemo(() => {
        return applyThemeColorPatch(getCoreThemeToken('light'), fieldsToPatch(lightFields), { id: 'preview-light', label: name || 'Preview Light' });
    }, [lightFields, name]);

    const previewDark = useMemo(() => {
        return applyThemeColorPatch(getCoreThemeToken('dark'), fieldsToPatch(darkFields), { id: 'preview-dark', label: name || 'Preview Dark' });
    }, [darkFields, name]);

    const buildContrastFallback = (mode: EditorMode): ModeFallbackColors => {
        const palette = mode === 'light' ? previewLight.colors : previewDark.colors;
        return {
            primary: {
                DEFAULT: palette.primary?.DEFAULT ?? colors.primary.DEFAULT,
                light: palette.primary?.light ?? colors.primary.light,
                dark: palette.primary?.dark ?? colors.primary.dark,
            },
            onPrimary: palette.onPrimary ?? colors.onPrimary,
            background: palette.background ?? colors.background,
            surface: palette.surface ?? colors.surface,
            surfaceLighter: palette.surfaceLighter ?? colors.surfaceLighter,
            text: palette.text ?? colors.text,
            textMuted: palette.textMuted ?? colors.textMuted,
            border: palette.border ?? colors.border,
        };
    };

    const lightContrastReport = useMemo(
        () => evaluateThemeContrastAudit(lightFields, 'light', buildContrastFallback('light')),
        [lightFields, previewLight.colors, colors],
    );

    const darkContrastReport = useMemo(
        () => evaluateThemeContrastAudit(darkFields, 'dark', buildContrastFallback('dark')),
        [darkFields, previewDark.colors, colors],
    );

    const lightResolvedFields = useMemo(
        () => applyEditorSmartDefaults(lightFields, 'light', buildContrastFallback('light')),
        [lightFields, previewLight.colors, colors],
    );

    const darkResolvedFields = useMemo(
        () => applyEditorSmartDefaults(darkFields, 'dark', buildContrastFallback('dark')),
        [darkFields, previewDark.colors, colors],
    );

    const contrastBlockersTotal = lightContrastReport.blockers + darkContrastReport.blockers;
    const contrastWarningsTotal = lightContrastReport.warnings + darkContrastReport.warnings;
    const contrastScoreAverage = Math.round((lightContrastReport.score + darkContrastReport.score) / 2);
    const effectiveContrastBlockersTotal = contrastBlockersTotal + (strictContrastMode ? contrastWarningsTotal : 0);

    const saveDisabledReason = useMemo(() => {
        if (basicSaveDisabledReason) return basicSaveDisabledReason;
        if (effectiveContrastBlockersTotal > 0) {
            return strictContrastMode
                ? `Modo AA estricto activo: ${effectiveContrastBlockersTotal} bloqueos de contraste (incluye warnings).`
                : `Hay ${effectiveContrastBlockersTotal} bloqueos críticos de contraste.`;
        }
        return null;
    }, [basicSaveDisabledReason, effectiveContrastBlockersTotal, strictContrastMode]);

    const canSaveTheme = saveDisabledReason === null;

    const autoFixContrast = async () => {
        const nextLight = autoFixThemeContrastFields(lightFields, 'light', buildContrastFallback('light'));
        const nextDark = autoFixThemeContrastFields(darkFields, 'dark', buildContrastFallback('dark'));
        setLightFields(nextLight);
        setDarkFields(nextDark);
        pushLiveFeedback('Autocorrección de contraste aplicada. Revisá el preview antes de guardar.');
        await triggerSensoryFeedback('selection');
    };

    const toggleStrictContrastMode = async () => {
        const nextValue = !strictContrastMode;
        setStrictContrastMode(nextValue);
        pushLiveFeedback(nextValue ? 'Modo AA estricto activado.' : 'Modo AA estricto desactivado.');
        await triggerSensoryFeedback('selection');
    };

    const getSuggestedColorForField = (fieldKey: EditableColorFieldKey, mode: EditorMode): string | null => {
        const modeFields = mode === 'light' ? lightFields : darkFields;
        const nextMode = autoFixThemeContrastFields(modeFields, mode, buildContrastFallback(mode));
        const suggested = nextMode[fieldKey];
        if (isValidHexColor(suggested)) return suggested;
        return null;
    };

    const applySuggestedColorForField = async (fieldKey: EditableColorFieldKey, mode: EditorMode, color: string) => {
        if (!isValidHexColor(color)) return;
        if (mode === 'light') {
            setLightFields((current) => ({ ...current, [fieldKey]: color }));
        } else {
            setDarkFields((current) => ({ ...current, [fieldKey]: color }));
        }
        pushLiveFeedback(`Sugerencia aplicada en modo ${mode === 'light' ? 'Claro' : 'Oscuro'}.`);
        await triggerSensoryFeedback('tapLight');
    };

    const styles = useMemo(() => createThemeStudioStyles(colors), [colors]);

    const getStatusLabel = (status?: MarketplaceThemePackSummary['status']) => {
        switch (status) {
            case 'approved':
                return 'Aprobado';
            case 'pending_review':
                return 'En revisión';
            case 'rejected':
                return 'Rechazado';
            case 'suspended':
                return 'Suspendido';
            case 'draft':
                return 'Borrador';
            default:
                return 'Sin estado';
        }
    };

    const ensureLocalDraftForItem = async (item: CatalogItem): Promise<ThemeDraft | null> => {
        if (item.origin === 'local') {
            return themeDrafts.find((value) => value.id === item.id) ?? null;
        }

        if (item.origin !== 'remote' || !item.remoteId) return null;

        const linkedDraftId = remoteThemeLinks[item.remoteId];
        if (linkedDraftId) {
            const linked = themeDrafts.find((value) => value.id === linkedDraftId) ?? null;
            if (linked) return linked;
        }

        const detail = await SocialService.getMarketplaceThemeDetail(item.remoteId);
        const lightPatch = (detail.payload?.lightPatch ?? {}) as ThemeColorPatch;
        const darkPatch = (detail.payload?.darkPatch ?? {}) as ThemeColorPatch;
        const result = await saveThemeDraft({
            name: `${detail.name} (Marketplace)`,
            lightPatch,
            darkPatch,
        });

        if (!result.ok) {
            notify.error('No se pudo sincronizar', result.errors.join('\n'));
            return null;
        }

        const nextLinks = {
            ...remoteThemeLinks,
            [item.remoteId]: result.draft.id,
        };
        await persistRemoteThemeLinks(nextLinks);
        return result.draft;
    };

    const selectThemeForEdit = async (item: CatalogItem) => {
        setEditorSelectedCatalogItem(item);
        if (item.isCore) {
            setSelectedThemeId(null);
            setName(item.name === 'Core Claro' ? 'Core Claro Remix' : 'Core Oscuro Remix');
            setLightFields(EMPTY_FIELDS);
            setDarkFields(EMPTY_FIELDS);
            setEditorVisibility('private');
        } else {
            const draft = await ensureLocalDraftForItem(item);
            if (!draft) return;
            setSelectedThemeId(draft.id);
            setName(draft.name);
            setLightFields(patchToFields(draft.lightPatch));
            setDarkFields(patchToFields(draft.darkPatch));
        }
        setEditorEntryReady(true);
        setStudioTab('editor');
        pushLiveFeedback(`Tema "${item.name}" listo para editar.`);
        await triggerSensoryFeedback('selection');
    };

    const createBlankTheme = async () => {
        setEditorSelectedCatalogItem(null);
        setSelectedThemeId(null);
        setName('');
        setLightFields(EMPTY_FIELDS);
        setDarkFields(EMPTY_FIELDS);
        setEditorVisibility('private');
        setApplyOnSave('both');
        setEditorEntryReady(true);
        setStudioTab('editor');
        pushLiveFeedback('Nuevo tema en blanco listo para crear.', 'warn');
        await triggerSensoryFeedback('selection');
    };

    const createNamedThemeFromEditor = async () => {
        const nextName = newThemeNameInput.trim();
        if (!nextName) {
            notify.info('Nombre requerido', 'Ingresá un nombre para crear el tema.');
            pushLiveFeedback('Ingresá un nombre antes de crear el tema.', 'warn');
            await triggerSensoryFeedback('warning');
            return;
        }

        setEditorSelectedCatalogItem(null);
        setSelectedThemeId(null);
        setName(nextName);
        setLightFields(EMPTY_FIELDS);
        setDarkFields(EMPTY_FIELDS);
        setApplyOnSave('both');
        setEditorVisibility('private');
        setEditorEntryReady(true);
        setNewThemeNameInput('');
        setEditorThemeListExpanded(false);
        pushLiveFeedback(`Nuevo tema "${nextName}" listo para editar.`);
        await triggerSensoryFeedback('selection');
    };

    const duplicateTheme = async () => {
        if (!selectedDraft) {
            notify.info('Sin tema seleccionado', 'Elegí un tema de comunidad para duplicarlo.');
            return;
        }

        const proceed = async () => {
            setEditorSelectedCatalogItem(null);
            setSelectedThemeId(null);
            setName(`${selectedDraft.name} Copy`);
            setLightFields(patchToFields(selectedDraft.lightPatch));
            setDarkFields(patchToFields(selectedDraft.darkPatch));
            setEditorVisibility(themeMetaMap[selectedDraft.id]?.visibility ?? 'private');
            setStudioTab('editor');
            pushLiveFeedback(`Copia preparada desde "${selectedDraft.name}".`);
            await triggerSensoryFeedback('selection');
        };

        confirm.ask(
            'Duplicar tema',
            `Se va a crear una copia editable de "${selectedDraft.name}".`,
            () => {
                void proceed();
            },
            'Duplicar'
        );
    };

    const removeTheme = async () => {
        if (!selectedDraft) {
            notify.info('Sin tema activo', 'Elegí un tema de comunidad para eliminar.');
            return;
        }

        const proceed = async () => {
            await deleteThemeDraft(selectedDraft.id);
            setEditorSelectedCatalogItem(null);
            setSelectedThemeId(null);
            setName('');
            setLightFields(EMPTY_FIELDS);
            setDarkFields(EMPTY_FIELDS);

            const nextMeta = { ...themeMetaMap };
            delete nextMeta[selectedDraft.id];
            await persistThemeMeta(nextMeta);

            notify.success('Tema eliminado', 'Se eliminó el tema local y se limpiaron asignaciones activas si aplicaba.');
            pushLiveFeedback('Tema eliminado del catálogo local.', 'warn');
            await triggerSensoryFeedback('warning');
        };

        confirm.destructive(
            'Eliminar tema',
            `Se eliminará "${selectedDraft.name}" y no se puede deshacer.`,
            () => {
                void proceed();
            },
            'Eliminar'
        );
    };

    const saveTheme = async () => {
        if (isSavingTheme) return;

        const trimmedName = name.trim();
        if (!trimmedName) {
            notify.error('Nombre requerido', 'Ingresá un nombre antes de guardar el tema.');
            pushLiveFeedback('Falta nombre del tema.', 'warn');
            await triggerSensoryFeedback('warning');
            return;
        }

        if (hasInvalidInputs) {
            notify.error('Color inválido', 'Corregí los valores HEX o RGB antes de guardar.');
            pushLiveFeedback('Hay colores inválidos en el editor.', 'warn');
            return;
        }

        if (!selectedThemeId && !hasAnyValidColor) {
            notify.info('Definí al menos un color', 'Para crear un tema nuevo, agregá al menos un color válido.');
            pushLiveFeedback('Agregá al menos un color válido para crear el tema.', 'warn');
            await triggerSensoryFeedback('warning');
            return;
        }

        if (effectiveContrastBlockersTotal > 0) {
            notify.error(
                'Contraste insuficiente',
                strictContrastMode
                    ? `Modo AA estricto: hay ${effectiveContrastBlockersTotal} chequeos sin cumplir (warnings incluidos).`
                    : `Hay ${effectiveContrastBlockersTotal} chequeos críticos sin cumplir.`,
            );
            pushLiveFeedback('No se puede guardar hasta resolver bloqueos críticos de contraste.', 'warn');
            await triggerSensoryFeedback('warning');
            return;
        }

        setIsSavingTheme(true);
        try {
            const nextLightFields = applyEditorSmartDefaults(lightFields, 'light', previewLight.colors as any);
            const nextDarkFields = applyEditorSmartDefaults(darkFields, 'dark', previewDark.colors as any);

            const result = await saveThemeDraft({
                id: selectedThemeId ?? undefined,
                name: trimmedName,
                lightPatch: fieldsToPatch(nextLightFields),
                darkPatch: fieldsToPatch(nextDarkFields),
            });

            if (!result.ok) {
                notify.error('No se pudo guardar', result.errors.join('\n'));
                pushLiveFeedback('No se pudo guardar el tema.', 'warn');
                return;
            }

            setSelectedThemeId(result.draft.id);
            setEditorSelectedCatalogItem({
                id: result.draft.id,
                name: result.draft.name,
                source: 'community',
                lightPatch: result.draft.lightPatch,
                darkPatch: result.draft.darkPatch,
                supportsLight: true,
                supportsDark: true,
                isCore: false,
                isVerified: false,
                origin: 'local',
            });

            if (!themeMetaMap[result.draft.id]) {
                const nextMeta: Record<string, LocalThemeMeta> = {
                    ...themeMetaMap,
                    [result.draft.id]: {
                        visibility: isEditingCoreTheme ? 'private' : editorVisibility,
                        isBanned: false,
                        commentsCount: 0,
                        isCoreDerived: isEditingCoreTheme,
                    },
                };
                await persistThemeMeta(nextMeta);
            } else {
                const nextMeta: Record<string, LocalThemeMeta> = {
                    ...themeMetaMap,
                    [result.draft.id]: {
                        ...(themeMetaMap[result.draft.id] ?? { isBanned: false, commentsCount: 0 }),
                        visibility: isEditingCoreTheme ? 'private' : editorVisibility,
                        isBanned: themeMetaMap[result.draft.id]?.isBanned ?? false,
                        commentsCount: themeMetaMap[result.draft.id]?.commentsCount ?? 0,
                        isCoreDerived: isEditingCoreTheme || themeMetaMap[result.draft.id]?.isCoreDerived === true,
                    },
                };
                await persistThemeMeta(nextMeta);
            }

            const effectiveVisibility: LocalThemeMeta['visibility'] = isEditingCoreTheme ? 'private' : editorVisibility;

            if (!isEditingCoreTheme && effectiveVisibility !== 'private') {
                let linkedRemoteId = await ensureRemoteLinkForDraft(result.draft);
                const payload = buildMarketplacePayloadFromDraft(result.draft);

                try {
                    if (!linkedRemoteId) {
                        const created = await SocialService.createMarketplaceThemePack({
                            name: result.draft.name,
                            description: `Tema creado en IronTrain (${effectiveVisibility === 'friends' ? 'solo amigos' : 'público'}).`,
                            tags: ['irontrain', 'theme'],
                            supportsLight: true,
                            supportsDark: true,
                            visibility: effectiveVisibility,
                            payload,
                        });

                        await persistRemoteThemeLinks({
                            ...remoteThemeLinks,
                            [created.id]: result.draft.id,
                        });
                        linkedRemoteId = created.id;

                        pushLiveFeedback(
                            effectiveVisibility === 'friends'
                                ? 'Tema compartido para amigos en marketplace.'
                                : 'Tema enviado a marketplace (público).'
                        );
                    } else {
                        await SocialService.createMarketplaceThemeVersion(linkedRemoteId, {
                            payload,
                            changelog: 'Actualización desde Theme Studio móvil',
                        });
                        await SocialService.updateMarketplaceThemePack(linkedRemoteId, {
                            visibility: effectiveVisibility,
                            name: result.draft.name,
                        });

                        pushLiveFeedback(
                            effectiveVisibility === 'friends'
                                ? 'Tema actualizado para visibilidad de amigos.'
                                : 'Tema actualizado para visibilidad pública.'
                        );
                    }
                } catch {
                    pushLiveFeedback('Guardado local OK; no se pudo sincronizar marketplace.', 'warn');
                }
            }

            if (applyOnSave === 'light' || applyOnSave === 'both') {
                await setActiveThemePackId('light', result.draft.id);
            }
            if (applyOnSave === 'dark' || applyOnSave === 'both') {
                await setActiveThemePackId('dark', result.draft.id);
            }

            notify.success('Tema guardado', 'El tema quedó listo y aplicado según tu selección.');
            pushLiveFeedback('Tema guardado y aplicado correctamente.');
            await triggerSensoryFeedback('success');
        } finally {
            setIsSavingTheme(false);
        }
    };

    const assignTheme = async (mode: 'light' | 'dark', item: CatalogItem) => {
        if (item.isCore) {
            await setActiveThemePackId(mode, null);
            notify.success('Tema core activado', `Se activó el tema core para modo ${mode === 'light' ? 'Claro' : 'Oscuro'}.`);
        } else {
            const draft = await ensureLocalDraftForItem(item);
            if (!draft) return;
            await setActiveThemePackId(mode, draft.id);
            notify.success('Tema activado', `Se activó "${item.name}" en modo ${mode === 'light' ? 'Claro' : 'Oscuro'}.`);
        }

        pushLiveFeedback(`Tema aplicado en modo ${mode === 'light' ? 'Claro' : 'Oscuro'}.`);
        await triggerSensoryFeedback('success');
    };

    const toggleVisibility = async (themeId: string) => {
        const current = themeMetaMap[themeId] ?? { visibility: 'private', isBanned: false, commentsCount: 0 };

        if (current.isCoreDerived) {
            const next = {
                ...themeMetaMap,
                [themeId]: {
                    ...current,
                    visibility: 'private' as const,
                    isCoreDerived: true,
                },
            };
            await persistThemeMeta(next);
            pushLiveFeedback('Los temas derivados de core mantienen visibilidad privada.', 'warn');
            await triggerSensoryFeedback('warning');
            return;
        }

        const nextVisibility: LocalThemeMeta['visibility'] =
            current.visibility === 'private' ? 'friends' : current.visibility === 'friends' ? 'public' : 'private';
        const next = {
            ...themeMetaMap,
            [themeId]: {
                ...current,
                visibility: nextVisibility,
            },
        };
        await persistThemeMeta(next);

        let linkedRemoteId = findRemoteThemeIdByLocalDraftId(themeId);
        if (!linkedRemoteId && nextVisibility !== 'private') {
            const localDraft = themeDrafts.find((draft) => draft.id === themeId) ?? null;
            if (localDraft) {
                linkedRemoteId = await ensureRemoteLinkForDraft(localDraft);
            }
        }
        if (linkedRemoteId) {
            try {
                await SocialService.updateMarketplaceThemePack(linkedRemoteId, { visibility: nextVisibility });
            } catch {
                pushLiveFeedback('Visibilidad local actualizada; marketplace pendiente de sincronizar.', 'warn');
            }
        }

        const visibilityLabel = next[themeId].visibility === 'public' ? 'público' : next[themeId].visibility === 'friends' ? 'amigos' : 'privado';
        pushLiveFeedback(`Visibilidad cambiada a ${visibilityLabel}.`);
        await triggerSensoryFeedback('selection');
    };

    const toggleBanned = async (themeId: string) => {
        const current = themeMetaMap[themeId] ?? { visibility: 'private', isBanned: false, commentsCount: 0 };
        confirm.ask(
            current.isBanned ? 'Quitar baneo' : 'Marcar baneado',
            current.isBanned
                ? 'Se quitará la marca de baneo para este tema.'
                : 'Se marcará este tema como baneado en tu catálogo local.',
            () => {
                void (async () => {
                    const next = {
                        ...themeMetaMap,
                        [themeId]: {
                            ...current,
                            isBanned: !current.isBanned,
                        },
                    };
                    await persistThemeMeta(next);
                    pushLiveFeedback(next[themeId].isBanned ? 'Tema marcado como baneado.' : 'Tema restaurado.');
                    await triggerSensoryFeedback(next[themeId].isBanned ? 'warning' : 'selection');
                })();
            },
            current.isBanned ? 'Quitar baneo' : 'Marcar'
        );
    };

    const openMarketplaceForTheme = async (item: CatalogItem) => {
        const target = `https://irontrain.motiona.xyz/feed?view=themes&q=${encodeURIComponent(item.name)}`;
        try {
            await Linking.openURL(target);
            pushLiveFeedback('Marketplace abierto para este tema.');
            await triggerSensoryFeedback('selection');
        } catch {
            notify.error('No se pudo abrir', 'No fue posible abrir el marketplace para este tema.');
            pushLiveFeedback('No se pudo abrir marketplace.', 'warn');
        }
    };

    const updateFieldFromHex = async (fieldKey: EditableColorFieldKey, rawValue: string) => {
        const normalized = prettifyHexInput(rawValue);
        setActiveFields({ ...activeFields, [fieldKey]: normalized });
        if (!normalized) {
            pushLiveFeedback(`${fieldKey} limpiado.`, 'warn');
            await triggerSensoryFeedback('tapLight');
            return;
        }
        if (isValidHexColor(normalized)) {
            pushLiveFeedback(`${fieldKey} actualizado correctamente.`);
            await triggerSensoryFeedback('tapLight');
        }
    };

    const updateFieldFromRgb = async (fieldKey: EditableColorFieldKey, rawValue: string) => {
        if (!rawValue.trim()) {
            setActiveFields({ ...activeFields, [fieldKey]: '' });
            pushLiveFeedback(`${fieldKey} limpiado.`, 'warn');
            await triggerSensoryFeedback('tapLight');
            return;
        }

        const parsed = parseRgbInput(rawValue);
        if (!parsed.ok) {
            pushLiveFeedback('RGB inválido. Usá formato 255, 255, 255.', 'warn');
            return;
        }

        setActiveFields({ ...activeFields, [fieldKey]: parsed.hex });
        pushLiveFeedback(`${fieldKey} actualizado desde RGB.`);
        await triggerSensoryFeedback('tapLight');
    };

    const updateFieldFromHsl = async (fieldKey: EditableColorFieldKey, rawValue: string) => {
        if (!rawValue.trim()) {
            setActiveFields({ ...activeFields, [fieldKey]: '' });
            pushLiveFeedback(`${fieldKey} limpiado.`, 'warn');
            await triggerSensoryFeedback('tapLight');
            return;
        }

        const parsed = parseHslInput(rawValue);
        if (!parsed.ok) {
            pushLiveFeedback('HSL inválido. Usá formato 210, 60, 50.', 'warn');
            return;
        }

        setActiveFields({ ...activeFields, [fieldKey]: parsed.hex });
        pushLiveFeedback(`${fieldKey} actualizado desde HSL.`);
        await triggerSensoryFeedback('tapLight');
    };

    const setEditorThemeVisibility = async (visibility: LocalThemeMeta['visibility']) => {
        if (isEditingCoreTheme) {
            if (selectedThemeId) {
                const current = themeMetaMap[selectedThemeId] ?? { visibility: 'private', isBanned: false, commentsCount: 0, isCoreDerived: true };
                const next = {
                    ...themeMetaMap,
                    [selectedThemeId]: {
                        ...current,
                        visibility: 'private' as const,
                        isCoreDerived: true,
                    },
                };
                await persistThemeMeta(next);
            }
            setEditorVisibility('private');
            pushLiveFeedback('La visibilidad del tema core es fija y no se puede cambiar.', 'warn');
            await triggerSensoryFeedback('warning');
            return;
        }

        setEditorVisibility(visibility);
        if (selectedDraft) {
            const current = themeMetaMap[selectedDraft.id] ?? { visibility: 'private', isBanned: false, commentsCount: 0 };
            const next = {
                ...themeMetaMap,
                [selectedDraft.id]: {
                    ...current,
                    visibility,
                },
            };
            await persistThemeMeta(next);
        }
        const label = visibility === 'public' ? 'público' : visibility === 'friends' ? 'amigos' : 'privado';
        pushLiveFeedback(`Visibilidad del editor: ${label}.`);
        await triggerSensoryFeedback('selection');
    };

    const selectColorFromPicker = async (fieldKey: EditableColorFieldKey, value: string) => {
        setActiveFields({ ...activeFields, [fieldKey]: value });
        setPickerField(null);
        pushLiveFeedback(`${fieldKey} seleccionado desde picker.`);
        await triggerSensoryFeedback('selection');
    };

    const renderPreviewCard = (mode: EditorMode, title: string, draftColors: ReturnType<typeof applyThemeColorPatch>['colors']) => {
        return (
            <View style={styles.grow}>
                <Text style={styles.previewTitle}>{title}</Text>
                <View style={[styles.previewCard, { backgroundColor: draftColors.surface, borderColor: draftColors.border }]}> 
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: draftColors.text, fontSize: 13, fontWeight: '900' }}>IronTrain {mode === 'light' ? 'Claro' : 'Oscuro'}</Text>
                        <View style={[styles.previewBtn, { backgroundColor: draftColors.primary.DEFAULT, borderColor: draftColors.primary.dark }]}> 
                            <Text style={[styles.previewBtnText, { color: draftColors.onPrimary }]}>Acción</Text>
                        </View>
                    </View>
                    <View style={{ marginTop: 10, gap: 5 }}>
                        <Text style={{ color: draftColors.text, fontWeight: '800', fontSize: 12 }}>Volumen semanal</Text>
                        <Text style={{ color: draftColors.primary.DEFAULT, fontWeight: '900', fontSize: 17 }}>42,800 kg</Text>
                        <Text style={{ color: draftColors.textMuted, fontSize: 10 }}>+6.2% vs semana anterior</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderThemeSummaryLine = (item: CatalogItem, isActiveLight: boolean, isActiveDark: boolean) => {
        const localMeta = themeMetaMap[item.id] ?? { visibility: item.isCore ? 'public' : 'private', isBanned: false, commentsCount: 0 };
        const hasRemoteState = !!item.remoteId;
        const visibility = (item.origin === 'remote' || hasRemoteState)
            ? (item.remoteVisibility ?? 'private')
            : (localMeta.isCoreDerived ? 'private' : localMeta.visibility);
        const statusLabel = (item.origin === 'remote' || hasRemoteState)
            ? getStatusLabel(item.remoteStatus)
            : item.isVerified
                ? 'Verificado'
                : (localMeta.isBanned ? 'Baneado' : 'Sin verificar');
        const commentsCount = (item.origin === 'remote' || hasRemoteState) ? (item.remoteRatingCount ?? 0) : localMeta.commentsCount;
        const sourceLabel = item.isCore
            ? 'Core'
            : (localMeta.isCoreDerived
                ? 'Core Remix'
                : (hasRemoteState ? 'Marketplace' : 'Comunidad'));
        const visibilityLabel = visibility === 'public' ? 'Público' : visibility === 'friends' ? 'Amigos' : 'Privado';
        const activeLabel = isActiveLight || isActiveDark
            ? `${isActiveLight ? 'Claro' : '-'} · ${isActiveDark ? 'Oscuro' : '-'}`
            : 'Sin activar';
        const remoteSignals = (item.origin === 'remote' || hasRemoteState) ? ` · ${item.remoteDownloadsCount ?? 0} desc` : '';
        const text = `${sourceLabel} · ${visibilityLabel} · ${statusLabel} · ${activeLabel} · ${commentsCount} com${remoteSignals}`;

        return (
            <Text numberOfLines={1} style={styles.compactMetaLine}>{text}</Text>
        );
    };

    const activeFiltersCount =
        (sourceFilter !== 'all' ? 1 : 0) +
        (activeFilter !== 'all' ? 1 : 0) +
        (statusFilter !== 'all' ? 1 : 0) +
        (themeSearch.trim().length > 0 ? 1 : 0);

    const onFeedbackSelection = () => {
        void triggerSensoryFeedback('selection');
    };

    const renderThemesTab = () => (
        <ThemeStudioThemesTab
            styles={styles}
            colors={colors}
            selectedDraft={selectedDraft}
            themeDrafts={themeDrafts}
            activeThemePackIdLight={activeThemePackIdLight}
            activeThemePackIdDark={activeThemePackIdDark}
            isLoadingRemoteThemes={isLoadingRemoteThemes}
            remoteThemesCount={remoteThemes.length}
            sourceFilter={sourceFilter}
            activeFilter={activeFilter}
            statusFilter={statusFilter}
            themeSearch={themeSearch}
            filtersExpanded={filtersExpanded}
            activeFiltersCount={activeFiltersCount}
            remoteThemeError={remoteThemeError}
            filteredCatalog={filteredCatalog}
            remoteThemeLinks={remoteThemeLinks}
            selectedThemeId={selectedThemeId}
            themeMetaMap={themeMetaMap}
            expandedActionsThemeId={expandedActionsThemeId}
            localMarketplaceStateByDraftId={localMarketplaceStateByDraftId}
            onFeedbackSelection={onFeedbackSelection}
            onLoadRemoteThemes={(query) => {
                void loadRemoteThemes(query);
            }}
            onSetFiltersExpanded={setFiltersExpanded}
            onSetSourceFilter={setSourceFilter}
            onSetActiveFilter={setActiveFilter}
            onSetStatusFilter={setStatusFilter}
            onSetThemeSearch={setThemeSearch}
            onSelectThemeForEdit={(item) => {
                void selectThemeForEdit(item);
            }}
            onAssignTheme={(mode, item) => {
                void assignTheme(mode, item);
            }}
            onSetExpandedActionsThemeId={setExpandedActionsThemeId}
            onOpenMarketplaceForTheme={(item) => {
                void openMarketplaceForTheme(item);
            }}
            onToggleVisibility={(themeId) => {
                void toggleVisibility(themeId);
            }}
            onToggleBanned={(themeId) => {
                void toggleBanned(themeId);
            }}
            onCreateBlankTheme={() => {
                void createBlankTheme();
            }}
            onDuplicateTheme={() => {
                void duplicateTheme();
            }}
            onRemoveTheme={() => {
                void removeTheme();
            }}
            renderThemeSummaryLine={renderThemeSummaryLine}
        />
    );

    const renderEditorTab = () => (
        <ThemeStudioEditorTab
            styles={styles}
            colors={colors}
            name={name}
            setName={setName}
            editorThemeListExpanded={editorThemeListExpanded}
            setEditorThemeListExpanded={setEditorThemeListExpanded}
            newThemeNameInput={newThemeNameInput}
            setNewThemeNameInput={setNewThemeNameInput}
            editorSelectableThemes={editorSelectableThemes}
            selectedThemeId={selectedThemeId}
            editorMode={editorMode}
            setEditorMode={setEditorMode}
            applyOnSave={applyOnSave}
            setApplyOnSave={setApplyOnSave}
            editorAdvancedExpanded={editorAdvancedExpanded}
            setEditorAdvancedExpanded={setEditorAdvancedExpanded}
            editorVisibilityExpanded={editorVisibilityExpanded}
            setEditorVisibilityExpanded={setEditorVisibilityExpanded}
            editorVisibility={editorVisibility}
            selectedDraft={selectedDraft}
            colorFieldMeta={COLOR_FIELD_META}
            activeFields={activeFields}
            pickerField={pickerField}
            hasInvalidInputs={hasInvalidInputs}
            validColorCount={validColorCount}
            contrastScoreAverage={contrastScoreAverage}
            contrastBlockersTotal={contrastBlockersTotal}
            contrastWarningsTotal={contrastWarningsTotal}
            effectiveContrastBlockersTotal={effectiveContrastBlockersTotal}
            strictContrastMode={strictContrastMode}
            lightContrastReport={lightContrastReport}
            darkContrastReport={darkContrastReport}
            isCreationFlow={isCreationFlow}
            canSaveTheme={canSaveTheme}
            isSavingTheme={isSavingTheme}
            saveDisabledReason={saveDisabledReason}
            editorEntryReady={editorEntryReady}
            hasUnsavedNewDraft={hasUnsavedNewDraft}
            isEditingCoreTheme={isEditingCoreTheme}
            selectedEditorThemeKey={editorSelectedCatalogItem?.id ?? selectedThemeId}
            previewLightColors={previewLight.colors}
            previewDarkColors={previewDark.colors}
            previewLightResolvedFields={lightResolvedFields}
            previewDarkResolvedFields={darkResolvedFields}
            onFeedbackSelection={onFeedbackSelection}
            onCreateNamedThemeFromEditor={() => {
                void createNamedThemeFromEditor();
            }}
            onCreateBlankTheme={() => {
                void createBlankTheme();
            }}
            onRequestThemeSwitch={requestThemeSwitch}
            onSelectThemeForEdit={(item) => {
                void selectThemeForEdit(item);
            }}
            onSetEditorThemeVisibility={(visibility) => {
                void setEditorThemeVisibility(visibility);
            }}
            onSetPickerField={setPickerField}
            onUpdateFieldFromHex={(fieldKey, next) => {
                void updateFieldFromHex(fieldKey, next);
            }}
            onUpdateFieldFromRgb={(fieldKey, next) => {
                void updateFieldFromRgb(fieldKey, next);
            }}
            onUpdateFieldFromHsl={(fieldKey, next) => {
                void updateFieldFromHsl(fieldKey, next);
            }}
            onSaveTheme={() => {
                void saveTheme();
            }}
            onAutoFixContrast={() => {
                void autoFixContrast();
            }}
            onToggleStrictContrast={() => {
                void toggleStrictContrastMode();
            }}
            onGetSuggestedColorForField={getSuggestedColorForField}
            onApplySuggestedColorForField={(fieldKey, mode, color) => {
                void applySuggestedColorForField(fieldKey, mode, color);
            }}
            onSelectColorFromPicker={(fieldKey, color) => {
                void selectColorFromPicker(fieldKey, color);
            }}
            hexToRgbInput={hexToRgbInput}
            hexToHslInput={hexToHslInput}
            isValidHexColor={isValidHexColor}
            renderPreviewCard={renderPreviewCard}
        />
    );

    return (
        <View style={styles.container}>
            {liveFeedback ? (
                <View style={[styles.liveFeedbackBanner, liveFeedback.tone === 'ok' ? styles.liveFeedbackOk : styles.liveFeedbackWarn]}>
                    <Text style={[styles.liveFeedbackText, { color: liveFeedback.tone === 'ok' ? colors.green : colors.yellow }]}>{liveFeedback.message}</Text>
                </View>
            ) : null}

            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.tabBtn, studioTab === 'themes' && styles.tabBtnActive]}
                    onPress={() => {
                        setStudioTab('themes');
                        void triggerSensoryFeedback('selection');
                    }}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.tabBtnText, studioTab === 'themes' && styles.tabBtnTextActive]}>Temas</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, studioTab === 'editor' && styles.tabBtnActive]}
                    onPress={() => {
                        setStudioTab('editor');
                        void triggerSensoryFeedback('selection');
                    }}
                    activeOpacity={0.85}
                >
                    <Text style={[styles.tabBtnText, studioTab === 'editor' && styles.tabBtnTextActive]}>Editor</Text>
                </TouchableOpacity>
            </View>

            {studioTab === 'themes' ? renderThemesTab() : renderEditorTab()}

            <View style={styles.statusCard}>
                <Text style={styles.sectionLabel}>Modo de app actual</Text>
                <Text style={styles.cardSub}>{effectiveMode === 'light' ? 'Claro' : 'Oscuro'}</Text>
            </View>
        </View>
    );
}
