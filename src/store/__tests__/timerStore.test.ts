import { useTimerStore } from '../timerStore';

describe('timerStore', () => {
  beforeEach(() => {
    useTimerStore.setState({ timeLeft: 0, isRunning: false, duration: 0, endAtMs: null } as any);
    jest.restoreAllMocks();
  });

  it('should compute timeLeft from endAtMs (no drift)', () => {
    jest.spyOn(Date, 'now').mockReturnValue(0);
    useTimerStore.getState().startTimer(10);

    expect(useTimerStore.getState().timeLeft).toBe(10);
    expect(useTimerStore.getState().isRunning).toBe(true);
    expect(useTimerStore.getState().endAtMs).toBe(10_000);

    jest.spyOn(Date, 'now').mockReturnValue(5_500);
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().timeLeft).toBe(5);

    jest.spyOn(Date, 'now').mockReturnValue(10_001);
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().timeLeft).toBe(0);
    expect(useTimerStore.getState().isRunning).toBe(false);
    expect(useTimerStore.getState().endAtMs).toBeNull();
  });

  it('should extend endAtMs when adding time while running', () => {
    jest.spyOn(Date, 'now').mockReturnValue(0);
    useTimerStore.getState().startTimer(10);

    jest.spyOn(Date, 'now').mockReturnValue(3_000);
    useTimerStore.getState().addTime(10);
    useTimerStore.getState().tick();

    expect(useTimerStore.getState().timeLeft).toBe(17);
  });
});

