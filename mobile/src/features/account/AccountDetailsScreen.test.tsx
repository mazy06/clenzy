import React from 'react';
import { apiClient } from '@/api/apiClient';
import { BaitlyButton, BaitlyField, BaitlyNotice } from '@/design-system/components';
import { AccountDetailsScreen } from './AccountDetailsScreen';

const renderer = require('react-test-renderer');
const { act } = renderer;
const mockLoadUser = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('@/api/apiClient', () => ({ apiClient: { patch: jest.fn(), post: jest.fn() } }));
jest.mock('@/store/authStore', () => ({ useAuthStore: (selector: any) => selector({
  user: { firstName: 'Admin', lastName: 'User', email: 'admin@example.test', organizationName: 'Test' },
  loadUser: mockLoadUser, logout: jest.fn(),
}) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('./AccountComponents', () => {
  const React = require('react');
  return { accountStyles: {}, AccountGroup: (props: any) => React.createElement('Group', props, props.children), AccountRow: (props: any) => React.createElement('Row', props) };
});
jest.mock('@/design-system/components', () => {
  const React = require('react');
  return Object.fromEntries(['BaitlyScreen', 'BaitlyButton', 'BaitlyField', 'BaitlyText', 'BaitlyNotice'].map(name => [name, (props: any) => React.createElement(name, props, props.children)]));
});
let tree: any;
beforeEach(async () => { jest.clearAllMocks(); await act(async () => { tree = renderer.create(<AccountDetailsScreen />); }); });
afterEach(async () => { await act(async () => tree.unmount()); });
it('saves only personal names through the authenticated API and reloads the profile', async () => {
  expect(tree.root.findByType(BaitlyButton).props.disabled).toBe(true);
  jest.mocked(apiClient.patch).mockResolvedValueOnce({});
  await act(async () => tree.root.findAllByType(BaitlyField)[0].props.onChangeText(' Toufik '));
  await act(async () => tree.root.findByType(BaitlyButton).props.onPress());
  expect(apiClient.patch).toHaveBeenCalledWith('/users/me/profile', { firstName: 'Toufik', lastName: 'User' });
  expect(mockLoadUser).toHaveBeenCalledTimes(1);
  expect(tree.root.findByType(BaitlyNotice).props.error).toBe(false);
});
it('keeps the entered name on failure and reports that the save failed', async () => {
  jest.mocked(apiClient.patch).mockRejectedValueOnce(new Error('offline'));
  await act(async () => tree.root.findAllByType(BaitlyField)[0].props.onChangeText('Toufik'));
  await act(async () => tree.root.findByType(BaitlyButton).props.onPress());
  expect(tree.root.findAllByType(BaitlyField)[0].props.value).toBe('Toufik');
  expect(tree.root.findByType(BaitlyNotice).props.error).toBe(true);
  expect(mockLoadUser).not.toHaveBeenCalled();
});
