import { useEffect, useRef } from 'react';
import { DataEventType, dataEventService } from '../services/DataEventService';

/**
 * Hook to automatically trigger a callback when specific data events occur.
 * Useful for refreshing screens when background sync finishes.
 * 
 * @param callback The function to call when the event occurs
 * @param events Array of events to listen to (default: ['DATA_UPDATED'])
 */
export function useDataReload(callback: () => void, events: DataEventType[] = ['DATA_UPDATED']) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        const unsubscribes = events.map(event =>
            dataEventService.subscribe(event, () => {
                callbackRef.current();
            })
        );

        return () => {
            unsubscribes.forEach(unsub => unsub());
        };
    }, [events]);
}
