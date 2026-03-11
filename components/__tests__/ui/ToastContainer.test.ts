import { computeToastStackStyle } from '../../ui/ToastContainer';

describe('ToastContainer stacking', () => {
    it('returns expected style for index 0 (front)', () => {
        const s = computeToastStackStyle(0);
        expect(s.opacity).toBe(1);
        expect(s.marginTop).toBe(0);
        expect(s.transform).toEqual([{ scale: 1 }, { translateY: 0 }]);
    });

    it('clamps negative index to 0', () => {
        const s = computeToastStackStyle(-10);
        expect(s.opacity).toBe(1);
        expect(s.marginTop).toBe(0);
        expect(s.transform).toEqual([{ scale: 1 }, { translateY: 0 }]);
    });

    it('stacks behind for higher indices', () => {
        const s1 = computeToastStackStyle(1);
        const s2 = computeToastStackStyle(2);

        expect(s1.opacity).toBeLessThan(1);
        expect(s2.opacity).toBeLessThan(s1.opacity);

        expect(s1.marginTop).toBeLessThan(0);
        expect(s2.marginTop).toBeLessThan(0);

        expect(s1.transform).toEqual([{ scale: 0.96 }, { translateY: 6 }]);
        expect(s2.transform).toEqual([{ scale: 0.92 }, { translateY: 12 }]);
    });

    it('clamps to minimum values for very large index', () => {
        const s = computeToastStackStyle(100);
        expect(s.opacity).toBeGreaterThanOrEqual(0.72);
        expect(s.transform[0].scale).toBeGreaterThanOrEqual(0.88);
    });
});
