import { logger } from '../../utils/logger';
import { MetricsAndFeedbackService } from '../MetricsAndFeedbackService';

jest.mock('expo-application', () => ({
  nativeApplicationVersion: '2.1.0',
  nativeBuildVersion: '210',
}));

jest.mock('expo-device', () => ({
  osVersion: '16',
  modelName: 'TestDevice',
}));

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('../../constants/Config', () => ({
  Config: {
    API_URL: 'https://example.test',
  },
}));

describe('MetricsAndFeedbackService.submitFeedback', () => {
  beforeEach(() => {
    logger.clear();
    jest.clearAllMocks();
  });

  it('submits feedback successfully without attaching logs', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => ({ success: true }),
    }));
    // @ts-expect-error override global
    global.fetch = fetchMock;

    const res = await MetricsAndFeedbackService.submitFeedback('bug', 'test', { context: 'unit_test' });

    expect(res).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const call = (fetchMock.mock.calls as unknown[][])[0];
    expect(call).toBeDefined();

    const init = call?.[1] as { body?: unknown } | undefined;
    expect(init?.body).toBeDefined();

    const body = JSON.parse(String(init?.body));

    expect(body.metadata.context).toBe('unit_test');
    expect(body.metadata.logs).toBeUndefined();
  });
});
