import { createAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { configService } from '../ConfigService';
import { feedbackService } from '../FeedbackService';

jest.mock('../ConfigService', () => ({
    configService: {
        get: jest.fn(),
    },
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    notificationAsync: jest.fn(),
    selectionAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

describe('FeedbackService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (configService.get as jest.Mock).mockImplementation((key) => {
            if (key === 'soundFeedbackEnabled') return true;
            if (key === 'hapticFeedbackEnabled') return true;
            if (key === 'notificationPreferences') {
                return {
                    sounds: {
                        countdown: true,
                        intervalTimer: true,
                        restTimer: true,
                        workoutComplete: true,
                    },
                };
            }
            return null;
        });
    });

    const waitForSound = () => new Promise(resolve => setTimeout(resolve, 10));

    it('should trigger button press haptic', async () => {
        await feedbackService.buttonPress();
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    });

    it('should trigger selection haptic', async () => {
        await feedbackService.selection();
        expect(Haptics.selectionAsync).toHaveBeenCalled();
    });

    it('should trigger countdown haptic and sound', async () => {
        await feedbackService.countdown();
        await waitForSound();
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
        expect(createAudioPlayer).toHaveBeenCalled();
    });

    it('should trigger phase change (work) feedback', async () => {
        await feedbackService.phaseChange('work');
        await waitForSound();
        expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
        expect(createAudioPlayer).toHaveBeenCalled();
    });

    it('should trigger phase change (rest) feedback', async () => {
        await feedbackService.phaseChange('rest');
        await waitForSound();
        expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Medium);
        expect(createAudioPlayer).toHaveBeenCalled();
    });

    it('should trigger workout completion feedback', async () => {
        await feedbackService.workoutFinished();
        await waitForSound();
        expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
        expect(createAudioPlayer).toHaveBeenCalled();
    });

    it('should trigger timer complete feedback', async () => {
        await feedbackService.timerComplete();
        await waitForSound();
        expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
        expect(createAudioPlayer).toHaveBeenCalled();
    });

    it('should trigger error feedback', async () => {
        await feedbackService.errorFeedback();
        expect(Haptics.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    });

    it('should respect haptic disabled setting', async () => {
        (configService.get as jest.Mock).mockImplementation((key) => {
            if (key === 'hapticFeedbackEnabled') return false;
            return true;
        });
        await feedbackService.buttonPress();
        expect(Haptics.impactAsync).not.toHaveBeenCalled();
    });

    it('should respect sound disabled setting', async () => {
        (configService.get as jest.Mock).mockImplementation((key) => {
            if (key === 'soundFeedbackEnabled') return false;
            if (key === 'hapticFeedbackEnabled') return true;
            if (key === 'notificationPreferences') {
                return {
                    sounds: {
                        countdown: true,
                    },
                };
            }
            return null;
        });
        await feedbackService.countdown();
        await waitForSound();
        expect(Haptics.impactAsync).toHaveBeenCalled();
        expect(createAudioPlayer).not.toHaveBeenCalled();
    });
});
