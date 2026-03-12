import Constants from 'expo-constants';

/**
 * Gets the current app version from expo-constants.
 * @returns The version string, or '0.0.0' if not found.
 */
export function getAppVersion(): string {
    const v = (Constants.expoConfig as any)?.version;
    return typeof v === 'string' && v.length > 0 ? v : '0.0.0';
}
