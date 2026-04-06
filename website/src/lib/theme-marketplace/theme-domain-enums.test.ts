import { describe, expect, it } from 'vitest';
import {
    createThemeFeedbackSchema,
    createThemePackSchema,
    createThemeReportSchema,
    themePackStatusEnum,
    themePackVisibilityEnum,
} from './service';

describe('theme domain enums', () => {
    it('accepts only valid visibility values', () => {
        expect(themePackVisibilityEnum.safeParse('public').success).toBe(true);
        expect(themePackVisibilityEnum.safeParse('friends').success).toBe(true);
        expect(themePackVisibilityEnum.safeParse('invalid').success).toBe(false);
    });

    it('accepts only valid moderation status values', () => {
        expect(themePackStatusEnum.safeParse('draft').success).toBe(true);
        expect(themePackStatusEnum.safeParse('approved').success).toBe(true);
        expect(themePackStatusEnum.safeParse('archived').success).toBe(false);
    });

    it('validates feedback kind and report reason', () => {
        expect(createThemeFeedbackSchema.safeParse({ kind: 'issue', message: 'mensaje válido' }).success).toBe(true);
        expect(createThemeFeedbackSchema.safeParse({ kind: 'bug', message: 'mensaje válido' }).success).toBe(false);

        expect(createThemeReportSchema.safeParse({ reason: 'spam' }).success).toBe(true);
        expect(createThemeReportSchema.safeParse({ reason: 'copyright' }).success).toBe(false);
    });

    it('uses private visibility as default', () => {
        const parsed = createThemePackSchema.parse({
            name: 'Theme Test',
            supportsLight: true,
            supportsDark: true,
            payload: {
                schemaVersion: 1,
                base: { light: 'core-light', dark: 'core-dark' },
            },
        });

        expect(parsed.visibility).toBe('private');
    });
});
