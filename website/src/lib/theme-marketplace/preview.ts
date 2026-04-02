import { ThemePackPayload } from './contracts';

export type ThemePreviewChannels = {
    hero: string;
    surface: string;
    text: string;
};

const FALLBACK_PREVIEW: ThemePreviewChannels = {
    hero: '#8AA0B8',
    surface: '#FFFFFF',
    text: '#0F172A',
};

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const asHex = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    if (!HEX_COLOR_REGEX.test(normalized)) return null;
    return normalized.toUpperCase();
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
};

const pickFirstHex = (...values: unknown[]): string | null => {
    for (const value of values) {
        const hex = asHex(value);
        if (hex) return hex;
    }
    return null;
};

export function resolveThemePreview(payloadRaw: unknown): ThemePreviewChannels {
    const payload = (asRecord(payloadRaw) ?? {}) as Partial<ThemePackPayload>;
    const preview = asRecord(payload.preview);
    const lightPatch = asRecord(payload.lightPatch);
    const darkPatch = asRecord(payload.darkPatch);
    const lightPrimary = asRecord(lightPatch?.primary);
    const darkPrimary = asRecord(darkPatch?.primary);

    const hero = pickFirstHex(
        preview?.hero,
        lightPrimary?.DEFAULT,
        lightPrimary?.light,
        lightPatch?.blue,
        lightPatch?.onPrimary,
        darkPrimary?.DEFAULT,
        darkPrimary?.dark,
        darkPatch?.blue,
        darkPatch?.onPrimary,
        FALLBACK_PREVIEW.hero,
    ) ?? FALLBACK_PREVIEW.hero;

    const surface = pickFirstHex(
        preview?.surface,
        lightPatch?.surface,
        lightPatch?.surfaceLighter,
        lightPatch?.background,
        darkPatch?.surface,
        darkPatch?.surfaceLighter,
        darkPatch?.background,
        FALLBACK_PREVIEW.surface,
    ) ?? FALLBACK_PREVIEW.surface;

    const text = pickFirstHex(
        preview?.text,
        lightPatch?.text,
        lightPatch?.textMuted,
        darkPatch?.text,
        darkPatch?.textMuted,
        FALLBACK_PREVIEW.text,
    ) ?? FALLBACK_PREVIEW.text;

    return { hero, surface, text };
}