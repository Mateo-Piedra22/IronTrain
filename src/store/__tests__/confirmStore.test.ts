import { act, renderHook } from '@testing-library/react-native';
import { useConfirmStore } from '../confirmStore';

describe('confirmStore', () => {
    beforeEach(() => {
        act(() => {
            useConfirmStore.getState().hide();
        });
    });

    it('should initialize hidden', () => {
        const { result } = renderHook(() => useConfirmStore());
        expect(result.current.visible).toBe(false);
    });

    it('should show confirmation dialog', () => {
        const { result } = renderHook(() => useConfirmStore());

        act(() => {
            result.current.show({
                title: 'Test',
                message: 'Are you sure?',
                buttons: [{ label: 'Yes' }],
            });
        });

        expect(result.current.visible).toBe(true);
        expect(result.current.config?.title).toBe('Test');
    });

    it('should hide confirmation dialog', () => {
        const { result } = renderHook(() => useConfirmStore());

        act(() => {
            result.current.show({
                title: 'Test',
                message: 'Are you sure?',
            });
        });

        expect(result.current.visible).toBe(true);

        act(() => {
            result.current.hide();
        });

        expect(result.current.visible).toBe(false);
    });
});
