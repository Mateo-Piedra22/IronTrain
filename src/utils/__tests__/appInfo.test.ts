import Constants from 'expo-constants';
import { getAppVersion } from '../appInfo';

jest.mock('expo-constants', () => ({
    __esModule: true,
    default: {
        expoConfig: {
            version: '2.1.5',
        },
    },
}));

describe('appInfo', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getAppVersion', () => {
        it('should return version from expo config', () => {
            const version = getAppVersion();
            expect(version).toBe('2.1.5');
        });

        it('should return "0.0.0" when version is undefined', () => {
            (Constants.expoConfig as any) = { version: undefined };
            
            const version = getAppVersion();
            expect(version).toBe('0.0.0');
        });

        it('should return "0.0.0" when version is null', () => {
            (Constants.expoConfig as any) = { version: null };
            
            const version = getAppVersion();
            expect(version).toBe('0.0.0');
        });

        it('should return "0.0.0" when version is empty string', () => {
            (Constants.expoConfig as any) = { version: '' };
            
            const version = getAppVersion();
            expect(version).toBe('0.0.0');
        });

        it('should return "0.0.0" when expoConfig is undefined', () => {
            (Constants.expoConfig as any) = undefined;
            
            const version = getAppVersion();
            expect(version).toBe('0.0.0');
        });

        it('should return "0.0.0" when version is not a string', () => {
            (Constants.expoConfig as any) = { version: 123 };
            
            const version = getAppVersion();
            expect(version).toBe('0.0.0');
        });

        it('should return valid version strings', () => {
            const validVersions = ['1.0.0', '2.1.5', '10.20.30', '0.0.1', '999.999.999'];
            
            for (const versionStr of validVersions) {
                (Constants.expoConfig as any) = { version: versionStr };
                const version = getAppVersion();
                expect(version).toBe(versionStr);
            }
        });

        it('should return version with pre-release tags', () => {
            (Constants.expoConfig as any) = { version: '2.1.5-beta.1' };
            
            const version = getAppVersion();
            expect(version).toBe('2.1.5-beta.1');
        });

        it('should return version with build metadata', () => {
            (Constants.expoConfig as any) = { version: '2.1.5+build.123' };
            
            const version = getAppVersion();
            expect(version).toBe('2.1.5+build.123');
        });
    });
});
