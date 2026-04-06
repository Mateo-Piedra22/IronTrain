import { EMPTY_FIELDS } from '../theme-studio/constants';
import { applyEditorSmartDefaults, fieldsToPatch, patchToFields, type ModeFallbackColors } from '../theme-studio/helpers';

const LIGHT_FALLBACK: ModeFallbackColors = {
  primary: {
    DEFAULT: '#8AA0B8',
    light: '#B7C7D8',
    dark: '#5F768F',
  },
  logoPrimary: '#1C2430',
  logoAccent: '#5F768F',
  onPrimary: '#0F172A',
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceLighter: '#EEF1F4',
  text: '#0F172A',
  textMuted: '#5E6877',
  border: '#E2E7ED',
};

describe('Theme Studio helpers', () => {
  test('patchToFields and fieldsToPatch include logo fields', () => {
    const fields = patchToFields({
      primary: { DEFAULT: '#112233' },
      logoPrimary: '#223344',
      logoAccent: '#334455',
      text: '#445566',
    });

    expect(fields.logoPrimary).toBe('#223344');
    expect(fields.logoAccent).toBe('#334455');

    const patch = fieldsToPatch(fields);
    expect(patch.logoPrimary).toBe('#223344');
    expect(patch.logoAccent).toBe('#334455');
    expect(patch.primary?.DEFAULT).toBe('#112233');
  });

  test('applyEditorSmartDefaults autogenerates logo colors from principal fields', () => {
    const next = applyEditorSmartDefaults(
      {
        ...EMPTY_FIELDS,
        primaryDefault: '#406080',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        text: '#0F172A',
      },
      'light',
      LIGHT_FALLBACK,
    );

    expect(next.logoPrimary).toMatch(/^#[0-9A-F]{6}$/);
    expect(next.logoAccent).toMatch(/^#[0-9A-F]{6}$/);
    expect(next.logoPrimary).not.toBe('');
    expect(next.logoAccent).not.toBe('');
  });

  test('applyEditorSmartDefaults preserves manual logo overrides', () => {
    const next = applyEditorSmartDefaults(
      {
        ...EMPTY_FIELDS,
        primaryDefault: '#406080',
        logoPrimary: '#111111',
        logoAccent: '#EEEEEE',
      },
      'dark',
      LIGHT_FALLBACK,
    );

    expect(next.logoPrimary).toBe('#111111');
    expect(next.logoAccent).toBe('#EEEEEE');
  });
});
