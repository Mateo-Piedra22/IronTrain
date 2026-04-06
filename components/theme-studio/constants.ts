import { EditableColorFieldKey, EditableColorFields } from './types';

export const META_STORAGE_KEY = 'theme_studio_meta_v1';
export const REMOTE_LINK_STORAGE_KEY = 'theme_studio_remote_links_v1';
export const THEMES_FILTER_PREFS_STORAGE_KEY = 'theme_studio_filters_v1';
export const THEMES_EXPANDED_ACTIONS_STORAGE_KEY = 'theme_studio_expanded_actions_v1';
export const THEME_STUDIO_STRICT_CONTRAST_STORAGE_KEY = 'theme_studio_strict_contrast_v1';

export const EMPTY_FIELDS: EditableColorFields = {
    primaryDefault: '',
    primaryLight: '',
    primaryDark: '',
    logoPrimary: '',
    logoAccent: '',
    onPrimary: '',
    background: '',
    surface: '',
    surfaceLighter: '',
    text: '',
    textMuted: '',
    border: '',
};

export const COLOR_FIELD_META: Array<{ key: EditableColorFieldKey; label: string; description: string }> = [
    { key: 'primaryDefault', label: 'Primario', description: 'Color principal de marca' },
    { key: 'primaryLight', label: 'Primario claro', description: 'Variante clara para estados' },
    { key: 'primaryDark', label: 'Primario oscuro', description: 'Variante oscura para foco' },
    { key: 'logoPrimary', label: 'Logo principal', description: 'Color base del logo de IronTrain' },
    { key: 'logoAccent', label: 'Logo acento', description: 'Color de acento para detalles del logo' },
    { key: 'onPrimary', label: 'Texto sobre primario', description: 'Color del texto en botones primarios' },
    { key: 'background', label: 'Fondo', description: 'Fondo global de la app' },
    { key: 'surface', label: 'Superficie', description: 'Cards y contenedores principales' },
    { key: 'surfaceLighter', label: 'Superficie secundaria', description: 'Bloques y paneles secundarios' },
    { key: 'text', label: 'Texto principal', description: 'Color del texto principal' },
    { key: 'textMuted', label: 'Texto secundario', description: 'Color del texto auxiliar' },
    { key: 'border', label: 'Bordes', description: 'Divisores y contornos' },
];
