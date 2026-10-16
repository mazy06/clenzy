import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BaitlyButton, BaitlyField } from '@/design-system/components';
import { CreateRequestScreen } from '../CreateRequestScreen';
import { marketplaceApi } from '../api';

const renderer = require('react-test-renderer');
const { act } = renderer;
const navigation = { replace: jest.fn(), navigate: jest.fn(), dispatch: jest.fn() };
jest.mock('@react-navigation/native', () => ({ usePreventRemove: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr', dir: () => 'ltr' } }) }));
jest.mock('@/hooks/useNetworkStatus', () => ({ useNetworkStatus: () => ({ isConnected: true }) }));
jest.mock('@/store/settingsStore', () => ({ useSettingsStore: (select: (state: unknown) => unknown) => select({ themeMode: 'light' }) }));
jest.mock('@/design-system/components', () => {
  const React = require('react');
  const component = (name: string) => (props: any) => React.createElement(name, props, props.children);
  // The screen's footer holds its actions: render it like the real BaitlyScreen does.
  const screen = (props: any) => React.createElement('BaitlyScreen', props, props.children, props.footer);
  return { ...Object.fromEntries(['BaitlyButton', 'BaitlyField', 'BaitlyEmpty', 'BaitlyLoading', 'BaitlyNotice', 'BaitlyText'].map(name => [name, component(name)])), BaitlyScreen: screen };
});
jest.mock('../queries', () => ({
  useBaitlyScope: () => ['baitly-mobile-v1', 'a', 1],
  useProvider: () => ({ data: { displayName: 'Provider', offers: [{ id: 1, label: 'Service', active: true, categoryCode: 'OTHER', serviceItemCode: 'remote' }] } }),
  useCategories: () => ({ data: [{ items: [{ code: 'remote', propertyRequired: false, slotRequired: false }] }] }),
  useBaitlyProperties: () => ({ data: { pages: [{ content: [] }] } }),
}));
jest.mock('../api', () => ({ marketplaceApi: { create: jest.fn() } }));
jest.mock('@/design-system/primitives', () => {
  const React = require('react');
  const component = (name: string) => (props: any) => React.createElement(name, props, props.children);
  return Object.fromEntries(['BaitlyCard', 'BaitlyChoices', 'BaitlyInfoRow'].map(name => [name, component(name)]));
});
let tree: any;
let client: QueryClient;
function button(title: string) {
  return tree.root.findAllByType(BaitlyButton).find((node: any) => node.props.title === title);
}
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); }
async function openReview() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: 1, gcTime: Infinity } } });
  await act(async () => {
    tree = renderer.create(<QueryClientProvider client={client}><CreateRequestScreen
      navigation={navigation as any} route={{ params: { providerId: 2 } } as any} /></QueryClientProvider>);
  });
  await act(async () => tree.root.findAll((node: any) => node.props.label === 'requestWhatService' && node.props.onChange)[0].props.onChange(1));
  await act(async () => tree.root.findAllByType(BaitlyField).find((node: any) => node.props.label === 'requestTitle').props.onChangeText('A request'));
  await act(async () => button('reviewRequest').props.onPress());
}
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  tree = null; client?.clear(); jest.clearAllMocks();
});

it('sends one request on a double tap and opens the confirmed server result', async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(marketplaceApi.create).mockReturnValueOnce(new Promise(done => { resolve = done; }) as any);
  await openReview();
  const send = button('sendRequest');
  await act(async () => { send.props.onPress(); send.props.onPress(); });
  expect(marketplaceApi.create).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ id: 9 })); await settle();
  expect(navigation.replace).toHaveBeenCalledWith('Quote', { requestId: 9, side: 'sent' });
});
it('does not retry an uncertain creation even when global mutations default to retry', async () => {
  jest.mocked(marketplaceApi.create).mockRejectedValueOnce(new Error('Network interrupted'));
  await openReview();
  await act(async () => button('sendRequest').props.onPress()); await settle();
  expect(marketplaceApi.create).toHaveBeenCalledTimes(1);
  expect(button('sendRequest').props.disabled).toBe(true);
  await act(async () => button('sendRequest').props.onPress());
  expect(marketplaceApi.create).toHaveBeenCalledTimes(1);
  expect(navigation.replace).not.toHaveBeenCalled();
  await act(async () => button('checkSent').props.onPress());
  expect(navigation.navigate).toHaveBeenCalledWith('SentRequests');
});
