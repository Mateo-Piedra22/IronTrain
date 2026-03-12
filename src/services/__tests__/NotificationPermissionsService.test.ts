import notifee, { AuthorizationStatus } from '@notifee/react-native';
import * as SecureStore from 'expo-secure-store';
import { notificationPermissionsService } from '../NotificationPermissionsService';

jest.mock('../../utils/logger', () => ({
  logger: {
    captureException: jest.fn(),
  },
}));

jest.mock('../../store/confirmStore', () => ({
  confirm: {
    ask: jest.fn(),
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  Linking: {
    openURL: jest.fn(),
    openSettings: jest.fn(),
  },
}));

describe('NotificationPermissionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requestPermission', () => {
    it('returns true when already authorized', async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({ authorizationStatus: AuthorizationStatus.AUTHORIZED });

      const res = await notificationPermissionsService.requestPermission(false);

      expect(res).toBe(true);
      expect(notifee.requestPermission).not.toHaveBeenCalled();
    });

    it('requests permission when NOT_DETERMINED', async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({ authorizationStatus: AuthorizationStatus.NOT_DETERMINED });
      (notifee.requestPermission as jest.Mock).mockResolvedValue({ authorizationStatus: AuthorizationStatus.AUTHORIZED });

      const res = await notificationPermissionsService.requestPermission(false);

      expect(res).toBe(true);
      expect(notifee.requestPermission).toHaveBeenCalledTimes(1);
    });

    it('does not request permission when DENIED and explainContext=false', async () => {
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({ authorizationStatus: AuthorizationStatus.DENIED });

      const res = await notificationPermissionsService.requestPermission(false);

      expect(res).toBe(false);
      expect(notifee.requestPermission).not.toHaveBeenCalled();
    });
  });

  describe('requestPermissionOnce', () => {
    it('prompts and stores prompted flag when not prompted before', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({ authorizationStatus: AuthorizationStatus.NOT_DETERMINED });
      (notifee.requestPermission as jest.Mock).mockResolvedValue({ authorizationStatus: AuthorizationStatus.AUTHORIZED });

      const res = await notificationPermissionsService.requestPermissionOnce(false);

      expect(res).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    });

    it('does not call requestPermission when already prompted; uses requestPermissionIfNeeded', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');
      (notifee.getNotificationSettings as jest.Mock).mockResolvedValue({ authorizationStatus: AuthorizationStatus.AUTHORIZED });

      const res = await notificationPermissionsService.requestPermissionOnce(false);

      expect(res).toBe(true);
      expect(notifee.requestPermission).not.toHaveBeenCalled();
    });
  });
});
