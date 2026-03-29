import { renderHook } from '@testing-library/react-native';
import { dataEventService } from '../../services/DataEventService';
import { useDataReload } from '../useDataReload';

jest.mock('../../services/DataEventService', () => ({
    dataEventService: {
        subscribe: jest.fn()
    }
}));

describe('useDataReload', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should subscribe to events on mount and unsubscribe on unmount', () => {
        const unsubscribe = jest.fn();
        (dataEventService.subscribe as jest.Mock).mockReturnValue(unsubscribe);

        const callback = jest.fn();
        const { unmount } = renderHook(() => useDataReload(callback, ['DATA_UPDATED']));

        expect(dataEventService.subscribe).toHaveBeenCalledWith('DATA_UPDATED', expect.any(Function));

        unmount();
        expect(unsubscribe).toHaveBeenCalled();
    });

    it('should trigger callback when event occurs', () => {
        let registeredCallback: (() => void) | undefined;
        (dataEventService.subscribe as jest.Mock).mockImplementation((event, cb) => {
            registeredCallback = cb;
            return () => { };
        });

        const callback = jest.fn();
        renderHook(() => useDataReload(callback, ['DATA_UPDATED']));

        if (registeredCallback) {
            registeredCallback();
        }

        expect(callback).toHaveBeenCalled();
    });

    it('should handle multiple events simultaneously', () => {
        const unsubscribe = jest.fn();
        (dataEventService.subscribe as jest.Mock).mockReturnValue(unsubscribe);

        const callback = jest.fn();
        const events = ['DATA_UPDATED', 'SYNC_FINISHED'] as any[];
        const { unmount } = renderHook(() => useDataReload(callback, events));

        expect(dataEventService.subscribe).toHaveBeenCalledTimes(2);
        expect(dataEventService.subscribe).toHaveBeenCalledWith('DATA_UPDATED', expect.any(Function));
        expect(dataEventService.subscribe).toHaveBeenCalledWith('SYNC_FINISHED', expect.any(Function));

        unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(2);
    });
});
