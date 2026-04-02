import { ThemeDraft } from '@/src/theme-engine';
import { Ban, ChevronDown, ChevronUp, CopyPlus, ExternalLink, Filter, Globe, Palette, RotateCw, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CatalogItem, LocalThemeMeta, MarketplaceStatusFilter } from './types';

type ThemeStudioThemesTabProps = {
    styles: any;
    colors: any;
    selectedDraft: ThemeDraft | null;
    themeDrafts: ThemeDraft[];
    activeThemePackIdLight: string | null;
    activeThemePackIdDark: string | null;
    isLoadingRemoteThemes: boolean;
    remoteThemesCount: number;
    sourceFilter: 'all' | 'core' | 'community';
    activeFilter: 'all' | 'active' | 'inactive';
    statusFilter: MarketplaceStatusFilter;
    themeSearch: string;
    filtersExpanded: boolean;
    activeFiltersCount: number;
    remoteThemeError: string | null;
    filteredCatalog: CatalogItem[];
    remoteThemeLinks: Record<string, string>;
    selectedThemeId: string | null;
    themeMetaMap: Record<string, LocalThemeMeta>;
    expandedActionsThemeId: string | null;
    localMarketplaceStateByDraftId: Record<string, { visibility: 'private' | 'friends' | 'public'; status: string }>;
    onFeedbackSelection: () => void;
    onLoadRemoteThemes: (query?: string) => void;
    onSetFiltersExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    onSetSourceFilter: (value: 'all' | 'core' | 'community') => void;
    onSetActiveFilter: (value: 'all' | 'active' | 'inactive') => void;
    onSetStatusFilter: (value: MarketplaceStatusFilter) => void;
    onSetThemeSearch: (value: string) => void;
    onSelectThemeForEdit: (item: CatalogItem) => void;
    onAssignTheme: (mode: 'light' | 'dark', item: CatalogItem) => void;
    onSetExpandedActionsThemeId: React.Dispatch<React.SetStateAction<string | null>>;
    onOpenMarketplaceForTheme: (item: CatalogItem) => void;
    onToggleVisibility: (themeId: string) => void;
    onToggleBanned: (themeId: string) => void;
    onCreateBlankTheme: () => void;
    onDuplicateTheme: () => void;
    onRemoveTheme: () => void;
    renderThemeSummaryLine: (item: CatalogItem, isActiveLight: boolean, isActiveDark: boolean) => React.ReactNode;
};

