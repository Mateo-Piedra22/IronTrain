import React from 'react';
import renderer from 'react-test-renderer';
import { TestingProvider } from '../../src/utils/TestingProvider';
import { DuplicateResolutionModal } from '../DuplicateResolutionModal';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => <>{children}</>,
  SafeAreaView: ({ children }: any) => <>{children}</>,
}));

jest.mock('../../src/services/DuplicateResolutionService', () => ({
  DuplicateResolutionService: {
    scanHardDuplicates: jest.fn(async () => ({ hard: [] })),
    scanAllDuplicates: jest.fn(async () => ({ hard: [], soft: [] })),
    mergeGroup: jest.fn(async () => undefined),
  },
}));

jest.mock('../../src/services/FeedbackService', () => ({
  feedbackService: {
    buttonPress: jest.fn(),
    dayCompleted: jest.fn(),
    selection: jest.fn(),
  },
}));

jest.mock('../../src/store/confirmStore', () => ({
  confirm: {
    hide: jest.fn(),
    custom: jest.fn(),
  },
}));

jest.mock('../../src/utils/notify', () => ({
  notify: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('../../src/services/ConfigService', () => ({
  configService: {
    get: jest.fn(() => null),
    set: jest.fn(async () => undefined),
  },
}));

describe('DuplicateResolutionModal', () => {
  it('renders when visible', () => {
    let root: renderer.ReactTestRenderer;
    renderer.act(() => {
      root = renderer.create(
        <TestingProvider>
          <DuplicateResolutionModal visible onClose={() => undefined} />
        </TestingProvider>
      );
    });

    expect(root!.toJSON()).toBeTruthy();

    renderer.act(() => {
      root!.unmount();
    });
  });

  it('does not render when not visible', () => {
    let root: renderer.ReactTestRenderer;
    renderer.act(() => {
      root = renderer.create(
        <TestingProvider>
          <DuplicateResolutionModal visible={false} onClose={() => undefined} />
        </TestingProvider>
      );
    });

    expect(root!.toJSON()).toBeNull();

    renderer.act(() => {
      root!.unmount();
    });
  });
});
