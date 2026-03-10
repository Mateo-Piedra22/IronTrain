import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import * as React from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';
import { resolveNavigationTheme, resolveThemeTokens } from '../theme';

// Mock ConfigService to return 'system' or 'dark' by default for tests
jest.mock('../services/ConfigService', () => ({
    configService: {
        init: jest.fn(() => Promise.resolve()),
        get: jest.fn((key) => {
            if (key === 'themeMode') return 'system';
            return null;
        }),
        set: jest.fn(() => Promise.resolve()),
    },
}));

// Mock DatabaseService to avoid real indexedDB/SQLite access in node
jest.mock('../services/DatabaseService', () => ({
    dbService: {
        run: jest.fn(() => Promise.resolve()),
        getAll: jest.fn(() => Promise.resolve([])),
        getFirst: jest.fn(() => Promise.resolve(null)),
        queueSyncMutation: jest.fn(() => Promise.resolve()),
    },
}));

export const TestingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Generate a static theme for consistency in tests
    const tokens = resolveThemeTokens('dark', 'dark');
    const navTheme = resolveNavigationTheme(tokens);

    return (
        <ThemeProvider>
            <NavigationThemeProvider value={navTheme}>
                {children}
            </NavigationThemeProvider>
        </ThemeProvider>
    );
};
