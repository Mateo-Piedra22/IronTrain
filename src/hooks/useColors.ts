import { ThemeColors } from '../theme';
import { useTheme } from './useTheme';

/**
 * useColors hook to easily access active theme colors.
 * Use this in functional components instead of static Colors object
 * to support dynamic theming in real-time.
 */
export const useColors = (): ThemeColors => {
    const { activeTheme } = useTheme();
    return activeTheme.colors;
};
