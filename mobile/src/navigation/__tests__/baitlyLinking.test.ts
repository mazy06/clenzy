import { Linking } from 'react-native';
import { getStateFromPath } from '@react-navigation/native';
import { getMobileLinkingConfig } from '../linking';

it.each([true, false])('opens a mandate signature without losing its token (guest=%s)', guest => {
  const token = '11111111-2222-3333-4444-555555555555';
  const state = getStateFromPath(`sign/${token}`, getMobileLinkingConfig(true, guest).config);
  const route = guest ? state!.routes[0].state!.routes[0] : state!.routes[0].state!.routes[0].state!.routes[0];
  expect(route).toMatchObject({ name: 'MandateSignature', params: { token } });
});

it('opens a public provider inside the guest marketplace', () => {
  const state = getStateFromPath('marketplace/providers/42', getMobileLinkingConfig(true, true).config);
  expect(state!.routes[0].name).toBe('Auth');
  expect(state!.routes[0].state!.routes[0]).toMatchObject({ name: 'Provider', params: { providerId: 42 } });
});

it('resolves the nested marketplace route to a numeric provider ID', () => {
  const state = getStateFromPath('marketplace/providers/42', getMobileLinkingConfig(true).config);
  const main = state!.routes[0];
  const tabs = main.state!.routes[0];
  const provider = tabs.state!.routes[0];
  expect(main.name).toBe('Main');
  expect(tabs.name).toBe('Tabs');
  expect(provider.name).toBe('Provider');
  expect(provider.params).toMatchObject({ providerId: 42 });
});
it('bounds the side parameter on a linked quote', () => {
  const state = getStateFromPath('quote-requests/7?side=attacker', getMobileLinkingConfig(true).config);
  expect(state!.routes[0].state!.routes[0].state!.routes[0].params).toMatchObject({ requestId: 7, side: 'sent' });
});

it('keeps the OAuth callback out of navigation history', async () => {
  const spy = jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('clenzy://auth/callback?code=secret-code&state=state');
  expect(await getMobileLinkingConfig(true).getInitialURL!()).toBeNull();
  spy.mockRestore();
});
