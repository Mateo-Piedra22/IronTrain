import { MarketplaceThemePackSummary } from '@/src/services/SocialService';
import { ThemeColorPatch } from '@/src/theme-engine';

export type EditableColorFieldKey =
    | 'primaryDefault'
    | 'primaryLight'
    | 'primaryDark'
    | 'logoPrimary'
    | 'logoAccent'
    | 'onPrimary'
    | 'background'
    | 'surface'
    | 'surfaceLighter'
    | 'text'
    | 'textMuted'
    | 'border';

export type EditableColorFields = Record<EditableColorFieldKey, string>;
export type EditorMode = 'light' | 'dark';
export type ApplyOnSave = 'none' | 'light' | 'dark' | 'both';
export type StudioTab = 'themes' | 'editor';
export type SourceFilter = 'all' | 'core' | 'community';
export type ActiveFilter = 'all' | 'active' | 'inactive';
export type CatalogOrigin = 'core' | 'local' | 'remote';
export type MarketplaceStatusFilter = 'all' | 'approved' | 'pending_review' | 'draft' | 'rejected' | 'suspended';

export type ThemesFilterPreferences = {
    sourceFilter: SourceFilter;
    activeFilter: ActiveFilter;
    statusFilter: MarketplaceStatusFilter;
    themeSearch: string;
    filtersExpanded: boolean;
};

export type LocalThemeMeta = {
    visibility: 'private' | 'friends' | 'public';
    isBanned: boolean;
    commentsCount: number;
    isCoreDerived?: boolean;
};

export type CatalogItem = {
    id: string;
    name: string;
    source: 'core' | 'community';
    lightPatch: ThemeColorPatch;
    darkPatch: ThemeColorPatch;
    supportsLight: boolean;
    supportsDark: boolean;
    isCore: boolean;
    isVerified: boolean;
    origin: CatalogOrigin;
    remoteId?: string;
    remoteStatus?: MarketplaceThemePackSummary['status'];
    remoteVisibility?: MarketplaceThemePackSummary['visibility'];
    remoteRatingCount?: number;
    remoteDownloadsCount?: number;
};