export function ThemeStudioThemesTab({
    styles,
    colors,
    selectedDraft,
    themeDrafts,
    activeThemePackIdLight,
    activeThemePackIdDark,
    isLoadingRemoteThemes,
    remoteThemesCount,
    sourceFilter,
    activeFilter,
    statusFilter,
    themeSearch,
    filtersExpanded,
    activeFiltersCount,
    remoteThemeError,
    filteredCatalog,
    remoteThemeLinks,
    selectedThemeId,
    themeMetaMap,
    expandedActionsThemeId,
    localMarketplaceStateByDraftId,
    onFeedbackSelection,
    onLoadRemoteThemes,
    onSetFiltersExpanded,
    onSetSourceFilter,
    onSetActiveFilter,
    onSetStatusFilter,
    onSetThemeSearch,
    onSelectThemeForEdit,
    onAssignTheme,
    onSetExpandedActionsThemeId,
    onOpenMarketplaceForTheme,
    onToggleVisibility,
    onToggleBanned,
    onCreateBlankTheme,
    onDuplicateTheme,
    onRemoveTheme,
    renderThemeSummaryLine,
}: ThemeStudioThemesTabProps) {
    return (
        <View style={{ gap: 9 }}>
            <View style={styles.statusCard}>
                <Text style={styles.sectionLabel}>Estado</Text>
                <Text style={styles.cardSub}>Tema seleccionado: {selectedDraft?.name ?? 'Nuevo tema sin guardar'}</Text>
                <Text style={styles.cardSub}>Claro activo: {activeThemePackIdLight ? (themeDrafts.find((value) => value.id === activeThemePackIdLight)?.name ?? 'Custom') : 'Core'}</Text>
                <Text style={styles.cardSub}>Oscuro activo: {activeThemePackIdDark ? (themeDrafts.find((value) => value.id === activeThemePackIdDark)?.name ?? 'Custom') : 'Core'}</Text>
                <Text style={styles.cardSub}>Marketplace sincronizado: {isLoadingRemoteThemes ? 'actualizando...' : `${remoteThemesCount} temas`}</Text>
                <View style={[styles.row, { marginTop: 2 }]}> 
                    <TouchableOpacity
                        style={styles.actionBtn}
                        activeOpacity={0.85}
                        onPress={() => {
                            const coreLight = {
                                id: 'core-light',
                                name: 'Core Claro',
                                source: 'core' as const,
                                lightPatch: {},
                                darkPatch: {},
                                supportsLight: true,
                                supportsDark: false,
                                isCore: true,
                                isVerified: true,
                                origin: 'core' as const,
                            };
                            onAssignTheme('light', coreLight);
                        }}
                    >
                        <Text style={styles.actionBtnText}>Restablecer claro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        activeOpacity={0.85}
                        onPress={() => {
                            const coreDark = {
                                id: 'core-dark',
                                name: 'Core Oscuro',
                                source: 'core' as const,
                                lightPatch: {},
                                darkPatch: {},
                                supportsLight: false,
                                supportsDark: true,
                                isCore: true,
                                isVerified: true,
                                origin: 'core' as const,
                            };
                            onAssignTheme('dark', coreDark);
                        }}
                    >
                        <Text style={styles.actionBtnText}>Restablecer oscuro</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.subtlePanel}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                        onPress={() => {
                            onSetFiltersExpanded((current) => !current);
                            onFeedbackSelection();
                        }}
                    >
                        <Filter size={13} color={colors.textMuted} />
                        <Text style={styles.sectionLabel}>Filtros ({activeFiltersCount})</Text>
                        {filtersExpanded ? <ChevronUp size={13} color={colors.textMuted} /> : <ChevronDown size={13} color={colors.textMuted} />}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, isLoadingRemoteThemes && styles.disabledBtn]}
                        activeOpacity={0.85}
                        disabled={isLoadingRemoteThemes}
                        onPress={() => {
                            onLoadRemoteThemes(themeSearch);
                            onFeedbackSelection();
                        }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <RotateCw size={12} color={colors.textMuted} />
                            <Text style={styles.actionBtnText}>{isLoadingRemoteThemes ? 'Actualizando' : 'Actualizar'}</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {filtersExpanded ? (
                    <View style={{ gap: 7 }}>
                        <View style={styles.row}>
                            {([
                                { id: 'all', label: 'Todo' },
                                { id: 'core', label: 'Core' },
                                { id: 'community', label: 'Comunidad' },
                            ] as const).map((option) => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.chip, sourceFilter === option.id && styles.chipActive]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        onSetSourceFilter(option.id);
                                        onFeedbackSelection();
                                    }}
                                >
                                    <Text style={[styles.chipText, sourceFilter === option.id && styles.chipTextActive]}>{option.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.row}>
                            {([
                                { id: 'all', label: 'Todos' },
                                { id: 'active', label: 'Activos' },
                                { id: 'inactive', label: 'Inactivos' },
                            ] as const).map((option) => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.chip, activeFilter === option.id && styles.chipActive]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        onSetActiveFilter(option.id);
                                        onFeedbackSelection();
                                    }}
                                >
                                    <Text style={[styles.chipText, activeFilter === option.id && styles.chipTextActive]}>{option.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={[styles.row, { flexWrap: 'wrap' }]}>
                            {([
                                { id: 'all', label: 'Estado: todos' },
                                { id: 'approved', label: 'Aprobados' },
                                { id: 'pending_review', label: 'En revisión' },
                                { id: 'draft', label: 'Borrador' },
                                { id: 'suspended', label: 'Suspendido' },
                            ] as const).map((option) => (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.chip, statusFilter === option.id && styles.chipActive]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        onSetStatusFilter(option.id);
                                        onFeedbackSelection();
                                    }}
                                >
                                    <Text style={[styles.chipText, statusFilter === option.id && styles.chipTextActive]}>{option.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TextInput
                            value={themeSearch}
                            onChangeText={onSetThemeSearch}
                            style={styles.compactInput}
                            placeholder="Buscar tema por nombre"
                            placeholderTextColor={colors.textMuted}
                        />
                        {remoteThemeError ? <Text style={styles.cardSub}>{remoteThemeError}</Text> : null}
                    </View>
                ) : null}
            </View>

            <View style={{ gap: 7 }}>
                {filteredCatalog.map((item) => {
                    const linkedDraftId = item.remoteId ? remoteThemeLinks[item.remoteId] : null;
                    const candidateThemeId = linkedDraftId ?? item.id;
                    const isActiveLight = item.isCore ? item.id === 'core-light' && activeThemePackIdLight === null : activeThemePackIdLight === candidateThemeId;
                    const isActiveDark = item.isCore ? item.id === 'core-dark' && activeThemePackIdDark === null : activeThemePackIdDark === candidateThemeId;
                    const isSelected = selectedThemeId === item.id || (linkedDraftId ? selectedThemeId === linkedDraftId : false);
                    const meta = themeMetaMap[item.id] ?? { visibility: item.isCore ? 'public' : 'private', isBanned: false, commentsCount: 0 };
                    const isCoreDerivedLocal = item.origin === 'local' && meta.isCoreDerived === true;
                    const localMarketplaceState = item.origin === 'local' ? localMarketplaceStateByDraftId[item.id] : undefined;
                    const marketplaceLabel = item.origin === 'local'
                        ? (localMarketplaceState
                            ? (localMarketplaceState.status === 'pending_review'
                                ? 'Marketplace: En revisión'
                                : localMarketplaceState.status === 'approved'
                                    ? (localMarketplaceState.visibility === 'friends'
                                        ? 'Marketplace: Aprobado (Amigos)'
                                        : localMarketplaceState.visibility === 'public'
                                            ? 'Marketplace: Aprobado (Público)'
                                            : 'Marketplace: Aprobado (Privado)')
                                    : localMarketplaceState.status === 'rejected'
                                        ? 'Marketplace: Rechazado'
                                        : localMarketplaceState.status === 'suspended'
                                            ? 'Marketplace: Suspendido'
                                            : 'Marketplace: Draft')
                            : 'Marketplace: Draft')
                        : null;
                    const actionsExpanded = expandedActionsThemeId === item.id;

                    return (
                        <View key={item.id} style={styles.card}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.cardTitle}>{item.name}</Text>
                                    {isCoreDerivedLocal ? (
                                        <View style={styles.badge}>
                                            <Text style={styles.badgeText}>Core Remix</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <Text style={styles.cardSub}>{isActiveLight ? 'Claro' : '-'} · {isActiveDark ? 'Oscuro' : '-'}</Text>
                            </View>

                            {renderThemeSummaryLine(item, isActiveLight, isActiveDark)}
                            {marketplaceLabel ? <Text style={styles.cardSub}>{marketplaceLabel}</Text> : null}

                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.grow, styles.actionBtnPrimary]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        onSelectThemeForEdit(item);
                                    }}
                                >
                                    <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>{isSelected ? 'Editando' : 'Editar'}</Text>
                                </TouchableOpacity>
                                {item.supportsLight ? (
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.grow, isActiveLight && styles.actionBtnPrimary]}
                                        activeOpacity={0.85}
                                        onPress={() => {
                                            onAssignTheme('light', item);
                                        }}
                                    >
                                        <Text style={[styles.actionBtnText, isActiveLight && styles.actionBtnTextPrimary]}>Activar claro</Text>
                                    </TouchableOpacity>
                                ) : null}
                                {item.supportsDark ? (
                                    <TouchableOpacity
                                        style={[styles.actionBtn, styles.grow, isActiveDark && styles.actionBtnPrimary]}
                                        activeOpacity={0.85}
                                        onPress={() => {
                                            onAssignTheme('dark', item);
                                        }}
                                    >
                                        <Text style={[styles.actionBtnText, isActiveDark && styles.actionBtnTextPrimary]}>Activar oscuro</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={[styles.actionBtn, styles.grow]}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        onSetExpandedActionsThemeId((current) => (current === item.id ? null : item.id));
                                        onFeedbackSelection();
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        {actionsExpanded ? <ChevronUp size={12} color={colors.textMuted} /> : <ChevronDown size={12} color={colors.textMuted} />}
                                        <Text style={styles.actionBtnText}>{actionsExpanded ? 'Ocultar acciones' : 'Más acciones'}</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            {actionsExpanded ? (
                                <View style={{ gap: 6 }}>
                                    <View style={styles.row}>
                                        <TouchableOpacity
                                            style={styles.actionBtn}
                                            activeOpacity={0.85}
                                            onPress={() => {
                                                onOpenMarketplaceForTheme(item);
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <ExternalLink size={12} color={colors.textMuted} />
                                                <Text style={styles.actionBtnText}>Marketplace</Text>
                                            </View>
                                        </TouchableOpacity>

                                        {!item.isCore && item.origin !== 'remote' && !isCoreDerivedLocal ? (
                                            <TouchableOpacity
                                                style={styles.actionBtn}
                                                activeOpacity={0.85}
                                                onPress={() => {
                                                    onToggleVisibility(item.id);
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Globe size={12} color={colors.textMuted} />
                                                    <Text style={styles.actionBtnText}>
                                                        {meta.visibility === 'private'
                                                            ? 'Pasar a amigos'
                                                            : meta.visibility === 'friends'
                                                                ? 'Pasar a público'
                                                                : 'Pasar a privado'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        ) : null}

                                        {!item.isCore && item.origin !== 'remote' ? (
                                            <TouchableOpacity
                                                style={styles.actionBtn}
                                                activeOpacity={0.85}
                                                onPress={() => {
                                                    onToggleBanned(item.id);
                                                }}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Ban size={12} color={colors.textMuted} />
                                                    <Text style={styles.actionBtnText}>{meta.isBanned ? 'Quitar baneo' : 'Marcar baneado'}</Text>
                                                </View>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    {!item.isCore && item.origin === 'remote' ? (
                                        <Text style={styles.colorRowSub}>Estado y visibilidad tomados del backend.</Text>
                                    ) : null}
                                    {isCoreDerivedLocal ? (
                                        <Text style={styles.colorRowSub}>Tema derivado de core: visibilidad privada bloqueada.</Text>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>
                    );
                })}
            </View>

            <View style={styles.subtlePanel}>
                <Text style={styles.sectionLabel}>Acciones de tema</Text>
                <View style={styles.row}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary, styles.grow]} activeOpacity={0.85} onPress={onCreateBlankTheme}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Palette size={12} color={colors.primary.DEFAULT} />
                        <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>Nuevo tema</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.grow]} activeOpacity={0.85} onPress={onDuplicateTheme}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <CopyPlus size={12} color={colors.text} />
                        <Text style={styles.actionBtnText}>Duplicar tema</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.actionBtn,
                        styles.grow,
                        {
                            borderColor: colors.red,
                            backgroundColor: colors.surface,
                        },
                        !selectedDraft && styles.disabledBtn,
                    ]}
                    activeOpacity={0.85}
                    disabled={!selectedDraft}
                    onPress={onRemoveTheme}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Trash2 size={12} color={colors.red} />
                        <Text style={[styles.actionBtnText, { color: colors.red }]}>Eliminar tema</Text>
                    </View>
                </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
