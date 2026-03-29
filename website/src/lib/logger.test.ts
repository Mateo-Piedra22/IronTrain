import { beforeEach, describe, expect, it } from 'vitest';
import { logger } from './logger';

describe('logger sampled methods', () => {
    beforeEach(() => {
        logger.clear();
    });

    it('does not log when sampleRate is 0', () => {
        logger.warnSampled('sampled-warn', { sampleRate: 0, sampleKey: 'k1' });
        expect(logger.getEntries().length).toBe(0);
    });

    it('always logs when sampleRate is 1', () => {
        logger.infoSampled('sampled-info', { sampleRate: 1, sampleKey: 'k2' });
        expect(logger.getEntries().length).toBe(1);
    });

    it('is deterministic for same sample key and rate', () => {
        logger.warnSampled('sampled-a', { sampleRate: 0.35, sampleKey: 'fixed-key' });
        const firstCount = logger.getEntries().length;
        logger.clear();
        logger.warnSampled('sampled-b', { sampleRate: 0.35, sampleKey: 'fixed-key' });
        const secondCount = logger.getEntries().length;
        expect(firstCount).toBe(secondCount);
    });
});
