import { DarkThemeTokens, LightThemeTokens } from '../../theme';

type Rgb = { r: number; g: number; b: number };

function assertHex6(hex: string): void {
    expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
}

function hexToRgb(hex: string): Rgb {
    const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
    if (normalized.length !== 6) throw new Error(`Unsupported hex: ${hex}`);
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b };
}

function srgbToLinear(c: number): number {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function relativeLuminance(rgb: Rgb): number {
    const r = srgbToLinear(rgb.r);
    const g = srgbToLinear(rgb.g);
    const b = srgbToLinear(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(hexToRgb(a));
    const lb = relativeLuminance(hexToRgb(b));
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
}

describe('theme tokens', () => {
    test('LightThemeTokens use valid hex colors', () => {
        const c = LightThemeTokens.colors;
        assertHex6(c.primary.DEFAULT);
        assertHex6(c.primary.light);
        assertHex6(c.primary.dark);
        assertHex6(c.onPrimary);
        assertHex6(c.background);
        assertHex6(c.surface);
        assertHex6(c.surfaceLighter);
        assertHex6(c.text);
        assertHex6(c.textMuted);
        assertHex6(c.border);
        assertHex6(c.blue);
        assertHex6(c.red);
        assertHex6(c.green);
        assertHex6(c.yellow);
        assertHex6(c.white);
        assertHex6(c.black);

        const ironKeys: (keyof typeof c.iron)[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
        for (const k of ironKeys) assertHex6(c.iron[k]);
    });

    test('DarkThemeTokens use valid hex colors', () => {
        const c = DarkThemeTokens.colors;
        assertHex6(c.primary.DEFAULT);
        assertHex6(c.primary.light);
        assertHex6(c.primary.dark);
        assertHex6(c.onPrimary);
        assertHex6(c.background);
        assertHex6(c.surface);
        assertHex6(c.surfaceLighter);
        assertHex6(c.text);
        assertHex6(c.textMuted);
        assertHex6(c.border);
        assertHex6(c.blue);
        assertHex6(c.red);
        assertHex6(c.green);
        assertHex6(c.yellow);
        assertHex6(c.white);
        assertHex6(c.black);

        const ironKeys: (keyof typeof c.iron)[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
        for (const k of ironKeys) assertHex6(c.iron[k]);
    });

    test('Contrast is safe for primary and text usage', () => {
        const light = LightThemeTokens.colors;
        const dark = DarkThemeTokens.colors;

        expect(contrastRatio(light.primary.DEFAULT, light.onPrimary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(light.background, light.text)).toBeGreaterThanOrEqual(7);

        expect(contrastRatio(dark.primary.DEFAULT, dark.onPrimary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(dark.background, dark.text)).toBeGreaterThanOrEqual(7);
    });
});
