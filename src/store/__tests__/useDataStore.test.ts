import { act, renderHook } from '@testing-library/react-native';
import { CategoryService } from '../../services/CategoryService';
import { dataEventService } from '../../services/DataEventService';
import { ExerciseService } from '../../services/ExerciseService';
import { useDataStore } from '../useDataStore';

jest.mock('../../services/CategoryService');
jest.mock('../../services/ExerciseService');
jest.mock('../../services/DataEventService', () => ({
    dataEventService: {
        subscribe: jest.fn(),
        emit: jest.fn(),
    }
}));

describe('useDataStore', () => {
    beforeEach(() => {
        (CategoryService.getAll as jest.Mock).mockClear();
        (ExerciseService.getAll as jest.Mock).mockClear();
        (dataEventService.emit as jest.Mock).mockClear();
        // We do NOT clear dataEventService.subscribe because it's called at module level 
        // Reset Zustand state
        act(() => {
            useDataStore.setState({
                categories: [],
                exercises: [],
                isLoading: false,
                error: null,
            });
        });
    });

    it('should initialize with empty state', () => {
        const { result } = renderHook(() => useDataStore());
        expect(result.current.categories).toEqual([]);
        expect(result.current.exercises).toEqual([]);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('should fetch categories successfully', async () => {
        const mockCategories = [{ id: '1', name: 'Cat 1' }];
        (CategoryService.getAll as jest.Mock).mockResolvedValueOnce(mockCategories);

        const { result } = renderHook(() => useDataStore());

        await act(async () => {
            await result.current.refreshCategories();
        });

        expect(result.current.categories).toEqual(mockCategories);
        expect(result.current.isLoading).toBe(false);
    });

    it('should fetch exercises successfully', async () => {
        const mockExercises = [{ id: '1', name: 'Ex 1' }];
        (ExerciseService.getAll as jest.Mock).mockResolvedValueOnce(mockExercises);

        const { result } = renderHook(() => useDataStore());

        await act(async () => {
            await result.current.refreshExercises();
        });

        expect(result.current.exercises).toEqual(mockExercises);
        expect(result.current.isLoading).toBe(false);
    });

    it('should fetch all data successfully', async () => {
        const mockCategories = [{ id: '1', name: 'Cat 1' }];
        const mockExercises = [{ id: '1', name: 'Ex 1' }];

        (CategoryService.getAll as jest.Mock).mockResolvedValueOnce(mockCategories);
        (ExerciseService.getAll as jest.Mock).mockResolvedValueOnce(mockExercises);

        const { result } = renderHook(() => useDataStore());

        await act(async () => {
            await result.current.fetchAll();
        });

        expect(result.current.categories).toEqual(mockCategories);
        expect(result.current.exercises).toEqual(mockExercises);
        expect(result.current.isLoading).toBe(false);
    });

    it('should handle errors in fetchAll', async () => {
        const error = new Error('Fetch failed');
        (CategoryService.getAll as jest.Mock).mockRejectedValueOnce(error);

        const { result } = renderHook(() => useDataStore());

        await act(async () => {
            await result.current.fetchAll();
        });

        expect(result.current.error).toBe('Fetch failed');
        expect(result.current.isLoading).toBe(false);
    });

    it('should subscribe to DATA_UPDATED event on initialization', () => {
        // The subscription happens on module load in the file, 
        // so we check if subscribe was called with the correct event
        expect(dataEventService.subscribe).toHaveBeenCalledWith('DATA_UPDATED', expect.any(Function));
    });
});
