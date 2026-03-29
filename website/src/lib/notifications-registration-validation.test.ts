import { describe, expect, it } from 'vitest';
import { parseNotificationRegistrationPayload } from './notifications-registration-validation';

describe('parseNotificationRegistrationPayload', () => {
  it('accepts valid payload', () => {
    const parsed = parseNotificationRegistrationPayload({
      pushToken: 'ExponentPushToken[abcdef1234567890]',
      platform: 'ios',
      tokenType: 'expo',
    });

    expect(parsed.pushToken).toBe('ExponentPushToken[abcdef1234567890]');
    expect(parsed.platform).toBe('ios');
    expect(parsed.tokenType).toBe('expo');
  });

  it('rejects short push token', () => {
    expect(() =>
      parseNotificationRegistrationPayload({
        pushToken: 'short',
      })
    ).toThrow();
  });

  it('rejects unknown properties', () => {
    expect(() =>
      parseNotificationRegistrationPayload({
        pushToken: 'ExponentPushToken[abcdef1234567890]',
        extra: 'field',
      })
    ).toThrow();
  });
});
