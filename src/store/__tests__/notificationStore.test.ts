import { useNotificationStore } from '../notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ toasts: [], globalBanner: null } as any);
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('should cap toast list to 3 items (FIFO)', () => {
    jest.spyOn(Date, 'now').mockReturnValue(0);

    useNotificationStore.getState().addToast({ type: 'info', title: 't1', message: 'm1', duration: 3000 });
    useNotificationStore.getState().addToast({ type: 'info', title: 't2', message: 'm2', duration: 3000 });
    useNotificationStore.getState().addToast({ type: 'info', title: 't3', message: 'm3', duration: 3000 });
    useNotificationStore.getState().addToast({ type: 'info', title: 't4', message: 'm4', duration: 3000 });

    const titles = useNotificationStore.getState().toasts.map((t) => t.title);
    expect(titles).toEqual(['t2', 't3', 't4']);
  });

  it('should sweep expired toasts even if setTimeout removal does not run', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);

    useNotificationStore.getState().addToast({ type: 'success', title: 'ok', message: 'm', duration: 1500 });
    expect(useNotificationStore.getState().toasts).toHaveLength(1);

    jest.spyOn(Date, 'now').mockReturnValue(2_600);
    useNotificationStore.getState().sweepExpiredToasts();

    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });

  it('should assign expiresAtMs even when duration <= 0 to avoid stuck toasts', () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);

    useNotificationStore.getState().addToast({ type: 'warning', title: 'hold', message: 'm', duration: 0 });

    const toast = useNotificationStore.getState().toasts[0];
    expect(toast.createdAtMs).toBe(10_000);
    expect(toast.expiresAtMs).toBeGreaterThan(10_000);

    jest.spyOn(Date, 'now').mockReturnValue(toast.expiresAtMs + 1);
    useNotificationStore.getState().sweepExpiredToasts();

    expect(useNotificationStore.getState().toasts).toHaveLength(0);
  });
});
