import { create } from 'zustand';
import { Category, CategoryService } from '../services/CategoryService';
import { Exercise, ExerciseService } from '../services/ExerciseService';

interface DataState {
    categories: Category[];
    exercises: Exercise[];
    isLoading: boolean;
    error: string | null;

    refreshCategories: () => Promise<void>;
    refreshExercises: () => Promise<void>;
    fetchAll: () => Promise<void>;
}

export const useDataStore = create<DataState>((set) => ({
    categories: [],
    exercises: [],
    isLoading: false,
    error: null,

    refreshCategories: async () => {
        try {
            set({ isLoading: true, error: null });
            const categories = await CategoryService.getAll();
            set({ categories, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    refreshExercises: async () => {
        try {
            set({ isLoading: true, error: null });
            const exercises = await ExerciseService.getAll();
            set({ exercises, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    },

    fetchAll: async () => {
        try {
            set({ isLoading: true, error: null });
            const [categories, exercises] = await Promise.all([
                CategoryService.getAll(),
                ExerciseService.getAll()
            ]);
            set({ categories, exercises, isLoading: false });
        } catch (e) {
            set({ error: (e as Error).message, isLoading: false });
        }
    }
}));
