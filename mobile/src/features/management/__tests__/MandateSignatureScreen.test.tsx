import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { BaitlyButton, BaitlyField } from '@/design-system/components';
import { MandateSignatureScreen } from '../MandateScreens';
import { managementApi } from '../api';

const renderer = require('react-test-renderer');
const { act } = renderer;
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }));
jest.mock('@/design-system/theme', () => ({ useBaitlyTheme: () => ({}) }));
jest.mock('@/features/marketplace/queries', () => ({ useBaitlyScope: () => ['baitly-mobile-v1', 'owner', 7] }));
jest.mock('../api', () => ({ isSignatureToken: (token: string) => token.startsWith('valid'), managementApi: { view: jest.fn(), sign: jest.fn(), documentUrl: () => 'https://api.example/mandate.pdf' } }));
jest.mock('@/design-system/components', () => {
  const React = require('react');
  const component = (name: string) => (props: any) => React.createElement(name, props, props.children);
  return Object.fromEntries(['BaitlyButton', 'BaitlyField', 'BaitlyEmpty', 'BaitlyLoading', 'BaitlyNotice', 'BaitlyRow', 'BaitlyScreen', 'BaitlyText'].map(name => [name, component(name)]));
});
const pending = { status: 'PENDING', documentAvailable: true, consentText: 'Server consent', propertyName: 'Home', commissionRate: .2 } as any;
let tree: any; let client: QueryClient;
function button(title: string) { return tree.root.findAllByType(BaitlyButton).find((n: any) => n.props.title === title); }
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); }); }
async function mount(token = 'valid') {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: 1 } } });
  await act(async () => { tree = renderer.create(<QueryClientProvider client={client}><MandateSignatureScreen route={{ params: { token } } as any} navigation={{} as any} /></QueryClientProvider>); });
  await settle();
}
async function ready() {
  await act(async () => button('readMandate').props.onPress()); await settle();
  await act(async () => tree.root.findByType(BaitlyField).props.onChangeText('Owner Name'));
  await act(async () => tree.root.findAllByProps({ testID: 'mandate-consent' })[0].props.onPress());
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  jest.mocked(managementApi.view).mockResolvedValue(pending);
  jest.mocked(WebBrowser.openBrowserAsync).mockResolvedValue({ type: 'dismiss' } as any);
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); tree = null; client?.clear(); jest.resetAllMocks(); });
it('requires opening the PDF, a name and the server consent before signing', async () => {
  await mount(); expect(button('signMandate').props.disabled).toBe(true);
  expect(tree.root.findAllByProps({ testID: 'mandate-consent' })[0].props.accessibilityLabel).toBe('Server consent');
  await ready(); expect(button('signMandate').props.disabled).toBe(false);
});
it('sends exactly one signature on a double tap and displays only the confirmed result', async () => {
  let resolve!: (value: any) => void;
  jest.mocked(managementApi.sign).mockReturnValue(new Promise(done => { resolve = done; }));
  await mount(); await ready(); const send = button('signMandate');
  await act(async () => { send.props.onPress(); send.props.onPress(); });
  expect(managementApi.sign).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ ...pending, status: 'SIGNED' })); await settle();
  expect(button('signMandate')).toBeUndefined(); expect(button('readSignedMandate')).toBeDefined();
});
it('does not retry an uncertain signature and resets consent after checking its status', async () => {
  jest.mocked(managementApi.sign).mockRejectedValue(new Error('Interrupted'));
  await mount(); await ready(); await act(async () => button('signMandate').props.onPress()); await settle();
  expect(managementApi.sign).toHaveBeenCalledTimes(1); expect(button('signMandate').props.disabled).toBe(true);
  await act(async () => button('checkSignature').props.onPress()); await settle();
  expect(button('signMandate').props.disabled).toBe(true);
  expect(tree.root.findAllByProps({ testID: 'mandate-consent' })[0].props.accessibilityState.checked).toBe(false);
});
it('rejects malformed links without any server request', async () => {
  await mount('invalid'); expect(managementApi.view).not.toHaveBeenCalled(); expect(button('signMandate')).toBeUndefined();
});
it.each(['SIGNED','CANCELLED','EXPIRED'])('never offers signature for %s', async status => {
  jest.mocked(managementApi.view).mockResolvedValue({ ...pending, status });
  await mount(); expect(button('signMandate')).toBeUndefined();
});
it('does not carry a name, PDF opening or consent over to a different mandate', async () => {
  await mount(); await ready(); expect(button('signMandate').props.disabled).toBe(false);
  await act(async () => tree.update(<QueryClientProvider client={client}><MandateSignatureScreen
    route={{ params: { token: 'valid-second' } } as any} navigation={{} as any} /></QueryClientProvider>));
  await settle();
  expect(tree.root.findByType(BaitlyField).props.value).toBe('');
  expect(tree.root.findAllByProps({ testID: 'mandate-consent' })[0].props.accessibilityState.checked).toBe(false);
  expect(button('signMandate').props.disabled).toBe(true);
});
