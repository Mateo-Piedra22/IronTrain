import * as React from 'react';
import renderer from 'react-test-renderer';
import { IronButton } from '../../IronButton';
import { IronCard } from '../../IronCard';
import { IronInput } from '../../IronInput';

describe('UI Components', () => {
  describe('IronButton', () => {
    it('renders solid variant correctly', () => {
      let root: renderer.ReactTestRenderer;
      renderer.act(() => {
        root = renderer.create(<IronButton label="Test Button" onPress={() => {}} />);
      });
      expect(root!.toJSON()).toBeTruthy();
      renderer.act(() => {
        root!.unmount();
      });
    });

    it('renders loading state', () => {
      let root: renderer.ReactTestRenderer;
      renderer.act(() => {
        root = renderer.create(<IronButton label="Loading" loading onPress={() => {}} />);
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
        root = renderer.create(<IronInput label="Username" placeholder="Enter name" />);
      });
      expect(root!.toJSON()).toBeTruthy();
      renderer.act(() => {
        root!.unmount();
      });
    });

    it('renders error state', () => {
      let root: renderer.ReactTestRenderer;
      renderer.act(() => {
        root = renderer.create(<IronInput label="Email" error="Invalid email" />);
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
        root = renderer.create(<IronCard><IronInput /></IronCard>);
      });
      expect(root!.toJSON()).toBeTruthy();
      renderer.act(() => {
        root!.unmount();
      });
    });
  });
});
