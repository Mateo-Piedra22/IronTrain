import { useWorkoutStore } from '../workoutStore';

jest.mock('../../services/ConfigService', () => ({
  configService: {
    get: jest.fn(() => false),
  },
}));

const mockFinishWorkout = jest.fn();
const mockResumeWorkout = jest.fn();
const mockUpdate = jest.fn();
const mockGetSets = jest.fn(async () => []);

jest.mock('../../services/WorkoutService', () => ({
  workoutService: {
    finishWorkout: (...args: any[]) => (mockFinishWorkout as any).apply(null, args as any),
    resumeWorkout: (...args: any[]) => (mockResumeWorkout as any).apply(null, args as any),
    update: (...args: any[]) => (mockUpdate as any).apply(null, args as any),
    getSets: (...args: any[]) => (mockGetSets as any).apply(null, args as any),
  },
}));

jest.mock('../../services/DatabaseService', () => ({
  dbService: {
    getWorkoutById: jest.fn(async () => null),
    getAll: jest.fn(async () => []),
  },
}));

describe('workoutStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWorkoutStore.setState({
      activeWorkout: null,
      activeSets: [],
      workoutTimer: 0,
      isTimerRunning: false,
      lastTickAtMs: null,
      exerciseNames: {},
    } as any);
    jest.restoreAllMocks();
  });

  it('should mark workout as completed via setWorkoutStatus', async () => {
    useWorkoutStore.setState({
      activeWorkout: { id: 'w1', status: 'in_progress', is_template: 0 } as any,
      isTimerRunning: true,
      lastTickAtMs: 0,
    } as any);

    await useWorkoutStore.getState().setWorkoutStatus('completed');

    expect(mockFinishWorkout).toHaveBeenCalledWith('w1');
    expect(useWorkoutStore.getState().activeWorkout?.status).toBe('completed');
    expect(useWorkoutStore.getState().isTimerRunning).toBe(false);
  });

  it('should advance timer by real delta seconds', () => {
    jest.spyOn(Date, 'now').mockReturnValue(2_500);
    useWorkoutStore.setState({
      activeWorkout: { id: 'w1', status: 'in_progress', is_template: 0 } as any,
      workoutTimer: 0,
      isTimerRunning: true,
      lastTickAtMs: 0,
    } as any);

    useWorkoutStore.getState().tickTimer();
    expect(useWorkoutStore.getState().workoutTimer).toBe(2);
  });
});
