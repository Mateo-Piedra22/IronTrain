import type * as schema from '../db/schema';

type GlobalEventRow = typeof schema.globalEvents.$inferSelect;

type DerivedAnnouncement = {
    id: string;
    title: string;
    message: string;
    type: 'toast' | 'modal' | 'system';
    priority: 'low' | 'normal' | 'high' | 'critical';
    displayMode: 'once' | 'always' | 'until_closed';
    targetVersion: string | null;
    targetPlatform: 'android' | 'ios' | 'all' | null;
    targetSegment: string;
    metadata: Record<string, any> | null;
    isActive: 0 | 1;
};

export function buildDerivedGlobalEventAnnouncement(event: GlobalEventRow): DerivedAnnouncement {
    const id = `global-event:${event.id}`;

    const title = `Evento Global: ${event.name}`;
    const message = `${event.name} · multiplicador x${event.multiplier.toFixed(2)} en todo tu puntaje.`;

    const metadata = {
        actionUrl: 'irontrain://social',
        derivedFrom: { kind: 'global_event', id: event.id },
    };

    return {
        id,
        title,
        message,
        type: 'system',
        priority: 'high',
        displayMode: 'once',
        targetVersion: null,
        targetPlatform: 'all',
        targetSegment: 'all',
        metadata,
        isActive: event.isActive === 1 ? 1 : 0,
    };
}
