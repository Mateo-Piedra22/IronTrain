import { uuidV4 } from '../uuid';

describe('uuid', () => {
    describe('uuidV4', () => {
        it('should generate a valid UUID v4 format', () => {
            const uuid = uuidV4();

            // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(uuid).toMatch(uuidRegex);
        });

        it('should generate unique UUIDs', () => {
            const uuids = new Set<string>();
            const count = 1000;

            for (let i = 0; i < count; i++) {
                uuids.add(uuidV4());
            }

            expect(uuids.size).toBe(count);
        });

        it('should generate UUIDs with correct version (4)', () => {
            const uuid = uuidV4();
            const version = uuid.split('-')[2].charAt(0);
            expect(version).toBe('4');
        });

        it('should generate UUIDs with correct variant (RFC 4122)', () => {
            const uuid = uuidV4();
            const variant = uuid.split('-')[3].charAt(0);
            // Variant should be 8, 9, a, or b
            expect(['8', '9', 'a', 'b']).toContain(variant.toLowerCase());
        });

        it('should generate 36 character strings', () => {
            const uuid = uuidV4();
            expect(uuid.length).toBe(36);
        });

        it('should generate lowercase UUIDs', () => {
            const uuid = uuidV4();
            expect(uuid).toBe(uuid.toLowerCase());
        });
    });

    describe('crypto fallback', () => {
        it('should use crypto.randomUUID when available', () => {
            const originalCrypto = globalThis.crypto;
            const mockRandomUUID = jest.fn(() => '00000000-0000-4000-8000-000000000000');
            (globalThis as any).crypto = { randomUUID: mockRandomUUID };

            const uuid = uuidV4();

            expect(uuid).toBe('00000000-0000-4000-8000-000000000000');
            expect(mockRandomUUID).toHaveBeenCalled();

            globalThis.crypto = originalCrypto;
        });

        it('should use crypto.getRandomValues when randomUUID is not available', () => {
            const originalCrypto = globalThis.crypto;
            const mockGetRandomValues = jest.fn((array: Uint8Array) => {
                // Fill with predictable values for testing
                for (let i = 0; i < array.length; i++) {
                    array[i] = i;
                }
                return array;
            });
            (globalThis as any).crypto = { getRandomValues: mockGetRandomValues };

            const uuid = uuidV4();

            expect(mockGetRandomValues).toHaveBeenCalled();
            expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

            globalThis.crypto = originalCrypto;
        });

        it('should fallback to Math.random when crypto is not available', () => {
            const originalCrypto = globalThis.crypto;
            delete (globalThis as any).crypto;

            const uuid = uuidV4();

            expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

            globalThis.crypto = originalCrypto;
        });
    });

    describe('randomBytes', () => {
        it('should generate correct number of bytes', () => {
            const originalCrypto = globalThis.crypto;
            delete (globalThis as any).crypto;

            // Test internal randomBytes function indirectly through uuidV4
            const uuid = uuidV4();
            const bytes = uuid.replace(/-/g, '');
            
            expect(bytes.length).toBe(32); // 16 bytes = 32 hex chars

            globalThis.crypto = originalCrypto;
        });
    });

    describe('Performance', () => {
        it('should generate UUIDs quickly', () => {
            const start = performance.now();
            for (let i = 0; i < 10000; i++) {
                uuidV4();
            }
            const end = performance.now();

            // Should generate 10000 UUIDs in less than 1 second
            expect(end - start).toBeLessThan(1000);
        });
    });

    describe('Edge cases', () => {
        it('should handle multiple consecutive calls', () => {
            const uuid1 = uuidV4();
            const uuid2 = uuidV4();
            const uuid3 = uuidV4();

            expect(uuid1).not.toBe(uuid2);
            expect(uuid2).not.toBe(uuid3);
            expect(uuid1).not.toBe(uuid3);
        });

        it('should work in loops', () => {
            const uuids: string[] = [];
            for (let i = 0; i < 100; i++) {
                uuids.push(uuidV4());
            }

            const uniqueUuids = new Set(uuids);
            expect(uniqueUuids.size).toBe(100);
        });
    });
});
