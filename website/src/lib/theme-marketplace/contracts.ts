export type ThemeVisibility = 'private' | 'friends' | 'public';
export type ThemeModerationStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';

export type ThemePatch = Partial<{
  iron: Record<string, string>;
  primary: Partial<{ DEFAULT: string; light: string; dark: string }>;
  onPrimary: string;
  white: string;
  black: string;
  blue: string;
  red: string;
  green: string;
  yellow: string;
  background: string;
  surface: string;
  surfaceLighter: string;
  text: string;
  textMuted: string;
  border: string;
}>;

export type ThemePackPayload = {
  schemaVersion: 1;
  base: { light: 'core-light'; dark: 'core-dark' };
  lightPatch?: ThemePatch;
  darkPatch?: ThemePatch;
  preview?: {
    hero?: string;
    surface?: string;
    text?: string;
  };
  meta?: {
    name?: string;
    description?: string;
    tags?: string[];
  };
};

export type ThemePackSummary = {
  id: string;
  slug: string;
  ownerId: string;
  name: string;
  description?: string | null;
  tags: string[];
  supportsLight: boolean;
  supportsDark: boolean;
  isSystem: boolean;
  visibility: ThemeVisibility;
  status: ThemeModerationStatus;
  currentVersion: number;
  downloadsCount: number;
  appliesCount: number;
  ratingAvg: number;
  ratingCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ThemePackDetail = ThemePackSummary & {
  payload: ThemePackPayload;
  moderationMessage?: string | null;
};

export type ListThemesQuery = {
  scope?: 'public' | 'owned' | 'friends';
  mode?: 'light' | 'dark' | 'both';
  sort?: 'trending' | 'new' | 'top';
  source?: 'all' | 'system' | 'community';
  page?: number;
  pageSize?: number;
  q?: string;
};

export type ListThemesResponse = {
  items: ThemePackSummary[];
  page: number;
  pageSize: number;
  total: number;
};

export type CreateThemePackInput = {
  name: string;
  description?: string;
  tags?: string[];
  supportsLight: boolean;
  supportsDark: boolean;
  visibility: ThemeVisibility;
  payload: ThemePackPayload;
};

export type CreateThemeVersionInput = {
  payload: ThemePackPayload;
  changelog?: string;
};

export type RateThemeInput = {
  rating: 1 | 2 | 3 | 4 | 5;
  review?: string;
};

export type ThemeFeedbackInput = {
  kind: 'issue' | 'suggestion' | 'praise';
  message: string;
};

export type ThemeReportInput = {
  reason: 'nsfw' | 'hate' | 'spam' | 'impersonation' | 'malware' | 'other';
  details?: string;
};

export const THEME_MARKETPLACE_ENDPOINTS = {
  list: '/api/social/themes',
  detail: (id: string) => `/api/social/themes/${encodeURIComponent(id)}`,
  bySlug: (slug: string) => `/api/social/themes/slug/${encodeURIComponent(slug)}`,
  create: '/api/social/themes',
  createVersion: (id: string) => `/api/social/themes/${encodeURIComponent(id)}/version`,
  install: (id: string) => `/api/social/themes/${encodeURIComponent(id)}/install`,
  rate: (id: string) => `/api/social/themes/${encodeURIComponent(id)}/rate`,
  feedback: (id: string) => `/api/social/themes/${encodeURIComponent(id)}/feedback`,
  report: (id: string) => `/api/social/themes/${encodeURIComponent(id)}/report`,
  export: (id: string) => `/api/social/themes/${encodeURIComponent(id)}/export`,
};
