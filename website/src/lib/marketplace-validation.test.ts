import { describe, expect, it } from 'vitest';
import { parseMarketplaceCheckoutPayload } from './marketplace-validation';

describe('parseMarketplaceCheckoutPayload', () => {
    it('accepts valid payload', () => {
        const result = parseMarketplaceCheckoutPayload({
            exerciseIds: ['ex_1', 'ex_2', 'master-abc'],
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.exerciseIds).toEqual(['ex_1', 'ex_2', 'master-abc']);
        }
    });

    it('rejects empty arrays', () => {
        const result = parseMarketplaceCheckoutPayload({ exerciseIds: [] });
        expect(result.success).toBe(false);
    });

    it('rejects invalid exercise ids', () => {
        const result = parseMarketplaceCheckoutPayload({
            exerciseIds: ['ok_id', 'bad id with spaces'],
        });

        expect(result.success).toBe(false);
    });
});
