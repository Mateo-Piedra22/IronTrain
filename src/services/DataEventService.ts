import { logger } from '../utils/logger';

export type DataEventType = 'DATA_UPDATED' | 'SETTINGS_UPDATED' | 'SYNC_COMPLETED' | 'SOCIAL_UPDATED';

type Listener = (payload?: any) => void;

class DataEventService {
    private listeners: Map<DataEventType, Set<Listener>> = new Map();

    public emit(event: DataEventType, payload?: any) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => {
                try {
                    callback(payload);
                } catch (e) {
                    logger.captureException(e, { scope: 'DataEventService.emit', event });
                }
            });
        }
    }

    public subscribe(event: DataEventType, callback: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        return () => {
            const eventListeners = this.listeners.get(event);
            if (eventListeners) {
                eventListeners.delete(callback);
            }
        };
    }
}

export const dataEventService = new DataEventService();
