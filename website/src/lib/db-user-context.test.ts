import { describe, expect, test, vi } from 'vitest';
import { setDbUserContext } from './db-user-context';

describe('setDbUserContext', () => {
    test('executes query for a valid UUID userId', async () => {
        const dbClient = { execute: vi.fn().mockResolvedValue(undefined) };

        await setDbUserContext(dbClient, '  550e8400-e29b-41d4-a716-446655440000  ');

        expect(dbClient.execute).toHaveBeenCalledTimes(1);
    });

    test('throws for empty userId', async () => {
        const dbClient = { execute: vi.fn().mockResolvedValue(undefined) };

        await expect(setDbUserContext(dbClient, '   ')).rejects.toThrow('setDbUserContext requires a non-empty userId');
        expect(dbClient.execute).not.toHaveBeenCalled();
    });

    test('throws for invalid UUID userId', async () => {
        const dbClient = { execute: vi.fn().mockResolvedValue(undefined) };

        await expect(setDbUserContext(dbClient, 'not-a-uuid')).rejects.toThrow('setDbUserContext requires a valid UUID userId');
        expect(dbClient.execute).not.toHaveBeenCalled();
    });
});
