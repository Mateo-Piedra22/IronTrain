import { sql } from 'drizzle-orm';

export async function setDbUserContext(dbClient: { execute: (...args: any[]) => any }, userId: string): Promise<void> {
    const normalizedUserId = userId?.trim();
    if (!normalizedUserId) {
        throw new Error('setDbUserContext requires a non-empty userId');
    }

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(normalizedUserId)) {
        throw new Error('setDbUserContext requires a valid UUID userId');
    }

    await dbClient.execute(sql`select set_config('app.current_user_id', ${normalizedUserId}, true)`);
}
