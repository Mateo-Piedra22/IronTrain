import * as React from 'react';
import renderer from 'react-test-renderer';
import { TestingProvider } from '../../../src/utils/TestingProvider';
import { IronButton } from '../../IronButton';
import { IronCard } from '../../IronCard';
import { IronInput } from '../../IronInput';

describe('UI Components', () => {
  describe('IronButton', () => {
    it('renders solid variant correctly', () => {
      let root: renderer.ReactTestRenderer;
      renderer.act(() => {
        root = renderer.create(
          <TestingProvider>
            <IronButton label="Test Button" onPress={() => { }} />
          </TestingProvider>
        );
      });
      expect(root!.toJSON()).toBeTruthy();
      renderer.act(() => {
        root!.unmount();
      });
    });

    it('renders loading state', () => {
      let root: renderer.ReactTestRenderer;
      renderer.act(() => {
        root = renderer.create(
          <TestingProvider>
            <IronButton label="Loading" loading onPress={() => { }} />
          </TestingProvider>
        );
      });
      expect(root!.toJSON()).toBeTruthy();
      renderer.act(() => {
        root!.unmount();
      });
    });
  });

  describe('IronInput', () => {
    it('renders with label and placeholder', () => {
      let root: renderer.ReactTestRenderer;
      renderer.act(() => {
        root = renderer.create(
          <TestingProvider>
            <IronInput label="Username" placeholder="Enter name" />
          </TestingProvider>
        );
      });
      expect(root!.toJSON()).toBeTruthy();
      renderer.act(() => {
        root!.unmount();
      });
    });

    it('renders error state', () => {
      let root: renderer.ReactTestRenderer;
      renderer.act(() => {
        root = renderer.create(
          <TestingProvider>
            <IronInput label="Email" error="Invalid email" />
          </TestingProvider>
        );
      });
      expect(root!.toJSON()).toBeTruthy();
      renderer.act(() => {
        root!.unmount();
      });
    });
  });

  describe('IronCard', () => {
    it('renders default variant', () => {
      let root: renderer.ReactTestRenderer;
      renderer.act(() => {
        root = renderer.create(
          <TestingProvider>
            <IronCard><IronInput /></IronCard>
          </TestingProvider>
        );
      });
      expect(root!.toJSON()).toBeTruthy();
      renderer.act(() => {
        root!.unmount();
      });
    });
  });
});
