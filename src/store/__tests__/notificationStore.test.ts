import { act, renderHook } from '@testing-library/react-native';
import { useNotificationStore } from '../notificationStore';

describe('useNotificationStore', () => {
    beforeEach(() => {
        act(() => {
            useNotificationStore.getState().clearAll();
        });
    });

    it('should add a toast notification', () => {
        const { result } = renderHook(() => useNotificationStore());

        act(() => {
            result.current.addToast({
                type: 'success',
                title: 'Success',
                message: 'Task completed'
            });
        });

        expect(result.current.toasts.length).toBe(1);
        expect(result.current.toasts[0].title).toBe('Success');
    });

    it('should remove a toast notification by id', () => {
        const { result } = renderHook(() => useNotificationStore());

        let id = '';
        act(() => {
            id = result.current.addToast({
                type: 'info',
                title: 'Info',
                message: 'Something happened'
            });
        });

        expect(result.current.toasts.length).toBe(1);

        act(() => {
            result.current.removeToast(id);
        });

        expect(result.current.toasts.length).toBe(0);
    });

    it('should clear all toasts', () => {
        const { result } = renderHook(() => useNotificationStore());

        act(() => {
            result.current.addToast({ type: 'info', title: '1', message: '1' });
            result.current.addToast({ type: 'info', title: '2', message: '2' });
        });

        expect(result.current.toasts.length).toBe(2);

        act(() => {
            result.current.clearAll();
        });

        expect(result.current.toasts.length).toBe(0);
    });
});
