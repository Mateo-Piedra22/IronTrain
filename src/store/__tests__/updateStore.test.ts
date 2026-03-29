import { act, renderHook } from '@testing-library/react-native';
import { useUpdateStore } from '../updateStore';

describe('useUpdateStore', () => {
    beforeEach(() => {
        act(() => {
            useUpdateStore.getState().reset();
        });
    });

    it('should initialize with idle status', () => {
        const { result } = renderHook(() => useUpdateStore());
        expect(result.current.status).toBe('idle');
        expect(result.current.latestVersion).toBeNull();
    });

    it('should set status', () => {
        const { result } = renderHook(() => useUpdateStore());

        act(() => {
            result.current.setStatus('checking');
        });

        expect(result.current.status).toBe('checking');
    });

    it('should set update info', () => {
        const { result } = renderHook(() => useUpdateStore());

        act(() => {
            result.current.setUpdateInfo({
                latestVersion: '1.2.0',
                downloadUrl: 'https://example.com/dl'
            });
        });

        expect(result.current.latestVersion).toBe('1.2.0');
        expect(result.current.downloadUrl).toBe('https://example.com/dl');
    });

    it('should reset correctly', () => {
        const { result } = renderHook(() => useUpdateStore());

        act(() => {
            result.current.setStatus('update_available');
            result.current.reset();
        });

        expect(result.current.status).toBe('idle');
    });
});
