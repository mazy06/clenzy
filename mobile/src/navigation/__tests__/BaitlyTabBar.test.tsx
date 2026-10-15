import React from 'react';
import { Keyboard } from 'react-native';
import { BaitlyTabBar } from '../BaitlyTabBar';

const renderer = require('react-test-renderer');
const { act } = renderer;
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: require('react-native').View, createAnimatedComponent: (component: unknown) => component },
  useSharedValue: (value: number) => require('react').useRef({ value }).current,
  useAnimatedStyle: (style: () => unknown) => style(), withTiming: (value: number) => value,
  useAnimatedProps: (props: () => unknown) => props(),
  Easing: { out: (value: unknown) => value, poly: () => undefined },
}));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../useBaitlyMotion', () => ({ useBaitlyReducedMotion: () => true }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { dir: () => 'ltr' } }) }));
jest.mock('@/design-system/theme', () => ({ useBaitlyTheme: () => ({ background: '#E8EEF3', surface: '#FAFBFC', ink: '#1B2A35' }) }));
jest.mock('@/design-system/components', () => ({ BaitlyText: require('react-native').Text }));
jest.mock('expo-image', () => ({ Image: require('react-native').View }));

let tree: any;
const navigation = { emit: jest.fn(() => ({ defaultPrevented: false })), navigate: jest.fn() };
async function mount() {
  await act(async () => {
    tree = renderer.create(<BaitlyTabBar {...{
      state: { index: 0, routes: [{ key: 'market', name: 'Marketplace' }, { key: 'account', name: 'Profile' }] },
      descriptors: { market: { options: { tabBarLabel: 'Explorer' } }, account: { options: { tabBarLabel: 'Compte', tabBarBadge: 3 } } },
      navigation, insets: { bottom: 34, top: 0, left: 0, right: 0 },
    } as any} />);
  });
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null;
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

it('changes destination through tab events and avoids navigating again on the selected tab', async () => {
  await mount();
  const buttons = ['Marketplace', 'Profile'].map(name => tree.root.findByProps({ testID: `baitly-tab-${name}` }));
  await act(async () => buttons[0].props.onPress());
  expect(navigation.navigate).not.toHaveBeenCalled();
  await act(async () => buttons[1].props.onPress());
  expect(navigation.emit).toHaveBeenLastCalledWith({ type: 'tabPress', target: 'account', canPreventDefault: true });
  expect(navigation.navigate).toHaveBeenCalledWith('Profile', undefined);
  expect(buttons[0].props.accessibilityState).toEqual({ selected: true });
});

it('respects cancellation by the navigator and preserves long-press events', async () => {
  await mount();
  navigation.emit.mockReturnValueOnce({ defaultPrevented: true });
  const button = tree.root.findByProps({ testID: 'baitly-tab-Profile' });
  await act(async () => button.props.onPress());
  expect(navigation.navigate).not.toHaveBeenCalled();
  await act(async () => button.props.onLongPress());
  expect(navigation.emit).toHaveBeenLastCalledWith({ type: 'tabLongPress', target: 'account' });
});

it('hides the bar when opened with the keyboard already visible', async () => {
  jest.mocked(Keyboard.isVisible).mockReturnValue(true);
  await mount();
  expect(tree.toJSON()).toBeNull();
});
