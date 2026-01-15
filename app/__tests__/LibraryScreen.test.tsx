import React from 'react';
import renderer from 'react-test-renderer';
import LibraryScreen from '../(tabs)/exercises';

// Mock Expo Router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock Child Components to focus on layout
jest.mock('../../components/ExerciseList', () => ({
  ExerciseList: () => 'ExerciseList'
}));
jest.mock('../../components/CategoryManager', () => ({
  CategoryManager: () => 'CategoryManager'
}));
jest.mock('../../components/ui/SafeAreaWrapper', () => ({
    SafeAreaWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe('LibraryScreen Navigation Structure', () => {
  it('renders exercises mode by default', () => {
    let root: renderer.ReactTestRenderer;
    renderer.act(() => {
      root = renderer.create(<LibraryScreen />);
    });
    expect(root!.toJSON()).toBeTruthy();
    renderer.act(() => {
      root!.unmount();
    });
  });
});
