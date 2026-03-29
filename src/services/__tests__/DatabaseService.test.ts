import * as SQLite from 'expo-sqlite';
import { dbService } from '../DatabaseService';

jest.mock('expo-sqlite', () => ({
    openDatabaseAsync: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        captureException: jest.fn(),
    },
}));

jest.mock('../../utils/uuid', () => ({
    uuidV4: jest.fn(() => 'mock-uuid'),
}));

jest.mock('../DataEventService', () => ({
    dataEventService: {
        emit: jest.fn(),
    },
}));

jest.mock('../../store/authStore', () => ({
    useAuthStore: {
        getState: jest.fn(() => ({ token: 'mock-token', user: { id: 'mock-user' } })),
    },
}));

describe('DatabaseService', () => {
    let mockDb: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDb = {
            execAsync: jest.fn().mockResolvedValue(undefined),
            runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
            getAllAsync: jest.fn().mockResolvedValue([]),
            getFirstAsync: jest.fn().mockResolvedValue(null),
            withTransactionAsync: jest.fn().mockImplementation(async (cb) => await cb()),
        };
        (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(mockDb);
        // Reset the service state between tests
        (dbService as any).isInitialized = false;
        (dbService as any).db = null;
        (dbService as any).initPromise = null;
    });

    it('initializes correctly and creates tables', async () => {
        await dbService.init();
        expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('irontrain_v1.db');
        expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('PRAGMA foreign_keys = ON;'));
        expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS categories'));
    });

    it('executes raw SQL', async () => {
        await dbService.init();
        const sql = 'SELECT 1';
        await dbService.executeRaw(sql);
        expect(mockDb.execAsync).toHaveBeenCalledWith(sql);
    });

    it('runs a command with parameters', async () => {
        await dbService.init();
        const sql = 'INSERT INTO table (col) VALUES (?)';
        const params = ['val'];
        await dbService.run(sql, params);
        expect(mockDb.runAsync).toHaveBeenCalledWith(sql, ...params);
    });

    it('gets categories', async () => {
        const mockCategories = [{ id: '1', name: 'Cat 1' }];
        mockDb.getAllAsync.mockResolvedValue(mockCategories);
        await dbService.init();

        const categories = await dbService.getCategories();
        expect(categories).toEqual(mockCategories);
        expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM categories'));
    });

    it('creates an exercise', async () => {
        await dbService.init();
        const exerciseData = { name: 'Push up', category_id: 'cat-1', type: 'reps' };

        const id = await dbService.createExercise(exerciseData as any);

        expect(id).toBe('mock-uuid');
        // Check runAsync call for INSERT - notice the order in the actual implementation
        expect(mockDb.runAsync).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO exercises'),
            'mock-uuid',
            'cat-1',
            'Push up',
            'reps',
            2.5, // default increment
            null, // notes
            0, // is_system
            expect.any(Number), // updatedAt
            'mock-user' // userId
        );
    });

    it('updates an exercise', async () => {
        await dbService.init();
        const exerciseId = 'ex-1';
        const updates = { name: 'Updated Push up' };

        await dbService.updateExercise(exerciseId, updates);

        expect(mockDb.runAsync).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE exercises SET name = ?'),
            'Updated Push up',
            expect.any(Number), // updated_at
            exerciseId
        );
    });

    it('creates a workout', async () => {
        await dbService.init();
        const date = Date.now();

        const id = await dbService.createWorkout(date);

        expect(id).toBe('mock-uuid');
        expect(mockDb.runAsync).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO workouts'),
            'mock-uuid',
            date,
            expect.any(Number), // start_time
            'in_progress',
            0, // is_template
            expect.any(Number), // updatedAt
            'mock-user' // userId
        );
    });

    it('adds a set to a workout', async () => {
        await dbService.init();
        const setData = {
            workout_id: 'w-1',
            exercise_id: 'e-1',
            type: 'weight_reps',
            order_index: 0,
            weight: 10,
            reps: 10
        };

        const id = await dbService.addSet(setData as any);

        expect(id).toBe('mock-uuid');
        expect(mockDb.runAsync).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO workout_sets'),
            'mock-uuid',
            'w-1',
            'e-1',
            'weight_reps',
            10,
            10,
            null, // distance
            null, // time
            null, // rpe
            0,
            0, // completed
            null, // notes
            null, // superset_id
            expect.any(Number), // updated_at
            'mock-user' // userId
        );
    });

    it('handles transactions', async () => {
        await dbService.init();
        const callback = jest.fn().mockResolvedValue(undefined);

        await dbService.withTransactionAsync(callback);

        expect(mockDb.withTransactionAsync).toHaveBeenCalled();
    });

    it('throws error if initialization fails', async () => {
        (SQLite.openDatabaseAsync as jest.Mock).mockRejectedValueOnce(new Error('Init failed'));
        await expect(dbService.init()).rejects.toThrow('Init failed');
    });
});
