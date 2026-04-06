import { useWorkoutStore } from '../workoutStore';

jest.mock('../../services/ConfigService', () => ({
  configService: {
    get: jest.fn((key: string) => {
      if (key === 'runningWorkoutTimerWorkoutId') return 'w1';
      return false;
    }),
    set: jest.fn(async () => { }),
    setGeneric: jest.fn(async () => { }),
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

    expect(mockFinishWorkout).toHaveBeenCalledWith('w1', 0);
    expect(useWorkoutStore.getState().activeWorkout).toBe(null);
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

  it('should resume timer without losing precision across foreground resume', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(10_000);

    useWorkoutStore.setState({
      activeWorkout: { id: 'w1', status: 'in_progress', is_template: 0 } as any,
      workoutTimer: 120,
      isTimerRunning: true,
      lastTickAtMs: 8_000,
    } as any);

    useWorkoutStore.getState().tickTimer();

    expect(useWorkoutStore.getState().workoutTimer).toBe(122);
    expect(useWorkoutStore.getState().lastTickAtMs).toBe(10_000);
  });

  it('should cap background delta to prevent massive timer jumps', () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(50_000_000);

    useWorkoutStore.setState({
      activeWorkout: { id: 'w1', status: 'in_progress', is_template: 0 } as any,
      workoutTimer: 30,
      isTimerRunning: true,
      lastTickAtMs: 0,
    } as any);

    useWorkoutStore.getState().tickTimer();

    expect(useWorkoutStore.getState().workoutTimer).toBe(43_230);
  });

  it('should not transfer workout timer ownership when loading another workout by id (cross-day safety)', async () => {
    const { dbService } = require('../../services/DatabaseService');
    const { configService } = require('../../services/ConfigService');

    (dbService.getWorkoutById as jest.Mock).mockResolvedValue({ id: 'w2', status: 'in_progress', is_template: 0, duration: 12 } as any);

    await useWorkoutStore.getState().loadWorkoutById('w2');

    expect(useWorkoutStore.getState().activeWorkout?.id).toBe('w2');
    // runningWorkoutTimerWorkoutId mocked to 'w1', so w2 must NOT run
    expect(useWorkoutStore.getState().isTimerRunning).toBe(false);
    // Loading should never reassign ownership
    expect(configService.set).not.toHaveBeenCalledWith('runningWorkoutTimerWorkoutId', 'w2');
  });
});
