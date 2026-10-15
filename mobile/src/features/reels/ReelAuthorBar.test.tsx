import React from 'react';
import { ReelAuthorBar } from './ReelAuthorBar';
import type { Reel, ReelCreator } from './api';

const renderer = require('react-test-renderer');
const { act } = renderer;
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { dir: () => 'ltr' } }) }));
jest.mock('@/design-system/components', () => ({ BaitlyText: require('react-native').Text }));
jest.mock('@/features/marketplace/PublicAvatar', () => ({ PublicAvatar: require('react-native').View }));
jest.mock('@/icons', () => ({ Reicon: require('react-native').View }));
jest.mock('@/api/baitlyMedia', () => ({ baitlyMediaUrl: (url: string) => url }));

const creator: ReelCreator = { name: 'Salma', publicProfileId: 'public-profile', role: 'CONCIERGE',
  offersManagement: true, seekingManagement: false };
let tree: any;
async function mount(author?: ReelCreator) {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const reel = { id: 'reel', caption: '', permalink: 'https://www.instagram.com/reel/test/',
    author: { displayName: 'Social name', published: true }, creator: author } as Reel;
  await act(async () => { tree = renderer.create(<ReelAuthorBar reel={reel} onLayout={() => {}} />); });
}
async function press(label: string) {
  const button = tree.root.findAll((node: any) => typeof node.props.onPress === 'function').find((node: any) =>
    node.findAll((child: any) => child.props.children === label).length > 0);
  expect(button).toBeDefined();
  await act(async () => button.props.onPress());
}
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null; jest.clearAllMocks();
});

it('opens the public profile and its existing management contact form', async () => {
  await mount(creator);
  await press('reelViewProfile');
  expect(mockNavigate).toHaveBeenLastCalledWith('PublicClientProfile', { clientProfileId: 'public-profile' });
  await press('reelEntrustProperty');
  expect(mockNavigate).toHaveBeenLastCalledWith('PublicClientProfile', { clientProfileId: 'public-profile', contact: true });
});
it('routes service inquiries to the provider rather than a management form', async () => {
  await mount({ ...creator, publicProfileId: null, providerId: 42, role: 'PROVIDER', offersManagement: false });
  await press('reelViewServices');
  expect(mockNavigate).toHaveBeenCalledWith('Provider', { providerId: 42 });
});
it('allows a management proposal only when the public owner is seeking management', async () => {
  await mount({ ...creator, role: 'OWNER', offersManagement: false, seekingManagement: true });
  await press('reelOfferManagement');
  expect(mockNavigate).toHaveBeenCalledWith('PublicClientProfile', { clientProfileId: 'public-profile', contact: true });
});
it('does not invent public profile or contact links on an older server response', async () => {
  await mount();
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain('reelOpenInstagram');
  expect(output).not.toContain('reelEntrustProperty');
  expect(output).not.toContain('reelViewServices');
  expect(output).not.toContain('reelViewProfile');
  expect(mockNavigate).not.toHaveBeenCalled();
});
