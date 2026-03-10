import { eq } from 'drizzle-orm';
import { db } from '../db';
import { systemStatus } from '../db/schema';

export async function getSystemStatus() {
    try {
        const result = await db.select().from(systemStatus).where(eq(systemStatus.id, 'global')).limit(1);
        if (result.length > 0) {
            return result[0];
        }
    } catch (error) {
        console.error('Error fetching system status:', error);
    }

    // Default safe values if not found or error
    return {
        maintenanceMode: 0,
        offlineOnlyMode: 0,
        message: ''
    };
}

/**
 * Validates system availability and returns a 503 response if restricted.
 * Used for Zero Trust policy enforcement in API routes.
 */
export async function validateSystemAccess() {
    const status = await getSystemStatus();

    if (status.maintenanceMode === 1) {
        return {
            isRestricted: true,
            response: new Response(JSON.stringify({
                error: 'MAINTENANCE_MODE',
                message: status.message || 'Sistema en mantenimiento.'
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            })
        };
    }

    if (status.offlineOnlyMode === 1) {
        return {
            isRestricted: true,
            response: new Response(JSON.stringify({
                error: 'OFFLINE_ONLY_MODE',
                message: status.message || 'El servidor se encuentra en modo offline temporalmente.'
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            })
        };
    }

    return { isRestricted: false, response: null };
}
