import renderer from 'react-test-renderer';

import { MonoText } from '../StyledText';

it(`renders correctly`, () => {
  let root;
  renderer.act(() => {
    root = renderer.create(<MonoText>Snapshot test!</MonoText>);
  });
  expect(root.toJSON()).toBeTruthy();
  renderer.act(() => {
    root.unmount();
  });
});
