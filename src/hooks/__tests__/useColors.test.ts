import { renderHook } from '@testing-library/react-native';
import { useColors } from '../useColors';
import { useTheme } from '../useTheme';

jest.mock('../useTheme', () => ({
    useTheme: jest.fn(),
}));

describe('useColors', () => {
    it('should return colors from active theme', () => {
        const mockColors = {
            primary: { DEFAULT: '#000000', foreground: '#FFFFFF' },
            background: '#FFFFFF'
        };
        (useTheme as jest.Mock).mockReturnValue({
            activeTheme: {
                colors: mockColors
            }
        });

        const { result } = renderHook(() => useColors());

        expect(result.current).toEqual(mockColors);
        expect(useTheme).toHaveBeenCalled();
    });
});
