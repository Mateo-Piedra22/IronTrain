import { buildDuplicateMessage, findBadgeDuplicates, findExerciseDuplicates, findNameDuplicates } from '../duplicates';

describe('duplicates utils', () => {
    describe('findNameDuplicates', () => {
        it('matches by normalized name and excludes same id', () => {
            const existing = [
                { id: '1', name: 'Press de banca' },
                { id: '2', name: 'Sentadilla' },
            ];

            expect(findNameDuplicates({ name: ' press  de   banca ' }, existing).map((x) => x.id)).toEqual(['1']);
            expect(findNameDuplicates({ id: '1', name: 'press de banca' }, existing)).toEqual([]);
        });
    });

    describe('findBadgeDuplicates', () => {
        it('matches by normalized name and group', () => {
            const existing = [
                { id: 'b1', name: 'Barra Z', group_name: 'equipamiento' },
                { id: 'b2', name: 'Barra Z', group_name: 'otro' },
            ];

            expect(findBadgeDuplicates({ name: 'barra z', group_name: 'equipamiento' }, existing).map((x) => x.id)).toEqual(['b1']);
        });
    });

    describe('findExerciseDuplicates', () => {
        it('requires name+category+type+badge set equality', () => {
            const existing = [
                { id: 'e1', name: 'Press de banca', category_id: 'c1', type: 'weight_reps', badge_ids: ['b2', 'b1'] },
                { id: 'e2', name: 'Press de banca', category_id: 'c1', type: 'weight_reps', badge_ids: ['b1'] },
            ];

            const dups = findExerciseDuplicates({ name: 'press de banca', category_id: 'c1', type: 'weight_reps', badge_ids: ['b1', 'b2'] }, existing);
            expect(dups.map((x) => x.id)).toEqual(['e1']);
        });

        it('excludes same id on edit', () => {
            const existing = [
                { id: 'e1', name: 'Press', category_id: 'c1', type: 'weight_reps', badge_ids: [] },
            ];

            expect(findExerciseDuplicates({ id: 'e1', name: 'press', category_id: 'c1', type: 'weight_reps', badge_ids: [] }, existing)).toEqual([]);
        });
    });

    describe('buildDuplicateMessage', () => {
        it('formats a readable message', () => {
            const msg = buildDuplicateMessage('Intro', [
                { title: 'Press de banca', subtitle: 'Pecho' },
            ]);

            expect(msg).toContain('Intro');
            expect(msg).toContain('Coincidencias:');
            expect(msg).toContain('Press de banca (Pecho)');
        });
    });
});
